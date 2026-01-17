# Story 1.3: Permission Detection + Degraded Mode

Status: review

**Story ID:** 1.3  
**Story Key:** `1-3-permission-detection-degraded-mode`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to detect missing microphone/accessibility permissions and explain what's needed,  
so that I can fix setup issues quickly and trust the app.

## Acceptance Criteria

1.
   **Given** ClipMorph is running  
   **When** the user has not granted microphone permission  
   **Then** the UI indicates "mic permission required" and voice features are disabled (FR2)  
   **And** the app does not attempt to start voice capture  


## Tasks / Subtasks

- [x] Task 1: ClipMorph is running (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 41 tests pass

### Completion Notes List

- Created `src/main/services/permission-service.ts` - handles macOS permission detection
- Implemented `checkMicrophonePermission()` using Electron's `systemPreferences.getMediaAccessStatus`
- Implemented `checkAccessibilityPermission()` using `systemPreferences.isTrustedAccessibilityClient`
- Implemented `requestMicrophonePermission()` and `requestAccessibilityPermission()` for permission prompts
- Added `canEnableVoice()` and `canEnableHotkeys()` helper functions
- Added permission IPC channels: `clipmorph:permission:getall`, `clipmorph:permission:check`, `clipmorph:permission:request`
- Added permission types to contracts: `PermissionType`, `PermissionStatus`, `PermissionState`, etc.
- Added `PERMISSION_CHANGED` event type
- Updated preload to expose permission APIs: `getPermissions()`, `checkPermission()`, `requestPermission()`
- Updated renderer UI to show permission warning when mic not granted
- Added "Enable" button for requesting permission when status is `not-determined`
- Added 14 unit tests for permission service with mocked Electron APIs

### File List

- `src/main/services/permission-service.ts` (new)
- `src/main/__tests__/permission-service.test.ts` (new)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `src/renderer/src/App.tsx` (modified)
- `src/renderer/src/styles/App.css` (modified)
- `packages/contracts/src/index.ts` (modified)

## Change Log

- 2026-01-17: Implemented permission detection with UI feedback and IPC handlers
