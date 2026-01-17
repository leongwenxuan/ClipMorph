---
workflowType: "architecture"
project_name: "ClipMorph"
user_name: "Leongwenxuan"
date: "2026-01-17T06:23:37Z"
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: "complete"
completedAt: "2026-01-17T06:42:08Z"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/analysis/brainstorming-session-2026-01-17.md"
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (architectural implications):**

- The MVP is effectively **two systems**:
  1) **Clipboard transform engine** (high-frequency; correctness + undo; safe clipboard write semantics).
  2) **Browser automation engine** (long-running; stateful; cancel/progress; “needs user input” interruptions).
- Voice acts as the shared intent layer routing requests into either transforms or automation.
- Settings/debug (menubar) is required because permissions + transcript visibility are core to trust.

**Non-Functional Requirements (architecture drivers):**

- Latency + timeouts imply an async job model with explicit pending/apply semantics.
- Reliability targets imply idempotency + snapshot gating on clipboard writes.
- Persisting transcripts implies a local persistence decision (scope, retention, delete).
- Cloud LLM allowed implies a provider boundary + minimal content-minimization strategy.

### Scale & Complexity

- **Primary domain:** macOS desktop background agent + Chrome automation
- **Complexity level:** medium
- **Estimated architectural components (MVP):**
  - menubar/settings UI
  - global hotkey + audio capture
  - speech → intent router
  - clipboard watcher + job runner + undo store
  - transform implementations (deterministic + LLM-backed)
  - browser automation runner (Chrome) + progress/cancel
  - local persistence (settings + last transcripts)

### Technical Constraints & Dependencies

- **Platform:** macOS (cross-platform only if same codebase).
- **Permissions:** microphone + accessibility required for full MVP.
- **Browser automation:** Chrome-only for MVP.
- **Model:** cloud LLM allowed (network dependency acceptable).
- **Transcript persistence:** store last 20 transcripts locally + clear control.
- **Agentic portal handling:** automation must handle arbitrary portals using a structured interaction loop (snapshot → action → re-snapshot), not per-site selectors.

### Cross-Cutting Concerns Identified

- **Correctness:** clipboard race conditions, self-trigger loops, “pending means no change”.
- **Trust UX:** undo, last transcript, minimal “what happened” visibility.
- **Routing:** strict intent → capability mapping to mitigate LLM reliability issues.
- **Long-running automation:** cancelability, progress states, and “needs user input” interruption handling.
- **Permissions management:** detect/messaging when missing permissions; degrade gracefully.

## Starter Template Evaluation

### Primary Technology Domain

Desktop application: Electron background main process + lightweight React settings UI.

### Selected Starter: Electron + Vite + React (TypeScript)

**Rationale for Selection:**

- Fast iteration and familiar JS/TS tooling (Vite)
- Clean separation of concerns: renderer UI vs main-process “agent runtime”
- Natural fit for Playwright under the hood plus an agentic automation loop (snapshot → action → re-snapshot)

**Initialization Command:**

```bash
npm create electron-vite@latest clipmorph -- --template react-ts
```

**Notes:**

- Main process owns: clipboard engine, voice routing, `agent-browser` orchestration, local persistence.
- Renderer owns: menubar/settings UI, last transcript view, progress/cancel surfaces.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- **App framework:** Electron + Vite + React (TypeScript) (`electron-vite` starter; pin exact versions at implementation time)
- **Process model:** Single Electron **main process** runs clipboard/voice/automation; renderer is UI-only.
- **Browser automation runtime:** Use `agent-browser` **Node API** as the automation runtime (ref-based snapshot → action → re-snapshot loop).
- **Persistence:** SQLite for settings + last-20 transcripts; macOS Keychain for secrets/API keys.
- **Browser target:** Chrome-only for MVP automation.

**Important Decisions (Shape Architecture):**

- **Job orchestration model:** explicit async jobs with statuses (`pending/running/needs_input/completed/failed/cancelled`).
- **IPC boundary:** renderer never touches OS primitives directly; all privileged operations go through main-process APIs.
- **Transcript retention:** persist last 20 transcripts locally; provide “clear history”.

**Deferred Decisions (Post-MVP):**

- Cross-platform packaging (only if same codebase remains viable)
- Auto-update strategy
- Local model/offline mode

### Data Architecture

- **Local DB:** SQLite.
- **Data model (minimum):**
  - `settings` (key/value or structured JSON)
  - `transcripts` (timestamp, transcript text, capability invoked, result status)
  - (optional) `jobs` (job_id, type, status, timestamps, last_error)
- **Retention:** transcripts capped at last 20 (rolling).

### Authentication & Security

- **Secrets storage:** macOS Keychain for API keys/secrets.
- **Privilege separation:** renderer sandboxed; nodeIntegration off; contextIsolation on; strict IPC allowlist.
- **Automation permissioning:** require explicit user activation (push-to-talk) before any automation job starts.

### API & Communication Patterns

- **Intent routing:** transcript → intent classification → (transform engine | automation engine).
- **Automation loop:** `agent-browser` snapshot (refs) → LLM chooses actions → execute actions → resnapshot until done/needs_input/cancelled.
- **Cloud calls:** cloud LLM allowed; design a provider boundary so model can be swapped without rewriting core logic.

### Frontend Architecture

- **Renderer UI:** minimal menubar/settings app with:
  - status (idle/running/needs input)
  - last transcript
  - enable/disable transform categories
  - cancel current job

### Infrastructure & Deployment

- **Distribution (MVP):** manual install (no auto-update).
- **Versioning strategy:** pin exact dependency versions in lockfile for reproducibility; update deliberately.

### Decision Impact Analysis

**Implementation Sequence (high-level):**

1. Bootstrap Electron app + settings UI from starter.
2. Implement clipboard engine + undo store + safe write semantics.
3. Implement voice capture + transcript + intent routing.
4. Implement transform capabilities (deterministic first; LLM-backed next).
5. Integrate `agent-browser` Node API and build the agentic automation loop.
6. Add persistence (SQLite) + Keychain secrets + last transcript UI.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points identified:** IPC shapes, job lifecycle semantics, file naming, and automation action schemas (high risk of AI-agent divergence).

### Naming Patterns

**Code (TypeScript):**

- `camelCase` variables/functions, `PascalCase` classes/types/components.
- File names: `kebab-case.ts` / `kebab-case.tsx`.

**IPC naming:**

- Channels: `clipmorph:<domain>:<action>` (e.g. `clipmorph:clipboard:getState`, `clipmorph:automation:startJob`).
- Job identifiers: `jobId` (UUID v4 string).
- Correlation: `requestId` (UUID v4 string) on every IPC request/response.

**Time:**

- Timestamps: `createdAt/updatedAt` as ISO8601 UTC strings.

### Structure Patterns

**Privilege boundary:**

- Renderer is UI-only.
- All privileged operations (clipboard, mic, automation, persistence) live in main process services.

**Service boundaries (main process):**

- `ClipboardService`, `VoiceService`, `AutomationService`, `StoreService`, `SettingsService`.

**Shared types:**

- One shared “contract” for IPC payload types and job status types (single source of truth).

### Format Patterns

**IPC envelope format (mandatory):**

- Success: `{ ok: true, requestId, data }`
- Error: `{ ok: false, requestId, error: { code, message, details? } }`

### Communication Patterns

**Command-style IPC:**

- Use request/response (`ipcMain.handle` + `ipcRenderer.invoke`) for commands and queries.

**Event-style IPC:**

- Single events bus channel: `clipmorph:events` emitting `{ type, jobId?, payload }`.
- Event `type` examples: `automation.jobStatusChanged`, `clipboard.changed`, `voice.transcriptUpdated`.

**Job lifecycle:**

- Status enum: `pending | running | needs_input | completed | failed | cancelled`.
- Status transitions must be monotonic and recorded with timestamps.

### Process Patterns

**Clipboard correctness:**

- Apply results only if clipboard snapshot still matches (snapshot gating).
- “Pending means no change”: clipboard remains original until job completes.
- Undo: 2-deep store updated on every ClipMorph clipboard overwrite; `⌥⌘Z` restores previous value.

### Agent-browser (“computer use”) Patterns

- Ref-first interaction: operate on snapshot refs, not CSS selectors.
- Loop contract: `snapshot → LLM actions(JSON schema) → execute → resnapshot` until terminal state.
- LLM output must be schema-validated before execution.
- If automation hits login/CAPTCHA/ambiguity: transition to `needs_input` and stop.

### Persistence Patterns

- Canonical store: SQLite for settings + transcripts.
- Secrets: macOS Keychain only.
- Transcript retention: last 20 (rolling), plus “clear history” action.

### Enforcement Guidelines

**All AI agents MUST:**

- Use the IPC envelope format.
- Use the shared job status enum and lifecycle rules.
- Keep privileged OS actions in main process services only.
- Keep filenames in `kebab-case`.

**Pattern enforcement:**

- If a PR introduces a second pattern, refactor to conform (do not “support both”).

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
clipmorph/
├── README.md
├── package.json                 # npm workspaces root
├── package-lock.json
├── .gitignore
├── .editorconfig
├── .env.example
├── .env.local                   # not committed
├── .prettierrc
├── .eslintrc.cjs
├── tsconfig.base.json
├── scripts/
│   └── postinstall.cjs          # optional: sanity checks
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── electron.vite.config.ts
│       ├── tsconfig.json
│       ├── resources/
│       │   ├── icons/
│       │   └── entitlements.mac.plist
│       └── src/
│           ├── main/
│           │   ├── main.ts                       # app bootstrap
│           │   ├── ipc/
│           │   │   ├── ipc-router.ts             # registers all IPC handlers
│           │   │   ├── ipc-channels.ts           # channel constants
│           │   │   └── ipc-events.ts             # emits clipmorph:events
│           │   ├── services/
│           │   │   ├── clipboard-service.ts
│           │   │   ├── voice-service.ts
│           │   │   ├── automation-service.ts     # agent-browser orchestration
│           │   │   ├── transform-service.ts
│           │   │   ├── store-service.ts          # sqlite access
│           │   │   └── settings-service.ts
│           │   ├── jobs/
│           │   │   ├── job-manager.ts            # status lifecycle + cancellation
│           │   │   └── job-types.ts
│           │   ├── llm/
│           │   │   ├── provider.ts               # cloud LLM boundary
│           │   │   └── schemas/
│           │   │       ├── intent.schema.json
│           │   │       └── automation-actions.schema.json
│           │   └── util/
│           │       ├── logger.ts
│           │       └── hash.ts
│           ├── preload/
│           │   └── preload.ts                    # exposes safe IPC API
│           └── renderer/
│               ├── index.html
│               ├── src/
│               │   ├── app.tsx
│               │   ├── main.tsx
│               │   ├── ui/
│               │   │   ├── menubar.tsx
│               │   │   ├── settings.tsx
│               │   │   └── job-status.tsx
│               │   └── state/
│               │       └── app-state.ts
│               └── assets/
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   └── src/
│   │       ├── ipc.ts            # request/response envelope + channel types
│   │       ├── jobs.ts           # JobStatus enum + payload types
│   │       └── settings.ts
│   ├── core/
│   │   ├── package.json
│   │   └── src/
│   │       ├── transforms/
│   │       │   ├── index.ts
│   │       │   ├── url-clean.ts
│   │       │   ├── markdown-link.ts
│   │       │   ├── json-format.ts
│   │       │   ├── json-yaml.ts
│   │       │   ├── extract-emails.ts
│   │       │   ├── extract-links.ts
│   │       │   └── redact-secrets.ts
│   │       └── intent/
│   │           ├── classify-intent.ts
│   │           └── intent-types.ts
│   ├── store-sqlite/
│   │   ├── package.json
│   │   └── src/
│   │       ├── db.ts
│   │       ├── schema.sql         # sqlite schema for settings/transcripts/jobs
│   │       └── migrations/
│   ├── stt-parakeet/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── client.ts          # node client for the sidecar (spawn + protocol)
│   │   │   ├── types.ts
│   │   │   └── audio.ts           # wav/pcm helpers for 16k mono
│   │   └── sidecar/
│   │       ├── README.md
│   │       ├── requirements.txt
│   │       ├── server.py          # stdio/localhost JSON server for transcription
│   │       └── model/
│   │           └── README.md      # where/how model is cached (no hardcoded weights)
│   └── automation-agent-browser/
│       ├── package.json
│       └── src/
│           ├── browser-manager.ts  # wraps agent-browser Node API
│           ├── snapshot.ts
│           ├── actions.ts          # validates/executes action schema
│           └── loop.ts             # snapshot→LLM→act→resnapshot
└── docs/
    └── architecture-notes.md       # optional
```

### Architectural Boundaries

#### Component boundaries

- Renderer: UI only (menubar/settings/status). No direct OS access.
- Main: owns clipboard, mic/voice, job lifecycle, transforms, automation, persistence.
- Preload: the only bridge; exposes a minimal, typed API.

#### Service boundaries

- `ClipboardService`: clipboard watch + safe overwrite + 2-deep undo.
- `VoiceService`: push-to-talk capture + transcript + STT orchestration (`stt-parakeet` client + sidecar lifecycle).
- `TransformService`: deterministic transforms + LLM-backed transforms (via `LLMProvider`).
- `AutomationService`: job orchestration + `automation-agent-browser` loop.
- `StoreService`: SQLite reads/writes; retention policy.
- `SettingsService`: settings CRUD (backed by SQLite).

#### Data boundaries

- SQLite is the system of record for settings + transcripts (+ optional jobs table).
- Keychain is secrets-only (API keys).

### Requirements to Structure Mapping

#### FR Category → module

- Activation/permissions/lifecycle → `apps/desktop/src/main/main.ts`, `services/*`, `renderer/ui/*`
- Clipboard monitoring/state/undo → `ClipboardService`, `jobs/job-manager.ts`, `packages/core/transforms/*`
- Voice capture + transcript → `VoiceService`, `packages/stt-parakeet/*`, `renderer/ui/job-status.tsx`
- Transforms → `packages/core/transforms/*` + `TransformService`
- Browser automation → `AutomationService` + `packages/automation-agent-browser/*`
- Settings → `SettingsService` + `renderer/ui/settings.tsx`
- Troubleshooting → `renderer/ui/*` (last transcript view) + `StoreService`
- Safety/privacy functional → `SettingsService` + activation gates in `VoiceService`/`AutomationService`

### Integration Points

#### Internal Communication

- IPC request/response uses the envelope defined in `packages/contracts/src/ipc.ts`.
- Event stream uses `clipmorph:events` with typed payloads.

#### External Integrations

- Cloud LLM provider via `apps/desktop/src/main/llm/provider.ts`.
- `agent-browser` Node API via `packages/automation-agent-browser`.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

- Electron + Vite + React (TypeScript) is compatible with a background-agent main process model.
- `agent-browser` (Playwright-based) fits the Chrome-only MVP automation scope.
- SQLite + Keychain split aligns with local retention + secret storage constraints.

**Pattern Consistency:**

- IPC envelope + strict job lifecycle semantics reduce AI-agent divergence.
- Snapshot gating + “pending means no change” is consistent with correctness and undo requirements.
- Ref-first automation loop matches the “arbitrary portals” requirement.

**Structure Alignment:**

- Project structure cleanly separates renderer (UI), preload (bridge), and main (privileged runtime).
- Monorepo layout isolates shared contracts, transforms, automation loop, and persistence.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

- Clipboard state control is supported via snapshot gating + undo store (FR5–FR10).
- Voice flow is supported via push-to-talk capture + transcript view + intent routing (FR11–FR15).
- Transforms are supported via deterministic transforms + optional LLM-backed transforms behind a provider boundary (FR16–FR23).
- Browser automation is supported via async jobs, progress states, cancel, and `needs_input` interruptions (FR24–FR29).
- Settings + supportability are supported via menubar UI + persisted transcripts (FR30–FR35).
- Unintentional automation is prevented via explicit activation gates (FR36).

**Non-Functional Requirements Coverage:**

- Performance: async job model + explicit timeouts support NFR-P1/P2/P3.
- Reliability: snapshot gating + monotonic job transitions support NFR-R2/R4.
- Security: Keychain for secrets + transcript retention cap + clear-history control supports NFR-S1–S4.
- Integration: Chrome-only automation explicitly supported (NFR-I1).

### Implementation Readiness Validation ✅

**Decision Completeness:**

- Core stack and boundaries are specified; remaining “pick-one” libraries should be decided to avoid drift.

**Structure Completeness:**

- Complete project tree and module ownership boundaries are defined.

**Pattern Completeness:**

- IPC envelope, event channel, job statuses, and automation loop contract are defined.

### Gap Analysis Results

**Important (recommend resolving before implementation begins):**

- Voice transcription: pick exact implementation (cloud Whisper API vs macOS local STT vs local Whisper later).
- SQLite driver: pick one (`better-sqlite3` vs `sqlite3`) and enforce it.
- Keychain integration: pick one (typically `keytar`) and enforce it.
- IPC contracts: `packages/contracts` is the single source of truth for IPC payload types (no ad-hoc shapes).

**Resolved decisions (locked):**

- Voice transcription: **local Parakeet v2** (`nvidia/parakeet-tdt-0.6b-v2`) running via a **local Python sidecar** (NeMo / PyTorch). The Electron main process spawns/controls the sidecar, sends recorded audio chunks, and receives transcripts. Model artifacts are cached on disk (no network after first download).
- SQLite driver: **`better-sqlite3`** (single-writer, synchronous API in main process; enforce one DB access module).
- Keychain integration: **`keytar`** for macOS Keychain storage.

**Nice-to-have:**

- Explicit idle-CPU guardrails (debounce/backoff on watchers).
- Explicit timeout semantics per job type aligned to NFR-P2/P3.

### Validation Issues Addressed

- No critical blockers found. Remaining gaps are “pick-one” library decisions and minor operational guardrails.

### Architecture Completeness Checklist

#### ✅ Requirements Analysis

- [x] Project context thoroughly analyzed
- [x] Cross-cutting concerns mapped

#### ✅ Architectural Decisions

- [x] Technology stack specified
- [x] Integration patterns defined

#### ✅ Implementation Patterns

- [x] Naming conventions established
- [x] Communication patterns specified
- [x] Process patterns documented

#### ✅ Project Structure

- [x] Complete directory structure defined
- [x] Boundaries and integration points mapped

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION  
**Confidence Level:** HIGH (core “pick-one” library decisions are now locked)

**Key Strengths:**

- Correctness-first clipboard semantics (snapshot gating + undo)
- Clear job lifecycle model for automation + transforms
- Ref-based automation loop designed for arbitrary portals

**Areas for Future Enhancement:**

- Offline/local model path
- Cross-platform packaging
- Formal test strategy (intentionally deferred)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅  
**Total Steps Completed:** 8  
**Date Completed:** 2026-01-17T06:42:08Z  
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

#### 📋 Complete Architecture Document

- All architectural decisions documented (stack, process model, automation runtime, persistence)
- Implementation patterns ensuring AI-agent consistency (IPC envelope, job lifecycle, automation loop contract)
- Complete project structure (npm workspaces monorepo) with clear boundaries
- Requirements → structure mapping for FR + NFR coverage
- Validation confirming coherence and implementation readiness

#### 🏗️ Implementation Ready Foundation

- **Decision count:** ~10 core decisions + derived constraints
- **Pattern count:** ~8 enforceable pattern groups (naming, IPC envelope, events, job lifecycle, clipboard correctness, automation loop, persistence, enforcement)
- **Component count (MVP):** 6 main services (`ClipboardService`, `VoiceService`, `TransformService`, `AutomationService`, `StoreService`, `SettingsService`)
- **Requirements supported:** 36 FRs + 14 NFRs (total 50)

#### 📚 AI Agent Implementation Guide

- Technology stack boundary: Electron main owns privileged ops; renderer UI-only.
- Single source of truth: `packages/contracts` for IPC payload types + job statuses.
- Automation contract: ref-first `agent-browser` loop with schema-validated actions.

### Implementation Handoff

**For AI Agents:**

- Read this architecture doc before implementing each story.
- Follow patterns exactly (no “second pattern” drift).
- Keep all OS/automation/persistence primitives in main-process services.

**First Implementation Priority:**

`npm create electron-vite@latest clipmorph -- --template react-ts`

**Immediate Next Steps:**

1. Start `/bmad:bmm:workflows:create-epics-and-stories` to turn PRD into implementable stories that reference this architecture.
2. Encode the locked runtime choices in the first setup story (Parakeet v2 local sidecar, `better-sqlite3`, `keytar`).

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅
