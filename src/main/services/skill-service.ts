/**
 * Skill Service
 *
 * Discovers and manages reusable instruction templates (skills).
 * Skills are stored in .clipmorph/skills/<name>/SKILL.md files.
 */

import { EventEmitter } from 'events'
import { readdir, readFile, stat, mkdir, writeFile, copyFile } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { homedir } from 'os'
import {
  ClipMorphEvent,
  createEvent,
  EventTypes,
  SkillConfig,
  SkillListResponse,
  SkillDiscoverResponse,
  SkillGetResponse,
  SkillExportResponse,
  SkillImportResponse,
  SkillDiscoveredPayload,
  SkillAppliedPayload,
  SkillImportedPayload,
  SkillExportedPayload,
} from '../../../packages/contracts/src'

// ============================================================================
// YAML Frontmatter Parser
// ============================================================================

interface SkillFrontmatter {
  name?: string
  description?: string
  version?: string
  triggers?: string[]
  requires?: string[]
}

function parseSkillFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content }
  }

  const yaml = frontmatterMatch[1]
  const body = frontmatterMatch[2].trim()
  const result: SkillFrontmatter = {}

  // Parse name
  const nameMatch = yaml.match(/^name:\s*(.+)$/m)
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  // Parse description
  const descMatch = yaml.match(/^description:\s*(.+)$/m)
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  // Parse version
  const versionMatch = yaml.match(/^version:\s*(.+)$/m)
  if (versionMatch) {
    result.version = versionMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  // Parse triggers (array format)
  const triggerMatch = yaml.match(/^triggers:\s*\n((?:\s+-\s+.+\n?)+)/m)
  if (triggerMatch) {
    result.triggers = triggerMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter((t) => t.length > 0)
  }

  // Parse requires (array format)
  const requiresMatch = yaml.match(/^requires:\s*\n((?:\s+-\s+.+\n?)+)/m)
  if (requiresMatch) {
    result.requires = requiresMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter((r) => r.length > 0)
  }

  return { frontmatter: result, body }
}

// ============================================================================
// Skill Service
// ============================================================================

class SkillService extends EventEmitter {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private skills: Map<string, SkillConfig> = new Map()
  private projectRoot: string = process.cwd()
  private lastDiscovery: number = 0

  /**
   * Set the event emitter for broadcasting events
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Emit an event
   */
  private emit<T>(event: ClipMorphEvent<T>): void {
    if (this.eventEmitter) {
      this.eventEmitter(event)
    }
  }

  /**
   * Set the project root directory
   */
  setProjectRoot(root: string): void {
    this.projectRoot = root
  }

  /**
   * Get the project skills directory
   */
  private getProjectDir(): string {
    return join(this.projectRoot, '.clipmorph', 'skills')
  }

  /**
   * Get the global skills directory
   */
  private getGlobalDir(): string {
    return join(homedir(), '.clipmorph', 'skills')
  }

  /**
   * Parse a SKILL.md file
   */
  private async parseSkillFile(
    skillDir: string,
    scope: 'global' | 'project'
  ): Promise<SkillConfig | null> {
    const skillFile = join(skillDir, 'SKILL.md')
    
    try {
      const content = await readFile(skillFile, 'utf-8')
      const { frontmatter, body } = parseSkillFrontmatter(content)
      const fileStat = await stat(skillFile)

      // Use directory name as ID
      const id = basename(skillDir)

      return {
        id,
        name: frontmatter.name || id,
        description: frontmatter.description || `Skill: ${id}`,
        version: frontmatter.version || '1.0.0',
        triggers: frontmatter.triggers || [],
        requires: frontmatter.requires || [],
        instructions: body,
        filePath: skillFile,
        scope,
        lastModified: fileStat.mtimeMs,
      }
    } catch (err) {
      console.warn(`[SkillService] Failed to parse skill at ${skillDir}:`, err)
      return null
    }
  }

  /**
   * Discover skills from a directory
   */
  private async discoverFromDir(
    dir: string,
    scope: 'global' | 'project'
  ): Promise<{ skills: SkillConfig[]; errors: Array<{ path: string; error: string }> }> {
    const skills: SkillConfig[] = []
    const errors: Array<{ path: string; error: string }> = []

    try {
      const dirStat = await stat(dir).catch(() => null)
      if (!dirStat?.isDirectory()) {
        return { skills, errors }
      }

      const entries = await readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        
        const skillDir = join(dir, entry.name)
        try {
          const skill = await this.parseSkillFile(skillDir, scope)
          if (skill) {
            skills.push(skill)
          }
        } catch (err) {
          errors.push({
            path: skillDir,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } catch {
      // Directory doesn't exist - that's fine
    }

    return { skills, errors }
  }

  /**
   * Discover all skills
   */
  async discover(forceReload = false): Promise<SkillDiscoverResponse> {
    const previousSkills = new Map(this.skills)
    let newCount = 0
    let updatedCount = 0
    const allErrors: Array<{ path: string; error: string }> = []

    if (forceReload) {
      this.skills.clear()
    }

    // Discover from global directory first
    const globalResult = await this.discoverFromDir(this.getGlobalDir(), 'global')
    allErrors.push(...globalResult.errors)

    // Discover from project directory (overrides global)
    const projectResult = await this.discoverFromDir(this.getProjectDir(), 'project')
    allErrors.push(...projectResult.errors)

    // Merge skills (project overrides global)
    const allSkills = [...globalResult.skills, ...projectResult.skills]
    
    for (const skill of allSkills) {
      const existing = previousSkills.get(skill.id)
      if (!existing) {
        newCount++
      } else if (existing.lastModified !== skill.lastModified) {
        updatedCount++
      }
      this.skills.set(skill.id, skill)
    }

    this.lastDiscovery = Date.now()

    console.log(
      `[SkillService] Discovered ${this.skills.size} skills (${newCount} new, ${updatedCount} updated)`
    )

    // Emit discovered event
    if (newCount > 0 || updatedCount > 0) {
      this.emit(
        createEvent<SkillDiscoveredPayload>(EventTypes.SKILL_DISCOVERED, {
          skills: Array.from(this.skills.values()),
          newCount,
        })
      )
    }

    return {
      skills: Array.from(this.skills.values()),
      newCount,
      updatedCount,
      errors: allErrors,
    }
  }

  /**
   * List all skills
   */
  async list(): Promise<SkillListResponse> {
    // Auto-discover if never discovered
    if (this.lastDiscovery === 0) {
      await this.discover()
    }

    const projectDir = this.getProjectDir()
    const globalDir = this.getGlobalDir()

    let projectDirExists = false
    try {
      const dirStat = await stat(projectDir)
      projectDirExists = dirStat.isDirectory()
    } catch {
      projectDirExists = false
    }

    return {
      skills: Array.from(this.skills.values()),
      projectDir,
      globalDir,
      projectDirExists,
    }
  }

  /**
   * Get a skill by ID
   */
  get(skillId: string): SkillGetResponse {
    return {
      skill: this.skills.get(skillId) || null,
    }
  }

  /**
   * Find skills by trigger keyword
   */
  findByTrigger(keyword: string): SkillConfig[] {
    const lowerKeyword = keyword.toLowerCase()
    return Array.from(this.skills.values()).filter((skill) =>
      skill.triggers.some((t) => lowerKeyword.includes(t.toLowerCase()))
    )
  }

  /**
   * Match skills to a task prompt
   */
  matchSkillsForTask(prompt: string): SkillConfig[] {
    const lowerPrompt = prompt.toLowerCase()
    const matched: SkillConfig[] = []

    for (const skill of this.skills.values()) {
      // Check if any trigger matches the prompt
      const hasMatch = skill.triggers.some((trigger) =>
        lowerPrompt.includes(trigger.toLowerCase())
      )
      if (hasMatch) {
        matched.push(skill)
      }
    }

    return matched
  }

  /**
   * Build augmented prompt with skill instructions
   */
  buildAugmentedPrompt(prompt: string, skills: SkillConfig[]): string {
    if (skills.length === 0) {
      return prompt
    }

    const skillInstructions = skills
      .map((s) => `## Skill: ${s.name}\n\n${s.instructions}`)
      .join('\n\n---\n\n')

    // Emit applied event for each skill
    for (const skill of skills) {
      this.emit(
        createEvent<SkillAppliedPayload>(EventTypes.SKILL_APPLIED, {
          skillId: skill.id,
          skillName: skill.name,
          taskPrompt: prompt,
        })
      )
    }

    return `# Applied Skills\n\n${skillInstructions}\n\n---\n\n# Task\n\n${prompt}`
  }

  /**
   * Export a skill to a file
   */
  async export(skillId: string, outputPath?: string): Promise<SkillExportResponse> {
    const skill = this.skills.get(skillId)
    if (!skill) {
      return { success: false, error: `Skill not found: ${skillId}` }
    }

    try {
      // Default to Downloads directory
      const downloadsDir = join(homedir(), 'Downloads')
      const exportDir = outputPath || downloadsDir
      const exportFile = join(exportDir, `${skill.id}.skill.md`)

      // Create export content (full SKILL.md)
      const content = await readFile(skill.filePath, 'utf-8')
      await writeFile(exportFile, content, 'utf-8')

      // Emit exported event
      this.emit(
        createEvent<SkillExportedPayload>(EventTypes.SKILL_EXPORTED, {
          skillId: skill.id,
          exportPath: exportFile,
        })
      )

      console.log(`[SkillService] Exported skill ${skillId} to ${exportFile}`)

      return { success: true, exportPath: exportFile }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  /**
   * Import a skill from a file
   */
  async import(source: string, global = false): Promise<SkillImportResponse> {
    try {
      // Read the source file
      const content = await readFile(source, 'utf-8')
      const { frontmatter } = parseSkillFrontmatter(content)

      // Determine skill ID from filename or frontmatter
      const skillId = frontmatter.name?.toLowerCase().replace(/\s+/g, '-') || 
        basename(source, '.skill.md').replace('.md', '')

      // Determine target directory
      const targetBase = global ? this.getGlobalDir() : this.getProjectDir()
      const targetDir = join(targetBase, skillId)
      const targetFile = join(targetDir, 'SKILL.md')

      // Create directory and copy file
      await mkdir(targetDir, { recursive: true })
      await writeFile(targetFile, content, 'utf-8')

      // Re-discover to pick up the new skill
      await this.discover(true)

      const skill = this.skills.get(skillId)
      if (!skill) {
        return { success: false, error: 'Failed to import skill' }
      }

      // Emit imported event
      this.emit(
        createEvent<SkillImportedPayload>(EventTypes.SKILL_IMPORTED, {
          skill,
          source,
        })
      )

      console.log(`[SkillService] Imported skill ${skillId} from ${source}`)

      return { success: true, skill }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  /**
   * Create the skills directory with a sample skill
   */
  async createSampleSkill(): Promise<string> {
    const skillsDir = this.getProjectDir()
    const sampleDir = join(skillsDir, 'example-style')
    const sampleFile = join(sampleDir, 'SKILL.md')

    await mkdir(sampleDir, { recursive: true })

    const sampleContent = `---
name: Example Style Guide
description: A sample skill demonstrating the format
version: 1.0.0
triggers:
  - style
  - format
  - clean
requires: []
---

# Example Style Guide

This is a sample skill that demonstrates the SKILL.md format.

## Guidelines

- Use consistent naming conventions
- Follow the project's established patterns
- Write clear, self-documenting code
- Add comments for complex logic

## Code Style

- Use 2-space indentation
- Keep lines under 100 characters
- Use meaningful variable names
`

    await writeFile(sampleFile, sampleContent, 'utf-8')
    console.log(`[SkillService] Created sample skill at ${sampleFile}`)

    // Re-discover
    await this.discover(true)

    return sampleFile
  }

  /**
   * Get all trigger keywords for voice matching
   */
  getAllTriggers(): Array<{ trigger: string; skillId: string }> {
    const triggers: Array<{ trigger: string; skillId: string }> = []
    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        triggers.push({ trigger, skillId: skill.id })
      }
    }
    return triggers
  }
}

// Singleton
export const skillService = new SkillService()
