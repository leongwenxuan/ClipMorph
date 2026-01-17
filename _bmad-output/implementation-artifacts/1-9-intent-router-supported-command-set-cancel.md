# Story 1.9: Intent Router (Supported Command Set) + Cancel

Status: review

**Story ID:** 1.9  
**Story Key:** `1-9-intent-router-supported-command-set-cancel`  
**Epic:** 1

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to route my transcript to a supported capability (transform vs automation),  
so that commands are reliable and not “random LLM vibes”.

## Acceptance Criteria

1.
   **Given** a transcript is produced  
   **When** it matches a supported transform intent  
   **Then** ClipMorph selects the correct transform capability and starts a transform job (FR14, FR16)  
   **And** unsupported/ambiguous intents yield a clear “unsupported” response without changing clipboard  


## Tasks / Subtasks

- [x] Task 1: a transcript is produced (AC: #1)
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

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 1.9)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References


### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- NOTE: `_bmad/core/tasks/validate-workflow.xml` is referenced by workflow but not present in this repo; no automated validation runner executed.
- Created @clipmorph/core package with intent classification module
- Implemented deterministic intent classifier using keyword/regex patterns
- Supports 13 intent types: cancel, undo, url:clean, url:markdown, json:pretty, json:minify, json:to-yaml, yaml:to-json, extract:emails, extract:links, redact:secrets, automation:portal, unsupported
- Created IntentService for routing transcripts to capabilities
- Integrated intent routing with voice service
- Added IPC handlers for intent:classify and intent:route
- All 151 tests pass including 34 new intent classification tests

### File List

- `_bmad-output/implementation-artifacts/1-9-intent-router-supported-command-set-cancel.md`
- `packages/core/package.json` (new)
- `packages/core/tsconfig.json` (new)
- `packages/core/src/index.ts` (new)
- `packages/core/src/intent/index.ts` (new)
- `packages/core/src/intent/intent-types.ts` (new)
- `packages/core/src/intent/classify-intent.ts` (new)
- `packages/core/src/__tests__/classify-intent.test.ts` (new)
- `src/main/services/intent-service.ts` (new)
- `src/main/services/voice-service.ts` (modified - added intent routing)
- `src/main/index.ts` (modified - added intent IPC handlers)
- `src/preload/index.ts` (modified - added intent API)
- `packages/contracts/src/index.ts` (modified - added intent types + channels)