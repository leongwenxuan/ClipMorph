# Story 3.5: Automation Form Fill (Basic Resume Mapping)

Status: review

**Story ID:** 3.5  
**Story Key:** `3-5-automation-form-fill-basic-resume-mapping`  
**Epic:** 3

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a job seeker,  
I want ClipMorph to fill common application fields from my resume content,  
so that applications take fewer manual steps.

## Acceptance Criteria

1.
   **Given** an automation job is on an application form with common fields (name/email/phone, etc.)  
   **When** the automation loop identifies fillable fields  
   **Then** it fills fields using parsed resume content (FR26)  
   **And** it reports completion/failure with a clear status and reason (FR27)  


## Tasks / Subtasks

- [x] Task 1: an automation job is on an application form with common fields (name/email/ph... (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 3.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Created resume-parser module to extract structured data (name, email, phone, address, social links)
- Created form-filler module to map resume data to form fields
- Implemented field type identification based on label/placeholder/name patterns
- Implemented confidence-based form filling (only fills high-confidence matches)
- Added form detection to identify application pages
- Added 32 tests for resume parsing and form filling
- All tests pass (57 browser-automation tests total)

### File List

- `packages/browser-automation/src/resume-parser.ts` - NEW: Resume text parsing and field extraction
- `packages/browser-automation/src/form-filler.ts` - NEW: Form field mapping and fill action generation
- `packages/browser-automation/src/index.ts` - Added exports for new modules
- `packages/browser-automation/src/__tests__/resume-parser.test.ts` - NEW: 19 tests for resume parsing
- `packages/browser-automation/src/__tests__/form-filler.test.ts` - NEW: 13 tests for form filling
- `_bmad-output/implementation-artifacts/3-5-automation-form-fill-basic-resume-mapping.md` - Updated story file
