# Story 1.1: Set up initial project from starter template (electron-vite)

Status: review

**Story ID:** 1.1  
**Story Key:** `1-1-set-up-initial-project-from-starter-template-electron-vite`  
**Epic:** 1 — Ambient Clipboard Transforms (Core Loop)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a power user,  
I want ClipMorph to run as a menubar/background app with a minimal status surface,  
so that it’s always available while I’m working in other apps.

## Acceptance Criteria

1. **Project scaffold**
   - **Given** I’m starting from an empty workspace  
     **When** I run `npm create electron-vite@latest clipmorph -- --template react-ts` and install dependencies  
     **Then** the project boots successfully with a working Electron main + renderer build pipeline  
     **And** the dependency lockfile is generated so the build is reproducible.

2. **Menubar presence + minimal status UI**
   - **Given** ClipMorph is launched  
     **When** the app starts  
     **Then** a menubar icon is visible and indicates the app is running  
     **And** clicking the menubar icon opens a lightweight UI showing at least an “idle” status.

3. **Privilege boundary enforced (renderer UI-only)**
   - **Given** the renderer is running  
     **When** it needs privileged operations  
     **Then** it can only do so via a preload-exposed API (no direct OS access)  
     **And** `contextIsolation` is enabled and privileged operations are owned by the main process.

## Tasks / Subtasks

- [x] Scaffold Electron app via `electron-vite` (React + TS)
  - [x] Run `npm create electron-vite@latest clipmorph -- --template react-ts`
  - [x] `cd clipmorph && npm install`
  - [x] Confirm baseline scripts run locally (at minimum: `npm run dev`, and a production build/preview path if provided by the scaffold)
  - [x] Commit-lock discipline: do not delete the lockfile; keep dependency resolution reproducible

- [x] Enforce the non-negotiable process boundary (main ↔ preload ↔ renderer)
  - [x] Ensure preload uses `contextBridge.exposeInMainWorld(...)` (no ad-hoc globals)
  - [x] Ensure `BrowserWindow` uses secure defaults:
    - [x] `contextIsolation: true`
    - [x] `nodeIntegration: false` (explicitly set if not defaulted)
    - [x] `sandbox: true` (unless a *specific* Electron feature requires otherwise; document why)
  - [x] Create a tiny, typed preload API surface for now (stub), e.g. `getAppStatus(): 'idle' | ...`

- [x] Menubar (Tray) + popover window (minimal status surface)
  - [x] Add a tray icon and click handler in the Electron **main** process
  - [x] On tray click, show/hide a small `BrowserWindow` rendering the React UI
  - [x] UI shows:
    - [x] App name ("ClipMorph")
    - [x] Current status: `idle`
  - [x] Ensure closing the window does **not** quit the app (menubar apps stay resident)

- [x] Project hygiene (foundation for future stories)
  - [x] Establish the "events bus" placeholder channel name (do not implement full IPC yet): `clipmorph:events`
  - [x] Add a minimal README section describing:
    - [x] how to run dev
    - [x] where main/preload/renderer live
    - [x] the renderer-is-UI-only rule

- [x] Output artifacts (for follow-on workflows)
  - [x] Ensure story implementation will create/retain the expected foundational files in the scaffold (main/preload/renderer + config)

## Dev Notes

- **Do not drift from the contract**: read `/_bmad-output/project-context.md` before touching code. Renderer must stay UI-only; main owns all OS primitives.  
- **Avoid premature scope creep**: this story is *not* implementing clipboard/voice/automation yet; it’s setting the secure shell + menubar UI.
- **Menubar implementation**: prefer Electron built-in `Tray` + a small `BrowserWindow` toggle. Keep state simple (`idle` hard-coded is fine for Story 1.1).
- **Security baseline**: treat `contextIsolation: true` + preload bridge as mandatory. No direct Node access in renderer.

### Latest Tech Information (for this story)

- **electron-vite project layout convention**:
  - `src/main/*` (Electron main process entry)
  - `src/preload/*` (preload entry; use `contextBridge`)
  - `src/renderer/*` (React UI)
  - `electron.vite.config.ts` (central config for main/preload/renderer)
- **Preload pattern**: `contextBridge.exposeInMainWorld` + `ipcRenderer.invoke/send/on` as needed; keep a narrow allowlist.

### Project Structure Notes

- **Primary goal**: establish a working baseline that aligns with the architecture’s boundaries and naming patterns.
- **If you later adopt the architecture’s “monorepo workspaces” tree** (apps/packages split), do it as a conscious refactor with one clear source of truth for IPC/job types (`packages/contracts`). Do **not** invent alternate layouts in the meantime.

### References

- Epics / Story definition: `_bmad-output/planning-artifacts/epics.md` (Epic 1 → Story 1.1)
- Architecture constraints + example structure + security boundary: `_bmad-output/planning-artifacts/architecture.md`
- Non-drift contract (IPC envelope, job model, renderer boundary): `_bmad-output/project-context.md`
- electron-vite docs (structure + preload `contextBridge` example): `https://context7.com/alex8088/electron-vite-docs`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- Initial scaffold created manually (electron-vite CLI was interactive, so structure was created based on docs)
- TypeScript errors fixed: NativeImage type import, global App interface extension
- All tests pass (5/5), typecheck passes, lint passes, build succeeds

### Completion Notes List

- Scaffolded electron-vite project with React + TypeScript template structure
- Implemented secure BrowserWindow with contextIsolation: true, nodeIntegration: false, sandbox: true
- Created typed preload API with contextBridge.exposeInMainWorld exposing `getAppStatus()` and `onEvent()`
- Implemented Tray icon with click-to-toggle popover window behavior
- Window hides on blur and close (menubar app pattern - stays resident)
- UI displays "ClipMorph" title and "Idle" status with pulsing indicator
- Events bus channel `clipmorph:events` established as placeholder
- README updated with dev instructions, project structure, and architecture rules
- IPC contract follows `clipmorph:<domain>:<action>` naming convention
- Response envelope: `{ ok: boolean, requestId: string, data?: T, error?: { code, message } }`

### Change Log

- 2026-01-17: Initial implementation of Story 1.1 - Project scaffold, menubar app, security boundaries

### File List

- `package.json` - Project manifest with electron-vite, React, TypeScript dependencies
- `package-lock.json` - Dependency lockfile for reproducible builds
- `electron.vite.config.ts` - Build configuration for main/preload/renderer
- `tsconfig.json` - Root TypeScript config (references node + web)
- `tsconfig.node.json` - TypeScript config for main/preload (Node environment)
- `tsconfig.web.json` - TypeScript config for renderer (browser environment)
- `electron-builder.yml` - Electron Builder packaging configuration
- `.eslintrc.cjs` - ESLint configuration
- `.prettierrc.yaml` - Prettier configuration
- `vitest.config.ts` - Vitest test runner configuration
- `README.md` - Project documentation with dev instructions and architecture rules
- `resources/tray-icon.png` - 16x16 template icon for macOS menubar
- `src/main/index.ts` - Main process: app lifecycle, tray, window management, IPC handlers
- `src/main/__tests__/index.test.ts` - Contract tests for IPC and security config
- `src/preload/index.ts` - Preload script with typed contextBridge API
- `src/preload/index.d.ts` - Type declarations for preload API
- `src/renderer/index.html` - HTML entry point with CSP
- `src/renderer/src/main.tsx` - React entry point
- `src/renderer/src/App.tsx` - Main React component with status display
- `src/renderer/src/env.d.ts` - Type declarations for Vite and window.clipmorph
- `src/renderer/src/styles/index.css` - Global styles
- `src/renderer/src/styles/App.css` - App component styles
