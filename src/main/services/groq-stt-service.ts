/**
 * Groq Whisper STT Service
 * 
 * Uses Groq's fast Whisper API for speech-to-text.
 * Non-streaming but very fast (~500ms latency).
 */

import Groq from 'groq-sdk'
import { secretsService } from './secrets-service'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface GroqTranscriptionResult {
  text: string
  duration?: number
}

class GroqSttService {
  private client: Groq | null = null
  private apiKey: string | null = null

  /**
   * Get or create Groq client
   */
  private async getClient(): Promise<Groq> {
    const apiKey = await secretsService.getGroqKey()
    
    if (!apiKey) {
      throw new Error('No Groq API key configured. Add it in Settings.')
    }

    if (!this.client || this.apiKey !== apiKey) {
      this.apiKey = apiKey
      this.client = new Groq({ apiKey })
    }

    return this.client
  }

  /**
   * Check if Groq API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const key = await secretsService.getGroqKey()
    return !!key
  }

  /**
   * Transcribe audio buffer using Groq Whisper
   * @param audioBuffer - Raw PCM16 audio at 16kHz mono
   * @param durationMs - Recording duration in milliseconds
   */
  async transcribe(audioBuffer: Buffer, durationMs: number): Promise<GroqTranscriptionResult> {
    const client = await this.getClient()
    
    console.log(`[GroqSTT] Transcribing ${audioBuffer.length} bytes (${durationMs}ms)...`)

    // Groq expects a WAV file, so we need to add WAV header to the raw PCM
    const wavBuffer = this.pcmToWav(audioBuffer, 16000, 1, 16)
    
    // Write to temp file (Groq SDK requires a file path or ReadStream)
    const tempPath = path.join(os.tmpdir(), `clipmorph-audio-${Date.now()}.wav`)
    fs.writeFileSync(tempPath, wavBuffer)

    try {
      const startTime = Date.now()
      
      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-large-v3-turbo', // Fast and accurate
        language: 'en',
        response_format: 'json',
      })

      const elapsed = Date.now() - startTime
      console.log(`[GroqSTT] Transcription completed in ${elapsed}ms: "${transcription.text}"`)

      return {
        text: transcription.text,
        duration: elapsed,
      }
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Convert raw PCM16 audio to WAV format
   */
  private pcmToWav(pcmBuffer: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
    const dataSize = pcmBuffer.length
    const headerSize = 44
    const fileSize = headerSize + dataSize - 8
    const byteRate = sampleRate * channels * (bitsPerSample / 8)
    const blockAlign = channels * (bitsPerSample / 8)

    const header = Buffer.alloc(headerSize)
    
    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(fileSize, 4)
    header.write('WAVE', 8)
    
    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // fmt chunk size
    header.writeUInt16LE(1, 20) // audio format (1 = PCM)
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    
    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, pcmBuffer])
  }
}

export const groqSttService = new GroqSttService()
