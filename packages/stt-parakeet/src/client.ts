/**
 * Parakeet STT Client
 *
 * Node.js client for the Parakeet v2 Python sidecar.
 * Manages sidecar lifecycle and provides transcription API.
 */

import { spawn, ChildProcess } from 'child_process'
import { createInterface, Interface } from 'readline'
import { join } from 'path'
import { EventEmitter } from 'events'
import {
  SidecarCommand,
  SidecarResponse,
  SttClientConfig,
  TranscriptionResult,
  SidecarState,
} from './types'

const DEFAULT_TIMEOUT = 30000 // 30 seconds for transcription
const STARTUP_TIMEOUT = 10000 // 10 seconds for sidecar startup

export class SttClient extends EventEmitter {
  private config: Required<SttClientConfig>
  private process: ChildProcess | null = null
  private readline: Interface | null = null
  private state: SidecarState = 'stopped'
  private pendingRequests: Map<
    number,
    { resolve: (value: SidecarResponse) => void; reject: (error: Error) => void }
  > = new Map()
  private requestId = 0

  constructor(config: SttClientConfig = {}) {
    super()
    this.config = {
      pythonPath: config.pythonPath || 'python3',
      sidecarPath:
        config.sidecarPath || join(__dirname, '..', 'sidecar', 'server.py'),
      timeout: config.timeout || DEFAULT_TIMEOUT,
    }
  }

  /**
   * Get current sidecar state
   */
  getState(): SidecarState {
    return this.state
  }

  /**
   * Check if sidecar is ready
   */
  isReady(): boolean {
    return this.state === 'ready'
  }

  /**
   * Start the sidecar process
   */
  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start sidecar in state: ${this.state}`)
    }

    this.state = 'starting'
    this.emit('state', this.state)

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stop()
        reject(new Error('Sidecar startup timeout'))
      }, STARTUP_TIMEOUT)

      try {
        this.process = spawn(this.config.pythonPath, [this.config.sidecarPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.process.on('error', (error) => {
          clearTimeout(timeout)
          this.state = 'error'
          this.emit('state', this.state)
          this.emit('error', error)
          reject(error)
        })

        this.process.on('exit', (code, signal) => {
          this.state = 'stopped'
          this.emit('state', this.state)
          this.emit('exit', { code, signal })
          this.cleanup()
        })

        // Handle stderr for debugging
        this.process.stderr?.on('data', (data) => {
          this.emit('stderr', data.toString())
        })

        // Set up readline for stdout
        if (this.process.stdout) {
          this.readline = createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity,
          })

          this.readline.on('line', (line) => {
            this.handleResponse(line)
          })
        }

        // Wait for startup message
        const startupHandler = (line: string): void => {
          try {
            const response = JSON.parse(line) as SidecarResponse
            if (response.ok && response.status === 'started') {
              clearTimeout(timeout)
              this.state = 'ready'
              this.emit('state', this.state)
              resolve()
            }
          } catch {
            // Ignore parse errors during startup
          }
        }

        this.readline?.once('line', startupHandler)
      } catch (error) {
        clearTimeout(timeout)
        this.state = 'error'
        this.emit('state', this.state)
        reject(error)
      }
    })
  }

  /**
   * Stop the sidecar process
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      return
    }

    // Try graceful shutdown first
    if (this.state === 'ready') {
      try {
        await this.sendCommand({ cmd: 'shutdown' }, 1000)
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.cleanup()
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }

    if (this.readline) {
      this.readline.close()
      this.readline = null
    }

    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Sidecar stopped'))
    }
    this.pendingRequests.clear()

    this.state = 'stopped'
  }

  /**
   * Send a command to the sidecar
   */
  private async sendCommand(
    command: SidecarCommand,
    timeout?: number
  ): Promise<SidecarResponse> {
    if (!this.process?.stdin) {
      throw new Error('Sidecar not running')
    }

    const id = ++this.requestId
    const effectiveTimeout = timeout || this.config.timeout

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Command timeout'))
      }, effectiveTimeout)

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timer)
          resolve(response)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })

      // Write command to stdin
      const line = JSON.stringify(command) + '\n'
      this.process!.stdin!.write(line)
    })
  }

  /**
   * Handle response from sidecar
   */
  private handleResponse(line: string): void {
    try {
      const response = JSON.parse(line) as SidecarResponse

      // Find the oldest pending request (FIFO)
      const [id, handler] = this.pendingRequests.entries().next().value || []
      if (id !== undefined && handler) {
        this.pendingRequests.delete(id)
        handler.resolve(response)
      }
    } catch (error) {
      this.emit('error', new Error(`Invalid response: ${line}`))
    }
  }

  /**
   * Check sidecar health
   */
  async health(): Promise<boolean> {
    if (this.state !== 'ready') {
      return false
    }

    try {
      const response = await this.sendCommand({ cmd: 'health' }, 5000)
      return response.ok === true
    } catch {
      return false
    }
  }

  /**
   * Preload the model (optional, for warming up)
   */
  async preload(): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error('Sidecar not ready')
    }

    this.state = 'busy'
    this.emit('state', this.state)

    try {
      const response = await this.sendCommand({ cmd: 'preload' }, 60000) // 60s for model load
      if (!response.ok) {
        throw new Error(response.error || 'Preload failed')
      }
    } finally {
      this.state = 'ready'
      this.emit('state', this.state)
    }
  }

  /**
   * Transcribe an audio file
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    if (this.state !== 'ready') {
      throw new Error('Sidecar not ready')
    }

    this.state = 'busy'
    this.emit('state', this.state)

    const startTime = Date.now()

    try {
      const response = await this.sendCommand({
        cmd: 'transcribe',
        audio_path: audioPath,
      })

      if (!response.ok) {
        throw new Error(response.error || 'Transcription failed')
      }

      const duration = Date.now() - startTime

      return {
        text: response.text || '',
        duration,
      }
    } finally {
      this.state = 'ready'
      this.emit('state', this.state)
    }
  }
}

// Singleton instance for the app
let sttClient: SttClient | null = null

export function getSttClient(config?: SttClientConfig): SttClient {
  if (!sttClient) {
    sttClient = new SttClient(config)
  }
  return sttClient
}

export function resetSttClient(): void {
  if (sttClient) {
    sttClient.stop()
    sttClient = null
  }
}
