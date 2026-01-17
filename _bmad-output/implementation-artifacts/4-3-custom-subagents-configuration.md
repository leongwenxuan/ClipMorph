# Story 4.3: Custom Subagents Configuration

Status: review

**Story ID:** 4.3  
**Story Key:** `4-3-custom-subagents-configuration`  
**Epic:** 4

## Story

As a power user,  
I want to define custom OpenCode subagents (e.g., reviewer, tester, formatter),  
so that I can delegate specialized tasks to purpose-built agents.

## Acceptance Criteria

1.
   **Given** the user has created `.clipmorph/subagents/*.md` files  
   **When** ClipMorph lists available agents  
   **Then** custom subagents appear alongside built-in agents  
   **And** the UI shows agent descriptions and capabilities  

2.
   **Given** the user invokes a custom subagent via voice  
   **When** the task runs  
   **Then** the correct subagent is invoked with appropriate permissions  
   **And** the agent's output is captured and surfaced in the UI  

## Tasks / Subtasks

- [x] Task 1: Implement subagent discovery (AC: #1)
  - [x] Scan `.clipmorph/subagents/` directory for agent definitions
  - [x] Parse agent markdown files for name, description, triggers, systemPrompt
  - [x] Create SubagentService to manage agent registry
  - [x] Add IPC channels for listing, discovering, and running agents

- [x] Task 2: Add voice patterns for subagent invocation (AC: #2)
  - [x] Add SubagentIntent type to intent-types.ts
  - [x] Implement matchSubagentTrigger() function for dynamic trigger matching
  - [x] Add isSubagentIntent() and getSubagentIdFromIntent() helpers
  - [x] Route matched triggers to subagent handler

- [x] Task 3: Implement subagent execution (AC: #2)
  - [x] Pass subagent's system prompt to OpenCode CLI
  - [x] Include clipboard content as context
  - [x] Stream agent output via existing OpenCode event system
  - [x] Handle agent-specific errors

- [x] Task 4: Tests for subagent functionality
  - [x] Update intent-service tests with subagent mocks
  - [x] Verify existing tests pass with new subagent integration

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no filesystem access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).

### Technical requirements (story-specific)

- Agent files are markdown with YAML frontmatter for metadata
- Support both project-local (`.clipmorph/subagents/`) and global (`~/.clipmorph/subagents/`) agents
- Also supports legacy `.opencode/agent/` directories for compatibility
- Agent names should be voice-friendly (lowercase, no special chars)
- Keep scope tight: discovery and invocation only, not agent creation/editing

### Agent File Format

```markdown
---
name: My Agent
description: Does something useful
triggers:
  - ask my agent
  - use custom agent
model: claude-3-5-sonnet  # optional
temperature: 0.7          # optional
---

System prompt content here...
```

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.3)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Depends on: Story 4.1 (OpenCode sidecar), Story 4.2 (voice-triggered code tasks)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- Intent service tests: `npm test -- --run src/main/__tests__/intent-service.test.ts`

### Completion Notes List

1. Created `SubagentService` in `src/main/services/subagent-service.ts` with:
   - Discovery of `.clipmorph/subagents/*.md` files
   - YAML frontmatter parsing for name, description, triggers, model, temperature
   - Support for both project-local and global subagent directories
   - Methods: `discover()`, `list()`, `get()`, `findByName()`, `findByTrigger()`, `getAllTriggers()`
   - Helper to create sample subagent file

2. Added IPC channels and types in `packages/contracts/src/index.ts`:
   - `SUBAGENT_LIST`, `SUBAGENT_DISCOVER`, `SUBAGENT_RUN` channels
   - `SubagentConfig`, `SubagentListResponse`, `SubagentDiscoverResponse`, `SubagentRunRequest`, `SubagentRunResponse` types

3. Extended intent classification in `packages/core/src/intent/`:
   - Added `SubagentIntent` type (`subagent:${string}`)
   - Added `SubagentClassification` interface
   - Implemented `matchSubagentTrigger()` for dynamic trigger matching
   - Added `isSubagentIntent()` and `getSubagentIdFromIntent()` helpers

4. Updated `IntentService` in `src/main/services/intent-service.ts`:
   - Checks for subagent triggers before standard intent classification
   - Routes matched triggers to `handleSubagentIntent()`
   - Passes subagent's system prompt + user prompt to OpenCode

5. Registered IPC handlers in `src/main/index.ts`:
   - `SUBAGENT_LIST`, `SUBAGENT_DISCOVER`, `SUBAGENT_RUN`
   - Subagent run uses OpenCode service with prepended system prompt

6. Added preload API in `src/preload/index.ts`:
   - `listSubagents()`, `discoverSubagents()`, `runSubagent()`

7. Updated tests with proper mocks for new subagent functionality

### File List

- `src/main/services/subagent-service.ts` (created)
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
