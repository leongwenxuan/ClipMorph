# Story 1.4: Job Manager + Status Model (Transforms)

Status: review

**Story ID:** 1.4  
**Story Key:** `1-4-job-manager-status-model-transforms`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want transforms to run as explicit jobs with progress and cancellation,  
so that long operations don't hang or clobber my clipboard unexpectedly.

## Acceptance Criteria

1.
   **Given** a transform is started  
   **When** it is running  
   **Then** a job exists with status in `pending | running | completed | failed | cancelled`  
   **And** status transitions are monotonic and timestamped (Architecture constraint)  


## Tasks / Subtasks

- [x] Task 1: a transform is started (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All 71 tests pass

### Completion Notes List

- Created `src/main/services/job-manager.ts` - manages job lifecycle
- Implemented `JobManager` class with singleton pattern
- Implemented monotonic status transitions: `pending → running → (needs_input | completed | failed | cancelled)`
- Implemented `VALID_TRANSITIONS` map to enforce valid state changes
- Added timestamped transitions (createdAt, updatedAt)
- Implemented job methods: `createJob()`, `startJob()`, `completeJob()`, `failJob()`, `cancelJob()`, `needsInputJob()`, `resumeJob()`
- Added `isTerminal()` check for completed/failed/cancelled states
- Added `cleanup()` method to remove old terminal jobs
- Integrated with event system - emits JOB_CREATED, JOB_UPDATED, JOB_COMPLETED, JOB_FAILED, JOB_CANCELLED, JOB_NEEDS_INPUT
- Added IPC handlers: `clipmorph:job:create`, `clipmorph:job:get`, `clipmorph:job:cancel`, `clipmorph:job:list`
- Updated preload to expose job APIs: `createJob()`, `getJob()`, `cancelJob()`, `listJobs()`
- Added 30 comprehensive unit tests for job manager

### File List

- `src/main/services/job-manager.ts` (new)
- `src/main/__tests__/job-manager.test.ts` (new)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `packages/contracts/src/index.ts` (modified - Job types already existed)

## Change Log

- 2026-01-17: Implemented job manager with monotonic status transitions and IPC handlers
