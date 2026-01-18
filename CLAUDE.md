# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClipMorph is a voice-driven clipboard transformation tool for macOS. It uses push-to-talk voice commands to process clipboard content through transforms, browser automation, AI agents, and file operations.

## Commands

### Development
```bash
# Start development with hot reload
npm run dev

# Run tests
npm test                    # Run all tests (183 tests)
npm run test:watch         # Run tests in watch mode

# Linting and type checking
npm run lint
npm run typecheck          # Runs both node and web type checks
npm run typecheck:node     # Check main/preload processes only
npm run typecheck:web      # Check renderer process only

# Build
npm run build              # Build all packages
npm run build:mac          # Build macOS distributable
```

### Python STT Setup (Optional)
```bash
cd packages/stt-parakeet/sidecar
pip install -r requirements.txt
```

## Architecture

### Electron Security Model

ClipMorph follows Electron's security best practices with strict separation between processes:

```
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│    Renderer      │  ◄───►   │     Preload      │  ◄───►   │       Main       │
│   (React UI)     │          │  (contextBridge) │          │ (Privileged API) │
│  NO privileges   │          │   Type-safe IPC  │          │  All services    │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

**Key principle:** The renderer has ZERO direct access to Node.js, filesystem, clipboard, or microphone. All privileged operations go through the preload bridge (`src/preload/index.ts`) to the main process.

### IPC Contract System

All communication between processes uses type-safe IPC contracts defined in `packages/contracts/src/index.ts`:

- **Channels**: `IpcChannels` enum defines all request/response channels
- **Events**: `EventTypes` enum defines all broadcast events (status, transcripts, permissions, jobs, etc.)
- **Request/Response types**: Every IPC call has strongly-typed request and response interfaces
- **Event payloads**: Every event has a typed payload interface

When adding new IPC handlers:
1. Define request/response types in `packages/contracts/src/index.ts`
2. Add handler in `src/main/index.ts`
3. Expose method in `src/preload/index.ts` via `contextBridge`
4. Use in renderer via `window.clipmorph` API

### Service Layer

All business logic lives in services under `src/main/services/`. Services are singleton instances that handle specific responsibilities:

**Core Services:**
- `voice-service.ts` - Push-to-talk hotkey, audio capture, STT provider orchestration
- `intent-service.ts` - Classify transcripts and route to appropriate handlers
- `clipboard-service.ts` - Read/write clipboard, undo history (2 levels)
- `store-service.ts` - SQLite database for settings, transcripts, action history
- `settings-service.ts` - User preferences (hotkey, STT provider, UI theme)
- `permission-service.ts` - macOS permissions (microphone, accessibility)

**Transform & Automation:**
- `transform-service.ts` - Rule-based transforms (URL cleaning, JSON/YAML, extraction)
- `llm-transform-service.ts` - LLM-powered transforms via Groq
- `browser-agent-service.ts` - Browser automation via agent-browser
- `automation-service.ts` - Automation orchestration

**Advanced Capabilities:**
- `opencode-service.ts` - Integration with OpenCode AI coding sidecar
- `subagent-service.ts` - Discovery and execution of specialized AI agents
- `workflow-service.ts` - Multi-step workflow execution
- `skill-service.ts` - Custom user-defined skills
- `file-operation-service.ts` - Safe file operations with preview/undo
- `document-extractor-service.ts` - Extract text from PDF/DOCX
- `chart-renderer-service.ts` - Render charts from data
- `job-manager.ts` - Job lifecycle management with status tracking

Services communicate via direct imports (singleton pattern), NOT event emitters or pub/sub.

### Intent Classification & Routing

Voice transcripts are classified into intents in this order:

1. **Special intents** - `cancel`, `undo`
2. **Transform intents** - Pattern-matched commands like "clean url", "pretty json"
3. **Automation intents** - Browser automation commands starting with "automate"
4. **Code intents** - OpenCode integration (if sidecar detected)
5. **Subagent intents** - Custom agent triggers loaded from BMAD framework
6. **Workflow intents** - Multi-step workflow execution
7. **File intents** - File operations (read, write, create, etc.)
8. **LLM fallback** - If no pattern matches, use LLM to classify intent

Intent classification logic lives in `packages/core/src/intent.ts` (rule-based) and `src/main/services/llm-intent-service.ts` (LLM fallback).

### Packages Structure

The monorepo has several packages:

- **`packages/contracts/`** - Shared TypeScript types and IPC contracts. This is the source of truth for all type definitions.
- **`packages/core/`** - Pure functions for intent classification and transforms. NO dependencies on Electron or services. Fully testable in isolation.
- **`packages/stt-parakeet/`** - Speech-to-text sidecar using Parakeet model (Python). Not actively used but available.
- **`packages/opencode-sidecar/`** - Detector and bridge for OpenCode AI coding tool
- **`packages/browser-automation/`** - Browser automation primitives (actions, form filling, loops, snapshots)

### STT Providers

ClipMorph supports three STT providers (configurable in settings):

1. **ElevenLabs** (default) - Lowest latency, streaming transcription via WebSocket
2. **Groq** - Fast, uses Whisper large-v3-turbo
3. **OpenAI** - Realtime API with conversation support

Provider implementations:
- `src/main/services/elevenlabs-stt-service.ts`
- `src/main/services/groq-stt-service.ts`
- `src/main/services/openai-stt-service.ts`

The `voice-service.ts` orchestrates the selected provider.

### Job Management

Long-running operations are tracked as jobs (`job-manager.ts`):

- Each job has a unique ID, status (pending, running, completed, failed), and result
- Jobs emit events for status changes
- Jobs can be cancelled mid-execution
- Used for transforms, automations, LLM calls, and file operations

### State Persistence

App state is stored in SQLite at `~/Library/Application Support/clipmorph/clipmorph.db`:

- Settings (hotkey, STT provider, UI theme, etc.)
- Transcript history (last 20)
- Action history (for undo)
- Operation history (audit log)

Database access is handled by `store-service.ts` using `better-sqlite3`.

### Secrets Management

API keys and tokens are stored securely in macOS Keychain via `secrets-service.ts` using the `keytar` library:

- `GROQ_API_KEY` - For Groq STT and LLM transforms
- `OPENAI_API_KEY` - For OpenAI STT
- `ELEVENLABS_API_KEY` - For ElevenLabs STT

Never log or expose secrets. Always use `secretsService.get()` to retrieve them.

## Development Guidelines

### Adding a New Transform

1. Implement the transform function in `packages/core/src/transforms.ts`
2. Add intent pattern to `packages/core/src/intent.ts`
3. Wire up in `intent-service.ts` routing logic
4. Add tests in `packages/core/src/__tests__/transforms.test.ts`

### Adding a New IPC Handler

1. Define types in `packages/contracts/src/index.ts`
2. Add IPC handler in `src/main/index.ts` using `ipcMain.handle()`
3. Expose in `src/preload/index.ts` via `contextBridge.exposeInMainWorld()`
4. Use in renderer via `window.clipmorph.yourNewMethod()`

### Working with Services

Services are singletons. Import and use directly:

```typescript
import { voiceService } from './services/voice-service'
import { intentService } from './services/intent-service'
```

Services can depend on other services via imports. Avoid circular dependencies.

### Event Broadcasting

To send events from main process to renderer:

```typescript
emitEvent(createEvent<YourPayloadType>(EventTypes.YOUR_EVENT, {
  // payload data
}))
```

The renderer subscribes via `window.clipmorph.onEvent(callback)`.

### Testing

Tests use Vitest. All test files are named `*.test.ts` and located in `__tests__` directories.

- Pure functions in `packages/core/` should have comprehensive unit tests
- Service tests should mock dependencies
- Run `npm test` before committing

### macOS Permissions

ClipMorph requires two permissions:

1. **Microphone** - For voice capture (requested via `permission-service.ts`)
2. **Accessibility** - For global hotkey registration (user must grant manually in System Preferences)

The app degrades gracefully if permissions are not granted. Check `permission-service.ts` for status checking logic.

## File Locations

- **User data**: `~/Library/Application Support/clipmorph/`
- **Database**: `~/Library/Application Support/clipmorph/clipmorph.db`
- **Secrets**: macOS Keychain (service name: `clipmorph`)
- **Chart images**: `~/Library/Application Support/clipmorph/chart-images/`

## Browser Automation

Browser automation uses the `agent-browser` package with Playwright:

- Automation service manages browser lifecycle
- Browser agent service provides AI-driven browser control
- Automation commands start with "automate" (e.g., "automate fill this form")
- Browser automation can take screenshots, fill forms, navigate, and loop over actions

## BMAD Framework

ClipMorph integrates with the BMAD (Brownfield Multi-Agent Development) framework for advanced agent workflows:

- Agents are discovered from `.cursor/commands/` directory
- Subagents can be triggered via voice commands matching their trigger patterns
- Workflows are multi-step processes with approval gates
- Skills are user-defined reusable commands

These features are optional and only active if BMAD files are present.

## Key Code Patterns

### Service Initialization

Services initialize themselves on first import. No explicit initialization needed:

```typescript
class MyService {
  private initialized = false

  async initialize() {
    if (this.initialized) return
    // setup code
    this.initialized = true
  }

  async doSomething() {
    await this.initialize()
    // actual work
  }
}

export const myService = new MyService()
```

### Error Handling in IPC

Always return `IpcResponse` with success/error:

```typescript
try {
  const result = await doSomething()
  return createSuccessResponse({ data: result })
} catch (error) {
  return createErrorResponse(ErrorCodes.OPERATION_FAILED, error.message)
}
```

### Job Lifecycle

For long-running operations:

```typescript
const job = jobManager.createJob('operation-type')
jobManager.startJob(job.id)

try {
  const result = await doWork()
  jobManager.completeJob(job.id, result)
} catch (error) {
  jobManager.failJob(job.id, error.message)
}
```

## Troubleshooting

### Tests Failing

Ensure you've run `npm install` in the root directory. The project uses workspace dependencies.

### TypeScript Errors

Run both type checks:
- `npm run typecheck:node` for main/preload
- `npm run typecheck:web` for renderer

They use different tsconfig files with different target environments.

### Hot Reload Not Working

The development server watches all packages. If changes don't reflect, restart `npm run dev`.

### macOS Permission Issues

Accessibility permission requires app restart after granting. Use `Ctrl+C` to stop, then `npm run dev` again.
