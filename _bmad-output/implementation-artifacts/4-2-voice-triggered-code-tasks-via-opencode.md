# Story 4.2: Voice-Triggered Code Tasks via OpenCode

Status: review

**Story ID:** 4.2  
**Story Key:** `4-2-voice-triggered-code-tasks-via-opencode`  
**Epic:** 4

## Story

As a developer,  
I want to say "generate a React component for X" or "refactor this function",  
so that I can trigger code generation/modification from voice without switching apps.

## Acceptance Criteria

1.
   **Given** the clipboard contains code or a file path  
   **When** the user issues a code-related voice command  
   **Then** ClipMorph routes to OpenCode CLI with the appropriate prompt  
   **And** the result is placed in the clipboard (or written to file if path-based)  
   **And** the job status shows progress and completion  

2.
   **Given** a code generation task completes  
   **When** the user reviews the result  
   **Then** the result can be approved/rejected before applying  
   **And** rejection leaves the original content unchanged  

## Tasks / Subtasks

- [x] Task 1: Add code-related intents to intent router (AC: #1)
  - [x] Add intent patterns for code generation ("generate", "create", "write")
  - [x] Add intent patterns for code modification ("refactor", "fix", "improve")
  - [x] Add intent patterns for code explanation ("explain", "what does")
  - [x] Route code intents to OpenCode service

- [x] Task 2: Implement code task execution flow (AC: #1)
  - [x] Extract clipboard content as context for OpenCode
  - [x] Pass prompt + context to OpenCode service
  - [x] Stream output to job status UI (via events)
  - [x] Place result in clipboard on completion (handled by OpenCode service)

- [ ] Task 3: Implement approval workflow (AC: #2)
  - [ ] Add `needs_input` state for code review approval
  - [ ] Show diff/preview of generated code
  - [ ] Allow approve/reject actions
  - [ ] Handle rejection (restore original clipboard)

- [x] Task 4: Tests for voice-to-code flow
  - [x] Test intent classification for code commands
  - [x] Test routing to OpenCode service
  - [x] Test clipboard handling

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no subprocess spawning, no direct CLI access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).
- **Clipboard correctness**: snapshot gating, pending-means-no-change, 2-deep undo.

### Technical requirements (story-specific)

- Leverage existing intent router infrastructure from Epic 1.
- Add new intent category `code:*` for code-related commands.
- Use OpenCode service from Story 4.1 for execution.
- Result should go through approval step before clipboard write (Task 3 - deferred).
- Keep original clipboard in undo stack for recovery.

### Architecture compliance

- Follow `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/architecture.md` exactly.
- Extend existing intent-service.ts with code intent patterns.
- Use existing clipboard-service.ts for gated writes.

### Intent Patterns (Examples)

- "generate a React component for user profile"
- "create a function to sort an array"
- "refactor this code to use async/await"
- "fix the bug in this function"
- "explain what this code does"

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.2)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Depends on: Story 4.1 (OpenCode sidecar integration)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Added 5 new code intent types: `code:generate`, `code:refactor`, `code:fix`, `code:explain`, `code:improve`
- Extended intent-types.ts with CodeIntent type
- Added intent patterns for code commands in classify-intent.ts
- Added `isCodeIntent()` helper function
- Updated intent-service.ts to handle code intents via `handleCodeIntent()` method
- Code intents route to OpenCode service with clipboard content as context
- Added 11 new tests for code intent classification and routing
- All 23 intent-service tests pass
- Note: Task 3 (approval workflow) deferred - requires UI changes for diff preview

### File List

- `packages/core/src/intent/intent-types.ts` - Added CodeIntent type
- `packages/core/src/intent/classify-intent.ts` - Added code intent patterns and isCodeIntent()
- `packages/core/src/intent/index.ts` - Exported isCodeIntent and CodeIntent
- `packages/core/src/index.ts` - Exported isCodeIntent and CodeIntent
- `packages/contracts/src/index.ts` - Added code intent types to Intent union
- `src/main/services/intent-service.ts` - Added handleCodeIntent() method
- `src/main/__tests__/intent-service.test.ts` - Added 11 tests for code intents
- `_bmad-output/implementation-artifacts/4-2-voice-triggered-code-tasks-via-opencode.md` - Updated story file

## Change Log

- 2026-01-17: Story created for Epic 4 implementation
- 2026-01-17: Implemented code intent classification and routing to OpenCode service
