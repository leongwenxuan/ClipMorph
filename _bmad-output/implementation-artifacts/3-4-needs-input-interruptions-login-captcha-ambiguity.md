# Story 3.4: “Needs Input” Interruptions (Login/CAPTCHA/Ambiguity)

Status: review

**Story ID:** 3.4  
**Story Key:** `3-4-needs-input-interruptions-login-captcha-ambiguity`  
**Epic:** 3

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a job seeker,  
I want ClipMorph to pause and ask for help when automation can’t proceed,  
so that the system doesn’t get stuck or do the wrong thing.

## Acceptance Criteria

1.
   **Given** automation hits a login screen, CAPTCHA, or ambiguous form step  
   **When** the system detects it cannot proceed safely  
   **Then** the job transitions to `needs_input` and stops acting (FR29)  
   **And** the UI explains what input/approval is required to continue  


## Tasks / Subtasks

- [x] Task 1: automation hits a login screen, CAPTCHA, or ambiguous form step (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 3.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Needs_input detection implemented in automation loop (login, captcha, ambiguity detection)
- Updated JobStatus UI component with enhanced needs_input banner showing reason and message
- Added Continue and Cancel buttons for user to respond to needs_input state
- IPC handler for provideAutomationInput already exists from Story 3.1
- Added 7 tests for needs_input detection scenarios
- All tests pass (25 browser-automation tests)

### File List

- `packages/browser-automation/src/loop.ts` - Contains detectNeedsInput function (implemented in Story 3.3)
- `src/renderer/src/components/JobStatus.tsx` - Enhanced needs_input UI with Continue/Cancel actions
- `src/renderer/src/components/JobStatus.css` - Styled needs_input banner with action buttons
- `packages/browser-automation/src/__tests__/loop.test.ts` - NEW: Tests for needs_input detection
- `_bmad-output/implementation-artifacts/3-4-needs-input-interruptions-login-captcha-ambiguity.md` - Updated story file
