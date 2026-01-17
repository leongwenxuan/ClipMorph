---
project_name: "ClipMorph"
user_name: "Leongwenxuan"
date: "2026-01-17T06:42:08Z"
source_docs:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
---

# Project Context for AI Agents

_This file is the “you must not drift” contract for anyone (human or AI) implementing ClipMorph. Prefer changing this file over inventing new patterns._

---

## Technology Stack (Locked)

- **App**: Electron + Vite + React + TypeScript (macOS-first)
- **Automation**: `agent-browser` Node API (Playwright-based), Chrome-only for MVP
- **Local DB**: SQLite via **`better-sqlite3`**
- **Secrets**: macOS Keychain via **`keytar`**
- **Voice transcription**: **Local Parakeet v2** (`nvidia/parakeet-tdt-0.6b-v2`) via a **local Python sidecar** (NeMo / PyTorch)

## Non-Negotiable Boundaries

- **Renderer is UI-only**: no clipboard, no mic, no DB, no browser automation, no secrets access.
- **Main process owns privileged operations**: clipboard engine, voice pipeline, job orchestration, automation loop, SQLite, Keychain.
- **Preload is the only bridge**: expose a minimal typed API; no ad-hoc IPC.

## IPC Contract (Do Not Drift)

- **Channel naming**: `clipmorph:<domain>:<action>`
- **Request/response envelope** (mandatory):
  - Success: `{ ok: true, requestId, data }`
  - Error: `{ ok: false, requestId, error: { code, message, details? } }`
- **Events**: single bus `clipmorph:events` emitting `{ type, jobId?, payload }`
- **All IPC payload types live in**: `packages/contracts` (single source of truth).

## Job Model (Mandatory Semantics)

- Status enum: `pending | running | needs_input | completed | failed | cancelled`
- Status transitions are **monotonic** and timestamped.
- Cancellation must be best-effort immediate and leave system in a safe state (no clipboard overwrite after cancel).

## Clipboard Correctness Rules (Must Hold)

- **Snapshot gating**: never apply an old result over a newer clipboard value.
- **Pending means no change**: clipboard stays original until completion.
- **Undo**: maintain at least 2-deep undo store for ClipMorph-originated overwrites.
- **Self-trigger immunity**: the app must not re-trigger on its own clipboard writes.

## Automation Rules (`agent-browser`)

- **Ref-first**: operate on snapshot refs, not CSS selectors.
- **Loop contract**: `snapshot → LLM actions (JSON schema) → execute → resnapshot` until terminal state.
- **Schema-validate** all LLM outputs before execution.
- **Hard stop to `needs_input`** on login/CAPTCHA/ambiguity; do not “guess” past it.

## Local Voice Transcription (Parakeet v2 Sidecar)

- Sidecar runs locally (Python). Electron main spawns it and communicates over stdin/stdout JSON (or localhost HTTP on `127.0.0.1`).
- Model: `nvidia/parakeet-tdt-0.6b-v2` via NeMo.
- Model cache location should be deterministic (e.g. app support dir) and not depend on global user state.
- After the first download, transcription must run offline (no network required).

## Persistence Rules

- SQLite stores: settings + last-20 transcripts (+ optional jobs table).
- Transcript retention: **last 20**, rolling; provide **clear history** action.
- Secrets (API keys) never go to SQLite; **Keychain only**.

## File/Code Style

- TypeScript: `camelCase` vars/functions; `PascalCase` types/classes/components
- Filenames: `kebab-case.ts` / `kebab-case.tsx`
- Prefer explicit error codes (`CLIPBOARD_SNAPSHOT_MISMATCH`, `AUTOMATION_NEEDS_INPUT`, etc.) over stringly errors.
