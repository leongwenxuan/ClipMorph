# Story 1.6: Shadow Clipboard + Undo Hotkey (⌥⌘Z)

Status: review

**Story ID:** 1.6  
**Story Key:** `1-6-shadow-clipboard-undo-hotkey-z`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want to undo the most recent clipboard overwrite reliably,  
so that I can trust trying voice transforms without fear.

## Acceptance Criteria

1.
   **Given** ClipMorph overwrites the clipboard with a transform result  
   **When** the overwrite happens  
   **Then** the previous clipboard value is stored in a 2-deep shadow history (FR10)  
   **And** the shadow history stores enough type metadata to restore correctly (text/structured text/file path if supported) (FR6)  


## Tasks / Subtasks

- [x] Task 1: ClipMorph overwrites the clipboard with a transform result (AC: #1)
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
- If you need to introduce a new library, document why and ensure it doesn't violate locked stack decisions.

### Architecture compliance

- Follow `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/architecture.md` exactly; do not introduce alternate patterns.

### Latest Tech Information

- electron-vite convention: `src/main/*`, `src/preload/*`, `src/renderer/*`, `electron.vite.config.ts`.
- Preload pattern: `contextBridge.exposeInMainWorld(...)` with a narrow allowlist; prefer `ipcMain.handle` / `ipcRenderer.invoke` for request/response.

### Project Structure Notes

- Keep filenames `kebab-case.*` and IPC/channel constants centralized (no stringly scattered literals).

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 101 tests pass

### Completion Notes List

- Extended `ClipboardSnapshot` with content type metadata: `contentType`, `html`, `rtf`
- Implemented 2-deep shadow history (`SHADOW_HISTORY_DEPTH = 2`)
- Added `pushToShadowHistory()` to save snapshots before overwrites
- Updated `writeClipboard()` with optional `saveToHistory` parameter
- Added `writeClipboardWithSnapshot()` for full content restoration (preserves HTML/RTF)
- Implemented `undo()` method that restores from shadow history
- Added `getShadowHistory()`, `getUndoCount()`, `canUndo()` helper methods
- Updated `writeClipboardGated()` to automatically save to history
- Added IPC handler: `clipmorph:clipboard:undo`
- Updated preload to expose `undoClipboard()` API
- Added `ClipboardUndoResponse` type to contracts
- Added 11 new tests for shadow history and undo functionality
- Added 3 tests for content type detection (HTML, RTF, text)

### File List

- `src/main/services/clipboard-service.ts` (modified)
- `src/main/__tests__/clipboard-service.test.ts` (modified)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `packages/contracts/src/index.ts` (modified)

## Change Log

- 2026-01-17: Implemented 2-deep shadow clipboard history with undo and content type preservation
