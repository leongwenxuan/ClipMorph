/**
 * STT Parakeet Package
 *
 * Local speech-to-text using NVIDIA Parakeet v2 model via Python sidecar.
 */

export { SttClient, getSttClient, resetSttClient } from './client'
export {
  createTempWavFile,
  deleteTempFile,
  pcmToWav,
  getAudioDurationMs,
  isAudioLongEnough,
  normalizeAudio,
  SAMPLE_RATE,
  CHANNELS,
  BIT_DEPTH,
} from './audio'
export type {
  SidecarCommand,
  SidecarResponse,
  SttClientConfig,
  TranscriptionResult,
  SidecarState,
} from './types'
