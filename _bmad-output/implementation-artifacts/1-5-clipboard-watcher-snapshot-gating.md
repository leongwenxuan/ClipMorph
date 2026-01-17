# Story 1.5: Clipboard Watcher + Snapshot Gating

Status: review

**Story ID:** 1.5  
**Story Key:** `1-5-clipboard-watcher-snapshot-gating`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to detect clipboard changes and only apply results to the correct snapshot,  
so that I never lose newer clipboard content to stale job outputs.

## Acceptance Criteria

1.
   **Given** the system clipboard changes  
   **When** ClipMorph observes it  
   **Then** it records a new clipboard snapshot and emits a `clipboard.changed` event (FR5)  
   **And** it avoids self-trigger loops caused by ClipMorph writes (Architecture constraint)  


## Tasks / Subtasks

- [x] Task 1: the system clipboard changes (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 90 tests pass

### Completion Notes List

- Created `src/main/services/clipboard-service.ts` - handles clipboard watching and snapshot gating
- Implemented `ClipboardService` class with singleton pattern
- Implemented clipboard polling with configurable interval (default 500ms)
- Implemented `ClipboardSnapshot` with id, text, timestamp, and hash
- Implemented self-trigger immunity using hash tracking with 2-second expiry
- Implemented `writeClipboardGated()` for snapshot-gated writes
- Returns `CLIPBOARD_SNAPSHOT_MISMATCH` error when snapshot is stale
- Added `CLIPBOARD_CHANGED` event emission when external changes detected
- Added IPC handlers: `clipmorph:clipboard:read`, `clipmorph:clipboard:write`
- Updated preload to expose clipboard APIs: `readClipboard()`, `writeClipboard()`
- Added clipboard types to contracts: `ClipboardSnapshot`, `ClipboardChangedPayload`, etc.
- Added 19 comprehensive unit tests for clipboard service

### File List

- `src/main/services/clipboard-service.ts` (new)
- `src/main/__tests__/clipboard-service.test.ts` (new)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `packages/contracts/src/index.ts` (modified)

## Change Log

- 2026-01-17: Implemented clipboard watcher with snapshot gating and self-trigger immunity
