/**
 * Audio Utilities for STT
 *
 * Helpers for capturing and preparing audio for Parakeet transcription.
 * Audio requirements: 16kHz mono WAV
 */

import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Audio constants
export const SAMPLE_RATE = 16000 // 16kHz for Parakeet
export const CHANNELS = 1 // Mono
export const BIT_DEPTH = 16 // 16-bit PCM

/**
 * Create a temporary WAV file from raw PCM audio data
 */
export function createTempWavFile(pcmData: Buffer): string {
  const tempPath = join(tmpdir(), `clipmorph-audio-${Date.now()}.wav`)
  const wavData = pcmToWav(pcmData)
  writeFileSync(tempPath, wavData)
  return tempPath
}

/**
 * Delete a temporary audio file
 */
export function deleteTempFile(filePath: string): void {
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
    } catch {
      // Ignore deletion errors
    }
  }
}

/**
 * Convert raw PCM data to WAV format
 * PCM should be 16-bit signed, little-endian, mono, 16kHz
 */
export function pcmToWav(pcmData: Buffer): Buffer {
  const dataSize = pcmData.length
  const fileSize = 36 + dataSize // Header (44) - 8 + data

  // WAV header
  const header = Buffer.alloc(44)

  // RIFF chunk descriptor
  header.write('RIFF', 0) // ChunkID
  header.writeUInt32LE(fileSize, 4) // ChunkSize
  header.write('WAVE', 8) // Format

  // fmt sub-chunk
  header.write('fmt ', 12) // Subchunk1ID
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  header.writeUInt16LE(CHANNELS, 22) // NumChannels
  header.writeUInt32LE(SAMPLE_RATE, 24) // SampleRate
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8), 28) // ByteRate
  header.writeUInt16LE(CHANNELS * (BIT_DEPTH / 8), 32) // BlockAlign
  header.writeUInt16LE(BIT_DEPTH, 34) // BitsPerSample

  // data sub-chunk
  header.write('data', 36) // Subchunk2ID
  header.writeUInt32LE(dataSize, 40) // Subchunk2Size

  return Buffer.concat([header, pcmData])
}

/**
 * Validate audio duration (in samples)
 */
export function getAudioDurationMs(pcmData: Buffer): number {
  const bytesPerSample = BIT_DEPTH / 8
  const samples = pcmData.length / bytesPerSample
  return (samples / SAMPLE_RATE) * 1000
}

/**
 * Check if audio is long enough for transcription
 */
export function isAudioLongEnough(pcmData: Buffer, minDurationMs = 200): boolean {
  return getAudioDurationMs(pcmData) >= minDurationMs
}

/**
 * Normalize audio levels (simple peak normalization)
 */
export function normalizeAudio(pcmData: Buffer): Buffer {
  const samples = new Int16Array(
    pcmData.buffer,
    pcmData.byteOffset,
    pcmData.length / 2
  )

  // Find peak
  let peak = 0
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample))
  }

  // Skip if already normalized or silent
  if (peak === 0 || peak >= 32767 * 0.9) {
    return pcmData
  }

  // Calculate normalization factor (target 90% of max)
  const factor = (32767 * 0.9) / peak

  // Normalize
  const normalized = Buffer.alloc(pcmData.length)
  const normalizedSamples = new Int16Array(
    normalized.buffer,
    normalized.byteOffset,
    normalized.length / 2
  )

  for (let i = 0; i < samples.length; i++) {
    normalizedSamples[i] = Math.round(samples[i] * factor)
  }

  return normalized
}
