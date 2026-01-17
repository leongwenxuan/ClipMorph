# Parakeet v2 STT Sidecar

Local speech-to-text server using NVIDIA Parakeet TDT 0.6B v2 model.

## Model

- **Name:** `nvidia/parakeet-tdt-0.6b-v2`
- **Framework:** NeMo
- **Size:** ~600MB
- **Cache Location:** `~/.cache/clipmorph/models/parakeet/`

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Protocol

The sidecar communicates via stdin/stdout JSON lines.

### Commands

**Health Check:**
```json
{"cmd": "health"}
// Response: {"ok": true, "status": "ready"}
```

**Preload Model:**
```json
{"cmd": "preload"}
// Response: {"ok": true, "status": "model_loaded"}
```

**Transcribe Audio:**
```json
{"cmd": "transcribe", "audio_path": "/path/to/audio.wav"}
// Response: {"ok": true, "text": "transcribed text"}
```

**Shutdown:**
```json
{"cmd": "shutdown"}
// Response: {"ok": true, "status": "shutting_down", "exit": true}
```

## Audio Requirements

- Format: WAV (16-bit PCM)
- Sample Rate: 16kHz (recommended)
- Channels: Mono

## Offline Operation

After the first model download, transcription works completely offline.
The model is cached in `~/.cache/clipmorph/models/parakeet/`.
