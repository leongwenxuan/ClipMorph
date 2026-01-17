---
stepsCompleted:
  - "step-01-validate-prerequisites"
  - "step-02-design-epics"
  - "step-03-create-stories"
  - "step-04-final-validation"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
---

# ClipMorph - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ClipMorph, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can run ClipMorph as a background desktop app available while other apps are in use.
FR2: User can grant required permissions for ClipMorph to operate (e.g., microphone, accessibility) and ClipMorph can detect whether permissions are granted.
FR3: User can start and stop ClipMorph’s active listening/automation behavior without quitting the app.
FR4: User can see whether ClipMorph is currently available/active via a lightweight status surface (e.g., menubar presence).
FR5: System can detect when the clipboard content changes.
FR6: System can identify the clipboard content type relevant to a requested operation (e.g., text vs structured text vs file path).
FR7: System can apply a transformation result to the clipboard.
FR8: System can avoid applying an outdated transformation result when the clipboard has changed since the transformation started.
FR9: User can undo the most recent clipboard transformation and restore the prior clipboard value.
FR10: System can preserve at least a 2-deep clipboard history solely for undo/recovery purposes.
FR11: User can activate voice command capture via a global push-to-talk action.
FR12: System can capture the user’s spoken command and produce a transcript.
FR13: User can view the last voice transcript used for the most recent action.
FR14: System can interpret a spoken command into an intended action category (e.g., transform vs automation).
FR15: User can cancel an in-progress voice command/action.
FR16: User can transform clipboard text based on a spoken command and paste the transformed result into any app.
FR17: User can run multi-step transform intents in one command (e.g., “compute then convert then format”).
FR18: User can trigger a “clean link” capability that outputs a sanitized URL.
FR19: User can trigger a “make markdown link” capability that outputs a markdown-formatted link from a URL.
FR20: User can trigger structured data transforms (e.g., pretty/minify JSON, convert JSON↔YAML).
FR21: User can trigger extraction transforms (e.g., extract emails, extract links) from pasted text.
FR22: User can trigger a redaction transform that removes/masks sensitive patterns from clipboard text.
FR23: System can report whether a transform succeeded or failed (without requiring a full UI).
FR24: User can initiate a browser automation task from a voice command (e.g., “apply on this portal”) using clipboard content as input.
FR25: System can open a browser context to perform the requested automation task.
FR26: System can fill web form fields as part of an automation task based on user-provided clipboard content.
FR27: User can observe automation progress at a high level (e.g., running / needs input / completed / failed).
FR28: User can stop/cancel an automation task while it is running.
FR29: System can detect when automation cannot proceed without user intervention (e.g., login/CAPTCHA/ambiguous fields) and request user input/approval to continue.
FR30: User can configure the push-to-talk activation behavior.
FR31: User can enable/disable categories of transforms (e.g., code transforms, URL transforms).
FR32: User can view and change basic app settings from a settings surface.
FR33: User can view the last action summary (at minimum: last transcript + what capability ran).
FR34: System can expose enough diagnostic information to help a user understand why an action failed (without requiring persistent logs).
FR35: User can choose whether ClipMorph retains any action history beyond the most recent “last transcript” view.
FR36: System can avoid running automation unintentionally when not explicitly activated by the user.

### NonFunctional Requirements

NFR1: (Performance) p95 end-to-end transform completion ≤ 15s (push-to-talk release → clipboard updated). (PRD: NFR-P1)
NFR2: (Performance) Transform hard timeout: succeed or fail cleanly within ≤ 60s (no hanging). (PRD: NFR-P2)
NFR3: (Performance) p95 end-to-end automation completion ≤ 120s for MVP demo flow. (PRD: NFR-P3)
NFR4: (Performance) Background overhead: idle CPU usage negligible (no sustained high CPU while waiting). (PRD: NFR-P4)
NFR5: (Reliability) Supported transform commands succeed ≥ 80% on clean audio. (PRD: NFR-R1)
NFR6: (Reliability) Undo restores the previous clipboard value correctly ≥ 99%. (PRD: NFR-R2)
NFR7: (Reliability) Automation requiring manual user intervention (login/CAPTCHA/ambiguous step) ≤ 5% in demo target portal(s). (PRD: NFR-R3)
NFR8: (Reliability) No stale overwrite: do not overwrite a newer clipboard change with an older job result (snapshot gating). (PRD: NFR-R4)
NFR9: (Security) Cloud processing allowed: clipboard contents may be sent to a cloud LLM in MVP (explicitly accepted). (PRD: NFR-S1)
NFR10: (Security/Privacy) Transcript persistence: persist last 20 (rolling), with user control to clear history. (PRD: NFR-S2)
NFR11: (Security/Privacy) Data minimization: avoid storing full clipboard history beyond what’s needed for undo/recovery. (PRD: NFR-S3)
NFR12: (Security/UX) Permissions transparency: clearly communicate required OS permissions (microphone + accessibility) and degrade gracefully if not granted. (PRD: NFR-S4)
NFR13: (Integration) Browser automation must support Chrome for MVP. (PRD: NFR-I1)
NFR14: (Integration) Offline mode not required for MVP (local models optional later). (PRD: NFR-I2)

### Additional Requirements

- Starter template (must drive Epic 1 / Story 1): Electron + Vite + React (TypeScript) via `npm create electron-vite@latest clipmorph -- --template react-ts`.
- Main/renderer privilege boundary: renderer is UI-only; all OS primitives (clipboard/mic/automation/persistence) live in Electron main process services; preload is the only bridge.
- Browser automation runtime: use `agent-browser` Node API with a ref-first loop (`snapshot → LLM actions(schema-validated) → execute → resnapshot`); avoid per-site CSS selectors; handle login/CAPTCHA/ambiguity by transitioning to `needs_input` and stopping.
- Job orchestration: explicit async jobs with statuses `pending | running | needs_input | completed | failed | cancelled`; cancellation supported; monotonic transitions; timestamps.
- Clipboard correctness semantics: snapshot gating on apply; “pending means no change”; prevent self-trigger loops; maintain 2-deep undo store; `⌥⌘Z` restores previous clipboard state.
- IPC patterns: channel naming `clipmorph:<domain>:<action>`; request/response via `ipcMain.handle`/`ipcRenderer.invoke`; event bus `clipmorph:events`; mandatory envelope `{ ok: true, requestId, data }` / `{ ok: false, requestId, error: { code, message, details? } }`.
- Persistence: SQLite as system of record for settings + last-20 transcripts (rolling) (+ optional jobs table); secrets/API keys stored in macOS Keychain only.
- Locked implementations (architecture “resolved decisions”): local Parakeet v2 transcription (`nvidia/parakeet-tdt-0.6b-v2`) via a local Python sidecar controlled by the Electron main process; SQLite driver `better-sqlite3`; Keychain integration via `keytar`.
- UI requirements implied by architecture: menubar/settings surface must show status (`idle/running/needs input`), last transcript, enable/disable transform categories, cancel current job.
- Distribution (MVP): manual install; no auto-update.
- Repo structure constraint (if followed): npm workspaces monorepo with shared `packages/contracts` as single source of truth for IPC/job types; file naming `kebab-case`.

### FR Coverage Map

FR1: Epic 1 - Background menubar app available while other apps are in use.
FR2: Epic 1 - Permissions grant + detection (mic/accessibility) needed for core use.
FR3: Epic 1 - Start/stop active listening/automation behavior without quitting.
FR4: Epic 1 - Lightweight availability/status surface (menubar presence).
FR5: Epic 1 - Detect clipboard changes.
FR6: Epic 1 - Identify clipboard content type for operations.
FR7: Epic 1 - Apply transform result to clipboard.
FR8: Epic 1 - Prevent stale overwrites when clipboard changes mid-job (snapshot gating).
FR9: Epic 1 - Undo most recent clipboard transform.
FR10: Epic 1 - Maintain 2-deep shadow clipboard for undo/recovery.
FR11: Epic 1 - Global push-to-talk activation.
FR12: Epic 1 - Capture spoken command and produce transcript.
FR13: Epic 1 - View last voice transcript for most recent action.
FR14: Epic 1 - Interpret transcript into intent category (transform vs automation).
FR15: Epic 1 - Cancel an in-progress voice command/action.
FR16: Epic 1 - Transform clipboard text via voice and paste anywhere.
FR17: Epic 1 - Multi-step transforms in one command (chaining).
FR18: Epic 1 - Clean link capability.
FR19: Epic 1 - URL → markdown link capability.
FR20: Epic 1 - Structured data transforms (pretty/minify JSON, JSON↔YAML).
FR21: Epic 1 - Extraction transforms (emails/links).
FR22: Epic 1 - Redaction transform (mask sensitive patterns).
FR23: Epic 1 - Report transform success/failure without requiring full UI.
FR24: Epic 3 - Start browser automation job from voice using clipboard input.
FR25: Epic 3 - Open browser context to execute automation.
FR26: Epic 3 - Fill web form fields during automation.
FR27: Epic 3 - Show high-level automation progress (running/needs input/completed/failed).
FR28: Epic 3 - Stop/cancel automation while running.
FR29: Epic 3 - Detect blocked automation + request user input/approval (needs_input).
FR30: Epic 2 - Configure push-to-talk activation behavior.
FR31: Epic 2 - Enable/disable transform categories.
FR32: Epic 2 - View/change basic app settings.
FR33: Epic 1 - View last action summary (last transcript + capability ran).
FR34: Epic 2 - Expose diagnostic info to explain failures without persistent logs.
FR35: Epic 2 - Control retention beyond the “last transcript” view (history/clear).
FR36: Epic 3 - Prevent unintentional automation when not explicitly activated.

## Epic List

### Epic 1: Ambient Clipboard Transforms (Core Loop)

Users can copy → push-to-talk → command → paste transformed output in any app, with reliable clipboard correctness and undo.
**FRs covered:** FR1–FR23, FR33

### Epic 2: Configure + Trust ClipMorph (Settings & Troubleshooting)

Users can configure ClipMorph’s behavior, understand what happened, and control retention/diagnostics so the tool stays trustworthy day-to-day.
**FRs covered:** FR30–FR32, FR34–FR35

### Epic 3: Agentic Browser Automation MVP (“Apply on this portal”)

Users can launch Chrome automation from voice using clipboard content, monitor progress, handle “needs input” stops, and cancel safely without accidental runs.
**FRs covered:** FR24–FR29, FR36

## Epic 1 — Ambient Clipboard Transforms (Core Loop)

Users can copy → push-to-talk → command → paste transformed output in any app, with reliable clipboard correctness and undo.

### Story 1.1: Set up initial project from starter template (electron-vite)

As a power user,
I want ClipMorph to run as a menubar/background app with a minimal status surface,
So that it’s always available while I’m working in other apps.

**Acceptance Criteria:**

**Given** I’m starting from an empty workspace
**When** I run `npm create electron-vite@latest clipmorph -- --template react-ts` and install dependencies
**Then** the project boots successfully with a working Electron main + renderer build pipeline (Architecture starter requirement)
**And** the dependency lockfile is generated so the build is reproducible (Architecture constraint)

**Given** ClipMorph is launched
**When** the app starts
**Then** a menubar icon is visible and indicates the app is running (FR1, FR4)
**And** clicking the menubar icon opens a lightweight UI showing at least an “idle” status

**Given** the renderer is running
**When** it needs privileged operations
**Then** it can only do so via a preload-exposed API (no direct OS access)
**And** `contextIsolation` is enabled and privileged operations are owned by the main process (Architecture constraint)

### Story 1.2: Core IPC Contract + Events Bus

As a power user,
I want the UI and the main process to communicate through a stable, typed contract,
So that ClipMorph stays maintainable as capabilities expand.

**Acceptance Criteria:**

**Given** the renderer invokes a main-process handler
**When** an IPC request is made
**Then** responses use the mandatory envelope `{ ok, requestId, data|error }`
**And** IPC channel names follow `clipmorph:<domain>:<action>` (Architecture constraint)

**Given** the main process needs to broadcast state changes
**When** an internal event occurs (e.g., job status change)
**Then** it emits on a single `clipmorph:events` channel
**And** the renderer can subscribe and update UI state accordingly (Architecture constraint)

### Story 1.3: Permission Detection + Degraded Mode

As a power user,
I want ClipMorph to detect missing microphone/accessibility permissions and explain what’s needed,
So that I can fix setup issues quickly and trust the app.

**Acceptance Criteria:**

**Given** ClipMorph is running
**When** the user has not granted microphone permission
**Then** the UI indicates “mic permission required” and voice features are disabled (FR2)
**And** the app does not attempt to start voice capture

**Given** ClipMorph is running
**When** the user has not granted accessibility permission
**Then** the UI indicates “accessibility permission required” and automation features are disabled (FR2)
**And** non-automation clipboard transforms remain usable
**And** required permissions are communicated clearly and the app degrades gracefully (NFR12)

### Story 1.4: Job Manager + Status Model (Transforms)

As a power user,
I want transforms to run as explicit jobs with progress and cancellation,
So that long operations don’t hang or clobber my clipboard unexpectedly.

**Acceptance Criteria:**

**Given** a transform is started
**When** it is running
**Then** a job exists with status in `pending | running | completed | failed | cancelled`
**And** status transitions are monotonic and timestamped (Architecture constraint)

**Given** a transform job is running
**When** the user cancels it
**Then** the job transitions to `cancelled`
**And** the clipboard remains unchanged (“pending means no change”) (Architecture constraint, FR15)

### Story 1.5: Clipboard Watcher + Snapshot Gating

As a power user,
I want ClipMorph to detect clipboard changes and only apply results to the correct snapshot,
So that I never lose newer clipboard content to stale job outputs.

**Acceptance Criteria:**

**Given** the system clipboard changes
**When** ClipMorph observes it
**Then** it records a new clipboard snapshot and emits a `clipboard.changed` event (FR5)
**And** it avoids self-trigger loops caused by ClipMorph writes (Architecture constraint)

**Given** a transform job captured clipboard snapshot A
**When** the clipboard changes to snapshot B before the job completes
**Then** the job result is not applied to the clipboard (FR8)
**And** the job reports a non-destructive outcome (cancelled/failed-with-reason) to the UI
**And** the system satisfies “no stale overwrite” semantics (NFR8)

### Story 1.6: Shadow Clipboard + Undo Hotkey (⌥⌘Z)

As a power user,
I want to undo the most recent clipboard overwrite reliably,
So that I can trust trying voice transforms without fear.

**Acceptance Criteria:**

**Given** ClipMorph overwrites the clipboard with a transform result
**When** the overwrite happens
**Then** the previous clipboard value is stored in a 2-deep shadow history (FR10)
**And** the shadow history stores enough type metadata to restore correctly (text/structured text/file path if supported) (FR6)

**Given** the most recent overwrite was performed by ClipMorph
**When** the user presses `⌥⌘Z`
**Then** the clipboard is restored to the previous value (FR9)
**And** undo succeeds ≥ 99% in normal operation (NFR-R2 as acceptance target)

### Story 1.7: Global Push-to-Talk Hotkey

As a power user,
I want a global push-to-talk hotkey to start/stop command capture,
So that I can issue commands without switching apps.

**Acceptance Criteria:**

**Given** ClipMorph is running and permissions allow
**When** the user presses and holds the configured push-to-talk hotkey
**Then** audio capture begins and UI status indicates “listening” (FR11)
**And** releasing the hotkey ends capture and proceeds to transcription

**Given** ClipMorph is running
**When** the user toggles “active listening/automation” off (global disable)
**Then** push-to-talk does not initiate capture/jobs
**And** the app remains running without quitting (FR3)

### Story 1.8: Local STT Sidecar (Parakeet v2) + Transcript Surfacing

As a power user,
I want my spoken command transcribed locally and shown as the last transcript,
So that I can verify what the system heard.

**Acceptance Criteria:**

**Given** a push-to-talk recording completes
**When** transcription finishes
**Then** ClipMorph produces a transcript string (FR12)
**And** the UI can display the last transcript for the most recent action (FR13)

**Given** transcription fails or exceeds the hard timeout
**When** the failure occurs
**Then** the job fails cleanly within ≤ 60s (NFR2)
**And** the UI shows an actionable error reason (FR34)

### Story 1.9: Intent Router (Supported Command Set) + Cancel

As a power user,
I want ClipMorph to route my transcript to a supported capability (transform vs automation),
So that commands are reliable and not “random LLM vibes”.

**Acceptance Criteria:**

**Given** a transcript is produced
**When** it matches a supported transform intent
**Then** ClipMorph selects the correct transform capability and starts a transform job (FR14, FR16)
**And** unsupported/ambiguous intents yield a clear “unsupported” response without changing clipboard

**Given** a transcript is produced
**When** it matches a supported automation intent
**Then** ClipMorph routes to the automation engine (FR14, FR24)
**And** it does not start automation unless explicitly activated by push-to-talk (FR36)

### Story 1.10: Transform Capability — URL Clean

As a power user,
I want to say “clean link” and get a sanitized URL in my clipboard,
So that pasted links are neat and shareable.

**Acceptance Criteria:**

**Given** the clipboard contains a URL string
**When** I issue the “clean link” command
**Then** ClipMorph replaces the clipboard with a sanitized URL result (FR18, FR7)
**And** the end-to-end transform completes p95 ≤ 15s (NFR1 as target)

### Story 1.11: Transform Capability — URL → Markdown Link

As a power user,
I want to say “make markdown link” and get a Markdown-formatted link,
So that I can paste clean links into docs quickly.

**Acceptance Criteria:**

**Given** the clipboard contains a URL string
**When** I issue the “make markdown link” command
**Then** ClipMorph replaces the clipboard with a Markdown link string (FR19, FR7)
**And** the transform fails cleanly with an error if clipboard is not a URL

### Story 1.12: Transform Capability — JSON Pretty/Minify

As a power user,
I want to say “pretty json” or “minify json” and get correctly formatted JSON,
So that I can paste structured data in a readable form.

**Acceptance Criteria:**

**Given** the clipboard contains valid JSON
**When** I issue “pretty json”
**Then** ClipMorph replaces the clipboard with pretty-printed JSON (FR20, FR7)
**And** it preserves JSON semantics (no key/value changes)

**Given** the clipboard contains invalid JSON
**When** I issue “pretty json” or “minify json”
**Then** the job fails cleanly without changing the clipboard
**And** the UI provides a parse error summary (FR23, FR34)

### Story 1.13: Transform Capability — JSON ↔ YAML Conversion

As a power user,
I want to convert JSON ↔ YAML via voice command,
So that I can move between formats without context switching.

**Acceptance Criteria:**

**Given** the clipboard contains valid JSON
**When** I issue “convert to yaml”
**Then** ClipMorph replaces the clipboard with YAML representing the same data (FR20)
**And** conversion failures do not change the clipboard

**Given** the clipboard contains valid YAML
**When** I issue “convert to json”
**Then** ClipMorph replaces the clipboard with JSON representing the same data (FR20)
**And** JSON output is valid and parseable

### Story 1.14: Transform Capability — Extract Emails / Extract Links

As a power user,
I want to extract emails or links from pasted text,
So that I can quickly build lists from unstructured content.

**Acceptance Criteria:**

**Given** the clipboard contains text with emails
**When** I issue “extract emails”
**Then** ClipMorph replaces the clipboard with a newline-delimited email list (FR21)
**And** duplicates are removed (deterministic rule)

**Given** the clipboard contains text with URLs
**When** I issue “extract links”
**Then** ClipMorph replaces the clipboard with a newline-delimited URL list (FR21)
**And** outputs are normalized consistently (deterministic rule)

### Story 1.15: Transform Capability — Redact Secrets (Heuristics)

As a power user,
I want ClipMorph to redact obvious secrets from clipboard text,
So that I can paste safely without accidental credential leaks.

**Acceptance Criteria:**

**Given** the clipboard contains text matching configured secret patterns (e.g., API keys)
**When** I issue “redact secrets”
**Then** ClipMorph replaces the clipboard with masked/redacted output (FR22)
**And** redaction rules are deterministic and documented

**Given** the clipboard contains no matching patterns
**When** I issue “redact secrets”
**Then** ClipMorph reports “nothing to redact” without changing clipboard
**And** the job completes successfully (FR23)

### Story 1.16: Multi-step Transform Chaining

As a power user,
I want to run multi-step transforms in one command,
So that I can compose operations without repeated interactions.

**Acceptance Criteria:**

**Given** a transcript implies a chain (e.g., “compute then convert then format”)
**When** the chain executes
**Then** ClipMorph applies steps in a deterministic order and produces a final output (FR17, FR16)
**And** if any step fails, the clipboard remains unchanged and a failure reason is shown (FR23, FR34)

### Story 1.17: Lightweight Result Feedback + Last Action Summary

As a power user,
I want to see whether the last action succeeded/failed and what capability ran,
So that I can quickly understand what happened without a full UI.

**Acceptance Criteria:**

**Given** a transform job completes
**When** it succeeds or fails
**Then** ClipMorph updates a “last action summary” including last transcript and capability name (FR33)
**And** it indicates success/failure in a lightweight surface (menubar/status UI) (FR23)

## Epic 2 — Configure + Trust ClipMorph (Settings & Troubleshooting)

Users can configure ClipMorph’s behavior, understand what happened, and control retention/diagnostics so the tool stays trustworthy day-to-day.

### Story 2.1: Settings Storage (SQLite) + Basic Settings UI

As a power user,
I want to view and change ClipMorph settings from a settings surface,
So that the tool fits my workflow.

**Acceptance Criteria:**

**Given** the settings UI is opened
**When** the user changes a setting (e.g., enable/disable transform categories)
**Then** the change is persisted locally in SQLite
**And** the change is reflected immediately in runtime behavior (FR31, FR32)

**Given** the app restarts
**When** it loads
**Then** it reads settings from SQLite and restores prior configuration (FR32)

### Story 2.2: Configure Push-to-Talk Behavior

As a power user,
I want to configure push-to-talk activation behavior,
So that I can avoid conflicts with other global shortcuts.

**Acceptance Criteria:**

**Given** the settings UI is opened
**When** the user changes the push-to-talk hotkey configuration
**Then** the new configuration is persisted and used for subsequent activations (FR30)
**And** invalid/unsupported hotkey choices are rejected with an explanation

### Story 2.3: Transcript History (Last 20) + Clear History Control

As a power user,
I want ClipMorph to keep a small rolling transcript history and allow clearing it,
So that I have transparency without excessive retention.

**Acceptance Criteria:**

**Given** actions occur over time
**When** transcripts are recorded
**Then** ClipMorph persists up to the last 20 transcripts locally (rolling retention) (NFR10 / PRD NFR-S2)
**And** older transcripts are removed automatically when the cap is exceeded

**Given** the user opens settings/support UI
**When** they click “clear history”
**Then** stored transcripts are deleted locally
**And** the UI reflects an empty/cleared state (FR35)

### Story 2.4: Action Failure Diagnostics (Non-Persistent)

As a power user,
I want clear diagnostic info for why an action failed,
So that I can self-debug without digging through logs.

**Acceptance Criteria:**

**Given** a job fails (transcription/transform/automation)
**When** the UI shows the failure
**Then** it includes a human-readable reason and (if applicable) structured error details (FR34)
**And** diagnostics do not require persistent logs beyond configured transcript retention (NFR11)

## Epic 3 — Agentic Browser Automation MVP (“Apply on this portal”)

Users can launch Chrome automation from voice using clipboard content, monitor progress, handle “needs input” stops, and cancel safely without accidental runs.

### Story 3.1: Automation Job Lifecycle + Status UI

As a power user,
I want automation tasks to run as cancellable jobs with clear status,
So that I can monitor progress and stop safely.

**Acceptance Criteria:**

**Given** an automation job is started
**When** it runs
**Then** the job status updates through `pending/running/needs_input/completed/failed/cancelled` (Architecture constraint)
**And** the UI reflects status changes in near-real-time (FR27)
**And** end-to-end automation completes p95 ≤ 120s for the MVP demo flow (NFR3 as target)

**Given** an automation job is running
**When** the user cancels it
**Then** it transitions to `cancelled` and stops driving the browser (FR28)
**And** cancellation is exposed via a UI control (Architecture constraint)

### Story 3.2: Start “Apply on this portal” Automation From Voice

As a job seeker,
I want to initiate “apply on this portal” from a voice command using clipboard resume content,
So that I can start an application flow quickly.

**Acceptance Criteria:**

**Given** the clipboard contains resume text (or a resume file path, if supported)
**When** the user issues the supported automation command
**Then** ClipMorph starts an automation job and opens a Chrome automation context (FR24, FR25)
**And** it shows “running” status to the user (FR27)
**And** automation uses Chrome for MVP (NFR13)

### Story 3.3: Agentic Automation Loop (agent-browser) With Schema Validation

As a job seeker,
I want ClipMorph to drive browser interactions robustly without brittle selectors,
So that it can handle different portals.

**Acceptance Criteria:**

**Given** an automation job is running
**When** the automation loop executes
**Then** it follows `snapshot → decide actions → execute → resnapshot` until completion (Architecture constraint)
**And** it operates on ref-based snapshot targets (not per-site CSS selectors) (Architecture constraint)

**Given** the LLM proposes actions
**When** actions are received
**Then** they are schema-validated before execution
**And** invalid actions cause a safe failure without executing arbitrary commands (Architecture constraint)

**Given** automation requires model reasoning
**When** the system sends data to an LLM provider
**Then** it may use a cloud provider in MVP (NFR9)
**And** it minimizes stored data beyond what’s needed (NFR11)

### Story 3.4: “Needs Input” Interruptions (Login/CAPTCHA/Ambiguity)

As a job seeker,
I want ClipMorph to pause and ask for help when automation can’t proceed,
So that the system doesn’t get stuck or do the wrong thing.

**Acceptance Criteria:**

**Given** automation hits a login screen, CAPTCHA, or ambiguous form step
**When** the system detects it cannot proceed safely
**Then** the job transitions to `needs_input` and stops acting (FR29)
**And** the UI explains what input/approval is required to continue

### Story 3.5: Automation Form Fill (Basic Resume Mapping)

As a job seeker,
I want ClipMorph to fill common application fields from my resume content,
So that applications take fewer manual steps.

**Acceptance Criteria:**

**Given** an automation job is on an application form with common fields (name/email/phone, etc.)
**When** the automation loop identifies fillable fields
**Then** it fills fields using parsed resume content (FR26)
**And** it reports completion/failure with a clear status and reason (FR27)

## Epic 4 — Agentic Code & File Automation via OpenCode CLI (Post-MVP)

Users can trigger general-purpose agentic tasks (code generation, file manipulation, multi-step workflows) from voice commands by spawning OpenCode CLI as a subprocess, enabling ClipMorph to handle tasks beyond browser automation.

**Note:** This epic is **post-MVP** and extends ClipMorph's capabilities using [OpenCode CLI](https://opencode.ai) patterns similar to [Openwork](https://github.com/accomplish-ai/openwork).

### Story 4.1: OpenCode CLI Sidecar Integration

As a power user,
I want ClipMorph to spawn and manage OpenCode CLI as a subprocess,
So that I can leverage agentic coding capabilities from voice commands.

**Acceptance Criteria:**

**Given** ClipMorph is running and OpenCode CLI is installed
**When** an agentic code task is requested
**Then** ClipMorph spawns OpenCode CLI via `node-pty` with proper environment
**And** the subprocess lifecycle is managed (start/stop/restart)
**And** stdout/stderr are captured and streamed to the job status

**Given** OpenCode CLI is not installed
**When** the user attempts an agentic code task
**Then** the UI shows a clear error with installation instructions
**And** other ClipMorph features remain functional

### Story 4.2: Voice-Triggered Code Tasks via OpenCode

As a developer,
I want to say "generate a React component for X" or "refactor this function",
So that I can trigger code generation/modification from voice without switching apps.

**Acceptance Criteria:**

**Given** the clipboard contains code or a file path
**When** the user issues a code-related voice command
**Then** ClipMorph routes to OpenCode CLI with the appropriate prompt
**And** the result is placed in the clipboard (or written to file if path-based)
**And** the job status shows progress and completion

**Given** a code generation task completes
**When** the user reviews the result
**Then** the result can be approved/rejected before applying
**And** rejection leaves the original content unchanged

### Story 4.3: Custom Subagents Configuration

As a power user,
I want to define custom OpenCode subagents (e.g., reviewer, tester, formatter),
So that I can delegate specialized tasks to purpose-built agents.

**Acceptance Criteria:**

**Given** the user has created `.opencode/agent/*.md` files
**When** ClipMorph lists available agents
**Then** custom subagents appear alongside built-in agents
**And** the UI shows agent descriptions and capabilities

**Given** the user invokes a custom subagent via voice
**When** the task runs
**Then** the correct subagent is invoked with appropriate permissions
**And** the agent's output is captured and surfaced in the UI

### Story 4.4: Multi-Stage Agentic Workflows (Plan → Code → Review)

As a team lead,
I want to run multi-stage workflows (e.g., plan → implement → review),
So that complex tasks are handled systematically with human checkpoints.

**Acceptance Criteria:**

**Given** the user triggers a multi-stage workflow
**When** the workflow executes
**Then** each stage runs sequentially (plan → code → review)
**And** the user can approve/reject at each stage before proceeding
**And** the workflow can be cancelled at any checkpoint

**Given** a stage fails or is rejected
**When** the user chooses to retry or abort
**Then** the workflow handles the decision gracefully
**And** partial results are preserved for review

### Story 4.5: File & Folder Operations via Voice

As a power user,
I want to say "organize my downloads folder" or "rename files matching X",
So that I can perform file management tasks hands-free.

**Acceptance Criteria:**

**Given** the user issues a file operation command
**When** OpenCode processes the request
**Then** a preview of changes is shown before execution
**And** the user must approve destructive operations (delete/move/rename)
**And** operations are logged for undo/audit purposes

**Given** file operations complete
**When** the user reviews results
**Then** a summary shows what was changed
**And** recent operations can be undone within a time window

### Story 4.6: Reusable Skills Library

As a developer,
I want to create and share reusable "skills" (instruction templates),
So that common patterns (linting rules, style guides, test patterns) are standardized.

**Acceptance Criteria:**

**Given** skills are defined in `.opencode/skill/<name>/SKILL.md`
**When** an agent runs a related task
**Then** the skill instructions are automatically included
**And** skills can be project-local or global (~/.config/opencode/skill/)

**Given** the user wants to share a skill
**When** they export it
**Then** the skill can be imported into other projects
**And** skill versioning is supported for updates
