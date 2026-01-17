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
import { groqSttService } from './groq-stt-service'
import { elevenLabsSttService } from './elevenlabs-stt-service'
import { settingsService } from './settings-service'

// STT Provider type
type SttProvider = 'elevenlabs' | 'groq' | 'openai'
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
  audioChunks: Buffer[] // Buffer audio for Groq
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
    audioChunks: [],
  }

  // Status callback for app status updates
  private statusCallback: ((status: AppStatus) => void) | null = null

  // Transcript history (in-memory, persisted to SQLite)
  private transcripts: TranscriptRecord[] = []
  private lastTranscript: TranscriptRecord | null = null
  
  // Flag to suppress partial transcripts during command execution
  private isExecutingCommand: boolean = false
  // Track when we last showed "Done" to prevent immediate overwrites
  private doneShownAt: number = 0

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
    } else {
      console.warn('[VoiceService] eventEmitter not set, event dropped:', event.type)
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

      console.log(`[VoiceService] Emitting transcript to UI: "${result.text}" (isFinal: ${result.isFinal})`)
      
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
      audioChunks: [], // Reset audio buffer for Groq
    }

    // Update app status to listening
    this.setAppStatus('listening')

    // Emit voice started event
    this.emit(createEvent(EventTypes.VOICE_STARTED))

    console.log('[VoiceService] Audio capture started')

    // Determine which STT provider to use (priority: ElevenLabs > Groq > OpenAI)
    const sttProvider = await this.getSttProvider()
    console.log(`[VoiceService] Using ${sttProvider} for transcription`)

    // Set up provider-specific handling
    if (sttProvider === 'elevenlabs') {
      await this.setupElevenLabsStreaming()
    } else {
      // Clear any previous audio buffer (for OpenAI live preview)
      openaiSttService.clearAudio()
    }

    // Start recording from microphone using node-record-lpcm16
    // Output: 16-bit PCM, 16kHz mono
    try {
      // Get configured input device (empty = system default)
      const inputDevice = settingsService.get('audio.inputDevice')
      
      const recordOptions: Record<string, unknown> = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw', // raw PCM, no WAV header
        recorder: 'sox',
        verbose: true, // Enable verbose logging
      }
      
      // Only set device if configured
      if (inputDevice) {
        recordOptions.device = inputDevice
        console.log(`[VoiceService] Using audio device: ${inputDevice}`)
      }
      
      console.log('[VoiceService] Starting sox recording with options:', JSON.stringify(recordOptions))
      const recording = record.record(recordOptions)

      this.captureState.recording = recording

      // Stream audio chunks
      let chunkCount = 0
      let totalBytes = 0
      recording.stream().on('data', (chunk: Buffer) => {
        if (this.captureState.isCapturing) {
          chunkCount++
          totalBytes += chunk.length
          
          // Always buffer audio for Groq (final transcription fallback)
          this.captureState.audioChunks.push(chunk)
          
          if (chunkCount === 1) {
            console.log(`[VoiceService] First audio chunk received: ${chunk.length} bytes`)
          } else if (chunkCount % 50 === 0) {
            console.log(`[VoiceService] Audio chunk #${chunkCount}, total: ${totalBytes} bytes`)
          }
          
          // Route audio to the appropriate STT service
          if (sttProvider === 'elevenlabs') {
            elevenLabsSttService.sendAudioChunk(chunk)
          } else if (sttProvider === 'openai') {
            openaiSttService.sendAudioBuffer(chunk)
          }
          // For Groq, we just buffer (processed on stop)
        }
      })

      recording.stream().on('error', (err: Error) => {
        console.error('[VoiceService] Recording stream error:', err)
      })

      recording.stream().on('end', () => {
        console.log(`[VoiceService] Recording stream ended. Total chunks: ${chunkCount}, total bytes: ${totalBytes}`)
      })
    } catch (err) {
      console.error('[VoiceService] Failed to start recording:', err)
    }
  }

  /**
   * Determine which STT provider to use
   */
  private async getSttProvider(): Promise<SttProvider> {
    // Check user preference from settings
    const preferredProvider = settingsService.get('voice.sttProvider')
    
    if (preferredProvider === 'elevenlabs' && await elevenLabsSttService.hasApiKey()) {
      return 'elevenlabs'
    }
    if (preferredProvider === 'groq' && await groqSttService.hasApiKey()) {
      return 'groq'
    }
    
    // Auto-detect based on available keys (ElevenLabs > Groq > OpenAI)
    if (await elevenLabsSttService.hasApiKey()) {
      return 'elevenlabs'
    }
    if (await groqSttService.hasApiKey()) {
      return 'groq'
    }
    return 'openai'
  }

  /**
   * Set up ElevenLabs streaming with live transcript updates and auto-execute
   */
  private async setupElevenLabsStreaming(): Promise<void> {
    // Track last executed command to detect new speech
    let lastExecutedText = ''
    
    // Set up transcript callback for live updates
    elevenLabsSttService.onTranscript((result) => {
      this.captureState.pendingTranscript = result.text
      
      // Don't emit partial transcripts while executing - they would overwrite the execution status
      if (this.isExecutingCommand && !result.isFinal) {
        // Check if this is genuinely new speech (not just repeats of what we executed)
        const isNewSpeech = lastExecutedText && 
          !result.text.startsWith(lastExecutedText) && 
          !lastExecutedText.startsWith(result.text)
        
        if (isNewSpeech) {
          // New command detected, allow it through
          console.log(`[VoiceService] New speech detected during execution hold, allowing: "${result.text.slice(0, 30)}..."`)
          this.isExecutingCommand = false
          this.doneShownAt = 0
          lastExecutedText = ''
        } else {
          // Same text as executed, suppress
          return
        }
      }
      
      // Don't let partials overwrite the "Done!" message for 2 seconds after done
      // This prevents ElevenLabs echo from immediately clearing the done state
      const timeSinceDone = Date.now() - this.doneShownAt
      if (this.doneShownAt > 0 && timeSinceDone < 2000 && !result.isFinal) {
        // Suppress ALL partials during the done display period
        // Only genuinely NEW speech (detected above) breaks through
        return
      }
      
      // Reset doneShownAt if we're past the 2s window and showing new content
      if (this.doneShownAt > 0 && timeSinceDone >= 2000) {
        this.doneShownAt = 0
        lastExecutedText = ''
      }
      
      console.log(`[VoiceService] ElevenLabs transcript: "${result.text}" (final: ${result.isFinal})`)
      
      // Emit live transcript for UI display
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: result.text,
          isFinal: result.isFinal,
        })
      )
    })

    // Set up auto-execute callback (silence triggered)
    // IMPORTANT: Keep recording active - only stop when user presses hotkey
    elevenLabsSttService.onExecute(async (transcript, reason) => {
      console.log(`[VoiceService] Auto-execute triggered by ${reason}: "${transcript}"`)
      
      // Suppress partial transcript emissions during execution
      this.isExecutingCommand = true
      lastExecutedText = transcript
      
      // Show processing status but DON'T stop recording
      this.setAppStatus('processing')
      
      // Emit transcript showing what's being executed
      console.log(`[VoiceService] === EXECUTING: "${transcript.slice(0, 50)}..." ===`)
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: transcript,
          isFinal: false,
          isExecuting: true, // New flag to indicate execution in progress
        })
      )
      
      // Store and route to intent service
      const startTime = this.captureState.startTime
      const duration = startTime ? Date.now() - startTime : 0
      this.storeTranscript(transcript, startTime, duration)
      
      const routingResult = await intentService.routeTranscript(transcript)
      console.log(`[VoiceService] Auto-execute intent result:`, routingResult)
      
      // Show "Done!" briefly before going back to listening
      console.log(`[VoiceService] === DONE! Emitting isDone=true - USER CAN PASTE NOW ===`)
      this.doneShownAt = Date.now() // Track when done was shown
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: '✓ Done! Ready for next command...',
          isFinal: false,
          isDone: true, // New flag for done state
        })
      )
      
      // Clear transcripts for next command
      elevenLabsSttService.clearTranscripts()
      
      // After a brief delay, allow new speech but DON'T change status yet
      // The status will naturally update when user speaks again or stops recording
      setTimeout(() => {
        console.log(`[VoiceService] 1.5s timeout - resetting isExecutingCommand to false, keeping done state`)
        this.isExecutingCommand = false // Re-enable partial transcript emissions
        // Note: doneShownAt stays set for 2s total to suppress echoes
        // DON'T call setAppStatus('listening') - that would overwrite the Done! state
        // The UI will update when genuinely new speech comes in
      }, 1500) // Show "Done!" for 1.5 seconds
    })

    // Apply noise suppression setting
    const noiseSuppression = await storeService.getSetting('voice.noiseSuppression')
    elevenLabsSttService.setNoiseSuppression(noiseSuppression === 'true')
    
    // Connect to ElevenLabs
    const connected = await elevenLabsSttService.startListening()
    if (!connected) {
      console.error('[VoiceService] Failed to connect to ElevenLabs STT')
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
    const audioChunks = this.captureState.audioChunks

    // Stop the recording
    if (this.captureState.recording) {
      this.captureState.recording.stop()
    }

    // Mark as no longer capturing
    this.captureState.isCapturing = false
    this.isExecutingCommand = false // Reset execution flag
    this.doneShownAt = 0 // Reset done timestamp

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

    // Emit processing status
    this.emit(
      createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
        text: '⏳ Transcribing...',
        isFinal: false,
      })
    )

    let transcriptText: string | null = null
    const sttProvider = await this.getSttProvider()

    // Get transcript based on provider
    if (sttProvider === 'elevenlabs') {
      // ElevenLabs: get the accumulated transcript from streaming
      transcriptText = elevenLabsSttService.stopListening()
      console.log(`[VoiceService] ElevenLabs final transcript: "${transcriptText}"`)
    } else if (sttProvider === 'groq' && audioChunks.length > 0) {
      // Groq: send buffered audio for transcription
      try {
        const audioBuffer = Buffer.concat(audioChunks)
        console.log(`[VoiceService] Sending ${audioBuffer.length} bytes to Groq Whisper...`)
        
        const result = await groqSttService.transcribe(audioBuffer, duration)
        transcriptText = result.text
        console.log(`[VoiceService] Groq transcript: "${transcriptText}"`)
      } catch (err) {
        console.error('[VoiceService] Groq transcription failed, falling back to OpenAI:', err)
        // Fall through to OpenAI fallback
      }
    }

    // Fallback to OpenAI Realtime if nothing else worked
    if (!transcriptText) {
      // Commit the audio buffer to signal end of input
      openaiSttService.commitAudio()

      // Wait for transcription to complete
      const waitTime = Math.min(5000, Math.max(2000, duration / 5))
      console.log(`[VoiceService] Waiting ${waitTime}ms for OpenAI transcription...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))

      transcriptText = openaiSttService.getFullTranscript() || this.captureState.pendingTranscript
    }

    if (transcriptText && transcriptText.trim().length > 0) {
      console.log(`[VoiceService] Final transcript: "${transcriptText}"`)

      // Store transcript
      this.storeTranscript(transcriptText, startTime, duration)

      // Emit final transcript event
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: transcriptText,
          isFinal: true,
        })
      )

      // Route to intent service
      const routingResult = await intentService.routeTranscript(transcriptText)
      console.log(`[VoiceService] Intent routing result:`, routingResult)
    } else {
      // No transcription received
      console.log(`[VoiceService] No transcription received`)
      this.emit(
        createEvent<VoiceTranscriptPayload>(EventTypes.VOICE_TRANSCRIPT, {
          text: '[No speech detected]',
          isFinal: true,
        })
      )
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
      audioChunks: [],
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
  async listInputDevices(): Promise<{ id: string; name: string }[]> {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      
      // Use system_profiler to get audio devices
      // Format: "Device Name:" at 8-space indent, then "Input Channels: N"
      exec('system_profiler SPAudioDataType', (error: Error | null, stdout: string) => {
        if (error) {
          console.error('[VoiceService] Failed to run system_profiler:', error.message)
          resolve([])
          return
        }
        
        const devices: { id: string; name: string }[] = []
        const lines = stdout.split('\n')
        let currentDevice = ''
        let hasInput = false
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          
          // Device names appear at specific indentation (usually 8 spaces)
          // and end with a colon
          const deviceMatch = line.match(/^\s{4,12}([^:]+):$/)
          if (deviceMatch && !line.includes('Audio:') && !line.includes('Devices:')) {
            // If we had a device being tracked with input, save it
            if (currentDevice && hasInput) {
              devices.push({ id: currentDevice, name: currentDevice })
            }
            currentDevice = deviceMatch[1].trim()
            hasInput = false
          }
          
          // Check for input channels
          if (currentDevice && line.includes('Input Channels:')) {
            const channelMatch = line.match(/Input Channels:\s*(\d+)/)
            if (channelMatch && parseInt(channelMatch[1]) > 0) {
              hasInput = true
            }
          }
        }
        
        // Don't forget the last device
        if (currentDevice && hasInput) {
          devices.push({ id: currentDevice, name: currentDevice })
        }
        
        // Remove duplicates
        const uniqueDevices = devices.filter((device, index, self) =>
          index === self.findIndex(d => d.id === device.id)
        )
        
        console.log('[VoiceService] Found audio input devices:', uniqueDevices)
        resolve(uniqueDevices)
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
