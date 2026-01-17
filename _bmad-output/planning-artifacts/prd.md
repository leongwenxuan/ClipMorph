---
workflowType: "prd"
project_name: "ClipMorph"
user_name: "Leongwenxuan"
date: "2026-01-17T05:47:17Z"
stepsCompleted:
  - "step-01-init"
  - "step-02-discovery"
  - "step-03-success"
  - "step-04-journeys"
  - "step-05-domain"
  - "step-06-innovation"
  - "step-07-project-type"
  - "step-08-scoping"
  - "step-09-functional"
  - "step-10-nonfunctional"
  - "step-11-polish"
  - "step-12-complete"
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 1
  projectDocsCount: 0
inputDocuments:
  - "_bmad-output/analysis/brainstorming-session-2026-01-17.md"
classification:
  projectType: "desktop_app"
  domain: "general"
  complexity: "medium"
  projectContext: "greenfield"
completed_at: "2026-01-17T06:20:24Z"
---

# Product Requirements Document - ClipMorph

**Author:** Leongwenxuan
**Date:** 2026-01-17T05:47:17Z

## Executive Summary

**Product:** ClipMorph — the **AI layer between copy and paste**.

**Target users:** People who copy/paste constantly (corporate knowledge workers, devs, power users).

**Core loop:** User copies anything → holds push-to-talk → speaks intent → pastes transformed output (no app switching).

**MVP thesis:** Transformations feel “ambient” because they happen at the OS boundary, not inside a chat UI.

**Validation:** 3 flawless demos in a row, total ≤ 90s (currency/math chain, URL clean→markdown link, JSON pretty/convert).

**Platform:** macOS menubar/background app. Chrome automation supported for MVP.

## Success Criteria

### User Success

- **Core (clipboard transforms):** user can copy → hold-to-talk → command → paste with zero app switching.
- **“Superpower” moment:** user completes 3 transforms back-to-back without friction (currency/math chain, URL clean→markdown link, JSON pretty/convert).
- **Automation (browser):** user can copy resume content (or a resume file path), say “apply on this portal”, and ClipMorph opens Chrome and progresses the application flow with minimal user intervention.

### Business Success

- **Hackathon demo:** deliver **3 flawless demos in a row** (no restart) with total demo time **≤ 90s**.

### Technical Success

- **Latency:** clipboard transforms complete (or fail cleanly) within ≤ 60s; automation tasks complete within ≤ 120s p95.
- **Undo reliability:** `⌥⌘Z` restores the previous clipboard state correctly ≥ 99%.
- **Command success rate:** ≥ 80% successful command interpretation on clean audio for the supported command set.

### Measurable Outcomes

- **Demo KPI:** 3/3 flawless runs, ≤ 90s total, recorded.
- **Quality KPI:** ≥ 80% command success (supported set), ≥ 99% undo success.

## Product Scope

### MVP - Minimum Viable Product

- Mac menubar/background app delivering clipboard transforms + a minimal settings/debug surface.
- **Includes MVP browser automation (“computer use”) in Chrome** for the “apply on portal” flow.

### Growth Features (Post-MVP)

- Expand automation robustness (more portals, more resilience, better recovery flows).
- More transforms (images OCR/compress, file/path actions) + per-app policies + richer reusable “skills”.

### Vision (Future)

- Full agentic workflows across apps (multi-step skills, approvals/logs/replay, deeper integrations).

## User Journeys

### Journey 1 — Primary User (Corporate Knowledge Worker) — “Stay in Flow”

- **Opening scene:** User is mid-task (docs/email/spreadsheet/browser). They copy/paste constantly and context switching breaks flow.
- **Rising action:** They copy content, hold-to-talk, speak a short command (e.g., “pretty json”, “clean link”, “format this code”), then paste.
- **Climax:** The pasted output is immediately usable (correct formatting / structured output) without leaving the current app.
- **Resolution:** They stay in flow and repeat this pattern all day because it’s faster than tool-switching.

### Journey 2 — Primary User (Automation-Seeker) — “Transform Anywhere”

- **Opening scene:** User is “anywhere on their local computer” where copying is possible and automation would save time.
- **Rising action:** They use ClipMorph as a universal transform layer: copy → speak intent → paste transformed result.
- **Climax:** Text transformation is reliable enough to replace ad-hoc tools (formatting copied code, cleaning pasted text, converting structured snippets).
- **Resolution:** ClipMorph becomes a default reflex: copy, speak, paste.

### Journey 3 — MVP Automation Journey (Agentic Browser Automation) — “Apply on This Portal”

- **Opening scene:** User is job hunting. They have a resume and are on a web portal with repetitive form-filling.
- **Rising action:** They copy resume content (or a resume file path), say “apply for jobs on this portal”.
- **Climax:** ClipMorph launches a browser session and auto-fills + completes the application flow.
- **Resolution:** User completes applications faster with far fewer repetitive steps.

### Journey 4 — Admin/Ops User (Configuration) — “Make It Fit My Workflow”

- **Opening scene:** User wants settings control.
- **Rising action:** They open settings and configure key behaviors (hotkey, which transforms are enabled, and what’s shown for debugging).
- **Climax:** ClipMorph is tuned to their workflow and “disappears” into the background.
- **Resolution:** Predictability increases trust and sustained use.

### Journey 5 — Support/Troubleshooting — “What Did It Hear?”

- **Opening scene:** A transform gives an unexpected result or takes longer than expected.
- **Rising action:** User opens the menubar panel/settings.
- **Climax:** User can see the **last transcript** (and optionally the last action) to diagnose what happened.
- **Resolution:** User can re-run with a clearer command or undo, without needing deep logs.

### Journey Requirements Summary

- **Core loop:** copy → hold-to-talk → command → paste (works in any app)
- **Transforms:** text/code/URL transforms as first-class MVP value
- **Automation:** “computer use” browser automation for job portals (MVP capability)
- **Settings:** user wants configuration surface (menubar settings)
- **Troubleshooting:** show at least **last transcript**

## Innovation & Novel Patterns

### Detected Innovation Areas

- **Category framing:** ClipMorph is the **AI layer between copy and paste**, not a clipboard history tool and not a chat assistant.
- **Interaction innovation:** “copy → hold-to-talk → command → paste” is a **zero-UI**, keyboard-first AI interaction model.
- **System substrate:** Clipboard becomes a universal input bus; transforms can be composable primitives (math/currency, URL hygiene, JSON/YAML, extraction).

### Market Context & Competitive Landscape

- Existing tools tend to be:
  - clipboard managers (store/history)
  - chat assistants (require a chat UI)
  - one-off converters/editors (require context switching)
- ClipMorph differentiates on **universality + invisibility**: it works anywhere paste works and keeps users in-flow.

### Validation Approach

- **Primary validation:** **3 flawless demos in a row**, total **≤ 90s**, covering:
  1) currency/math chain → paste
  2) URL clean → markdown link → paste
  3) JSON pretty (or JSON↔YAML) → paste

### Risk Mitigation

- If perceived as “just shortcuts,” emphasize:
  - universality across apps
  - transform composability
  - trust loop (undo + last transcript + minimal correctness guardrails)
- If voice is flaky, constrain MVP to push-to-talk and consider a typed command fallback post-MVP.

## Desktop App Specific Requirements

### Project-Type Overview

- **Form factor:** macOS menubar/background utility.
- **Platform scope:** **Mac-only** unless cross-platform can be achieved with essentially the **same code**.
- **Core interaction loop:** copy → hold-to-talk → command → paste (works in any app).

### Technical Architecture Considerations

#### Platform Support

- Target: macOS.
- Future option: cross-platform only if the architecture stays clean and doesn’t fork the product.

#### System Integration (MVP must-haves)

- Clipboard monitoring
- Global hotkey (push-to-talk)
- Menubar icon + settings window
- Microphone permission
- Accessibility permission (needed for Growth “computer use” automation; allowed in MVP)

#### Update Strategy

- **MVP:** no auto-update.

#### Offline Capabilities

- **MVP:** not required.
- **Offline mode:** only if local models are used.

### Implementation Considerations

- Minimal correctness baseline still required (don’t overwrite clipboard if it changed; prevent self-trigger loops; keep undo reliable).
- Support surface includes at least **last transcript** for troubleshooting.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

- **MVP Approach:** **Experience MVP** — nail the “AI layer between copy/paste” feel with **5–8 transforms** that demo extremely well.
- **Resource Requirements:** 1–2 people (desktop app plumbing + transform/prompt design).

### MVP Feature Set (Phase 1)

**Core user journeys supported:**

- **J2 Transform Anywhere** (primary): works in any app where copy/paste works.
- **J1 Stay in Flow** (primary): repeatable copy→voice→paste loop.
- **J4 Settings** (must-have): configure hotkey/transforms + debug surface.
- **J5 Troubleshooting** (must-have): show **last transcript** (+ last transform name).

**Must-Have Capabilities:**

- Clipboard listener + safe clipboard write semantics
- Push-to-talk global hotkey + mic permission
- Menubar app + settings window
- 2-deep shadow clipboard + undo `⌥⌘Z`
- Minimal correctness guardrails (don’t overwrite if clipboard changed; prevent self-trigger loops; pending means no change)
- Transform set (5–8) optimized for demo + daily value:
  - math/currency chain
  - URL clean
  - URL → markdown link
  - JSON pretty/minify
  - JSON ↔ YAML
  - extract emails
  - extract links
  - redact secrets (MVP heuristics)

### Post-MVP Features

**Phase 2 (Growth):**

- Expand browser automation breadth and resilience beyond MVP demo constraints
- More transforms (images OCR/compress, file/path actions)
- Per-app policies + richer reusable “skills”

**Phase 3 (Expansion):**

- Cross-platform **only if** same codebase stays viable
- Deeper integrations + multi-step workflows

### Risk Mitigation Strategy

**Technical Risks (primary = transform quality / LLM reliability):**

- Constrain to a small supported command set for MVP (avoid open-ended prompts).
- Prefer deterministic transforms where possible (JSON/YAML/formatters/parsers).
- Route “intent → tool” rather than freeform generation.
- Always support undo + show last transcript to reduce “WTF” moments.

**Market Risks (validation):**

- Prove the category with the 90s, 3-run flawless demo.

**Resource Risks (contingencies):**

- If voice is flaky, keep push-to-talk and ship fewer transforms; keep browser automation out of MVP.

## Functional Requirements

### Activation, Permissions, and Lifecycle

- FR1: User can run ClipMorph as a background desktop app available while other apps are in use.
- FR2: User can grant required permissions for ClipMorph to operate (e.g., microphone, accessibility) and ClipMorph can detect whether permissions are granted.
- FR3: User can start and stop ClipMorph’s active listening/automation behavior without quitting the app.
- FR4: User can see whether ClipMorph is currently available/active via a lightweight status surface (e.g., menubar presence).

### Clipboard Monitoring and Clipboard State Control

- FR5: System can detect when the clipboard content changes.
- FR6: System can identify the clipboard content type relevant to a requested operation (e.g., text vs structured text vs file path).
- FR7: System can apply a transformation result to the clipboard.
- FR8: System can avoid applying an outdated transformation result when the clipboard has changed since the transformation started.
- FR9: User can undo the most recent clipboard transformation and restore the prior clipboard value.
- FR10: System can preserve at least a 2-deep clipboard history solely for undo/recovery purposes.

### Voice Command Capture and Interpretation

- FR11: User can activate voice command capture via a global push-to-talk action.
- FR12: System can capture the user’s spoken command and produce a transcript.
- FR13: User can view the last voice transcript used for the most recent action.
- FR14: System can interpret a spoken command into an intended action category (e.g., transform vs automation).
- FR15: User can cancel an in-progress voice command/action.

### Transform Execution (Text / Code / URL / Structured Data)

- FR16: User can transform clipboard text based on a spoken command and paste the transformed result into any app.
- FR17: User can run multi-step transform intents in one command (e.g., “compute then convert then format”).
- FR18: User can trigger a “clean link” capability that outputs a sanitized URL.
- FR19: User can trigger a “make markdown link” capability that outputs a markdown-formatted link from a URL.
- FR20: User can trigger structured data transforms (e.g., pretty/minify JSON, convert JSON↔YAML).
- FR21: User can trigger extraction transforms (e.g., extract emails, extract links) from pasted text.
- FR22: User can trigger a redaction transform that removes/masks sensitive patterns from clipboard text.
- FR23: System can report whether a transform succeeded or failed (without requiring a full UI).

### Browser Automation (“Computer Use”) — MVP

- FR24: User can initiate a browser automation task from a voice command (e.g., “apply on this portal”) using clipboard content as input.
- FR25: System can open a browser context to perform the requested automation task.
- FR26: System can fill web form fields as part of an automation task based on user-provided clipboard content.
- FR27: User can observe automation progress at a high level (e.g., running / needs input / completed / failed).
- FR28: User can stop/cancel an automation task while it is running.
- FR29: System can detect when automation cannot proceed without user intervention (e.g., login/CAPTCHA/ambiguous fields) and request user input/approval to continue.

### Settings and Personalization

- FR30: User can configure the push-to-talk activation behavior.
- FR31: User can enable/disable categories of transforms (e.g., code transforms, URL transforms).
- FR32: User can view and change basic app settings from a settings surface.

### Supportability / Troubleshooting

- FR33: User can view the last action summary (at minimum: last transcript + what capability ran).
- FR34: System can expose enough diagnostic information to help a user understand why an action failed (without requiring persistent logs).

### Safety and Privacy (Functional)

- FR35: User can choose whether ClipMorph retains any action history beyond the most recent “last transcript” view.
- FR36: System can avoid running automation unintentionally when not explicitly activated by the user.

## Non-Functional Requirements

### Performance

- **NFR-P1 (Clipboard transforms latency):** p95 end-to-end transform completion **≤ 15s** (from push-to-talk release → clipboard updated).
- **NFR-P2 (Transform hard timeout):** any single transform must either succeed or fail cleanly within **≤ 60s** (no hanging).
- **NFR-P3 (Browser automation latency):** p95 end-to-end automation completion **≤ 120s** for the MVP demo flow.
- **NFR-P4 (Background overhead):** idle CPU usage should remain negligible (no sustained high CPU while waiting).

### Reliability

- **NFR-R1 (Transform success):** supported transform commands succeed **≥ 80%** on clean audio.
- **NFR-R2 (Undo reliability):** undo restores the previous clipboard value correctly **≥ 99%**.
- **NFR-R3 (Automation stuck rate):** automation requiring manual user intervention (login/CAPTCHA/ambiguous step) **≤ 5%** in the demo target portal(s).
- **NFR-R4 (No stale overwrite):** the system must not overwrite a newer clipboard change with an older job result (snapshot gating).

### Security

- **NFR-S1 (Cloud processing allowed):** clipboard contents may be sent to a cloud LLM in MVP (explicitly accepted).
- **NFR-S2 (Transcript persistence):** persist transcripts locally as **last 20** (rolling), with a user control to clear history.
- **NFR-S3 (Data minimization):** avoid storing full clipboard history beyond what’s needed for undo/recovery.
- **NFR-S4 (Permissions transparency):** clearly communicate required OS permissions (microphone + accessibility) and degrade gracefully if not granted.

### Integration

- **NFR-I1 (Browser support):** browser automation must support **Chrome** for MVP.
- **NFR-I2 (Offline):** offline mode not required for MVP (local models optional later).
