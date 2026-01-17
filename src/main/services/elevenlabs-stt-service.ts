/**
 * ElevenLabs Streaming STT Service
 * 
 * Uses ElevenLabs Scribe v2 Realtime for live speech-to-text with VAD.
 * Supports continuous listening with automatic intent detection.
 */

import WebSocket from 'ws'
import { secretsService } from './secrets-service'

export interface ElevenLabsTranscriptResult {
  text: string
  isFinal: boolean
  isPartial: boolean
  shouldExecute?: boolean // True when pattern detected or silence timeout
  triggerReason?: 'pattern' | 'silence' | 'manual'
}

type TranscriptCallback = (result: ElevenLabsTranscriptResult) => void
type ExecuteCallback = (transcript: string, reason: 'pattern' | 'silence') => void

// Silence timeout for auto-execute (ms) - execute after this much silence
// 2000ms (2 seconds) is more natural for speech pauses
const SILENCE_TIMEOUT_MS = 1300

class ElevenLabsSttService {
  private ws: WebSocket | null = null
  private apiKey: string | null = null
  private isConnected: boolean = false
  private transcriptCallback: TranscriptCallback | null = null
  private executeCallback: ExecuteCallback | null = null
  private currentTranscript: string = ''
  private committedTranscripts: string[] = []
  private isListening: boolean = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private keepAliveInterval: NodeJS.Timeout | null = null
  private silenceTimeout: NodeJS.Timeout | null = null
  private lastAudioTime: number = 0
  private hasExecuted: boolean = false // Prevent double execution
  
  // Audio settings
  private suppressNonSpeech: boolean = false
  
  // Track last transcript to detect actual changes
  private lastTranscriptText: string = ''
  
  // Track last EXECUTED transcript to prevent re-execution loops
  private lastExecutedTranscript: string = ''

  /**
   * Set the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }
  
  /**
   * Enable/disable noise suppression (filters background noise, music, etc.)
   */
  setNoiseSuppression(enabled: boolean): void {
    this.suppressNonSpeech = enabled
    console.log(`[ElevenLabs-STT] Noise suppression: ${enabled ? 'ON' : 'OFF'}`)
  }
  
  /**
   * Get current noise suppression setting
   */
  getNoiseSuppression(): boolean {
    return this.suppressNonSpeech
  }

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const key = await secretsService.getElevenLabsKey()
    return !!key
  }

  /**
   * Connect to ElevenLabs Realtime STT
   */
  async connect(): Promise<boolean> {
    // Get API key
    const apiKey = this.apiKey || await secretsService.getElevenLabsKey()
    if (!apiKey) {
      console.error('[ElevenLabs-STT] No API key configured')
      return false
    }
    this.apiKey = apiKey

    // Close existing connection
    if (this.ws) {
      this.disconnect()
    }

    return new Promise((resolve) => {
      try {
        // Build URL with query parameters for configuration
        const params = new URLSearchParams({
          model_id: 'scribe_v2_realtime',
          language_code: 'en',
          sample_rate: '16000',
          enable_logging: 'false',
        })
        
        // Add noise suppression if enabled
        if (this.suppressNonSpeech) {
          params.set('suppress_non_speech', 'true')
          console.log('[ElevenLabs-STT] Noise suppression enabled')
        }
        
        const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`
        console.log('[ElevenLabs-STT] Connecting to:', url)
        
        this.ws = new WebSocket(url, {
          headers: {
            'xi-api-key': apiKey,
          },
        })

        this.ws.on('open', () => {
          console.log('[ElevenLabs-STT] WebSocket connected')
          this.isConnected = true
          
          // Start keep-alive pings (every 15 seconds)
          this.startKeepAlive()
          
          resolve(true)
        })

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString())
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[ElevenLabs-STT] WebSocket closed (code: ${code}, reason: ${reason})`)
          this.isConnected = false
          this.stopKeepAlive()
          
          // Auto-reconnect if we were listening
          if (this.isListening && !this.reconnectTimeout) {
            console.log('[ElevenLabs-STT] Will attempt reconnect in 2s...')
            this.reconnectTimeout = setTimeout(() => {
              this.reconnectTimeout = null
              if (this.isListening) {
                this.connect()
              }
            }, 2000)
          }
        })

        this.ws.on('error', (error) => {
          console.error('[ElevenLabs-STT] WebSocket error:', error)
          resolve(false)
        })

      } catch (error) {
        console.error('[ElevenLabs-STT] Failed to connect:', error)
        resolve(false)
      }
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      
      // ElevenLabs uses message_type field
      const messageType = message.message_type
      
      // Debug: log all messages
      if (messageType !== 'audio_acknowledgement') {
        console.log('[ElevenLabs-STT] Message:', messageType, JSON.stringify(message).substring(0, 300))
      }

      switch (messageType) {
        case 'session_started':
          console.log('[ElevenLabs-STT] Session started, id:', message.session_id)
          break

        case 'partial_transcript':
          // Live transcript as you speak (streaming)
          if (message.text) {
            this.currentTranscript = message.text
            const fullText = this.getFullTranscript()
            
            // Only reset silence timer if the text actually changed (user speaking new words)
            const textChanged = fullText !== this.lastTranscriptText
            if (textChanged) {
              console.log('[ElevenLabs-STT] Live:', fullText)
              this.lastTranscriptText = fullText
              
              // Reset silence timer - user is still speaking
              this.resetSilenceTimer()
              
              // Start new silence timer
              this.startSilenceTimer()
            }
            // else: same text repeated, don't reset timer - could be natural pause
            
            // Always emit to UI
            this.transcriptCallback?.({
              text: fullText,
              isFinal: false,
              isPartial: true,
            })
          }
          break

        case 'final_transcript':
        case 'committed_transcript':
          // Final transcript for this segment (after VAD detects silence)
          if (message.text && message.text.trim()) {
            console.log('[ElevenLabs-STT] Final:', message.text)
            this.committedTranscripts.push(message.text.trim())
            this.currentTranscript = ''
            
            const fullText = this.getFullTranscript()
            this.transcriptCallback?.({
              text: fullText,
              isFinal: true,
              isPartial: false,
            })
            
            // Start silence timer for auto-execute
            this.startSilenceTimer()
          }
          break

        case 'audio_acknowledgement':
          // Audio chunk received acknowledgement - ignore
          break

        case 'resource_exhausted':
          // ElevenLabs rate limit or capacity limit hit
          console.warn('[ElevenLabs-STT] Rate limit hit - service at capacity')
          // Emit error to UI via transcript callback
          this.transcriptCallback?.({
            text: '⚠️ Voice service temporarily unavailable (rate limit)',
            isFinal: false,
            isPartial: false,
          })
          break

        case 'input_error':
        case 'error':
          // Suppress common benign errors during state transitions
          if (message.error === 'Message must be a valid protocol message') {
            // This happens when old audio chunks arrive after state change - harmless
            break
          }
          console.error('[ElevenLabs-STT] API error:', message.error || message)
          break

        default:
          // Only log truly unknown types
          if (messageType) {
            console.log('[ElevenLabs-STT] Unhandled message_type:', messageType)
          }
          break
      }
    } catch (error) {
      console.error('[ElevenLabs-STT] Failed to parse message:', error, data)
    }
  }

  /**
   * Start silence timer - auto-execute after SILENCE_TIMEOUT_MS of no new speech
   */
  private startSilenceTimer(): void {
    this.resetSilenceTimer()
    
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && !this.hasExecuted) {
        const transcript = this.getFullTranscript()
        
        // Minimum 15 characters to avoid executing incomplete phrases like "Calculate the"
        if (transcript && transcript.length > 15) {
          // IMPORTANT: Check if this is the same transcript we just executed
          // This prevents re-execution loops when ElevenLabs keeps sending old partials
          if (transcript === this.lastExecutedTranscript) {
            console.log(`[ElevenLabs-STT] Ignoring duplicate transcript: "${transcript.substring(0, 50)}..."`)
            return
          }
          
          // Also check if current transcript starts with or contains the last executed one
          // This prevents re-executing when user adds more words to same command
          if (this.lastExecutedTranscript && transcript.startsWith(this.lastExecutedTranscript)) {
            // User is continuing from the last executed command - only execute new part
            const newPart = transcript.slice(this.lastExecutedTranscript.length).trim()
            if (newPart.length < 10) {
              console.log(`[ElevenLabs-STT] New addition too short: "${newPart}"`)
              return
            }
          }
          
          console.log(`[ElevenLabs-STT] Silence timeout (${SILENCE_TIMEOUT_MS}ms), auto-executing!`)
          this.hasExecuted = true
          this.lastExecutedTranscript = transcript
          this.executeCallback?.(transcript, 'silence')
        } else if (transcript) {
          console.log(`[ElevenLabs-STT] Transcript too short to execute: "${transcript}" (${transcript.length} chars)`)
        }
      }
    }, SILENCE_TIMEOUT_MS)
  }

  /**
   * Reset silence timer (called when new speech detected)
   */
  private resetSilenceTimer(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }
    this.lastAudioTime = Date.now()
  }

  /**
   * Set callback for auto-execution (pattern or silence triggered)
   */
  onExecute(callback: ExecuteCallback): void {
    this.executeCallback = callback
  }

  /**
   * Send audio chunk to the API
   * @param buffer Raw PCM16 audio at 16kHz mono
   */
  sendAudioChunk(buffer: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Don't spam logs
      return
    }

    try {
      // ElevenLabs expects JSON with message_type and audio_base_64
      const message = {
        message_type: 'input_audio_chunk',
        audio_base_64: buffer.toString('base64'),
        sample_rate: 16000,
      }
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[ElevenLabs-STT] Failed to send audio chunk:', error)
    }
  }

  /**
   * Set callback for transcription results
   */
  onTranscript(callback: TranscriptCallback): void {
    this.transcriptCallback = callback
  }

  /**
   * Get the full accumulated transcript
   */
  getFullTranscript(): string {
    const committed = this.committedTranscripts.join(' ')
    if (this.currentTranscript) {
      return committed ? `${committed} ${this.currentTranscript}` : this.currentTranscript
    }
    return committed
  }

  /**
   * Clear transcripts and reset state
   */
  clearTranscripts(): void {
    this.currentTranscript = ''
    this.committedTranscripts = []
    this.hasExecuted = false
    this.lastTranscriptText = ''
    // NOTE: Don't reset lastExecutedTranscript - we need it to prevent re-execution loops
    // It gets cleared when stopListening() is called or when genuinely new text is detected
    this.resetSilenceTimer()
  }

  /**
   * Start continuous listening mode
   */
  async startListening(): Promise<boolean> {
    this.isListening = true
    this.hasExecuted = false
    this.lastExecutedTranscript = '' // Fresh session - allow any command
    this.clearTranscripts()
    
    if (!this.isConnected) {
      return await this.connect()
    }
    return true
  }

  /**
   * Stop continuous listening mode
   */
  stopListening(): string {
    this.isListening = false
    
    // Get the full transcript - include current partial if no committed transcripts
    let finalTranscript = this.getFullTranscript()
    
    // If we have a current partial transcript but nothing committed, use the partial
    if (!finalTranscript && this.currentTranscript) {
      finalTranscript = this.currentTranscript
    }
    
    console.log('[ElevenLabs-STT] Stop listening, transcript:', finalTranscript)
    return finalTranscript
  }

  /**
   * Start keep-alive pings
   */
  private startKeepAlive(): void {
    this.stopKeepAlive()
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send empty audio to keep connection alive
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 15000)
  }

  /**
   * Stop keep-alive pings
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
  }

  /**
   * Disconnect from the API
   */
  disconnect(): void {
    this.isListening = false
    this.stopKeepAlive()
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.clearTranscripts()
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }
}

export const elevenLabsSttService = new ElevenLabsSttService()
