# Story 1.7: Global Push-to-Talk Hotkey

Status: review

**Story ID:** 1.7  
**Story Key:** `1-7-global-push-to-talk-hotkey`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want a global push-to-talk hotkey to start/stop command capture,  
so that I can issue commands without switching apps.

## Acceptance Criteria

1.
   **Given** ClipMorph is running and permissions allow  
   **When** the user presses and holds the configured push-to-talk hotkey  
   **Then** audio capture begins and UI status indicates “listening” (FR11)  
   **And** releasing the hotkey ends capture and proceeds to transcription  


## Tasks / Subtasks

- [x] Task 1: ClipMorph is running and permissions allow (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.7)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References


### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- NOTE: `_bmad/core/tasks/validate-workflow.xml` is referenced by workflow but not present in this repo; no automated validation runner executed.
- Implemented VoiceService with global push-to-talk hotkey (default: Cmd+Shift+V)
- Added IPC handlers for voice:start and voice:stop
- Added VoiceStateResponse type to contracts
- Integrated voiceService into main process lifecycle
- Status changes to 'listening' when hotkey is held, 'processing' after release
- Short captures (<200ms) are ignored to prevent accidental triggers
- All 117 tests pass including 18 new voice-service tests

### File List

- `_bmad-output/implementation-artifacts/1-7-global-push-to-talk-hotkey.md`
- `src/main/services/voice-service.ts` (new)
- `src/main/__tests__/voice-service.test.ts` (new)
- `src/main/index.ts` (modified - added voice handlers and service integration)
- `src/preload/index.ts` (modified - added startVoice/stopVoice API)
- `packages/contracts/src/index.ts` (modified - added VoiceStateResponse)
- `tsconfig.node.json` (modified - added contracts to include)