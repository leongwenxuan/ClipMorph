# Story 4.5: File & Folder Operations via Voice

Status: review

**Story ID:** 4.5  
**Story Key:** `4-5-file-folder-operations-via-voice`  
**Epic:** 4

## Story

As a power user,  
I want to say "organize my downloads folder" or "rename files matching X",  
So that I can perform file management tasks hands-free.

## Acceptance Criteria

1.
   **Given** the user issues a file operation command  
   **When** OpenCode processes the request  
   **Then** a preview of changes is shown before execution  
   **And** the user must approve destructive operations (delete/move/rename)  
   **And** operations are logged for undo/audit purposes  

2.
   **Given** file operations complete  
   **When** the user reviews results  
   **Then** a summary shows what was changed  
   **And** recent operations can be undone within a time window  

## Tasks / Subtasks

- [x] Task 1: Add file operation intent patterns (AC: #1)
  - [x] Add FileIntent type (file:organize, file:rename, file:move, file:delete, file:find, file:copy)
  - [x] Create intent patterns for natural language file commands
  - [x] Add isFileIntent() helper

- [x] Task 2: Create FileOperationService (AC: #1, #2)
  - [x] Define FileOperationType, FileOperationItem, FileOperationPreview types
  - [x] Implement preview generation via OpenCode
  - [x] Track operation history for undo (max 20, 5-minute window)
  - [x] Support execute with approval flow

- [x] Task 3: Add IPC channels for file operations (AC: #1, #2)
  - [x] FILE_OP_PREVIEW - get preview of planned changes
  - [x] FILE_OP_EXECUTE - execute approved operations
  - [x] FILE_OP_UNDO - undo recent operation
  - [x] FILE_OP_HISTORY - get recent operations

- [x] Task 4: Implement approval flow (AC: #1)
  - [x] Preview expiry (5 minutes)
  - [x] Require explicit approval for destructive ops
  - [x] Track hasDestructive flag in preview

- [x] Task 5: Emit file operation events (AC: #1, #2)
  - [x] FILE_OP_PREVIEW_READY
  - [x] FILE_OP_STARTED
  - [x] FILE_OP_COMPLETED
  - [x] FILE_OP_FAILED
  - [x] FILE_OP_UNDONE

- [x] Task 6: Tests for file operations
  - [x] Update intent-service tests with file operation mocks
  - [x] Verify existing tests pass

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no filesystem access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).

### Technical requirements (story-specific)

- NEVER execute destructive operations without explicit user approval
- Always show preview before execution
- Keep operation log for undo (in-memory for MVP, max 20 operations)
- File operations are delegated to OpenCode for safety
- Limit scope to user-accessible directories (no system files)

### Safety Considerations

- Destructive operations (delete, move, rename) require approval
- Preview shows exact files/folders affected with counts
- Operations can be cancelled at preview stage
- Undo available for limited time window (5 minutes)
- No recursive delete without special confirmation

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.5)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Depends on: Story 4.1 (OpenCode sidecar), Story 4.2 (voice-triggered code tasks)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- Intent service tests: `npm test -- --run src/main/__tests__/intent-service.test.ts`

### Completion Notes List

1. Added FileIntent type to `packages/core/src/intent/intent-types.ts`:
   - `file:organize`, `file:rename`, `file:move`, `file:delete`, `file:find`, `file:copy`

2. Added file intent patterns in `packages/core/src/intent/classify-intent.ts`:
   - Natural language patterns for each file operation type
   - Added `isFileIntent()` helper function

3. Added file operation types to `packages/contracts/src/index.ts`:
   - `FileOperationType`, `FileOperationItem`, `FileOperationPreview`
   - `FileOperationJob`, `FileOperationHistoryEntry`
   - Request/response types for all operations
   - Event payload types

4. Added IPC channels:
   - `FILE_OP_PREVIEW`, `FILE_OP_EXECUTE`, `FILE_OP_UNDO`, `FILE_OP_HISTORY`

5. Added file operation events to EventTypes:
   - `FILE_OP_PREVIEW_READY`, `FILE_OP_STARTED`, `FILE_OP_COMPLETED`
   - `FILE_OP_FAILED`, `FILE_OP_UNDONE`

6. Created `FileOperationService` in `src/main/services/file-operation-service.ts`:
   - Preview generation via OpenCode
   - Execute with approval requirement for destructive ops
   - Undo with 5-minute window
   - History tracking (max 20 operations)
   - Automatic cleanup of expired previews

7. Registered IPC handlers in `src/main/index.ts`

8. Added preload API in `src/preload/index.ts`:
   - `previewFileOperation()`, `executeFileOperation()`
   - `undoFileOperation()`, `getFileOperationHistory()`

9. Updated intent service to route file intents to preview generation

10. Updated tests with file operation service mocks

### File List

- `src/main/services/file-operation-service.ts` (created)
- `src/main/services/intent-service.ts` (modified)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `packages/contracts/src/index.ts` (modified)
- `packages/core/src/intent/intent-types.ts` (modified)
- `packages/core/src/intent/classify-intent.ts` (modified)
- `packages/core/src/intent/index.ts` (modified)
- `src/main/__tests__/intent-service.test.ts` (modified)

## Change Log

- 2026-01-17: Story created for Epic 4 implementation
- 2026-01-17: Completed implementation - all tasks done, tests passing
