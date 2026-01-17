/**
 * VoiceService - Handles push-to-talk hotkey and audio capture
 *
 * Responsibilities:
 * - Global push-to-talk hotkey registration (default: Cmd+Shift+V)
 * - Audio capture during hotkey hold
 * - Status management (idle → listening → processing)
 * - Integration with OpenAI Realtime API for transcription
 * - Transcript storage and surfacing
 */

import { globalShortcut } from 'electron'
import {
  ClipMorphEvent,
  EventTypes,
  AppStatus,
  createEvent,
  VoiceTranscriptPayload,
} from '../../../packages/contracts/src'
import { checkMicrophonePermission } from './permission-service'
import { storeService } from './store-service'
import { intentService } from './intent-service'
import { openaiSttService } from './openai-stt-service'
import { settingsService } from './settings-service'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const record = require('node-record-lpcm16')

// Default push-to-talk hotkey
const DEFAULT_PTT_HOTKEY = 'CommandOrControl+Shift+V'

// Valid modifier keys
const VALID_MODIFIERS = ['Command', 'Cmd', 'Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl', 'Alt', 'Option', 'AltGr', 'Shift', 'Super', 'Meta']

// Valid key codes (subset of Electron accelerator keys)
const VALID_KEYS = [
  // Letters
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Function keys
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24',
  // Special keys
  'Space', 'Tab', 'Backspace', 'Delete', 'Insert', 'Return', 'Enter', 'Escape', 'Esc',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
  // Punctuation
  'Plus', 'Minus', 'Period', 'Comma', 'Slash', 'Backslash', 'Semicolon', 'Quote',
  'BracketLeft', 'BracketRight', 'Backquote',
]

/**
 * Validate a hotkey string
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateHotkey(hotkey: string): { valid: boolean; error?: string } {
  if (!hotkey || typeof hotkey !== 'string') {
    return { valid: false, error: 'Hotkey must be a non-empty string' }
  }

  const parts = hotkey.split('+').map(p => p.trim())
  if (parts.length < 2) {
    return { valid: false, error: 'Hotkey must include at least one modifier and a key (e.g., "Ctrl+Shift+V")' }
  }

  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)

  // Validate modifiers
  for (const mod of modifiers) {
    if (!VALID_MODIFIERS.includes(mod)) {
      return { valid: false, error: `Invalid modifier: "${mod}". Valid modifiers: ${VALID_MODIFIERS.slice(0, 6).join(', ')}...` }
    }
  }

  // Validate key
  if (!VALID_KEYS.includes(key)) {
    return { valid: false, error: `Invalid key: "${key}". Use a letter, number, function key, or special key like "Space"` }
  }

  // Check for at least one modifier (required for global shortcuts)
  if (modifiers.length === 0) {
    return { valid: false, error: 'At least one modifier key is required (e.g., Ctrl, Cmd, Alt, Shift)' }
  }

  return { valid: true }
}

// Transcript storage (last 20, per architecture)
const MAX_TRANSCRIPTS = 20

export interface TranscriptRecord {
  id: string
  text: string
  timestamp: number
  durationMs?: number
}

// Audio capture state
interface AudioCaptureState {
  isCapturing: boolean
  startTime: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recording: any | null
  pendingTranscript: string
}

class VoiceService {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private pttHotkey: string = DEFAULT_PTT_HOTKEY
  private isHotkeyRegistered: boolean = false
  private isHotkeyPressed: boolean = false
  private captureState: AudioCaptureState = {
    isCapturing: false,
    startTime: null,
    recording: null,
    pendingTranscript: '',
  }

  // Status callback for app status updates
  private statusCallback: ((status: AppStatus) => void) | null = null

  // Transcript history (in-memory, persisted to SQLite)
  private transcripts: TranscriptRecord[] = []
  private lastTranscript: TranscriptRecord | null = null

  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Set callback for app status changes
   */
  setStatusCallback(callback: (status: AppStatus) => void): void {
    this.statusCallback = callback
  }

  /**
   * Emit an event to the renderer
   */
  private emit<T>(event: ClipMorphEvent<T>): void {
    if (this.eventEmitter) {
      this.eventEmitter(event)
    }
  }

  /**
   * Update app status
   */
  private setAppStatus(status: AppStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status)
    }
  }

  /**
   * Check if voice capture can be enabled
   */
  canEnable(): boolean {
    const micPermission = checkMicrophonePermission()
    return micPermission.status === 'granted'
  }

  /**
   * Set the OpenAI API key
   */
  setApiKey(apiKey: string): void {
    openaiSttService.setApiKey(apiKey)
  }

  /**
   * Check if OpenAI API key is configured
   */
  hasApiKey(): boolean {
    return openaiSttService.hasApiKey()
  }

  /**
   * Initialize OpenAI STT connection
   * @param forceReconnect If true, disconnect and create fresh connection
   */
  async initStt(forceReconnect: boolean = false): Promise<boolean> {
    if (!this.hasApiKey()) {
      console.log('[VoiceService] No OpenAI API key configured')
      return false
    }

    // Set up transcript callback
    openaiSttService.onTranscript((result) => {
      this.captureState.pendingTranscript = result.text

      // Emit partial transcript for UI feedback
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: result.text,
          isFinal: result.isFinal,
        })
      )

    })

    const connected = await openaiSttService.connect(forceReconnect)
    if (connected) {
      console.log('[VoiceService] OpenAI STT connected')
    }
    return connected
  }

  /**
   * Check if STT is ready
   */
  isSttReady(): boolean {
    return openaiSttService.isReady()
  }

  /**
   * Register the push-to-talk global hotkey
   * Toggle mode: press once to start, press again to stop
   */
  registerHotkey(hotkey?: string): boolean {
    if (this.isHotkeyRegistered) {
      this.unregisterHotkey()
    }

    const hotkeyToRegister = hotkey || this.pttHotkey

    // Toggle mode: press once to start recording, press again to stop
    const registered = globalShortcut.register(hotkeyToRegister, () => {
      if (this.captureState.isCapturing) {
        // Already capturing - stop and transcribe
        this.handleHotkeyUp()
      } else {
        // Not capturing - start
        this.handleHotkeyDown()
      }
    })

    if (registered) {
      this.pttHotkey = hotkeyToRegister
      this.isHotkeyRegistered = true
    }

    return registered
  }

  /**
   * Unregister the push-to-talk hotkey
   */
  unregisterHotkey(): void {
    if (this.isHotkeyRegistered) {
      globalShortcut.unregister(this.pttHotkey)
      this.isHotkeyRegistered = false
    }
  }

  /**
   * Handle hotkey press (start listening)
   */
  private handleHotkeyDown(): void {
    if (!this.canEnable()) {
      console.log('[VoiceService] Cannot start capture - microphone permission not granted')
      return
    }

    this.isHotkeyPressed = true
    this.startCapture()
  }

  /**
   * Handle hotkey release (stop listening, start transcription)
   */
  private handleHotkeyUp(): void {
    if (this.isHotkeyPressed) {
      this.isHotkeyPressed = false
      this.stopCapture()
    }
  }

  /**
   * Start audio capture and streaming to OpenAI
   */
  private async startCapture(): Promise<void> {
    if (this.captureState.isCapturing) return

    // Check API key
    if (!this.hasApiKey()) {
      console.log('[VoiceService] No OpenAI API key - set OPENAI_API_KEY env var')
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: '[No OpenAI API key configured]',
          isFinal: true,
        })
      )
      return
    }

    // Force reconnect to OpenAI for each new capture session
    // This ensures a clean state for transcription
    console.log('[VoiceService] Connecting to OpenAI STT (fresh session)...')
    const connected = await this.initStt(true) // Force reconnect
    if (!connected) {
      console.error('[VoiceService] Failed to connect to OpenAI STT')
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: '[Failed to connect to OpenAI]',
          isFinal: true,
        })
      )
      return
    }

    this.captureState = {
      isCapturing: true,
      startTime: Date.now(),
      recording: null,
      pendingTranscript: '',
    }

    // Update app status to listening
    this.setAppStatus('listening')

    // Emit voice started event
    this.emit(createEvent(EventTypes.VOICE_STARTED))

    console.log('[VoiceService] Audio capture started')

    // Clear any previous audio buffer
    openaiSttService.clearAudio()

    // Start recording from microphone using node-record-lpcm16
    // Output: 16-bit PCM, 16kHz mono (required by OpenAI Realtime API)
    try {
      // Get configured input device (empty = system default)
      const inputDevice = settingsService.get('audio.inputDevice')
      
      const recordOptions: Record<string, unknown> = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw', // raw PCM, no WAV header
        recorder: 'sox',
      }
      
      // Only set device if configured
      if (inputDevice) {
        recordOptions.device = inputDevice
        console.log(`[VoiceService] Using audio device: ${inputDevice}`)
      }
      
      const recording = record.record(recordOptions)

      this.captureState.recording = recording

      // Stream audio chunks directly to OpenAI
      recording.stream().on('data', (chunk: Buffer) => {
        if (this.captureState.isCapturing) {
          openaiSttService.sendAudioBuffer(chunk)
        }
      })

      recording.stream().on('error', (err: Error) => {
        console.error('[VoiceService] Recording error:', err)
      })
    } catch (err) {
      console.error('[VoiceService] Failed to start recording:', err)
    }
  }

  /**
   * Stop audio capture and finalize transcription
   */
  private async stopCapture(): Promise<void> {
    if (!this.captureState.isCapturing) return

    const duration = this.captureState.startTime
      ? Date.now() - this.captureState.startTime
      : 0
    const startTime = this.captureState.startTime

    // Stop the recording
    if (this.captureState.recording) {
      this.captureState.recording.stop()
    }

    // Mark as no longer capturing
    this.captureState.isCapturing = false

    // Emit voice stopped event
    this.emit(createEvent(EventTypes.VOICE_STOPPED))

    console.log(`[VoiceService] Audio capture stopped (duration: ${duration}ms)`)

    // If capture was too short (< 300ms), ignore it
    if (duration < 300) {
      console.log('[VoiceService] Capture too short, ignoring')
      this.resetCaptureState()
      this.setAppStatus('idle')
      return
    }

    // Update status to processing
    this.setAppStatus('processing')

    // Commit the audio buffer to signal end of input
    // This forces OpenAI to finalize any pending transcription
    openaiSttService.commitAudio()

    // Wait for transcription to complete (longer wait to ensure we get the result)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Get the full accumulated transcript
    const transcriptText = openaiSttService.getFullTranscript() || this.captureState.pendingTranscript

    if (transcriptText) {
      console.log(`[VoiceService] Final transcript: "${transcriptText}"`)

      // Store transcript
      const record = this.storeTranscript(transcriptText, startTime, duration)

      // Emit final transcript event
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: transcriptText,
          isFinal: true,
        })
      )

      // Route to intent service
      if (transcriptText.length > 0) {
        const routingResult = await intentService.routeTranscript(transcriptText)
        console.log(`[VoiceService] Intent routing result:`, routingResult)
      }
    } else {
      // Use whatever partial transcript we have
      const fallbackText = this.captureState.pendingTranscript || '[No transcription received]'
      console.log(`[VoiceService] Using fallback transcript: "${fallbackText}"`)

      if (fallbackText && fallbackText !== '[No transcription received]') {
        this.storeTranscript(fallbackText, startTime, duration)

        // Route to intent service
        const routingResult = await intentService.routeTranscript(fallbackText)
        console.log(`[VoiceService] Intent routing result:`, routingResult)
      }
    }

    this.resetCaptureState()
    this.setAppStatus('idle')
  }

  /**
   * Store a transcript in history (persisted to SQLite)
   */
  private storeTranscript(
    text: string,
    startTime: number | null,
    durationMs?: number
  ): TranscriptRecord {
    const record: TranscriptRecord = {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: startTime || Date.now(),
      durationMs,
    }

    // Persist to SQLite (handles rolling retention of last 20)
    try {
      storeService.addTranscript(record.id, text, durationMs)
    } catch (error) {
      console.error('[VoiceService] Failed to persist transcript:', error)
    }

    // Also keep in memory for quick access
    this.transcripts.unshift(record)

    // Trim to max size
    if (this.transcripts.length > MAX_TRANSCRIPTS) {
      this.transcripts = this.transcripts.slice(0, MAX_TRANSCRIPTS)
    }

    // Update last transcript
    this.lastTranscript = record

    return record
  }

  /**
   * Get the last transcript
   */
  getLastTranscript(): TranscriptRecord | null {
    return this.lastTranscript
  }

  /**
   * Get all transcripts (most recent first)
   * Loads from SQLite if memory cache is empty
   */
  getTranscripts(): TranscriptRecord[] {
    // If memory is empty, load from SQLite
    if (this.transcripts.length === 0) {
      try {
        const rows = storeService.getTranscripts(MAX_TRANSCRIPTS)
        this.transcripts = rows.map((row) => ({
          id: row.id,
          text: row.text,
          timestamp: row.created_at,
          durationMs: row.duration_ms ?? undefined,
        }))
        if (this.transcripts.length > 0) {
          this.lastTranscript = this.transcripts[0]
        }
      } catch (error) {
        console.error('[VoiceService] Failed to load transcripts from SQLite:', error)
      }
    }
    return [...this.transcripts]
  }

  /**
   * Clear transcript history (both memory and SQLite)
   */
  clearTranscripts(): void {
    this.transcripts = []
    this.lastTranscript = null

    // Clear from SQLite
    try {
      storeService.clearTranscripts()
    } catch (error) {
      console.error('[VoiceService] Failed to clear transcripts from SQLite:', error)
    }
  }

  /**
   * Reset capture state
   */
  private resetCaptureState(): void {
    if (this.captureState.recording) {
      try {
        this.captureState.recording.stop()
      } catch {
        // ignore
      }
    }
    this.captureState = {
      isCapturing: false,
      startTime: null,
      recording: null,
      pendingTranscript: '',
    }
  }

  /**
   * Get current voice state
   */
  getState(): {
    isCapturing: boolean
    isHotkeyRegistered: boolean
    hotkey: string
    canEnable: boolean
  } {
    return {
      isCapturing: this.captureState.isCapturing,
      isHotkeyRegistered: this.isHotkeyRegistered,
      hotkey: this.pttHotkey,
      canEnable: this.canEnable(),
    }
  }

  /**
   * Manually trigger start (for testing or alternative activation)
   */
  start(): boolean {
    if (!this.canEnable()) {
      return false
    }
    this.handleHotkeyDown()
    return true
  }

  /**
   * Manually trigger stop (for testing or alternative activation)
   */
  stop(): void {
    this.handleHotkeyUp()
  }

  /**
   * Check if currently capturing
   */
  isCapturing(): boolean {
    return this.captureState.isCapturing
  }

  /**
   * Get the current hotkey
   */
  getHotkey(): string {
    return this.pttHotkey
  }

  /**
   * Get the current audio input device setting
   */
  getInputDevice(): string {
    return settingsService.get('audio.inputDevice')
  }

  /**
   * Set the audio input device
   * Pass empty string to use system default
   */
  setInputDevice(device: string): void {
    settingsService.set('audio.inputDevice', device)
    console.log(`[VoiceService] Audio input device set to: ${device || '(system default)'}`)
  }

  /**
   * List available audio input devices (macOS)
   * Returns device names that can be passed to setInputDevice()
   */
  async listInputDevices(): Promise<string[]> {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      
      // Use system_profiler to get audio devices on macOS
      exec('system_profiler SPAudioDataType -json', (error: Error | null, stdout: string) => {
        if (error) {
          console.error('[VoiceService] Failed to list audio devices:', error)
          resolve([])
          return
        }
        
        try {
          const data = JSON.parse(stdout)
          const devices: string[] = []
          
          // Extract input device names
          const audioData = data.SPAudioDataType || []
          for (const item of audioData) {
            // Look for input devices
            if (item._items) {
              for (const device of item._items) {
                if (device.coreaudio_input_source) {
                  devices.push(device._name)
                }
              }
            }
            // Direct device entries
            if (item.coreaudio_input_source) {
              devices.push(item._name)
            }
          }
          
          resolve(devices)
        } catch (parseError) {
          console.error('[VoiceService] Failed to parse audio devices:', parseError)
          resolve([])
        }
      })
    })
  }

  /**
   * Change the push-to-talk hotkey
   * Returns success status and any error message
   */
  setHotkey(newHotkey: string): { success: boolean; error?: string } {
    // Validate the hotkey
    const validation = validateHotkey(newHotkey)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // Try to register the new hotkey
    const wasRegistered = this.isHotkeyRegistered
    if (wasRegistered) {
      this.unregisterHotkey()
    }

    const registered = this.registerHotkey(newHotkey)
    if (!registered) {
      // Registration failed, try to restore the old hotkey
      if (wasRegistered) {
        this.registerHotkey(this.pttHotkey)
      }
      return {
        success: false,
        error: `Failed to register hotkey "${newHotkey}". It may be in use by another application.`,
      }
    }

    return { success: true }
  }

  /**
   * Cleanup on app quit
   */
  async cleanup(): Promise<void> {
    this.unregisterHotkey()
    if (this.captureState.isCapturing) {
      this.resetCaptureState()
    }

    // Disconnect from OpenAI
    openaiSttService.disconnect()
  }
}

// Singleton export
export const voiceService = new VoiceService()
