# Story 2.3: Transcript History (Last 20) + Clear History Control

Status: complete

**Story ID:** 2.3  
**Story Key:** `2-3-transcript-history-last-20-clear-history-control`  
**Epic:** 2

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to keep a small rolling transcript history and allow clearing it,  
so that I have transparency without excessive retention.

## Acceptance Criteria

1.
   **Given** actions occur over time  
   **When** transcripts are recorded  
   **Then** ClipMorph persists up to the last 20 transcripts locally (rolling retention) (NFR10 / PRD NFR-S2)  
   **And** older transcripts are removed automatically when the cap is exceeded  


## Tasks / Subtasks

- [x] Task 1: actions occur over time (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 2.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References


### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- NOTE: `_bmad/core/tasks/validate-workflow.xml` is referenced by workflow but not present in this repo; no automated validation runner executed.

### File List

- `_bmad-output/implementation-artifacts/2-3-transcript-history-last-20-clear-history-control.md`
