/**
 * OpenAI Realtime Transcription Service
 *
 * Uses OpenAI's Realtime API for speech-to-text via WebSocket.
 * Streams audio in real-time and receives transcription events.
 */

import WebSocket from 'ws'

export interface TranscriptionResult {
  text: string
  isFinal: boolean
}

type TranscriptionCallback = (result: TranscriptionResult) => void

class OpenAISttService {
  private ws: WebSocket | null = null
  private apiKey: string | null = null
  private isConnected: boolean = false
  private transcriptCallback: TranscriptionCallback | null = null
  private currentTranscript: string = ''
  private allTranscripts: string[] = [] // Accumulate all transcripts for the session
  private pendingAudioChunks: string[] = []

  /**
   * Set the OpenAI API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey
  }

  /**
   * Connect to OpenAI Realtime API
   * @param forceReconnect If true, disconnect existing connection and create new one
   */
  async connect(forceReconnect: boolean = false): Promise<boolean> {
    if (!this.apiKey) {
      console.error('[OpenAI-STT] No API key configured')
      return false
    }

    // If already connected and not forcing reconnect, return true
    if (!forceReconnect && this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return true
    }

    // Disconnect existing connection if forcing reconnect
    if (forceReconnect && this.ws) {
      console.log('[OpenAI-STT] Force reconnecting...')
      this.disconnect()
      // Small delay to ensure clean disconnect
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(
          'wss://api.openai.com/v1/realtime?intent=transcription',
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'OpenAI-Beta': 'realtime=v1',
            },
          }
        )

        this.ws.on('open', () => {
          console.log('[OpenAI-STT] WebSocket connected')
          this.isConnected = true

          // Configure the transcription session
          this.sendSessionConfig()

          // Send any pending audio chunks
          for (const chunk of this.pendingAudioChunks) {
            this.sendAudioChunk(chunk)
          }
          this.pendingAudioChunks = []

          resolve(true)
        })

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString())
        })

        this.ws.on('error', (error) => {
          console.error('[OpenAI-STT] WebSocket error:', error)
          this.isConnected = false
          this.pendingAudioChunks = [] // Clear pending chunks on error
          resolve(false)
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[OpenAI-STT] WebSocket closed (code: ${code}, reason: ${reason})`)
          this.isConnected = false
          this.pendingAudioChunks = [] // Clear pending chunks on close
        })
      } catch (error) {
        console.error('[OpenAI-STT] Failed to connect:', error)
        resolve(false)
      }
    })
  }

  /**
   * Send session configuration
   */
  private sendSessionConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const config = {
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'en',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1500, // 1.5s silence before segment ends
        },
        input_audio_noise_reduction: {
          type: 'near_field',
        },
      },
    }

    this.ws.send(JSON.stringify(config))
    console.log('[OpenAI-STT] Session config sent')
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'transcription_session.created':
          console.log('[OpenAI-STT] Session created:', message.session?.id)
          break

        case 'transcription_session.updated':
          console.log('[OpenAI-STT] Session updated')
          break

        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcription (streaming as you speak)
          if (message.delta) {
            this.currentTranscript += message.delta
            const fullText = this.allTranscripts.length > 0 
              ? this.allTranscripts.join(' ') + ' ' + this.currentTranscript
              : this.currentTranscript
            console.log('[OpenAI-STT] Live transcript:', fullText)
            if (this.transcriptCallback) {
              console.log('[OpenAI-STT] Calling transcript callback...')
              this.transcriptCallback({ text: fullText, isFinal: false })
            } else {
              console.log('[OpenAI-STT] WARNING: No transcript callback set!')
            }
          }
          break

        case 'conversation.item.input_audio_transcription.completed':
          // Final transcription for this segment
          const finalText = message.transcript || this.currentTranscript
          console.log('[OpenAI-STT] Transcription segment completed:', finalText)
          // Accumulate all transcripts
          if (finalText.trim()) {
            this.allTranscripts.push(finalText.trim())
            console.log('[OpenAI-STT] Accumulated transcripts:', this.allTranscripts.length, 'segments, total:', this.allTranscripts.join(' '))
          }
          // Send the accumulated transcript
          this.transcriptCallback?.({
            text: this.allTranscripts.join(' '),
            isFinal: true,
          })
          this.currentTranscript = ''
          break

        case 'input_audio_buffer.speech_started':
          console.log('[OpenAI-STT] Speech started (VAD detected voice)')
          break

        case 'input_audio_buffer.speech_stopped':
          console.log('[OpenAI-STT] Speech stopped (VAD detected silence)')
          break

        case 'input_audio_buffer.committed':
          // Audio chunk processed
          break

        case 'error':
          console.error('[OpenAI-STT] API error:', message.error)
          break

        default:
          // Log unknown message types to see what we're receiving
          console.log('[OpenAI-STT] Unknown event type:', message.type)
          break
      }
    } catch (error) {
      console.error('[OpenAI-STT] Failed to parse message:', error)
    }
  }

  /**
   * Send audio chunk to the API
   * Audio should be PCM16 @ 16kHz mono
   */
  sendAudioChunk(base64Audio: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue for when connection is ready (limit to prevent memory issues)
      if (this.pendingAudioChunks.length < 100) {
        this.pendingAudioChunks.push(base64Audio)
      }
      return
    }

    const message = {
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[OpenAI-STT] Failed to send audio chunk:', error)
    }
  }

  /**
   * Send raw PCM buffer (will be base64 encoded)
   */
  sendAudioBuffer(buffer: Buffer): void {
    const base64 = buffer.toString('base64')
    this.sendAudioChunk(base64)
  }

  /**
   * Set callback for transcription results
   */
  onTranscript(callback: TranscriptionCallback): void {
    this.transcriptCallback = callback
  }

  /**
   * Commit the audio buffer (signal end of input)
   */
  commitAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const message = {
      type: 'input_audio_buffer.commit',
    }

    this.ws.send(JSON.stringify(message))
    console.log('[OpenAI-STT] Audio buffer committed')
  }

  /**
   * Clear the audio buffer and reset transcripts
   */
  clearAudio(): void {
    // Always reset local state
    this.currentTranscript = ''
    this.allTranscripts = []
    this.pendingAudioChunks = []
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const message = {
      type: 'input_audio_buffer.clear',
    }

    this.ws.send(JSON.stringify(message))
    console.log('[OpenAI-STT] Audio buffer cleared, transcripts reset')
  }

  /**
   * Get the full accumulated transcript
   */
  getFullTranscript(): string {
    return this.allTranscripts.join(' ')
  }

  /**
   * Disconnect from the API
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.currentTranscript = ''
    this.allTranscripts = []
    this.pendingAudioChunks = []
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton export
export const openaiSttService = new OpenAISttService()
