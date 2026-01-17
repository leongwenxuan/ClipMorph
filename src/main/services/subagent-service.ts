/**
 * Subagent Service
 *
 * Discovers and manages custom OpenCode subagents.
 * Scans .clipmorph/subagents/*.md files for agent definitions.
 * 
 * File format:
 * ```
 * ---
 * name: My Agent
 * description: Does something useful
 * triggers:
 *   - ask my agent
 *   - use custom agent
 * model: claude-3-5-sonnet  # optional
 * temperature: 0.7          # optional
 * ---
 * 
 * System prompt content here...
 * ```
 */

import { EventEmitter } from 'events'
import { readdir, readFile, stat, mkdir, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import {
  SubagentConfig,
  SubagentListResponse,
  SubagentDiscoverResponse,
} from '../../../packages/contracts/src'

// ============================================================================
// YAML Frontmatter Parser (simple implementation)
// ============================================================================

interface FrontmatterResult {
  name?: string
  description?: string
  triggers?: string[]
  model?: string
  temperature?: number
}

function parseFrontmatter(content: string): { frontmatter: FrontmatterResult; body: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content }
  }

  const yaml = frontmatterMatch[1]
  const body = frontmatterMatch[2].trim()
  const result: FrontmatterResult = {}

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

  // Parse model
  const modelMatch = yaml.match(/^model:\s*(.+)$/m)
  if (modelMatch) {
    result.model = modelMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  // Parse temperature
  const tempMatch = yaml.match(/^temperature:\s*(.+)$/m)
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1].trim())
    if (!isNaN(temp)) {
      result.temperature = temp
    }
  }

  // Parse triggers (simple array format)
  const triggerMatch = yaml.match(/^triggers:\s*\n((?:\s+-\s+.+\n?)+)/m)
  if (triggerMatch) {
    result.triggers = triggerMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter((trigger) => trigger.length > 0)
  }

  return { frontmatter: result, body }
}

// ============================================================================
// Subagent Service
// ============================================================================

class SubagentService extends EventEmitter {
  private subagents: Map<string, SubagentConfig> = new Map()
  private projectRoot: string = process.cwd()
  private lastDiscovery: number = 0

  /**
   * Get the config directory path
   */
  private getConfigDir(): string {
    return join(this.projectRoot, '.clipmorph', 'subagents')
  }

  /**
   * Set the project root directory
   */
  setProjectRoot(root: string): void {
    this.projectRoot = root
  }

  /**
   * Get directories to scan for subagent definitions
   */
  private getSubagentDirectories(): string[] {
    return [
      // Project-local subagents (primary)
      this.getConfigDir(),
      // Global subagents
      join(homedir(), '.clipmorph', 'subagents'),
      // Also check .opencode/agent for compatibility
      join(this.projectRoot, '.opencode', 'agent'),
      join(homedir(), '.config', 'opencode', 'agent'),
    ]
  }

  /**
   * Parse a subagent file
   */
  private async parseSubagentFile(filePath: string): Promise<SubagentConfig | null> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(content)
      const fileStat = await stat(filePath)

      // Use filename (without .md) as fallback ID and name
      const id = basename(filePath, '.md')

      return {
        id,
        name: frontmatter.name || id,
        description: frontmatter.description || `Custom subagent: ${id}`,
        triggers: frontmatter.triggers || [],
        systemPrompt: body,
        model: frontmatter.model,
        temperature: frontmatter.temperature,
        filePath,
        lastModified: fileStat.mtimeMs,
      }
    } catch (err) {
      console.warn(`[SubagentService] Failed to parse subagent file ${filePath}:`, err)
      return null
    }
  }

  /**
   * Discover all available subagents
   */
  async discover(forceReload = false): Promise<SubagentDiscoverResponse> {
    const previousSubagents = new Map(this.subagents)
    const errors: Array<{ file: string; error: string }> = []
    let newCount = 0
    let updatedCount = 0

    // Clear cache if force reload
    if (forceReload) {
      this.subagents.clear()
    }

    const directories = this.getSubagentDirectories()

    for (const dirPath of directories) {
      try {
        const dirStat = await stat(dirPath).catch(() => null)
        if (!dirStat?.isDirectory()) {
          continue
        }

        const files = await readdir(dirPath)
        const mdFiles = files.filter((f) => f.endsWith('.md'))

        for (const file of mdFiles) {
          const filePath = join(dirPath, file)
          try {
            const subagent = await this.parseSubagentFile(filePath)
            if (subagent) {
              const existing = previousSubagents.get(subagent.id)
              if (!existing) {
                newCount++
              } else if (existing.lastModified !== subagent.lastModified) {
                updatedCount++
              }
              this.subagents.set(subagent.id, subagent)
            }
          } catch (err) {
            errors.push({
              file: filePath,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      } catch {
        // Directory doesn't exist or can't be read - that's fine
      }
    }

    this.lastDiscovery = Date.now()

    console.log(
      `[SubagentService] Discovered ${this.subagents.size} subagents (${newCount} new, ${updatedCount} updated)`
    )

    return {
      subagents: Array.from(this.subagents.values()),
      newCount,
      updatedCount,
      errors,
    }
  }

  /**
   * List all subagents
   */
  async list(): Promise<SubagentListResponse> {
    // Auto-discover if never discovered
    if (this.lastDiscovery === 0) {
      await this.discover()
    }

    const configDir = this.getConfigDir()
    let configDirExists = false
    try {
      const dirStat = await stat(configDir)
      configDirExists = dirStat.isDirectory()
    } catch {
      configDirExists = false
    }

    return {
      subagents: Array.from(this.subagents.values()),
      configDir,
      configDirExists,
    }
  }

  /**
   * Get a subagent by ID
   */
  get(id: string): SubagentConfig | undefined {
    return this.subagents.get(id)
  }

  /**
   * Find a subagent by name (case-insensitive)
   */
  findByName(name: string): SubagentConfig | undefined {
    const lowerName = name.toLowerCase()
    return Array.from(this.subagents.values()).find(
      (s) => s.name.toLowerCase() === lowerName || s.id.toLowerCase() === lowerName
    )
  }

  /**
   * Find subagents by trigger phrase
   */
  findByTrigger(phrase: string): SubagentConfig | undefined {
    const lowerPhrase = phrase.toLowerCase()
    return Array.from(this.subagents.values()).find((s) =>
      s.triggers.some((t) => lowerPhrase.includes(t.toLowerCase()))
    )
  }

  /**
   * Get all trigger phrases for voice matching
   */
  getAllTriggers(): Array<{ trigger: string; subagentId: string }> {
    const triggers: Array<{ trigger: string; subagentId: string }> = []
    for (const subagent of this.subagents.values()) {
      for (const trigger of subagent.triggers) {
        triggers.push({ trigger, subagentId: subagent.id })
      }
    }
    return triggers
  }

  /**
   * Check if a subagent exists
   */
  has(id: string): boolean {
    return this.subagents.has(id)
  }

  /**
   * Get subagent names for voice matching
   */
  getNames(): string[] {
    return Array.from(this.subagents.values()).map((s) => s.name)
  }

  /**
   * Create the config directory if it doesn't exist
   */
  async ensureConfigDir(): Promise<string> {
    const configDir = this.getConfigDir()
    try {
      await mkdir(configDir, { recursive: true })
    } catch {
      // Already exists
    }
    return configDir
  }

  /**
   * Create a sample subagent file
   */
  async createSampleSubagent(): Promise<string> {
    const configDir = await this.ensureConfigDir()
    const samplePath = join(configDir, 'example-agent.md')

    const sampleContent = `---
name: Example Agent
description: A sample subagent to demonstrate the format
triggers:
  - ask example
  - use example agent
model: claude-3-5-sonnet
temperature: 0.7
---

You are a helpful assistant that demonstrates the subagent format.

When the user asks you something, respond helpfully and concisely.

## Guidelines

- Be concise and helpful
- Use markdown formatting when appropriate
- If you don't know something, say so
`

    await writeFile(samplePath, sampleContent, 'utf-8')
    console.log(`[SubagentService] Created sample subagent at ${samplePath}`)

    // Re-discover to pick up the new file
    await this.discover(true)

    return samplePath
  }
}

// Singleton
export const subagentService = new SubagentService()
