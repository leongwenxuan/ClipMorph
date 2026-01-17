# Story 1.8: Local STT Sidecar (Parakeet v2) + Transcript Surfacing

Status: review

**Story ID:** 1.8  
**Story Key:** `1-8-local-stt-sidecar-parakeet-v2-transcript-surfacing`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want my spoken command transcribed locally and shown as the last transcript,  
so that I can verify what the system heard.

## Acceptance Criteria

1.
   **Given** a push-to-talk recording completes  
   **When** transcription finishes  
   **Then** ClipMorph produces a transcript string (FR12)  
   **And** the UI can display the last transcript for the most recent action (FR13)  


## Tasks / Subtasks

- [x] Task 1: a push-to-talk recording completes (AC: #1)
  - [x] Implement main-process/service changes for AC #1
  - [x] Implement preload API surface for AC #1 (if IPC/UI needed)
  - [x] Implement renderer UI updates for AC #1 (if needed)
  - [x] Add minimal sanity checks / smoke tests for AC #1

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no clipboard/mic/db/automation).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).
- **Clipboard correctness**: snapshot gating, pending-means-no-change, 2-deep undo, self-trigger immunity.

### Technical requirements (story-specific)

- Keep scope tight: implement only what the ACs require; no speculative features.
- Prefer deterministic implementations over LLM-dependent behavior where possible.
- If you need to introduce a new library, document why and ensure it doesn’t violate locked stack decisions.

### Architecture compliance

- Follow `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/architecture.md` exactly; do not introduce alternate patterns.

### Latest Tech Information

- electron-vite convention: `src/main/*`, `src/preload/*`, `src/renderer/*`, `electron.vite.config.ts`.
- Preload pattern: `contextBridge.exposeInMainWorld(...)` with a narrow allowlist; prefer `ipcMain.handle` / `ipcRenderer.invoke` for request/response.

### Project Structure Notes

- Keep filenames `kebab-case.*` and IPC/channel constants centralized (no stringly scattered literals).

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.8)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References


### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- NOTE: `_bmad/core/tasks/validate-workflow.xml` is referenced by workflow but not present in this repo; no automated validation runner executed.
- Created STT Parakeet package with Python sidecar (nvidia/parakeet-tdt-0.6b-v2)
- Implemented SttClient for Node.js to communicate with Python sidecar via stdin/stdout JSON
- Added audio utilities for WAV file creation and PCM processing
- Integrated STT into VoiceService for transcription after push-to-talk
- Added transcript storage (last 20) with getLastTranscript/getTranscripts/clearTranscripts APIs
- Added IPC handlers and preload API for transcript retrieval
- All 117 tests pass

### File List

- `_bmad-output/implementation-artifacts/1-8-local-stt-sidecar-parakeet-v2-transcript-surfacing.md`
- `packages/stt-parakeet/package.json` (new)
- `packages/stt-parakeet/tsconfig.json` (new)
- `packages/stt-parakeet/src/index.ts` (new)
- `packages/stt-parakeet/src/types.ts` (new)
- `packages/stt-parakeet/src/client.ts` (new)
- `packages/stt-parakeet/src/audio.ts` (new)
- `packages/stt-parakeet/sidecar/server.py` (new)
- `packages/stt-parakeet/sidecar/requirements.txt` (new)
- `packages/stt-parakeet/sidecar/README.md` (new)
- `src/main/services/voice-service.ts` (modified - STT integration + transcript storage)
- `src/main/index.ts` (modified - added transcript IPC handlers)
- `src/preload/index.ts` (modified - added transcript API)
- `packages/contracts/src/index.ts` (modified - added transcript types + channels)