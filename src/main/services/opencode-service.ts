/**
 * OpenCode Service
 *
 * Manages OpenCode CLI sidecar for agentic code tasks.
 * Uses node-pty for proper terminal emulation (like the reference implementation).
 * Integrates with the job system and IPC event bus.
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import * as pty from 'node-pty'
import * as fs from 'fs'
import * as path from 'path'
import {
  JobStatus,
  OpenCodeState,
  OpenCodeRunTaskRequest,
  OpenCodeTaskResult,
  OpenCodeStateResponse,
  OpenCodeDetectResponse,
  createEvent,
  EventTypes,
  OpenCodeStartedPayload,
  OpenCodeOutputPayload,
  OpenCodePermissionRequestPayload,
  OpenCodeCompletedPayload,
  OpenCodeFailedPayload,
  OpenCodeCancelledPayload,
} from '../../../packages/contracts/src'
import { app } from 'electron'
import { settingsService } from './settings-service'
import { secretsService } from './secrets-service'

const execAsync = promisify(exec)

// ============================================================================
// Types
// ============================================================================

interface OpenCodeTaskRequest {
  prompt: string
  context?: string
  cwd?: string
}

interface OutputChunk {
  type: 'stdout' | 'stderr'
  data: string
  timestamp: number
}

interface DetectionResult {
  installed: boolean
  binaryPath?: string
  version?: string
  error?: string
}

export interface OpenCodeJob {
  id: string
  status: JobStatus
  prompt: string
  context?: string
  cwd?: string
  output: string
  result?: OpenCodeTaskResult
  error?: string
  createdAt: number
  updatedAt: number
}

// ============================================================================
// Detection Utilities
// ============================================================================

function commandExists(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return result || null
  } catch {
    return null
  }
}

async function getVersion(binaryPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`"${binaryPath}" --version`, {
      timeout: 5000,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function detectOpenCode(): Promise<DetectionResult> {
  const binaryNames = ['opencode', 'oc']

  for (const name of binaryNames) {
    const path = commandExists(name)
    if (path) {
      const version = await getVersion(path)
      return {
        installed: true,
        binaryPath: path,
        version: version ?? undefined,
      }
    }
  }

  const commonPaths = [
    '/usr/local/bin/opencode',
    '/opt/homebrew/bin/opencode',
    `${process.env.HOME}/.local/bin/opencode`,
    `${process.env.HOME}/.npm-global/bin/opencode`,
  ]

  for (const path of commonPaths) {
    try {
      execSync(`test -x "${path}"`, { stdio: 'pipe' })
      const version = await getVersion(path)
      return {
        installed: true,
        binaryPath: path,
        version: version ?? undefined,
      }
    } catch {
      // Path doesn't exist
    }
  }

  return {
    installed: false,
    error: 'OpenCode CLI not found. Install it with: npm install -g opencode',
  }
}

function detectOpenCodeSync(): DetectionResult {
  const binaryNames = ['opencode', 'oc']

  for (const name of binaryNames) {
    const path = commandExists(name)
    if (path) {
      return { installed: true, binaryPath: path }
    }
  }

  return {
    installed: false,
    error: 'OpenCode CLI not found. Install it with: npm install -g opencode',
  }
}

function getInstallationInstructions(): string {
  return `
OpenCode CLI is not installed.

Installation options:

1. Using npm (recommended):
   npm install -g opencode

2. Using Homebrew (macOS):
   brew install opencode

3. Manual installation:
   Visit https://opencode.ai for download links

After installation, restart ClipMorph or run a new voice command.
`.trim()
}

// ============================================================================
// OpenCode Sidecar (using node-pty for proper terminal emulation)
// ============================================================================

type SidecarState = 'stopped' | 'ready' | 'busy' | 'error'

class OpenCodeSidecar extends EventEmitter {
  private state: SidecarState = 'ready'
  private ptyProcess: pty.IPty | null = null
  private outputBuffer: string = ''
  private taskTimeout: NodeJS.Timeout | null = null
  private binaryPath: string
  private timeout: number
  private shell: string

  constructor(config: { binaryPath?: string; timeout?: number } = {}) {
    super()
    const detection = detectOpenCodeSync()
    this.binaryPath = config.binaryPath || detection.binaryPath || 'opencode'
    this.timeout = config.timeout || 120000 // 2 minutes
    // Use the user's shell or default to bash
    this.shell = process.env.SHELL || '/bin/bash'
  }

  getState(): SidecarState {
    return this.state
  }

  isReady(): boolean {
    return this.state === 'ready'
  }

  isBusy(): boolean {
    return this.state === 'busy'
  }

  async runTask(request: OpenCodeTaskRequest): Promise<OpenCodeTaskResult> {
    if (this.state === 'busy') {
      throw new Error('Sidecar is busy with another task')
    }

    const detection = detectOpenCodeSync()
    if (!detection.installed) {
      const error = new Error(getInstallationInstructions())
      ;(error as Error & { code: string }).code = 'OPENCODE_NOT_INSTALLED'
      throw error
    }

    this.state = 'busy'
    this.emit('state', this.state)
    this.outputBuffer = ''

    const startTime = Date.now()
    console.log('[OpenCode Sidecar] runTask called with prompt:', request.prompt.slice(0, 100))

    // Get provider setting for auth configuration
    const selectedProvider = (settingsService.get('opencode.provider') as string) || 'anthropic'
    console.log('[OpenCode Sidecar] Provider for auth:', selectedProvider)

    // Configure OpenCode authentication by writing API key to auth.json BEFORE spawning
    const opencodeConfigDir = path.join(app.getPath('userData'), 'opencode-config')
    console.log('[OpenCode Sidecar] Configuring auth in:', opencodeConfigDir)
    
    try {
      await this.configureOpenCodeAuth(opencodeConfigDir, selectedProvider)
      console.log('[OpenCode Sidecar] Auth configured successfully')
    } catch (authError) {
      console.error('[OpenCode Sidecar] Auth configuration failed:', authError)
      // Continue anyway - OpenCode might have its own auth
    }

    return new Promise((resolve, reject) => {
      this.taskTimeout = setTimeout(() => {
        this.cancelTask()
        reject(new Error(`Task timeout after ${this.timeout}ms`))
      }, this.timeout)

      try {
        // Build the command - escape the prompt for shell
        const escapedPrompt = request.prompt.replace(/'/g, "'\\''")
        let command = `'${escapedPrompt}'`
        if (request.context) {
          const escapedContext = request.context.replace(/'/g, "'\\''")
          command += ` --context '${escapedContext}'`
        }

        // Spawn PTY process for proper terminal emulation
        // This handles interactive prompts, ANSI codes, and terminal sizing
        // Note: node-pty is a native module that may crash if not rebuilt for Electron
        // Run: npx electron-rebuild -f -w node-pty

        // Build args - use "run" subcommand for non-interactive execution
        // Format: opencode run "prompt message"
        const args = ['run', request.prompt]

        // Add model selection from settings
        // OpenCode uses its own model format: opencode/model-name
        // Available models: opencode/big-pickle, opencode/glm-4.7-free, opencode/gpt-5-nano, etc.
        const opencodeModel = settingsService.get('opencode.model') as string | undefined
        if (opencodeModel && opencodeModel.startsWith('opencode/')) {
          // Only use model flag if it's in OpenCode format
          args.push('--model', opencodeModel)
          console.log('[OpenCode] Using model:', opencodeModel)
        } else {
          // Let OpenCode use its default model
          console.log('[OpenCode] Using default model (settings model not compatible:', opencodeModel, ')')
        }

        // Check if user wants auto-approve mode (dangerous but fully agentic)
        // TODO: Make this configurable in settings
        const autoApprove = process.env.OPENCODE_AUTO_APPROVE === 'true'
        if (autoApprove) {
          args.push('--yes') // Auto-approve all operations
        }

        console.log('[OpenCode] ========== SPAWNING OPENCODE ==========')
        console.log('[OpenCode] Binary:', this.binaryPath)
        console.log('[OpenCode] Args:', JSON.stringify(args))
        console.log('[OpenCode] Working directory:', request.cwd || process.cwd())
        console.log('[OpenCode] Config dir:', opencodeConfigDir)
        
        // Verify binary exists
        if (!fs.existsSync(this.binaryPath)) {
          throw new Error(`OpenCode binary not found at: ${this.binaryPath}`)
        }
        console.log('[OpenCode] Binary exists, spawning PTY...')
        
        this.ptyProcess = pty.spawn(this.binaryPath, args, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: request.cwd || process.cwd(),
          env: {
            ...process.env,
            // Don't set CI=true - we want interactive mode for permission handling
            NO_COLOR: '1', // Disable ANSI colors for cleaner output
            TERM: 'xterm-256color',
            // Override OpenCode's config directory to avoid ~/.config permission issues
            XDG_CONFIG_HOME: opencodeConfigDir,
            OPENCODE_CONFIG_DIR: opencodeConfigDir,
          } as Record<string, string>,
        })

        console.log('[OpenCode] PTY process spawned with PID:', this.ptyProcess.pid)

        // Handle PTY data (combined stdout/stderr in PTY)
        this.ptyProcess.onData((data: string) => {
          this.outputBuffer += data
          
          // Log OpenCode output for debugging (including raw for visibility)
          const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '').trim() // Strip ANSI codes
          if (cleanData) {
            console.log('[OpenCode OUTPUT]', cleanData)
          } else if (data.trim()) {
            // Log raw if only ANSI codes
            console.log('[OpenCode RAW]', JSON.stringify(data.slice(0, 200)))
          }

          const chunk: OutputChunk = {
            type: 'stdout', // PTY combines stdout/stderr
            data,
            timestamp: Date.now(),
          }
          this.emit('output', chunk)
          
          // Check for permission/access errors
          const accessError = this.detectAccessError(data)
          if (accessError) {
            this.emit('accessError', accessError)
          }
          
          // Check for permission prompts in the output
          const permissionRequest = this.detectPermissionPrompt(this.outputBuffer)
          if (permissionRequest) {
            this.emit('permissionRequest', permissionRequest)
          }
        })

        // Handle PTY exit
        this.ptyProcess.onExit(({ exitCode, signal }) => {
          this.clearTaskTimeout()

          const durationMs = Date.now() - startTime
          const success = exitCode === 0
          
          console.log('[OpenCode] ========== PROCESS EXITED ==========')
          console.log(`[OpenCode] Exit code: ${exitCode}, Signal: ${signal}, Duration: ${durationMs}ms`)
          console.log('[OpenCode] Total output length:', this.outputBuffer.length)
          if (!success && this.outputBuffer) {
            console.log('[OpenCode] Last 500 chars of output:', this.outputBuffer.slice(-500))
          }

          const result: OpenCodeTaskResult = {
            success,
            output: this.outputBuffer,
            exitCode,
            durationMs,
            error: success ? undefined : `Process exited with code ${exitCode}`,
          }

          this.emit('taskCompleted', result)
          this.emit('exit', { code: exitCode, signal })

          this.cleanup()
          this.state = 'ready'
          this.emit('state', this.state)

          resolve(result)
        })

        this.emit('taskStarted', request)
      } catch (error) {
        this.clearTaskTimeout()
        this.cleanup()
        this.state = 'error'
        this.emit('state', this.state)
        this.emit('error', error)
        reject(error)
      }
    })
  }

  /**
   * Write input to the PTY (for handling interactive prompts)
   */
  write(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data)
    }
  }

  /**
   * Resize the PTY terminal
   */
  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows)
    }
  }

  cancelTask(): void {
    if (this.ptyProcess) {
      this.clearTaskTimeout()
      // Send SIGTERM first, then SIGKILL if needed
      this.ptyProcess.kill('SIGTERM')
      setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.kill('SIGKILL')
        }
      }, 500)
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') return
    this.cancelTask()
    this.cleanup()
    this.state = 'stopped'
    this.emit('state', this.state)
  }

  private clearTaskTimeout(): void {
    if (this.taskTimeout) {
      clearTimeout(this.taskTimeout)
      this.taskTimeout = null
    }
  }

  private cleanup(): void {
    this.clearTaskTimeout()
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill()
      } catch {
        // Ignore - process may already be dead
      }
      this.ptyProcess = null
    }
    this.outputBuffer = ''
    this.lastPermissionPrompt = ''
  }

  private lastPermissionPrompt = ''

  /**
   * Configure OpenCode authentication by writing API key to auth.json
   * Maps provider names to OpenCode's expected format
   */
  private async configureOpenCodeAuth(configDir: string, provider: string): Promise<void> {
    try {
      // Map ClipMorph provider names to OpenCode provider names
      const providerMap: Record<string, string> = {
        'anthropic': 'anthropic',
        'openai': 'openai',
        'google': 'google',
        'xai': 'x-ai',
        'zai': 'z-ai'
      }

      const opencodeProvider = providerMap[provider] || provider

      // Get the API key from secrets service
      const secretKey = `${provider}-api-key` as any
      const apiKey = await secretsService.getSecret(secretKey)

      if (!apiKey) {
        console.warn(`[OpenCode] No API key found for provider: ${provider}`)
        return
      }

      // Ensure config directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      // OpenCode expects auth.json at ~/.local/share/opencode/auth.json
      // But we're using a custom config dir, so we create it there
      const authFilePath = path.join(configDir, 'auth.json')

      // Read existing auth.json or create new one
      let authData: Record<string, any> = {}
      if (fs.existsSync(authFilePath)) {
        try {
          const content = fs.readFileSync(authFilePath, 'utf-8')
          authData = JSON.parse(content)
        } catch (err) {
          console.warn('[OpenCode] Failed to parse existing auth.json, creating new one')
        }
      }

      // Update the provider's API key
      authData[opencodeProvider] = {
        apiKey: apiKey
      }

      // Write updated auth.json
      fs.writeFileSync(authFilePath, JSON.stringify(authData, null, 2), 'utf-8')
      console.log(`[OpenCode] Configured API key for provider: ${opencodeProvider}`)

    } catch (err) {
      console.error('[OpenCode] Failed to configure authentication:', err)
      // Don't throw - let OpenCode handle missing auth
    }
  }

  /**
   * Detect permission prompts in OpenCode output
   * Returns parsed permission request or null if not a permission prompt
   */
  private detectPermissionPrompt(output: string): PermissionRequest | null {
    // Common patterns for permission prompts in OpenCode/agentic CLIs
    // These patterns match various CLI tool permission requests
    const patterns = [
      // File operations: "Create file src/utils/helper.ts? [y/n]"
      /(?:Create|Write|Overwrite|Delete|Remove|Modify|Edit|Update)\s+(?:file\s+)?['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Directory operations: "Create directory src/components? [y/n]"
      /(?:Create|Delete|Remove)\s+(?:directory|folder|dir)\s+['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Shell commands: "Run command: npm install? [y/n]"
      /(?:Run|Execute)\s+(?:command|shell)?\s*:?\s*['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Generic: "Allow X? [y/n]" or "Proceed with X? [y/n]"
      /(?:Allow|Proceed with|Confirm|Approve)\s+['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // OpenCode specific: "Tool call: write_file(...)" followed by approval prompt
      /Tool\s+(?:call|request):\s*(\w+)\s*\([^)]*\)[^\[]*\[([yYnN]\/[yYnN])\]/i,
      // Simple y/n at end of line with context
      /([^\n]{10,})\s*\[([yYnN]\/[yYnN])\]\s*$/i,
    ]

    // Get the last few lines of output (permission prompts are usually at the end)
    const lines = output.split('\n')
    const recentOutput = lines.slice(-10).join('\n')

    // Don't re-emit the same prompt
    if (this.lastPermissionPrompt && recentOutput.includes(this.lastPermissionPrompt)) {
      return null
    }

    for (const pattern of patterns) {
      const match = recentOutput.match(pattern)
      if (match) {
        const action = match[1]?.trim() || 'Unknown action'
        
        // Determine the type of permission
        let type: 'file_write' | 'file_delete' | 'shell_command' | 'other' = 'other'
        const lowerOutput = recentOutput.toLowerCase()
        if (lowerOutput.includes('create') || lowerOutput.includes('write') || lowerOutput.includes('modify')) {
          type = 'file_write'
        } else if (lowerOutput.includes('delete') || lowerOutput.includes('remove')) {
          type = 'file_delete'
        } else if (lowerOutput.includes('run') || lowerOutput.includes('execute') || lowerOutput.includes('command')) {
          type = 'shell_command'
        }

        this.lastPermissionPrompt = action
        
        return {
          type,
          action,
          context: recentOutput.trim(),
          timestamp: Date.now(),
        }
      }
    }

    return null
  }

  /**
   * Detect access/permission errors in OpenCode output
   */
  private detectAccessError(output: string): AccessError | null {
    // Permission denied errors
    if (output.includes('EACCES') || output.includes('EPERM') || output.includes('permission denied') || output.includes('operation not permitted')) {
      // Check for specific config directory issue
      if (output.includes('.config/opencode') || output.includes('.config')) {
        return {
          type: 'permission_denied',
          message: 'Cannot access ~/.config directory (owned by root)',
          fix: 'Open Terminal and run: sudo chown -R $(whoami) ~/.config',
        }
      }
      return {
        type: 'permission_denied',
        message: 'Permission denied',
        fix: 'Check file/directory permissions',
      }
    }

    // API key errors
    if (output.includes('API key') || output.includes('ANTHROPIC_API_KEY') || 
        output.includes('OPENAI_API_KEY') || output.includes('unauthorized') ||
        output.includes('401')) {
      return {
        type: 'api_key_missing',
        message: 'OpenCode API key not configured',
        fix: 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable, or configure in OpenCode settings',
      }
    }

    // Not configured
    if (output.includes('not configured') || output.includes('missing configuration')) {
      return {
        type: 'not_configured',
        message: 'OpenCode is not configured',
        fix: 'Run "opencode" in terminal to complete setup',
      }
    }

    return null
  }
}

export interface PermissionRequest {
  type: 'file_write' | 'file_delete' | 'shell_command' | 'other'
  action: string
  context: string
  timestamp: number
}

export interface AccessError {
  type: 'permission_denied' | 'not_configured' | 'api_key_missing' | 'other'
  message: string
  fix?: string
}

// ============================================================================
// OpenCode Service
// ============================================================================

export class OpenCodeService extends EventEmitter {
  private sidecar: OpenCodeSidecar
  private activeJob: OpenCodeJob | null = null
  private recentJobs: OpenCodeJob[] = []
  private maxRecentJobs = 10

  constructor() {
    super()
    this.sidecar = new OpenCodeSidecar()
    this.setupSidecarListeners()
  }

  private setupSidecarListeners(): void {
    this.sidecar.on('output', (chunk: OutputChunk) => {
      if (this.activeJob) {
        this.activeJob.output += chunk.data
        this.activeJob.updatedAt = Date.now()

        const payload: OpenCodeOutputPayload = {
          jobId: this.activeJob.id,
          chunk: {
            ...chunk,
            jobId: this.activeJob.id,
          },
        }
        // Emit to renderer
        this.emit('event', createEvent(EventTypes.OPENCODE_OUTPUT, payload, this.activeJob.id))
        console.log('[OpenCodeService] Emitted OPENCODE_OUTPUT event, chunk size:', chunk.data.length)
      }
    })

    // Handle permission requests from OpenCode
    this.sidecar.on('permissionRequest', (request: PermissionRequest) => {
      if (this.activeJob) {
        console.log('[OpenCodeService] Permission request detected:', request)
        const payload: OpenCodePermissionRequestPayload = {
          jobId: this.activeJob.id,
          type: request.type,
          action: request.action,
          context: request.context,
        }
        this.emit('event', createEvent(EventTypes.OPENCODE_PERMISSION_REQUEST, payload, this.activeJob.id))
      }
    })

    // Handle access errors from OpenCode
    this.sidecar.on('accessError', (error: AccessError) => {
      console.log('[OpenCodeService] Access error detected:', error)
      if (this.activeJob) {
        // Emit as a failed event with detailed error info
        const payload: OpenCodeFailedPayload = {
          jobId: this.activeJob.id,
          error: `${error.message}${error.fix ? `\n\nFix: ${error.fix}` : ''}`,
        }
        this.emit('event', createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id))
        
        // Also emit a special access error event for UI handling
        this.emit('event', createEvent('opencode-access-error' as any, {
          jobId: this.activeJob.id,
          type: error.type,
          message: error.message,
          fix: error.fix,
        }, this.activeJob.id))
      }
    })

    this.sidecar.on('taskCompleted', (result: OpenCodeTaskResult) => {
      if (this.activeJob) {
        this.activeJob.result = result
        this.activeJob.status = result.success ? 'completed' : 'failed'
        this.activeJob.error = result.error
        this.activeJob.updatedAt = Date.now()

        if (result.success) {
          const payload: OpenCodeCompletedPayload = {
            jobId: this.activeJob.id,
            result,
          }
          this.emit(
            'event',
            createEvent(EventTypes.OPENCODE_COMPLETED, payload, this.activeJob.id)
          )
        } else {
          const payload: OpenCodeFailedPayload = {
            jobId: this.activeJob.id,
            error: result.error || 'Task failed',
          }
          this.emit('event', createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id))
        }

        this.archiveJob(this.activeJob)
        this.activeJob = null
      }
    })

    this.sidecar.on('error', (error: Error) => {
      if (this.activeJob) {
        this.activeJob.status = 'failed'
        this.activeJob.error = error.message
        this.activeJob.updatedAt = Date.now()

        const payload: OpenCodeFailedPayload = {
          jobId: this.activeJob.id,
          error: error.message,
        }
        this.emit('event', createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id))

        this.archiveJob(this.activeJob)
        this.activeJob = null
      }
    })
  }

  private archiveJob(job: OpenCodeJob): void {
    this.recentJobs.unshift(job)
    if (this.recentJobs.length > this.maxRecentJobs) {
      this.recentJobs.pop()
    }
  }

  async getState(): Promise<OpenCodeStateResponse> {
    const detection = await detectOpenCode()
    const sidecarState = this.sidecar.getState()

    let state: OpenCodeState
    switch (sidecarState) {
      case 'stopped':
        state = 'stopped'
        break
      case 'ready':
        state = 'ready'
        break
      case 'busy':
        state = 'busy'
        break
      case 'error':
        state = 'error'
        break
      default:
        state = 'stopped'
    }

    return {
      state,
      installed: detection.installed,
      binaryPath: detection.binaryPath,
      version: detection.version,
      activeJobId: this.activeJob?.id,
      installInstructions: detection.installed ? undefined : getInstallationInstructions(),
    }
  }

  async detect(): Promise<OpenCodeDetectResponse> {
    const detection = await detectOpenCode()
    return {
      ...detection,
      installInstructions: getInstallationInstructions(),
    }
  }

  async runTask(request: OpenCodeRunTaskRequest): Promise<{ jobId: string; started: boolean }> {
    if (this.activeJob) {
      throw new Error('OpenCode is busy with another task')
    }

    const detection = await detectOpenCode()
    if (!detection.installed) {
      const error = new Error(getInstallationInstructions())
      ;(error as Error & { code: string }).code = 'OPENCODE_NOT_INSTALLED'
      throw error
    }

    const job: OpenCodeJob = {
      id: randomUUID(),
      status: 'pending',
      prompt: request.prompt,
      context: request.context,
      cwd: request.cwd,
      output: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.activeJob = job

    const startPayload: OpenCodeStartedPayload = {
      jobId: job.id,
      prompt: request.prompt,
    }
    this.emit('event', createEvent(EventTypes.OPENCODE_STARTED, startPayload, job.id))

    job.status = 'running'
    job.updatedAt = Date.now()

    const taskRequest: OpenCodeTaskRequest = {
      prompt: request.prompt,
      context: request.context,
      cwd: request.cwd,
    }

    // Run task in background
    console.log('[OpenCodeService] Starting sidecar.runTask...')
    this.sidecar.runTask(taskRequest).then((result) => {
      console.log('[OpenCodeService] Sidecar task completed:', result.success ? 'success' : 'failed')
    }).catch((error) => {
      console.error('[OpenCodeService] Sidecar task error:', error.message)
      if (this.activeJob && this.activeJob.id === job.id) {
        this.activeJob.status = 'failed'
        this.activeJob.error = error.message
        this.activeJob.updatedAt = Date.now()

        const payload: OpenCodeFailedPayload = {
          jobId: job.id,
          error: error.message,
        }
        this.emit('event', createEvent(EventTypes.OPENCODE_FAILED, payload, job.id))

        this.archiveJob(this.activeJob)
        this.activeJob = null
      }
    })

    return { jobId: job.id, started: true }
  }

  /**
   * Write input to the active task (for handling permission prompts)
   */
  writeInput(input: string): void {
    this.sidecar.write(input)
  }

  /**
   * Respond to a permission request from OpenCode
   */
  respondToPermission(allow: boolean): void {
    // Send 'y' or 'n' to the PTY for permission prompts
    this.sidecar.write(allow ? 'y\n' : 'n\n')
  }

  cancel(): { cancelled: boolean; jobId?: string } {
    if (!this.activeJob) {
      return { cancelled: false }
    }

    const jobId = this.activeJob.id
    this.activeJob.status = 'cancelled'
    this.activeJob.updatedAt = Date.now()

    this.sidecar.cancelTask()

    const payload: OpenCodeCancelledPayload = { jobId }
    this.emit('event', createEvent(EventTypes.OPENCODE_CANCELLED, payload, jobId))

    this.archiveJob(this.activeJob)
    this.activeJob = null

    return { cancelled: true, jobId }
  }

  getActiveJob(): OpenCodeJob | null {
    return this.activeJob
  }

  getRecentJobs(): OpenCodeJob[] {
    return [...this.recentJobs]
  }

  async dispose(): Promise<void> {
    await this.sidecar.stop()
  }
}

// Singleton
let serviceInstance: OpenCodeService | null = null

export function getOpenCodeService(): OpenCodeService {
  if (!serviceInstance) {
    serviceInstance = new OpenCodeService()
  }
  return serviceInstance
}

export function resetOpenCodeService(): void {
  if (serviceInstance) {
    serviceInstance.dispose()
    serviceInstance = null
  }
}
