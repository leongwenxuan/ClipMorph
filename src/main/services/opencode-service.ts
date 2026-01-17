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
  OpenCodeCompletedPayload,
  OpenCodeFailedPayload,
  OpenCodeCancelledPayload,
} from '../../../packages/contracts/src'

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
        this.ptyProcess = pty.spawn(this.binaryPath, [request.prompt], {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: request.cwd || process.cwd(),
          env: {
            ...process.env,
            CI: 'true', // Disable interactive prompts
            NO_COLOR: '1', // Disable ANSI colors for cleaner output
            TERM: 'xterm-256color',
          } as Record<string, string>,
        })

        // Handle PTY data (combined stdout/stderr in PTY)
        this.ptyProcess.onData((data: string) => {
          this.outputBuffer += data

          const chunk: OutputChunk = {
            type: 'stdout', // PTY combines stdout/stderr
            data,
            timestamp: Date.now(),
          }
          this.emit('output', chunk)
        })

        // Handle PTY exit
        this.ptyProcess.onExit(({ exitCode, signal }) => {
          this.clearTaskTimeout()

          const durationMs = Date.now() - startTime
          const success = exitCode === 0

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
  }
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
        this.emit('event', createEvent(EventTypes.OPENCODE_OUTPUT, payload, this.activeJob.id))
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
    this.sidecar.runTask(taskRequest).catch((error) => {
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
