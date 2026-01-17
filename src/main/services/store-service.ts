/**
 * Store Service - SQLite persistence layer
 *
 * Responsibilities:
 * - Initialize SQLite database
 * - Provide typed CRUD operations for settings and transcripts
 * - Handle migrations and schema updates
 */

import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

// Types
export interface SettingRow {
  key: string
  value: string
  updated_at: number
}

export interface TranscriptRow {
  id: string
  text: string
  duration_ms: number | null
  created_at: number
}

export interface OperationHistoryRow {
  id: string
  command: string
  job_type: string
  input_text: string
  input_html: string | null
  output_text: string | null
  output_image_size: number | null
  output_image_path: string | null
  success: boolean
  error: string | null
  duration_ms: number | null
  created_at: number
}

// Default settings
export const DEFAULT_SETTINGS = {
  'hotkey.pushToTalk': 'Control+Shift+Space',
  'transforms.urlClean.enabled': 'true',
  'transforms.urlMarkdown.enabled': 'true',
  'transforms.jsonPretty.enabled': 'true',
  'transforms.jsonMinify.enabled': 'true',
  'transforms.jsonToYaml.enabled': 'true',
  'transforms.yamlToJson.enabled': 'true',
  'transforms.extractEmails.enabled': 'true',
  'transforms.extractLinks.enabled': 'true',
  'transforms.redactSecrets.enabled': 'true',
  'ui.theme': 'system',
  'audio.minCaptureDuration': '200',
  'audio.inputDevice': '', // Empty = system default (macOS uses CoreAudio default)
  'cerebras.model': 'qwen-3-32b', // Cerebras model for browser agent
  'opencode.provider': 'anthropic', // OpenCode LLM provider
  'opencode.model': 'claude-3-5-sonnet-20241022', // OpenCode model for selected provider
  'ui.autoCompactOnBlur': 'true', // Auto-compact when app loses focus
  'voice.sttProvider': 'auto', // STT provider: 'auto' | 'elevenlabs' | 'groq' | 'openai'
  'voice.noiseSuppression': 'false', // Filter background noise (ElevenLabs only)
} as const

// Available Cerebras models
export const CEREBRAS_MODELS = [
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', params: '8B', speed: '~2200 t/s' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', params: '70B', speed: '~2100 t/s' },
  { id: 'gpt-oss-120b', name: 'OpenAI GPT OSS', params: '120B', speed: '~3000 t/s' },
  { id: 'qwen-3-32b', name: 'Qwen 3 32B', params: '32B', speed: '~2600 t/s' },
] as const

// Available OpenCode providers and their models
export const OPENCODE_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Recommended - Best balance' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cheaper' },
      { id: 'o1', name: 'o1', description: 'Advanced reasoning' },
      { id: 'o1-mini', name: 'o1 Mini', description: 'Faster reasoning' },
    ]
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Experimental preview' },
      { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro', description: 'Most capable' },
      { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash', description: 'Fastest' },
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    models: [
      { id: 'grok-2-1212', name: 'Grok 2', description: 'Latest model' },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', description: 'With vision capabilities' },
    ]
  },
  {
    id: 'zai',
    name: 'Z.AI (GLM)',
    models: [
      { id: 'glm-4.7', name: 'GLM-4.7', description: 'GLM Coding Plan model' },
      { id: 'glm-4.6', name: 'GLM-4.6', description: 'Previous generation' },
    ]
  },
] as const

export type SettingKey = keyof typeof DEFAULT_SETTINGS

class StoreService {
  private db: Database.Database | null = null
  private dbPath: string | null = null

  private getDbPath(): string {
    if (!this.dbPath) {
      // Defer path resolution until app is ready
      const userDataPath = app.getPath('userData')
      this.dbPath = path.join(userDataPath, 'clipmorph.db')
    }
    return this.dbPath
  }

  /**
   * Initialize the database
   */
  initialize(): void {
    if (this.db) return

    const dbPath = this.getDbPath()
    this.db = new Database(dbPath)

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    // Create tables
    this.createTables()

    // Initialize default settings
    this.initializeDefaults()

    console.log(`[StoreService] Database initialized at ${dbPath}`)
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized')

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // Transcripts table (last 20)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // Index for transcript ordering
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC)
    `)

    // Operations history table (last 100 operations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operations_history (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        job_type TEXT NOT NULL,
        input_text TEXT NOT NULL,
        input_html TEXT,
        output_text TEXT,
        output_image_size INTEGER,
        output_image_path TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)

    // Migration: add output_image_path column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE operations_history ADD COLUMN output_image_path TEXT`)
    } catch {
      // Column already exists, ignore
    }

    // Index for operations ordering
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations_history(created_at DESC)
    `)
  }

  /**
   * Initialize default settings if not present
   */
  private initializeDefaults(): void {
    if (!this.db) throw new Error('Database not initialized')

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `)

    const now = Date.now()
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertStmt.run(key, value, now)
    }
  }

  /**
   * Get a setting value
   */
  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  /**
   * Get a setting with default fallback
   */
  getSettingOrDefault(key: SettingKey): string {
    const value = this.getSetting(key)
    return value ?? DEFAULT_SETTINGS[key]
  }

  /**
   * Set a setting value
   */
  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    stmt.run(key, value, Date.now())
  }

  /**
   * Get all settings
   */
  getAllSettings(): Record<string, string> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT key, value FROM settings')
    const rows = stmt.all() as SettingRow[]

    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return settings
  }

  /**
   * Delete a setting
   */
  deleteSetting(key: string): void {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?')
    stmt.run(key)
  }

  /**
   * Add a transcript (maintains last 20)
   */
  addTranscript(id: string, text: string, durationMs?: number): void {
    if (!this.db) throw new Error('Database not initialized')

    // Insert new transcript
    const insertStmt = this.db.prepare(`
      INSERT INTO transcripts (id, text, duration_ms, created_at)
      VALUES (?, ?, ?, ?)
    `)
    insertStmt.run(id, text, durationMs ?? null, Date.now())

    // Delete old transcripts (keep last 20)
    const deleteStmt = this.db.prepare(`
      DELETE FROM transcripts WHERE id NOT IN (
        SELECT id FROM transcripts ORDER BY created_at DESC LIMIT 20
      )
    `)
    deleteStmt.run()
  }

  /**
   * Get transcripts (last 20, newest first)
   */
  getTranscripts(limit = 20): TranscriptRow[] {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      SELECT id, text, duration_ms, created_at
      FROM transcripts
      ORDER BY created_at DESC
      LIMIT ?
    `)
    return stmt.all(limit) as TranscriptRow[]
  }

  /**
   * Get last transcript
   */
  getLastTranscript(): TranscriptRow | null {
    const transcripts = this.getTranscripts(1)
    return transcripts[0] ?? null
  }

  /**
   * Clear all transcripts
   */
  clearTranscripts(): void {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM transcripts')
    stmt.run()
  }

  // ============================================================================
  // Operations History
  // ============================================================================

  /**
   * Add an operation to history (maintains last 100)
   */
  addOperation(operation: {
    id: string
    command: string
    jobType: string
    inputText: string
    inputHtml?: string
    outputText?: string
    outputImageSize?: number
    outputImagePath?: string
    success: boolean
    error?: string
    durationMs?: number
  }): void {
    if (!this.db) throw new Error('Database not initialized')

    const insertStmt = this.db.prepare(`
      INSERT INTO operations_history (
        id, command, job_type, input_text, input_html, 
        output_text, output_image_size, output_image_path, success, error, duration_ms, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insertStmt.run(
      operation.id,
      operation.command,
      operation.jobType,
      operation.inputText,
      operation.inputHtml ?? null,
      operation.outputText ?? null,
      operation.outputImageSize ?? null,
      operation.outputImagePath ?? null,
      operation.success ? 1 : 0,
      operation.error ?? null,
      operation.durationMs ?? null,
      Date.now()
    )
    console.log(`[StoreService] Added operation: "${operation.command}" (${operation.jobType}) - ${operation.success ? 'success' : 'failed'}`)

    // Delete old operations (keep last 100)
    const deleteStmt = this.db.prepare(`
      DELETE FROM operations_history WHERE id NOT IN (
        SELECT id FROM operations_history ORDER BY created_at DESC LIMIT 100
      )
    `)
    deleteStmt.run()
  }

  /**
   * Get operations history (newest first)
   */
  getOperations(limit = 50): OperationHistoryRow[] {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      SELECT 
        id, command, job_type, input_text, input_html,
        output_text, output_image_size, output_image_path, success, error, duration_ms, created_at
      FROM operations_history
      ORDER BY created_at DESC
      LIMIT ?
    `)
    const rows = stmt.all(limit) as Array<{
      id: string
      command: string
      job_type: string
      input_text: string
      input_html: string | null
      output_text: string | null
      output_image_size: number | null
      output_image_path: string | null
      success: number
      error: string | null
      duration_ms: number | null
      created_at: number
    }>

    // Convert success from number to boolean
    return rows.map(row => ({
      ...row,
      success: row.success === 1,
    }))
  }

  /**
   * Get last operation
   */
  getLastOperation(): OperationHistoryRow | null {
    const operations = this.getOperations(1)
    return operations[0] ?? null
  }

  /**
   * Clear all operations history
   */
  clearOperations(): void {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM operations_history')
    stmt.run()
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('[StoreService] Database closed')
    }
  }

}

// Singleton export
export const storeService = new StoreService()
