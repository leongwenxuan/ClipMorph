/**
 * STT Parakeet Types
 */

// Sidecar command types
export interface SidecarCommand {
  cmd: 'health' | 'preload' | 'transcribe' | 'shutdown'
  audio_path?: string
}

export interface SidecarResponse {
  ok: boolean
  text?: string
  status?: string
  error?: string
  exit?: boolean
}

// Client configuration
export interface SttClientConfig {
  pythonPath?: string
  sidecarPath?: string
  timeout?: number
}

// Transcription result
export interface TranscriptionResult {
  text: string
  duration?: number
}

// Client state
export type SidecarState = 'stopped' | 'starting' | 'ready' | 'busy' | 'error'
