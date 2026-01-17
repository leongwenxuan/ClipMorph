#!/usr/bin/env python3
"""
Parakeet v2 STT Sidecar Server

Local speech-to-text server using NVIDIA Parakeet TDT 0.6B v2 model.
Communicates via stdin/stdout JSON protocol.

Protocol:
- Input: JSON lines on stdin
- Output: JSON lines on stdout
- Commands: {"cmd": "transcribe", "audio_path": "/path/to/audio.wav"}
- Responses: {"ok": true, "text": "transcribed text"} or {"ok": false, "error": "message"}
"""

import sys
import json
import os
import tempfile
from pathlib import Path

# Lazy imports for faster startup when just checking health
_model = None
_processor = None


def get_cache_dir():
    """Get the model cache directory (deterministic, in app support)."""
    # Use XDG_CACHE_HOME or fallback to ~/.cache
    cache_base = os.environ.get('XDG_CACHE_HOME', os.path.expanduser('~/.cache'))
    cache_dir = Path(cache_base) / 'clipmorph' / 'models' / 'parakeet'
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def load_model():
    """Load the Parakeet v2 model (lazy, on first transcription)."""
    global _model, _processor
    
    if _model is not None:
        return _model, _processor
    
    try:
        import nemo.collections.asr as nemo_asr
        
        # Set cache directory
        cache_dir = get_cache_dir()
        os.environ['NEMO_CACHE_DIR'] = str(cache_dir)
        
        # Load Parakeet TDT 0.6B v2 model
        model_name = "nvidia/parakeet-tdt-0.6b-v2"
        _model = nemo_asr.models.ASRModel.from_pretrained(model_name)
        _model.eval()
        
        return _model, None
    except ImportError as e:
        raise RuntimeError(f"NeMo not installed: {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e}")


def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio file to text."""
    model, _ = load_model()
    
    # Verify file exists
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    
    # Transcribe
    transcriptions = model.transcribe([audio_path])
    
    if transcriptions and len(transcriptions) > 0:
        result = transcriptions[0]
        # Handle different return types (string or Hypothesis object)
        if hasattr(result, 'text'):
            return result.text
        elif isinstance(result, str):
            return result
        else:
            return str(result)
    
    return ""


def handle_command(cmd_data: dict) -> dict:
    """Handle a single command from stdin."""
    cmd = cmd_data.get('cmd')
    
    if cmd == 'health':
        # Quick health check without loading model
        return {'ok': True, 'status': 'ready'}
    
    elif cmd == 'transcribe':
        audio_path = cmd_data.get('audio_path')
        if not audio_path:
            return {'ok': False, 'error': 'Missing audio_path'}
        
        try:
            text = transcribe_audio(audio_path)
            return {'ok': True, 'text': text}
        except FileNotFoundError as e:
            return {'ok': False, 'error': str(e)}
        except Exception as e:
            return {'ok': False, 'error': f"Transcription failed: {e}"}
    
    elif cmd == 'preload':
        # Explicitly load model (optional, for warming up)
        try:
            load_model()
            return {'ok': True, 'status': 'model_loaded'}
        except Exception as e:
            return {'ok': False, 'error': str(e)}
    
    elif cmd == 'shutdown':
        return {'ok': True, 'status': 'shutting_down', 'exit': True}
    
    else:
        return {'ok': False, 'error': f'Unknown command: {cmd}'}


def main():
    """Main loop - read JSON lines from stdin, write responses to stdout."""
    # Disable buffering for stdout
    sys.stdout.reconfigure(line_buffering=True)
    
    # Signal ready
    print(json.dumps({'ok': True, 'status': 'started'}), flush=True)
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            cmd_data = json.loads(line)
        except json.JSONDecodeError as e:
            print(json.dumps({'ok': False, 'error': f'Invalid JSON: {e}'}), flush=True)
            continue
        
        response = handle_command(cmd_data)
        print(json.dumps(response), flush=True)
        
        # Check for exit signal
        if response.get('exit'):
            break


if __name__ == '__main__':
    main()
