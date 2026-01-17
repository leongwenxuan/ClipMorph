/**
 * OpenCode Sidecar
 *
 * Manages OpenCode CLI as a subprocess using node-pty for proper TTY support.
 * Provides spawn/stop/restart lifecycle management and stdout/stderr streaming.
 */

import { EventEmitter } from 'events'
import type { IPty } from 'node-pty'
import {
  SidecarState,
  OpenCodeConfig,
  OpenCodeTaskRequest,
  OpenCodeTaskResult,
  OutputChunk,
  SidecarEvents,
} from './types'
import { detectOpenCodeSync, getInstallationInstructions } from './detector'

const DEFAULT_TIMEOUT = 120000 // 2 minutes
const STARTUP_TIMEOUT = 10000 // 10 seconds

export class OpenCodeSidecar extends EventEmitter {
  private config: Required<OpenCodeConfig>
  private pty: IPty | null = null
  private state: SidecarState = 'stopped'
  private outputBuffer: string = ''
  private currentTask: OpenCodeTaskRequest | null = null
  private taskStartTime: number = 0
  private taskTimeout: NodeJS.Timeout | null = null

  constructor(config: OpenCodeConfig = {}) {
    super()

    // Detect OpenCode binary
    const detection = detectOpenCodeSync()
    const binaryPath = config.binaryPath || detection.binaryPath || 'opencode'

    this.config = {
      binaryPath,
      cwd: config.cwd || process.cwd(),
      env: config.env || {},
      timeout: config.timeout || DEFAULT_TIMEOUT,
      shell: config.shell || process.env.SHELL || '/bin/zsh',
    }
  }

  /**
   * Type-safe event emitter
   */
  emit<K extends keyof SidecarEvents>(event: K, ...args: Parameters<SidecarEvents[K]>): boolean {
    return super.emit(event, ...args)
  }

  on<K extends keyof SidecarEvents>(event: K, listener: SidecarEvents[K]): this {
    return super.on(event, listener)
  }

  once<K extends keyof SidecarEvents>(event: K, listener: SidecarEvents[K]): this {
    return super.once(event, listener)
  }

  /**
   * Get current sidecar state
   */
  getState(): SidecarState {
    return this.state
  }

  /**
   * Check if sidecar is ready to accept tasks
   */
  isReady(): boolean {
    return this.state === 'ready'
  }

  /**
   * Check if sidecar is busy with a task
   */
  isBusy(): boolean {
    return this.state === 'busy'
  }

  /**
   * Start a task (spawns opencode for each task)
   * OpenCode CLI is typically run per-task, not as a long-running daemon
   */
  async runTask(request: OpenCodeTaskRequest): Promise<OpenCodeTaskResult> {
    if (this.state === 'busy') {
      throw new Error('Sidecar is busy with another task')
    }

    // Check if OpenCode is installed
    const detection = detectOpenCodeSync()
    if (!detection.installed) {
      const error = new Error(getInstallationInstructions())
      ;(error as Error & { code: string }).code = 'OPENCODE_NOT_INSTALLED'
      throw error
    }

    this.state = 'busy'
    this.emit('state', this.state)
    this.currentTask = request
    this.taskStartTime = Date.now()
    this.outputBuffer = ''

    this.emit('taskStarted', request)

    return new Promise((resolve, reject) => {
      // Set timeout
      this.taskTimeout = setTimeout(() => {
        this.cancelTask()
        reject(new Error(`Task timeout after ${this.config.timeout}ms`))
      }, this.config.timeout)

      try {
        // Dynamically import node-pty (it's a native module)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pty = require('node-pty')

        // Build the command
        const args = [request.prompt]
        if (request.context) {
          // Pass context via stdin or as additional argument
          args.push('--context', request.context)
        }

        // Spawn opencode via pty
        this.pty = pty.spawn(this.config.binaryPath, args, {
          name: 'xterm-256color',
          cols: 120,
          rows: 30,
          cwd: request.cwd || this.config.cwd,
          env: {
            ...process.env,
            ...this.config.env,
            // Ensure non-interactive mode if supported
            CI: 'true',
            NO_COLOR: '1',
          },
        })

        // Handle data (combined stdout/stderr in pty)
        this.pty.onData((data: string) => {
          this.outputBuffer += data

          const chunk: OutputChunk = {
            type: 'stdout',
            data,
            timestamp: Date.now(),
          }
          this.emit('output', chunk)
        })

        // Handle exit
        this.pty.onExit(({ exitCode, signal }) => {
          this.clearTaskTimeout()

          const durationMs = Date.now() - this.taskStartTime
          const success = exitCode === 0

          const result: OpenCodeTaskResult = {
            success,
            output: this.outputBuffer,
            exitCode,
            durationMs,
            error: success ? undefined : `Process exited with code ${exitCode}`,
          }

          this.emit('taskCompleted', result)
          this.emit('exit', { code: exitCode, signal: signal?.toString() ?? null })

          this.cleanup()
          this.state = 'ready'
          this.emit('state', this.state)

          resolve(result)
        })
      } catch (error) {
        this.clearTaskTimeout()
        this.cleanup()
        this.state = 'error'
        this.emit('state', this.state)
        this.emit('error', error as Error)
        reject(error)
      }
    })
  }

  /**
   * Cancel the current task
   */
  cancelTask(): void {
    if (this.pty) {
      this.clearTaskTimeout()

      // Send SIGINT first (Ctrl+C)
      this.pty.write('\x03')

      // Give it a moment, then kill
      setTimeout(() => {
        if (this.pty) {
          this.pty.kill()
        }
      }, 500)
    }
  }

  /**
   * Stop the sidecar (cleanup)
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return
    }

    this.cancelTask()
    this.cleanup()

    this.state = 'stopped'
    this.emit('state', this.state)
  }

  /**
   * Restart the sidecar (just cleanup and reset state)
   */
  async restart(): Promise<void> {
    await this.stop()
    // OpenCode doesn't need explicit restart since we spawn per-task
    this.state = 'ready'
    this.emit('state', this.state)
  }

  /**
   * Write input to the running task (for interactive prompts)
   */
  writeInput(data: string): void {
    if (this.pty && this.state === 'busy') {
      this.pty.write(data)
    }
  }

  /**
   * Get the current output buffer
   */
  getOutput(): string {
    return this.outputBuffer
  }

  /**
   * Clear task timeout
   */
  private clearTaskTimeout(): void {
    if (this.taskTimeout) {
      clearTimeout(this.taskTimeout)
      this.taskTimeout = null
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.clearTaskTimeout()

    if (this.pty) {
      try {
        this.pty.kill()
      } catch {
        // Ignore kill errors
      }
      this.pty = null
    }

    this.currentTask = null
    this.outputBuffer = ''
  }
}

// Singleton instance
let sidecarInstance: OpenCodeSidecar | null = null

/**
 * Get the singleton OpenCode sidecar instance
 */
export function getOpenCodeSidecar(config?: OpenCodeConfig): OpenCodeSidecar {
  if (!sidecarInstance) {
    sidecarInstance = new OpenCodeSidecar(config)
  }
  return sidecarInstance
}

/**
 * Reset the singleton instance
 */
export function resetOpenCodeSidecar(): void {
  if (sidecarInstance) {
    sidecarInstance.stop()
    sidecarInstance = null
  }
}
