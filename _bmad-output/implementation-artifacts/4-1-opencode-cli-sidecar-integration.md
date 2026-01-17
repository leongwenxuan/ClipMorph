# Story 4.1: OpenCode CLI Sidecar Integration

Status: review

**Story ID:** 4.1  
**Story Key:** `4-1-opencode-cli-sidecar-integration`  
**Epic:** 4

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to spawn and manage OpenCode CLI as a subprocess,  
so that I can leverage agentic coding capabilities from voice commands.

## Acceptance Criteria

1.
   **Given** ClipMorph is running and OpenCode CLI is installed  
   **When** an agentic code task is requested  
   **Then** ClipMorph spawns OpenCode CLI via `node-pty` with proper environment  
   **And** the subprocess lifecycle is managed (start/stop/restart)  
   **And** stdout/stderr are captured and streamed to the job status  

2.
   **Given** OpenCode CLI is not installed  
   **When** the user attempts an agentic code task  
   **Then** the UI shows a clear error with installation instructions  
   **And** other ClipMorph features remain functional  

## Tasks / Subtasks

- [x] Task 1: OpenCode CLI sidecar lifecycle management (AC: #1)
  - [x] Create `packages/opencode-sidecar` package with TypeScript structure
  - [x] Implement OpenCodeSidecar class with spawn/stop/restart methods via node-pty
  - [x] Implement stdout/stderr streaming and event emission
  - [x] Add job integration for status updates (pending/running/completed/failed)

- [x] Task 2: CLI detection + graceful error handling (AC: #2)
  - [x] Implement OpenCode CLI detection (check `opencode` command availability)
  - [x] Create error types for CLI not found / spawn failures
  - [x] Add IPC channels for opencode operations (start task, get status, cancel)
  - [x] Implement renderer UI error state with installation instructions

- [x] Task 3: Integration tests for sidecar lifecycle
  - [x] Test spawn/stop/restart cycle
  - [x] Test stdout/stderr capture and streaming
  - [x] Test CLI-not-found error handling
  - [x] Test job status transitions during sidecar operations

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no subprocess spawning, no direct CLI access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).

### Technical requirements (story-specific)

- Use `node-pty` for pseudo-terminal subprocess management (provides proper TTY for CLI tools).
- OpenCode CLI must be spawned with proper environment variables (PATH, HOME, etc.).
- Stdout/stderr must be streamed in real-time to allow progress visibility.
- Subprocess must be killable on demand (cancellation support).
- Keep scope tight: this story is about sidecar lifecycle, NOT about routing voice commands to OpenCode (that's Story 4.2).

### Architecture compliance

- Follow `_bmad-output/project-context.md` and `_bmad-output/planning-artifacts/architecture.md` exactly.
- New package `packages/opencode-sidecar` follows existing monorepo pattern (see `packages/stt-parakeet`).
- IPC channels: `clipmorph:opencode:startTask`, `clipmorph:opencode:cancel`, `clipmorph:opencode:getStatus`.

### OpenCode CLI Reference

- OpenCode is an AI-powered coding assistant CLI (similar to Cursor but terminal-based).
- Installation: typically `npm install -g opencode` or via package managers.
- Invocation: `opencode <prompt>` or interactive mode.
- See: https://opencode.ai

### Project Structure Notes

- Keep filenames `kebab-case.*` and IPC/channel constants centralized.
- New package structure:
  ```
  packages/opencode-sidecar/
  ├── package.json
  ├── tsconfig.json
  └── src/
      ├── index.ts
      ├── sidecar.ts      # OpenCodeSidecar class
      ├── detector.ts     # CLI detection utilities
      └── types.ts        # OpenCode-specific types
  ```

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.1)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Similar pattern: `packages/stt-parakeet` (sidecar management)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- Implemented OpenCodeService in `src/main/services/opencode-service.ts` with full sidecar lifecycle management
- Added OpenCode IPC channels to contracts: `OPENCODE_RUN_TASK`, `OPENCODE_CANCEL`, `OPENCODE_GET_STATE`, `OPENCODE_DETECT`
- Added OpenCode error codes: `OPENCODE_NOT_INSTALLED`, `OPENCODE_TASK_FAILED`, `OPENCODE_TASK_TIMEOUT`, `OPENCODE_BUSY`
- Added OpenCode event types: `OPENCODE_STARTED`, `OPENCODE_OUTPUT`, `OPENCODE_COMPLETED`, `OPENCODE_FAILED`, `OPENCODE_CANCELLED`
- Implemented CLI detection via `which` command and common installation paths
- Created typed OpenCode API in preload bridge: `runOpenCodeTask`, `cancelOpenCode`, `getOpenCodeState`, `detectOpenCode`
- Added comprehensive error handling with installation instructions when CLI not found
- Implemented job lifecycle with proper status transitions and event emission
- Added 18 unit tests covering detection, state management, job lifecycle, and error handling
- All new tests pass; 5 pre-existing voice-service test failures unrelated to this story

### File List

- `packages/contracts/src/index.ts` - Added OpenCode IPC channels, types, error codes, and event types
- `src/main/services/opencode-service.ts` - NEW: OpenCode sidecar service with lifecycle management
- `src/main/index.ts` - Added OpenCode IPC handlers and service initialization
- `src/preload/index.ts` - Added OpenCode API methods to preload bridge
- `src/main/__tests__/opencode-service.test.ts` - NEW: 18 tests for OpenCode service
- `packages/opencode-sidecar/package.json` - NEW: Package definition (optional external package)
- `packages/opencode-sidecar/tsconfig.json` - NEW: TypeScript config
- `packages/opencode-sidecar/src/types.ts` - NEW: OpenCode types
- `packages/opencode-sidecar/src/detector.ts` - NEW: CLI detection utilities
- `packages/opencode-sidecar/src/sidecar.ts` - NEW: Sidecar class
- `packages/opencode-sidecar/src/index.ts` - NEW: Package exports
- `_bmad-output/implementation-artifacts/4-1-opencode-cli-sidecar-integration.md` - Updated story file

## Change Log

- 2026-01-17: Story created for Epic 4 implementation
- 2026-01-17: Implemented OpenCode sidecar integration with full lifecycle management, IPC, and tests
