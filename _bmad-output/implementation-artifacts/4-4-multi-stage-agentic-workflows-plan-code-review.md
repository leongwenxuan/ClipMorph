# Story 4.4: Multi-Stage Agentic Workflows (Plan → Code → Review)

Status: review

**Story ID:** 4.4  
**Story Key:** `4-4-multi-stage-agentic-workflows-plan-code-review`  
**Epic:** 4

## Story

As a team lead,  
I want to run multi-stage workflows (e.g., plan → implement → review),  
So that complex tasks are handled systematically with human checkpoints.

## Acceptance Criteria

1.
   **Given** the user triggers a multi-stage workflow  
   **When** the workflow executes  
   **Then** each stage runs sequentially (plan → code → review)  
   **And** the user can approve/reject at each stage before proceeding  
   **And** the workflow can be cancelled at any checkpoint  

2.
   **Given** a stage fails or is rejected  
   **When** the user chooses to retry or abort  
   **Then** the workflow handles the decision gracefully  
   **And** partial results are preserved for review  

## Tasks / Subtasks

- [x] Task 1: Design workflow state machine (AC: #1, #2)
  - [x] Define WorkflowStage type (plan | code | review)
  - [x] Create WorkflowJob interface extending Job with stages and checkpoints
  - [x] Add workflow state transitions (plan→code→review→completed)
  - [x] Support checkpoint approval/rejection/retry

- [x] Task 2: Create WorkflowService (AC: #1)
  - [x] Implement workflow orchestration logic
  - [x] Execute stages sequentially via OpenCode
  - [x] Pause at checkpoints for user approval
  - [x] Track stage outputs for context passing

- [x] Task 3: Add IPC channels for workflow control (AC: #1, #2)
  - [x] WORKFLOW_START - start a multi-stage workflow
  - [x] WORKFLOW_APPROVE - approve current stage, proceed to next
  - [x] WORKFLOW_REJECT - reject current stage, retry or abort
  - [x] WORKFLOW_CANCEL - cancel entire workflow
  - [x] WORKFLOW_GET_STATE - get current workflow state

- [x] Task 4: Add intent patterns for workflow triggers (AC: #1)
  - [x] "plan and implement X" → triggers plan→code workflow
  - [x] "full review workflow for X" → triggers plan→code→review
  - [x] "just plan X" → single stage (plan only)

- [x] Task 5: Emit workflow events (AC: #1, #2)
  - [x] WORKFLOW_STARTED, WORKFLOW_STAGE_STARTED
  - [x] WORKFLOW_CHECKPOINT (needs approval)
  - [x] WORKFLOW_STAGE_COMPLETED, WORKFLOW_STAGE_FAILED
  - [x] WORKFLOW_COMPLETED, WORKFLOW_CANCELLED

- [x] Task 6: Tests for workflow functionality
  - [x] Update intent-service tests with workflow mocks
  - [x] Verify existing tests pass with new workflow integration

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no filesystem access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).

### Technical requirements (story-specific)

- Each stage should capture its output for context in subsequent stages
- Plan stage output becomes context for code stage
- Code stage output becomes context for review stage
- Use `needs_input` job status for checkpoint pauses
- Keep workflow state in memory (no persistence needed for MVP)

### Workflow Design

```
┌─────────┐    approve    ┌──────┐    approve    ┌────────┐    auto     ┌───────────┐
│  PLAN   │──────────────▶│ CODE │──────────────▶│ REVIEW │───────────▶│ COMPLETED │
└─────────┘               └──────┘               └────────┘            └───────────┘
     │                         │                      │
     │ reject                  │ reject               │ reject
     ▼                         ▼                      ▼
┌─────────┐              ┌──────────┐           ┌──────────┐
│  RETRY  │              │  RETRY   │           │  RETRY   │
└─────────┘              └──────────┘           └──────────┘
     │                         │                      │
     │ cancel                  │ cancel               │ cancel
     ▼                         ▼                      ▼
┌───────────┐            ┌───────────┐          ┌───────────┐
│ CANCELLED │            │ CANCELLED │          │ CANCELLED │
└───────────┘            └───────────┘          └───────────┘
```

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Depends on: Story 4.1 (OpenCode sidecar), Story 4.2 (voice-triggered code tasks)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- Intent service tests: `npm test -- --run src/main/__tests__/intent-service.test.ts`

### Completion Notes List

1. Added workflow types to `packages/contracts/src/index.ts`:
   - `WorkflowStage` type (plan | code | review)
   - `WorkflowStatus` type (pending | running | checkpoint | completed | failed | cancelled)
   - `WorkflowJob` interface extending Job with workflow-specific fields
   - Request/response types for all workflow operations
   - Event payload types for workflow events

2. Added IPC channels:
   - `WORKFLOW_START`, `WORKFLOW_APPROVE`, `WORKFLOW_REJECT`, `WORKFLOW_CANCEL`, `WORKFLOW_GET_STATE`

3. Added workflow events to EventTypes:
   - `WORKFLOW_STARTED`, `WORKFLOW_STAGE_STARTED`, `WORKFLOW_CHECKPOINT`
   - `WORKFLOW_STAGE_COMPLETED`, `WORKFLOW_STAGE_FAILED`
   - `WORKFLOW_COMPLETED`, `WORKFLOW_CANCELLED`

4. Added workflow intent patterns in `packages/core/src/intent/classify-intent.ts`:
   - `workflow:plan-code-review` - full workflow
   - `workflow:plan-code` - plan and implement
   - `workflow:plan-only` - just planning
   - Added `isWorkflowIntent()` helper

5. Created `WorkflowService` in `src/main/services/workflow-service.ts`:
   - Stage-specific prompts for plan, code, review
   - Sequential stage execution via OpenCode
   - Checkpoint pausing with `needs_input` status
   - Approve/reject/retry/cancel operations
   - Stage output passed as context to next stage
   - Event emission for all state changes

6. Registered IPC handlers in `src/main/index.ts`:
   - All workflow control operations
   - Connected event emitter

7. Added preload API in `src/preload/index.ts`:
   - `startWorkflow()`, `approveWorkflowCheckpoint()`, `rejectWorkflowCheckpoint()`
   - `cancelWorkflow()`, `getWorkflowState()`

8. Updated intent service to route workflow intents:
   - Maps workflow intents to appropriate stage arrays
   - Starts workflow with clipboard context

9. Updated tests with workflow service mocks

### File List

- `src/main/services/workflow-service.ts` (created)
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
