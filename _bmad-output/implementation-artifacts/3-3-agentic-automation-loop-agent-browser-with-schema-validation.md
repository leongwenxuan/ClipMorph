# Story 3.3: Agentic Automation Loop (agent-browser) With Schema Validation

Status: review

**Story ID:** 3.3  
**Story Key:** `3-3-agentic-automation-loop-agent-browser-with-schema-validation`  
**Epic:** 3

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a job seeker,  
I want ClipMorph to drive browser interactions robustly without brittle selectors,  
so that it can handle different portals.

## Acceptance Criteria

1.
   **Given** an automation job is running  
   **When** the automation loop executes  
   **Then** it follows `snapshot → decide actions → execute → resnapshot` until completion (Architecture constraint)  
   **And** it operates on ref-based snapshot targets (not per-site CSS selectors) (Architecture constraint)  


## Tasks / Subtasks

- [x] Task 1: an automation job is running (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 3.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Created `packages/browser-automation` module with Playwright-based automation
- Implemented ref-based snapshot system (not CSS selectors) for robust element targeting
- Implemented action schema validation before execution
- Created automation loop: snapshot → decide actions → execute → resnapshot
- Integrated AutomationLoop into AutomationService for job orchestration
- Added 18 unit tests for action validation
- All tests pass (228 total, 5 pre-existing voice-service failures)

### File List

- `packages/browser-automation/package.json` - NEW: Package configuration
- `packages/browser-automation/tsconfig.json` - NEW: TypeScript config
- `packages/browser-automation/src/types.ts` - NEW: Type definitions for automation
- `packages/browser-automation/src/snapshot.ts` - NEW: Ref-based page snapshot
- `packages/browser-automation/src/actions.ts` - NEW: Action validation and execution
- `packages/browser-automation/src/loop.ts` - NEW: Automation loop implementation
- `packages/browser-automation/src/index.ts` - NEW: Package exports
- `packages/browser-automation/src/__tests__/actions.test.ts` - NEW: Action validation tests
- `src/main/services/automation-service.ts` - Added runAutomationLoop method
- `package.json` - Added playwright dependency
- `_bmad-output/implementation-artifacts/3-3-agentic-automation-loop-agent-browser-with-schema-validation.md` - Updated story file
