---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: "ClipMorph: a voice-driven AI layer between Copy and Paste that transforms clipboard content instantly (numbers/text/images/files) for a 48-hour hackathon MVP."
session_goals: "Generate 100+ divergent ideas for the MVP: high-leverage transform commands, minimal UX/interaction model (indicator + transcript), architecture + integrations, privacy constraints (local transcription), and a compelling demo flow."
selected_approach: 'ai-recommended'
techniques_used:
  - "Analogical Thinking"
  - "Morphological Analysis"
  - "Chaos Engineering"
ideas_generated: []
context_file: ''
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Facilitator:** Leongwenxuan
**Date:** 2026-01-17T03:59:30Z

## Session Overview

**Topic:** ClipMorph: a voice-driven AI layer between Copy and Paste that transforms clipboard content instantly (numbers/text/images/files) for a 48-hour hackathon MVP.

**Goals:** Generate 100+ divergent ideas for the MVP: high-leverage transform commands, minimal UX/interaction model (indicator + transcript), architecture + integrations, privacy constraints (local transcription), and a compelling demo flow.

### Context Guidance

_Given your PRD draft: prioritize “invisible” flow (no context switching), voice-first commands, fast turnaround (<5s), and strong differentiation vs clipboard history / chat assistants._

### Session Setup

_We’ll stay in divergence mode (quantity over quality) and deliberately pivot domains every ~10 ideas (UX → tech → business → edge cases) to avoid clustering._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** ClipMorph (48-hour hackathon MVP, mac-only) with focus on high-leverage voice transforms, invisible UX, and agentic-but-controlled execution patterns inspired by Openwork.

**Recommended Techniques (15 min):**

- **Analogical Thinking** (4 min): Mine “agentic process” patterns (approvals, logs, skills, sandboxing) and transpose them into a clipboard/voice layer.
- **Morphological Analysis** (9 min): Rapidly generate 60–100 concrete command ideas by combining dimensions (input type × intent × output × guardrails).
- **Chaos Engineering** (2 min): Surface failure modes + guardrails (misheard commands, dangerous paste, app quirks) to keep the MVP demo-safe.

**AI Rationale:** Short session + hackathon constraints favor a fast pattern-transfer opener, a high-throughput systematic generator, and a quick adversarial pass for robustness.

## Technique Execution (In Progress)

### Analogical Thinking — “Agentic but controlled” via Shadow Clipboard

**[Control Loop #1]**: Shadow Clipboard (2-deep undo)
_Concept_: Always keep `clipboard_prev` and `clipboard_prev_prev`. `⌥⌘Z` restores prev; double-tap restores prev_prev.
_Novelty_: Undo without UI; “approval” becomes reversible state.

**MVP decision:** Use **2-deep** shadow clipboard with undo hotkey **⌥⌘Z**.

**[Control Loop #2]**: Shadow Ring Buffer (N-deep)
_Concept_: Keep a small ring (e.g., 10) of prior clipboard states with timestamps; `⌥⌘Z` cycles backward, `⌥⌘⇧Z` cycles forward.
_Novelty_: Turns clipboard into a reversible timeline without becoming “clipboard history” UX.

**[Control Loop #3]**: “Auto-Undo After Paste” Safety Hook
_Concept_: If the first paste after a transform happens within X seconds into a “risky” target (terminal/password field), auto-revert to `clipboard_prev` immediately.
_Novelty_: Safety checks at paste-time, not transform-time, still zero-friction.

**[Control Loop #4]**: Per-App Shadow Policies
_Concept_: Default auto-apply everywhere, but maintain a deny/allow list by bundle id (e.g., Terminal.app, iTerm, 1Password) that always routes to shadow-only mode.
_Novelty_: Openwork “folder permissions” → ClipMorph “app permissions” with no extra steps.

**[Control Loop #5]**: “Spec Log” for Reproducible Transforms
_Concept_: Store (input_hash, transcript, parsed intent/params, output_hash) so the same transform can be replayed deterministically later.
_Novelty_: Auditability without showing logs unless asked.

**Analogical Thinking checkpoint (complete):**
- Chosen core pattern: **2-deep Shadow Clipboard** + undo **⌥⌘Z**
- Extra patterns captured: ring buffer, paste-time safety hook, per-app policies, spec logging for replay

---

### Morphological Analysis — Command Space Matrix (Starting)

**Dimensions (MVP-first):**
- **Input type**: number | currency | date/time | plain text | markdown | code | URL | image | file path
- **Intent**: compute | convert | format | extract | summarize | redact | translate | validate | generate
- **Output**: plain text | markdown | JSON | CSV | snippet | image | file action
- **Guardrail**: auto-apply | undo-only (shadow) | “risky app” auto-revert | offline-only

## Morphological Ideas (Batch 1)

**[Morph #1]**: FX Convert (Locale-Aware)
_Concept_: Voice: “convert to EUR” on a copied currency string, preserving locale formatting (comma/decimal) and symbol placement.
_Novelty_: Acts like a “clipboard FX function” rather than calculator; minimizes formatting friction.

**[Morph #2]**: FX Convert + Tax
_Concept_: Voice: “convert to EUR add 20% tax” on `"$200"` → `"€(200*rate*1.2)"`.
_Novelty_: Chains multiple numeric operators without leaving the paste flow.

**[Morph #3]**: FX Convert + Rounding Rule
_Concept_: Voice: “convert to JPY round to nearest 10” for currencies where minor units differ.
_Novelty_: Converts + applies domain rounding heuristics in one utterance.

**[Morph #4]**: FX Convert + Fee Model
_Concept_: Voice: “convert to SGD include 2.9% fee + 30 cents” for payment-processor math.
_Novelty_: Bakes real-world fee models into the transform layer.

**[Morph #5]**: FX Normalize (Unify Currency Format)
_Concept_: Voice: “normalize currency” turns `USD 1,200.00` / `$1.2k` / `1 200,00 €` into a canonical `USD 1200.00` or `€1200.00` based on detected locale.
_Novelty_: Cleans messy pasted numbers, not just computes them.

**[Morph #6]**: FX Split Range
_Concept_: Voice: “split currency range” on `"$10-$12"` → `min=10, max=12` (JSON or CSV).
_Novelty_: Turns ambiguous pasted text into structured data instantly.

**[Morph #7]**: FX Extract Amounts
_Concept_: Voice: “extract all amounts” on a paragraph → list of detected monetary values.
_Novelty_: High-signal extractor for invoices/emails; clipboard becomes a parser.

**[Morph #8]**: FX Extract Amounts → Sum
_Concept_: Voice: “extract amounts and sum” on `"$20 + $15 + tax $3"` → `$38`.
_Novelty_: Does spreadsheet-esque parsing without spreadsheets.

**[Morph #9]**: FX Extract Amounts → Table
_Concept_: Voice: “extract amounts as CSV” → `label,amount,currency` guesses labels from nearby tokens.
_Novelty_: Turns unstructured billing text into a paste-ready table.

**[Morph #10]**: FX Extract + Convert All
_Concept_: Voice: “convert all to EUR” on mixed `$`, `£`, `€` values in text; preserves original context.
_Novelty_: Mass conversion on arbitrary clipboard text.

**[Morph #11]**: FX Convert at Custom Rate
_Concept_: Voice: “convert to EUR at 1.08” uses user-specified rate (no network dependency).
_Novelty_: Offline-first / deterministic conversion for demos and privacy.

**[Morph #12]**: FX Convert Using “Last Known Rate”
_Concept_: Voice: “convert to EUR using last rate” uses cached rate (stale-ok), marks output with `(~)` or timestamp.
_Novelty_: Practical speed pattern; avoids blocking UX.

**[Morph #13]**: FX Convert + Budget Category Tagging
_Concept_: Voice: “convert to EUR tag as meals” outputs `€X — meals`.
_Novelty_: Turns paste into quick bookkeeping without opening an app.

**[Morph #14]**: FX Convert + Markdown Receipt Line
_Concept_: Voice: “convert to EUR make receipt line” → `- €12.34 — [source text] (2026-01-17)`.
_Novelty_: Optimized for note-taking workflows (Obsidian/Notion).

**[Morph #15]**: FX Extract Emails
_Concept_: Voice: “extract emails” → newline list of unique emails (dedup + normalize).
_Novelty_: Instant cleanup; common, high-frequency transform.

**[Morph #16]**: FX Extract Emails + Domains
_Concept_: Voice: “extract email domains” → `example.com` list + counts.
_Novelty_: Adds quick analysis, not just extraction.

**[Morph #17]**: FX Extract URLs + Canonicalize
_Concept_: Voice: “extract links canonicalize” strips tracking params (`utm_*`), normalizes scheme, dedups.
_Novelty_: Clipboard becomes a hygiene layer for links.

**[Morph #18]**: FX Extract Action Items
_Concept_: Voice: “extract action items” on meeting notes → bullet list of “TODO:” lines.
_Novelty_: Lightweight structuring without summarization UI.

**[Morph #19]**: FX Extract Dates → ISO
_Concept_: Voice: “extract dates ISO” on text → list of `YYYY-MM-DD` (timezone-aware if present).
_Novelty_: Makes dates paste-safe for code/CSV.

**[Morph #20]**: FX Extract Entities (Names/Orgs)
_Concept_: Voice: “extract names and companies” → structured list.
_Novelty_: Cheap “mini-NER” useful for CRM-ish workflows.

## Morphological Ideas (Batch 2 — Images)

**[Morph #21]**: Image Compress to Target Size
_Concept_: Voice: “compress to 500 KB” on a copied image → recompress until under threshold (with acceptable quality).
_Novelty_: Target-size compression is what people actually need for uploads.

**[Morph #22]**: Image Resize to Exact Dimensions
_Concept_: Voice: “resize to 1920 by 1080” → outputs resized image to clipboard.
_Novelty_: Zero-app image resizing from any source.

**[Morph #23]**: Image Convert Format
_Concept_: Voice: “convert to webp” / “convert to png” / “convert to jpg” on image clipboard.
_Novelty_: One-step conversion inline with paste workflows.

**[Morph #24]**: Strip Image Metadata
_Concept_: Voice: “remove metadata” → strips EXIF/location before paste.
_Novelty_: Privacy-first transform that’s invisible and high trust.

**[Morph #25]**: Smart Crop for Avatar
_Concept_: Voice: “crop to square avatar” → center/face-aware crop + resize (e.g., 512×512).
_Novelty_: “Make it uploadable” as a single voice intent.

**[Morph #26]**: Background Remove (MVP-lite)
_Concept_: Voice: “remove background” → uses a fast local model or macOS Vision APIs if available.
_Novelty_: Instant asset prep without opening design tools.

**[Morph #27]**: OCR to Text
_Concept_: Voice: “read text” on image → OCR result into clipboard text.
_Novelty_: Makes screenshots pasteable as text with one utterance.

**[Morph #28]**: Redact (Blur) Sensitive Regions
_Concept_: Voice: “blur emails and phone numbers” on screenshot → OCR-detect + blur.
_Novelty_: Privacy transform built into the clipboard layer.

**[Morph #29]**: Add Watermark
_Concept_: Voice: “add watermark ‘CONFIDENTIAL’ bottom right” → composited output.
_Novelty_: Fast policy compliance without UI.

**[Morph #30]**: Downscale for Retina vs Non-Retina
_Concept_: Voice: “downscale 50%” (or “make non-retina”) for screenshots.
_Novelty_: Solves the common “huge screenshot” pain with a single intent.

## Morphological Ideas (Batch 3 — Code)

**[Morph #31]**: Format Code (Language Auto-Detect)
_Concept_: Voice: “format code” on copied snippet → auto-detect language and pretty-print.
_Novelty_: Paste-ready formatting without IDE focus change.

**[Morph #32]**: JSON Pretty / Minify
_Concept_: Voice: “pretty json” / “minify json” on clipboard.
_Novelty_: The classic “tool switch” killer.

**[Morph #33]**: JSON ↔ YAML Convert
_Concept_: Voice: “convert json to yaml” (and reverse).
_Novelty_: Makes config shuffling frictionless.

**[Morph #34]**: Extract Types (TS/Schema)
_Concept_: Voice: “generate types” from JSON sample → TypeScript interfaces (or Zod) in clipboard.
_Novelty_: Turns sample payloads into code instantly.

**[Morph #35]**: Diff-Friendly Sort Keys
_Concept_: Voice: “sort json keys” for deterministic output.
_Novelty_: “Makes diffs sane” as a clipboard primitive.

**[Morph #36]**: Convert Curl → Fetch
_Concept_: Voice: “convert curl to fetch” or “to python requests”.
_Novelty_: High-frequency dev transform without hunting converters.

**[Morph #37]**: Extract TODOs
_Concept_: Voice: “extract TODOs” from pasted code → list with line guesses.
_Novelty_: Creates action lists from snippets fast.

**[Morph #38]**: Summarize Snippet (Intent + Side Effects)
_Concept_: Voice: “summarize this function” → 2–3 lines + pitfalls.
_Novelty_: Micro-summarization for snippets, not whole chats.

**[Morph #39]**: Redact Secrets
_Concept_: Voice: “redact secrets” → masks API keys/tokens/PEM blocks in pasted text.
_Novelty_: Prevents accidental pastes into tickets/slack.

**[Morph #40]**: Convert Stacktrace → Issues Checklist
_Concept_: Voice: “turn into checklist” on stacktrace/logs → bullets of suspected causes + next steps.
_Novelty_: Converts noise into an action scaffold.

## Morphological Ideas (Batch 4 — Files/Paths)

**[Morph #41]**: Zip This
_Concept_: Voice: “zip it” when clipboard contains file paths → creates zip and copies new path.
_Novelty_: “File action by voice” with no Finder interaction.

**[Morph #42]**: Rename with Pattern
_Concept_: Voice: “rename to YYYY-MM-DD - {title}” using clipboard filename(s).
_Novelty_: Fast deterministic renaming from anywhere.

**[Morph #43]**: Slugify Filename
_Concept_: Voice: “slugify filename” → `My File (Final).pdf` → `my-file-final.pdf`.
_Novelty_: Kills the “manual cleanup” microtask.

**[Morph #44]**: Move to Folder Alias
_Concept_: Voice: “move to Downloads/screenshots” or “move to project assets” (predefined aliases).
_Novelty_: Openwork “folder permissions” meets quick voice actions.

**[Morph #45]**: Convert to PDF
_Concept_: Voice: “convert to pdf” on an image/text selection/file path.
_Novelty_: One command for a very common deliverable.

**[Morph #46]**: Extract Text from PDF
_Concept_: Voice: “extract text” on PDF path → plaintext in clipboard.
_Novelty_: Makes PDFs pasteable without separate tools.

**[Morph #47]**: Create Share Link Stub
_Concept_: Voice: “create share link” → placeholder output (or local link) that later plugs into Drive/Dropbox.
_Novelty_: Keeps MVP demoable even if integrations are fake.

**[Morph #48]**: Batch Rename from Clipboard List
_Concept_: Voice: “rename all with increment” on list of paths → `image-001.png`, `image-002.png`, …
_Novelty_: Batch ops via clipboard as the selection mechanism.

**[Morph #49]**: Convert Image Folder → Optimized Web Assets
_Concept_: Voice: “optimize images for web” on folder path → compress + convert to webp + create manifest.
_Novelty_: A “mini build step” triggered by clipboard.

**[Morph #50]**: Email Attachment Prep (MVP)
_Concept_: Voice: “prepare for email” → zips + renames + ensures < X MB.
_Novelty_: Encodes a real workflow outcome, not a single transform.

## Morphological Ideas (Batch 5 — URLs)

**[Morph #51]**: Canonicalize URL
_Concept_: Voice: “clean link” removes `utm_*`, `fbclid`, trims fragments, normalizes scheme.
_Novelty_: Clipboard becomes link hygiene.

**[Morph #52]**: Extract Query Params
_Concept_: Voice: “extract params as JSON” → `{utm_source:..., ref:...}`.
_Novelty_: Turns URLs into structured data instantly.

**[Morph #53]**: Build URL with Params
_Concept_: Voice: “add param utm_source=twitter” on copied URL.
_Novelty_: Reverse of extraction—URL manipulation without typing.

**[Morph #54]**: Shorten (Local Alias)
_Concept_: Voice: “shorten link” → creates a local alias (or uses a chosen shortener if configured).
_Novelty_: MVP can do local aliasing without network.

**[Morph #55]**: Fetch Title → Markdown Link
_Concept_: Voice: “make markdown link” → `[Page Title](url)`.
_Novelty_: Huge for note-taking; kills a repetitive step.

**[Morph #56]**: Summarize Page (1–2 lines)
_Concept_: Voice: “summarize link” → short summary + key bullets (or offline stub if no network).
_Novelty_: “AI layer” applied to links with zero UI.

**[Morph #57]**: Extract All Links from Text
_Concept_: Voice: “extract links” from pasted blob, dedup, one per line.
_Novelty_: Fast cleanup for emails/docs.

**[Morph #58]**: Convert Links → Reference List
_Concept_: Voice: “make references” → numbered citations with titles.
_Novelty_: Turns browsing into pasteable bibliography.

**[Morph #59]**: Detect + Convert App URLs
_Concept_: Voice: “open in app” transforms web URLs into deep links (e.g., GitHub issue → `gh` CLI command or app deep link).
_Novelty_: “Agentic routing” without opening a chat.

**[Morph #60]**: Strip to Domain
_Concept_: Voice: “domain only” on URL → `example.com`.
_Novelty_: Simple, high-frequency extraction primitive.

---

## Chaos Engineering (Failure Modes + Guardrails)

**[Chaos #1]**: Misheard Command → Dangerous Clipboard Overwrite
_Concept_: Transcription/intent parse is wrong; user pastes garbage into a doc or terminal.
_Novelty_: Solve by design: zero-friction auto-apply still needs “damage containment”.
_Guardrail ideas_: 2-deep shadow + **⌥⌘Z**; confidence threshold auto-apply; “risky targets” auto-revert.

**[Chaos #2]**: “Paste Into Password Field” Catastrophe
_Concept_: User copies password, says something else, ClipMorph transforms or leaks it.
_Novelty_: Clipboard layer must understand “sensitive content” patterns.
_Guardrail ideas_: never transform if content matches secrets/PII heuristics; auto-clear transcript logs; require explicit override phrase for sensitive inputs.

**[Chaos #3]**: Race Condition (Copy Happens Mid-Transform)
_Concept_: User hits ⌘C again while model is processing; result overwrites the *new* clipboard.
_Novelty_: Temporal coupling bug unique to clipboard intermediaries.
_Guardrail ideas_: attach transform to clipboard-change UUID; only apply if clipboard still equals original hash; else drop result into shadow slot and notify.

**[Chaos #4]**: Multi-Modal Confusion (Image vs Text vs File Paths)
_Concept_: Clipboard type changes (RTF/html/plain) causing wrong transform pipeline.
_Novelty_: macOS pasteboard offers multiple representations simultaneously.
_Guardrail ideas_: pick representation deterministically (prefer plain text for text transforms); show minimal indicator of detected type; allow voice “treat as plain text”.

**[Chaos #5]**: LLM “Helpful” Hallucination
_Concept_: Model invents numbers/edits content beyond intent (especially summarization).
_Novelty_: Trust killer for “invisible” tool.
_Guardrail ideas_: strict mode for compute/convert (no freeform); for summarize, add “verbatim quotes only” option; tag outputs with provenance marker like `(~AI)` optionally.

**[Chaos #6]**: Cost/Latency Spikes (Network or Model Slow)
_Concept_: Command takes >5s; user pastes before transform done.
_Novelty_: Invisible tools must manage partial completion gracefully.
_Guardrail ideas_: “pending” state keeps clipboard unchanged; if user pastes during pending, do nothing; when ready, apply + optional sound cue.

**[Chaos #7]**: Streaming Transcription Noise in Open Office
_Concept_: Hot mic picks up chatter; triggers nonsense transforms.
_Novelty_: Voice-first needs robust activation boundary.
_Guardrail ideas_: push-to-talk only for MVP; wake-word later; VAD threshold tuning; “cancel” voice command always recognized locally.

**[Chaos #8]**: App-Specific Paste Semantics
_Concept_: Some apps paste rich text/HTML; others plain; transforms break formatting.
_Novelty_: User expectation depends on target app.
_Guardrail ideas_: default output plain text for MVP; optional “preserve markdown/rtf” modes; per-app profile later.

**[Chaos #9]**: Infinite Loop / Self-Trigger
_Concept_: App writes to clipboard after paste; ClipMorph re-triggers and mutates repeatedly.
_Novelty_: Clipboard listeners are easy to loop.
_Guardrail ideas_: ignore clipboard changes authored by ClipMorph (own marker); debounce; require explicit push-to-talk to trigger transform.

**[Chaos #10]**: Oversized Clipboard Payloads
_Concept_: Huge images / long docs cause CPU spikes or memory bloat.
_Novelty_: “Invisible” performance regressions feel like system instability.
_Guardrail ideas_: hard caps per type; downscale previews; refuse with a short reason and keep original untouched.

**[Chaos #11]**: Privacy Regression via Logs
_Concept_: Storing transcripts/inputs leaks sensitive info on disk.
_Novelty_: Logging is great until it becomes a liability.
_Guardrail ideas_: MVP: no persistent logs by default; store only hashes + command metadata; “debug mode” opt-in.

**[Chaos #12]**: Wrong Locale / Decimal Separator Bugs
_Concept_: `1,234` interpreted as `1.234` or vice versa.
_Novelty_: Makes currency transforms untrustworthy.
_Guardrail ideas_: detect locale from system; allow voice “treat comma as decimal”; show warning if ambiguous.

**[Chaos #13]**: Clipboard Contains Multiple Items (Files + Text)
_Concept_: Finder copy can include both file URLs and textual representation.
_Novelty_: Ambiguous input selection.
_Guardrail ideas_: prioritize file URLs for file intents; otherwise prefer text; allow voice “use file paths”.

**[Chaos #14]**: Terminal Injection / Shell Escaping
_Concept_: Transform generates text with backticks/quotes; user pastes into shell → unintended execution.
_Novelty_: A safety-critical paste context.
_Guardrail ideas_: terminal app denylist (shadow-only); “shell-escape output” command; auto-wrap in quotes for terminal profile.

**[Chaos #15]**: Undo Doesn’t Undo “Side Effects”
_Concept_: File actions (zip/move) can’t be undone by restoring clipboard.
_Novelty_: Shadow clipboard solves only clipboard state, not external changes.
_Guardrail ideas_: MVP: avoid side-effectful actions or make them output-only (generate command, don’t execute); later: reversible actions with temp staging.

### MVP Risk Priorities (Selected)

**Top 3 risks:** **#6 latency/paste-before-ready**, **#9 self-trigger loop**, **#3 copy mid-transform race**

**MVP behavior rules (concrete):**

- **Rule A (attach work to a clipboard snapshot):** on clipboard change, compute `input_hash` and assign `job_id`. Any transform result must carry the originating `job_id`.
- **Rule B (apply only if still current):** only overwrite clipboard if `current_clipboard_hash == input_hash` at completion time; otherwise:
  - store result in `shadow_output` (not applied)
  - keep 2-deep undo slots intact
- **Rule C (pending means “no change”):** while a job is pending, user pasting should paste the original clipboard unchanged. Optional: single beep when transform finishes.
- **Rule D (self-trigger immunity):** any clipboard writes by ClipMorph include an internal marker; clipboard listener ignores changes with that marker for a short TTL.
- **Rule E (debounce + coalesce):** if multiple clipboard changes happen quickly, cancel/abandon prior pending jobs and only keep latest `job_id`.

**Minimal state machine (MVP):**
- `idle` → (clipboard_changed) → `pending(job_id,input_hash)`
- `pending` → (clipboard_changed) → `pending(new_job_id,new_hash)` (drop old)
- `pending` → (result_ready) → if hash matches apply+mark else stash-to-shadow

## Technique Execution Results

**Analogical Thinking:**

- **Interactive Focus:** Translating Openwork-style “agentic but controlled” patterns into zero-friction clipboard mechanics.
- **Key Breakthroughs:** Approval-free control via **2-deep Shadow Clipboard** + undo **⌥⌘Z**; optional per-app safety policies; paste-time safety hooks; minimal spec logging for replay.

**Morphological Analysis:**

- **Interactive Focus:** High-leverage transform commands across currency/text/images/code/files/URLs.
- **Key Breakthroughs:** Command-space matrix produces a deep backlog of MVP transforms (#1–#60) suitable for demos and real use.

**Chaos Engineering:**

- **Interactive Focus:** Making a clipboard daemon correct and demo-safe.
- **Key Breakthroughs:** MVP ruleset for **#6 latency**, **#9 self-trigger**, **#3 mid-transform copy races** with snapshot hashing + marker TTL + debounce/coalesce state machine.

## Idea Organization and Prioritization

**Thematic Organization (Condensed):**

- **Engine/Correctness (Foundation):** shadow clipboard + job snapshotting + self-trigger marker TTL (kept minimal for MVP)
- **Killer Transforms (Priority = YES):** currency/math chains, extraction primitives, JSON/YAML utilities, URL hygiene + markdown link generation
- **Nice-to-haves:** images (OCR/compress), file/path actions (zip/rename), deeper agentic workflows

### Prioritization Results (for 48-hour MVP)

**Top Priority Ideas (demo + daily value):**

1. **Voice math + currency chain** (Morph #2 / #11 / #12): “times 12 convert to EUR add 20% tax”
2. **URL → Markdown link** (Morph #55) + **canonicalize** (Morph #51): “make markdown link” / “clean link”
3. **JSON pretty/minify + JSON↔YAML** (Morph #32 / #33): “pretty json” / “convert json to yaml”

**Quick Wins (low complexity, high frequency):**

- **Extract emails** (Morph #15)
- **Extract links** (Morph #57) + dedup
- **Redact secrets** (Morph #39) (even as simple regex-based MVP)

**Breakthrough Concepts (save for v2):**

- Background removal / OCR-redact pipeline (Morph #26/#28)
- File side-effect actions with rollback (Morph #41–#50 executed, not just generated)

### Action Planning (MVP build plan)

**MVP Goal:** Ship ~6–8 transforms with a consistent “copy → hold-to-talk → command → paste” loop.

**Action Plan A — Transform Set (implement first):**

1. Implement **math/currency chain** (strict compute mode) + **custom rate** override
2. Implement **URL clean + markdown link** (title fetch optional; fallback to domain)
3. Implement **JSON pretty/minify + JSON↔YAML**
4. Implement **extract emails / extract links**
5. Implement **redact secrets (MVP heuristics)**

**Action Plan B — Minimal correctness (just enough):**

1. Keep **2-deep shadow clipboard** + undo **⌥⌘Z**
2. Implement **job snapshot hash gating** (don’t overwrite if clipboard changed)
3. Add **self-trigger marker TTL** to prevent loops

**Action Plan C — Demo script (90 seconds):**

1. Copy `$200` → say “times 12 convert to EUR add 20% tax” → paste result
2. Copy a messy tracking URL → say “clean link” → paste; then “make markdown link”
3. Copy ugly JSON → say “pretty json” → paste into editor; then “convert to yaml”


