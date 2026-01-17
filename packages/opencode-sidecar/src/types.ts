/**
 * OpenCode Sidecar Types
 */

// Sidecar state machine
export type SidecarState = 'stopped' | 'starting' | 'ready' | 'busy' | 'error'

// Configuration for the OpenCode sidecar
export interface OpenCodeConfig {
  /** Path to opencode CLI binary (defaults to 'opencode' in PATH) */
  binaryPath?: string
  /** Working directory for opencode execution */
  cwd?: string
  /** Environment variables to pass to opencode */
  env?: Record<string, string>
  /** Timeout for task execution in ms (default: 120000 = 2 minutes) */
  timeout?: number
  /** Shell to use for pty (default: user's shell or /bin/zsh) */
  shell?: string
}

// Task request to send to OpenCode
export interface OpenCodeTaskRequest {
  /** The prompt/task to execute */
  prompt: string
  /** Optional context (e.g., clipboard content, file paths) */
  context?: string
  /** Optional working directory override */
  cwd?: string
}

// Result from OpenCode task execution
export interface OpenCodeTaskResult {
  /** Whether the task completed successfully */
  success: boolean
  /** The output from OpenCode */
  output: string
  /** Exit code from the process */
  exitCode: number | null
  /** Duration in milliseconds */
  durationMs: number
  /** Error message if failed */
  error?: string
}

// Output chunk from streaming
export interface OutputChunk {
  /** Type of output */
  type: 'stdout' | 'stderr'
  /** The data */
  data: string
  /** Timestamp */
  timestamp: number
}

// Events emitted by the sidecar
export interface SidecarEvents {
  /** State changed */
  state: (state: SidecarState) => void
  /** Output chunk received */
  output: (chunk: OutputChunk) => void
  /** Task started */
  taskStarted: (request: OpenCodeTaskRequest) => void
  /** Task completed */
  taskCompleted: (result: OpenCodeTaskResult) => void
  /** Error occurred */
  error: (error: Error) => void
  /** Process exited */
  exit: (info: { code: number | null; signal: string | null }) => void
}

// Detection result
export interface DetectionResult {
  /** Whether opencode CLI is installed */
  installed: boolean
  /** Path to the binary if found */
  binaryPath?: string
  /** Version string if available */
  version?: string
  /** Error message if detection failed */
  error?: string
}
