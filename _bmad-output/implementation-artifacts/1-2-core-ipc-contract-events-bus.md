# Story 1.2: Core IPC Contract + Events Bus

Status: review

**Story ID:** 1.2  
**Story Key:** `1-2-core-ipc-contract-events-bus`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want the UI and the main process to communicate through a stable, typed contract,  
so that ClipMorph stays maintainable as capabilities expand.

## Acceptance Criteria

1.
   **Given** the renderer invokes a main-process handler  
   **When** an IPC request is made  
   **Then** responses use the mandatory envelope `{ ok, requestId, data|error }`  
   **And** IPC channel names follow `clipmorph:<domain>:<action>` (Architecture constraint)  


## Tasks / Subtasks

- [x] Task 1: the renderer invokes a main-process handler (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 27 tests pass

### Completion Notes List

- Created `packages/contracts/src/index.ts` - single source of truth for all IPC types
- Implemented IpcChannels constants with `clipmorph:<domain>:<action>` naming convention
- Implemented IpcResponse envelope types: `IpcSuccessResponse<T>` and `IpcErrorResponse`
- Added type guards `isIpcSuccess()` and `isIpcError()` for response handling
- Defined ErrorCodes enum with explicit error codes (no stringly typed errors)
- Defined EventTypes for the events bus
- Created helper functions: `createSuccessResponse()`, `createErrorResponse()`, `createEvent()`, `generateRequestId()`
- Updated main process to use contracts and emit typed events
- Updated preload to use contracts for typed API
- Updated renderer to use contracts for type-safe IPC handling
- Added comprehensive tests for contracts (20 tests)
- Updated existing main process tests to use contracts (7 tests)

### File List

- `packages/contracts/src/index.ts` (new)
- `packages/contracts/src/__tests__/index.test.ts` (new)
- `packages/contracts/package.json` (new)
- `packages/contracts/tsconfig.json` (new)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `src/preload/index.d.ts` (modified)
- `src/renderer/src/App.tsx` (modified)
- `src/main/__tests__/index.test.ts` (modified)
- `vitest.config.ts` (modified)

## Change Log

- 2026-01-17: Implemented core IPC contract with typed envelope responses and events bus
