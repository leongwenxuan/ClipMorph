# Story 4.6: Reusable Skills Library

Status: review

**Story ID:** 4.6  
**Story Key:** `4-6-reusable-skills-library`  
**Epic:** 4

## Story

As a developer,  
I want to create and share reusable "skills" (instruction templates),  
So that common patterns (linting rules, style guides, test patterns) are standardized.

## Acceptance Criteria

1.
   **Given** skills are defined in `.clipmorph/skills/<name>/SKILL.md`  
   **When** an agent runs a related task  
   **Then** the skill instructions are automatically included  
   **And** skills can be project-local or global (`~/.clipmorph/skills/`)  

2.
   **Given** the user wants to share a skill  
   **When** they export it  
   **Then** the skill can be imported into other projects  
   **And** skill versioning is supported for updates  

## Tasks / Subtasks

- [x] Task 1: Define skill file format (AC: #1)
  - [x] Create SkillConfig type with name, description, triggers, version, requires
  - [x] Define SKILL.md format with YAML frontmatter
  - [x] Support skill dependencies via requires field

- [x] Task 2: Create SkillService (AC: #1)
  - [x] Discover skills from project and global directories
  - [x] Parse SKILL.md files with frontmatter
  - [x] Match skills to tasks based on triggers/keywords
  - [x] Inject skill instructions into agent prompts

- [x] Task 3: Add IPC channels for skill management (AC: #1, #2)
  - [x] SKILL_LIST - list available skills
  - [x] SKILL_DISCOVER - refresh skill discovery
  - [x] SKILL_GET - get a specific skill
  - [x] SKILL_EXPORT - export skill to shareable format
  - [x] SKILL_IMPORT - import skill from file

- [x] Task 4: Integrate skills with OpenCode tasks (AC: #1)
  - [x] Auto-detect applicable skills based on task
  - [x] Prepend skill instructions to prompts
  - [x] IntentService integration for code intents

- [x] Task 5: Emit skill events (AC: #1)
  - [x] SKILL_DISCOVERED
  - [x] SKILL_APPLIED
  - [x] SKILL_IMPORTED
  - [x] SKILL_EXPORTED

- [x] Task 6: Tests for skill functionality
  - [x] Update intent-service tests with skill mocks
  - [x] Verify existing tests pass

## Dev Notes

### Non-negotiable guardrails

- **Renderer is UI-only** (no filesystem access).
- **Main owns privileged operations**; preload is the only bridge.
- **IPC**: `clipmorph:<domain>:<action>`, envelope `{ ok, requestId, data|error }`, events bus `clipmorph:events`.
- **Job model**: `pending | running | needs_input | completed | failed | cancelled` (monotonic transitions).

### Technical requirements (story-specific)

- Skills are read-only templates (not editable via ClipMorph)
- Project skills override global skills with same name
- Skill versioning uses semver format
- Export format is a .skill.md file

### Skill File Format

```markdown
---
name: typescript-style
description: TypeScript coding style guidelines
version: 1.0.0
triggers:
  - typescript
  - ts
  - type
requires:
  - eslint-config  # Optional dependency on another skill
---

# TypeScript Style Guide

## Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
...
```

### Directory Structure

```
.clipmorph/
  skills/
    typescript-style/
      SKILL.md
    react-patterns/
      SKILL.md
~/.clipmorph/
  skills/
    global-style/
      SKILL.md
```

### References

- Story definition + ACs: `_bmad-output/planning-artifacts/epics.md` (Story 4.6)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Project contract: `_bmad-output/project-context.md`
- Depends on: Story 4.1 (OpenCode sidecar), Story 4.3 (subagents)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- Intent service tests: `npm test -- --run src/main/__tests__/intent-service.test.ts`

### Completion Notes List

1. Added SkillConfig type to `packages/contracts/src/index.ts`:
   - id, name, description, version, triggers, requires, instructions
   - scope (global | project), filePath, lastModified

2. Added IPC channels:
   - `SKILL_LIST`, `SKILL_DISCOVER`, `SKILL_GET`, `SKILL_EXPORT`, `SKILL_IMPORT`

3. Added skill events to EventTypes:
   - `SKILL_DISCOVERED`, `SKILL_APPLIED`, `SKILL_IMPORTED`, `SKILL_EXPORTED`

4. Created `SkillService` in `src/main/services/skill-service.ts`:
   - Discovery from .clipmorph/skills/ and ~/.clipmorph/skills/
   - SKILL.md parsing with YAML frontmatter
   - Trigger-based skill matching for tasks
   - Prompt augmentation with skill instructions
   - Export to .skill.md files
   - Import from files with directory creation
   - Sample skill creation helper

5. Registered IPC handlers in `src/main/index.ts`

6. Added preload API in `src/preload/index.ts`:
   - `listSkills()`, `discoverSkills()`, `getSkill()`
   - `exportSkill()`, `importSkill()`

7. Integrated skills into IntentService:
   - Auto-match skills for code intents
   - Augment prompts with skill instructions
   - Log applied skills

8. Updated tests with skill service mocks

### File List

- `src/main/services/skill-service.ts` (created)
- `src/main/services/intent-service.ts` (modified)
- `src/main/index.ts` (modified)
- `src/preload/index.ts` (modified)
- `packages/contracts/src/index.ts` (modified)
- `src/main/__tests__/intent-service.test.ts` (modified)

## Change Log

- 2026-01-17: Story created for Epic 4 implementation
- 2026-01-17: Completed implementation - all tasks done, tests passing
