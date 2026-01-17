# Story 3.2: Start “Apply on this portal” Automation From Voice

Status: review

**Story ID:** 3.2  
**Story Key:** `3-2-start-apply-on-this-portal-automation-from-voice`  
**Epic:** 3

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a job seeker,  
I want to initiate “apply on this portal” from a voice command using clipboard resume content,  
so that I can start an application flow quickly.

## Acceptance Criteria

1.
   **Given** the clipboard contains resume text (or a resume file path, if supported)  
   **When** the user issues the supported automation command  
   **Then** ClipMorph starts an automation job and opens a Chrome automation context (FR24, FR25)  
   **And** it shows “running” status to the user (FR27)  
   **And** automation uses Chrome for MVP (NFR13)  


## Tasks / Subtasks

- [x] Task 1: the clipboard contains resume text (or a resume file path, if supported) (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 3.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Updated IntentService.handleAutomationIntent to start automation jobs via AutomationService
- Voice commands "apply to this portal", "fill out this form", "start automation" now trigger automation jobs
- Clipboard content is passed to automation context for resume text usage
- Added 3 tests for automation intent routing
- All tests pass (12 intent-service tests)

### File List

- `src/main/services/intent-service.ts` - Updated to route automation intents to AutomationService with clipboard content
- `src/main/__tests__/intent-service.test.ts` - Added automation intent tests
- `_bmad-output/implementation-artifacts/3-2-start-apply-on-this-portal-automation-from-voice.md` - Updated story file
