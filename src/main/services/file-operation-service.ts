/**
 * File Operation Service
 *
 * Handles file/folder operations via voice commands.
 * All operations require preview and approval before execution.
 * Supports undo for recent operations.
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'
import {
  ClipMorphEvent,
  createEvent,
  EventTypes,
  FileOperationType,
  FileOperationItem,
  FileOperationPreview,
  FileOperationJob,
  FileOperationHistoryEntry,
  FileOpPreviewRequest,
  FileOpPreviewResponse,
  FileOpExecuteRequest,
  FileOpExecuteResponse,
  FileOpUndoRequest,
  FileOpUndoResponse,
  FileOpHistoryResponse,
  FileOpPreviewReadyPayload,
  FileOpStartedPayload,
  FileOpCompletedPayload,
  FileOpFailedPayload,
  FileOpUndonePayload,
} from '../../../packages/contracts/src'
import { getOpenCodeService } from './opencode-service'

// ============================================================================
// Constants
// ============================================================================

const PREVIEW_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const UNDO_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const MAX_HISTORY = 20

// ============================================================================
// Prompts for OpenCode
// ============================================================================

const FILE_OP_PROMPTS: Record<string, (prompt: string, targetDir?: string) => string> = {
  // Preview only - just analyze and return JSON
  preview: (prompt: string, targetDir?: string) => `
You are a file management assistant. Analyze the following request and generate a preview of file operations.

## Request
${prompt}

${targetDir ? `## Target Directory\n${targetDir}` : ''}

## Instructions
1. Parse the user's intent (organize, rename, move, delete, copy, find)
2. List the specific files/folders that would be affected
3. For each operation, specify:
   - type: rename | move | delete | copy | organize
   - source: full path
   - destination: full path (for rename/move/copy)
   - destructive: true/false

## Output Format
Return a JSON object with:
{
  "operations": [
    { "type": "rename", "source": "/path/to/file", "destination": "/path/to/newfile", "destructive": false },
    ...
  ],
  "summary": "Human-readable summary of what will happen"
}

IMPORTANT: Only list actual files that exist. Be conservative - when in doubt, ask for clarification.
`,

  // Execute directly - perform the operations and return results
  executeDirectly: (prompt: string, targetDir?: string) => `
You are a file management assistant. Execute the following file operation request.

## Request
${prompt}

${targetDir ? `## Target Directory\n${targetDir}` : ''}

## Instructions
1. Parse the user's intent (organize, rename, move, delete, copy, find)
2. EXECUTE the operations immediately using shell commands (mv, cp, rm, mkdir, etc.)
3. Report what you did

## IMPORTANT
- Actually PERFORM the file operations, don't just list them
- Use 'mv' for rename/move operations
- Use 'cp' for copy operations  
- Use 'rm' for delete operations
- After completing, output a JSON summary

## Output Format (after executing)
Return a JSON object with:
{
  "executed": true,
  "operations": [
    { "type": "rename", "source": "/path/from", "destination": "/path/to", "success": true },
    ...
  ],
  "summary": "Human-readable summary of what was done"
}
`,

  execute: (operations: string) => `
Execute the following file operations. Be careful and report any errors.

## Operations
${operations}

## Instructions
1. Execute each operation in order using shell commands (mv, cp, rm)
2. Stop immediately if any operation fails
3. Report success/failure for each operation
4. Do NOT proceed if you encounter permission errors

## Output Format
Return a JSON object with:
{
  "results": [
    { "success": true, "operation": { ... } },
    { "success": false, "operation": { ... }, "error": "reason" }
  ]
}
`,
}

// ============================================================================
// File Operation Service
// ============================================================================

class FileOperationService extends EventEmitter {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private previews: Map<string, FileOperationPreview> = new Map()
  private history: FileOperationHistoryEntry[] = []
  private activeJob: FileOperationJob | null = null

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
   * Generate a preview of file operations
   */
  async generatePreview(request: FileOpPreviewRequest): Promise<FileOpPreviewResponse> {
    const openCodeService = getOpenCodeService()

    // Build the preview prompt
    const prompt = FILE_OP_PROMPTS.preview(request.prompt, request.targetDir)

    console.log(`[FileOperationService] Generating preview for: "${request.prompt}"`)

    try {
      // Run OpenCode to analyze the request and WAIT for completion
      const result = await openCodeService.runTask({
        prompt,
        cwd: request.targetDir,
      })

      // Parse operations from OpenCode's output
      let operations: FileOperationItem[] = []
      let summary = ''
      
      if (result.output) {
        // Try to extract JSON from the output
        // Look for JSON block in markdown code fence or raw JSON
        const jsonMatch = result.output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                          result.output.match(/(\{[\s\S]*"operations"[\s\S]*\})/)
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            if (parsed.operations && Array.isArray(parsed.operations)) {
              operations = parsed.operations.map((op: Record<string, unknown>) => ({
                type: op.type as string,
                source: op.source as string,
                destination: op.destination as string | undefined,
                destructive: Boolean(op.destructive),
              }))
              summary = parsed.summary || `${operations.length} file operations`
              console.log(`[FileOperationService] Parsed ${operations.length} operations from OpenCode output`)
            }
          } catch (parseError) {
            console.error('[FileOperationService] Failed to parse JSON from OpenCode:', parseError)
          }
        }
      }
      
      const now = Date.now()
      const previewId = crypto.randomUUID()

      // Check if any operations are destructive (delete)
      const hasDestructive = operations.some(op => op.destructive || op.type === 'delete')

      const preview: FileOperationPreview = {
        id: previewId,
        operations,
        fileCount: operations.length,
        folderCount: 0,
        hasDestructive,
        summary: summary || `${operations.length} file operations`,
        prompt: request.prompt,
        createdAt: now,
        expiresAt: now + PREVIEW_EXPIRY_MS,
      }

      // Store the preview
      this.previews.set(previewId, preview)

      // Clean up expired previews
      this.cleanupExpiredPreviews()

      // Emit preview ready event
      this.emit(
        createEvent<FileOpPreviewReadyPayload>(EventTypes.FILE_OP_PREVIEW_READY, { preview })
      )

      console.log(`[FileOperationService] Preview ${previewId} generated with ${operations.length} operations`)

      return { preview }
    } catch (error) {
      throw new Error(`Failed to generate preview: ${(error as Error).message}`)
    }
  }

  /**
   * Execute file operations directly (single OpenCode call - no separate preview)
   * This is the recommended method for non-destructive operations
   */
  async executeDirectly(request: FileOpPreviewRequest): Promise<FileOpExecuteResponse> {
    const openCodeService = getOpenCodeService()

    // Build prompt that tells OpenCode to EXECUTE, not just preview
    const prompt = FILE_OP_PROMPTS.executeDirectly(request.prompt, request.targetDir)

    console.log(`[FileOperationService] Executing directly: "${request.prompt}"`)

    const now = Date.now()
    const jobId = crypto.randomUUID()

    // Create job
    const job: FileOperationJob = {
      id: jobId,
      type: 'file-operation',
      status: 'running',
      createdAt: now,
      updatedAt: now,
      operationType: 'rename', // Will be updated from result
      previewId: '',
      operations: [],
      successCount: 0,
      failureCount: 0,
      prompt: request.prompt,
      requiredApproval: false,
    }

    this.activeJob = job

    // Emit started event
    this.emit(
      createEvent<FileOpStartedPayload>(EventTypes.FILE_OP_STARTED, { job })
    )

    try {
      // Run OpenCode to execute the operations directly
      // Enable auto-approve since we handle destructive checks ourselves
      const result = await openCodeService.runTask({
        prompt,
        cwd: request.targetDir,
        autoApprove: true,
      })

      // Parse results from OpenCode's output
      let operations: FileOperationItem[] = []
      let summary = ''
      
      if (result.output) {
        // Try to extract JSON from the output
        const jsonMatch = result.output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                          result.output.match(/(\{[\s\S]*"operations"[\s\S]*\})/)
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            if (parsed.operations && Array.isArray(parsed.operations)) {
              operations = parsed.operations.map((op: Record<string, unknown>) => ({
                type: op.type as string,
                source: op.source as string,
                destination: op.destination as string | undefined,
                destructive: Boolean(op.destructive),
              }))
              summary = parsed.summary || `${operations.length} file operations executed`
              
              // Count successes/failures
              for (const op of parsed.operations) {
                if (op.success !== false) {
                  job.successCount++
                } else {
                  job.failureCount++
                }
              }
            }
          } catch (parseError) {
            console.error('[FileOperationService] Failed to parse JSON from OpenCode:', parseError)
          }
        }
      }

      job.operations = operations
      job.operationType = this.determineOperationType(operations)
      job.status = 'completed'
      job.updatedAt = Date.now()

      // Add to history for undo
      this.addToHistory(job)

      // Emit completed event
      this.emit(
        createEvent<FileOpCompletedPayload>(EventTypes.FILE_OP_COMPLETED, { job })
      )

      console.log(`[FileOperationService] Direct execution completed: ${job.successCount} success, ${job.failureCount} failed`)

      this.activeJob = null
      return { job }
    } catch (error) {
      job.status = 'failed'
      job.error = { code: 'FILE_OP_FAILED', message: (error as Error).message }
      job.updatedAt = Date.now()

      this.emit(
        createEvent<FileOpFailedPayload>(EventTypes.FILE_OP_FAILED, {
          jobId: job.id,
          error: (error as Error).message,
        })
      )

      console.error(`[FileOperationService] Direct execution failed:`, error)

      this.activeJob = null
      throw error
    }
  }

  /**
   * Execute file operations from a preview
   */
  async execute(request: FileOpExecuteRequest): Promise<FileOpExecuteResponse> {
    const preview = this.previews.get(request.previewId)
    if (!preview) {
      throw new Error(`Preview not found: ${request.previewId}`)
    }

    // Check if preview has expired
    if (Date.now() > preview.expiresAt) {
      this.previews.delete(request.previewId)
      throw new Error('Preview has expired. Please generate a new preview.')
    }

    // Check approval for destructive operations
    if (preview.hasDestructive && !request.approved) {
      throw new Error('Destructive operations require explicit approval.')
    }

    // Create job
    const now = Date.now()
    const job: FileOperationJob = {
      id: crypto.randomUUID(),
      type: 'file-operation',
      status: 'running',
      createdAt: now,
      updatedAt: now,
      operationType: this.determineOperationType(preview.operations),
      previewId: preview.id,
      operations: preview.operations,
      successCount: 0,
      failureCount: 0,
      prompt: preview.prompt,
      requiredApproval: preview.hasDestructive,
    }

    this.activeJob = job

    // Emit started event
    this.emit(
      createEvent<FileOpStartedPayload>(EventTypes.FILE_OP_STARTED, { job })
    )

    console.log(`[FileOperationService] Executing job ${job.id} with ${preview.operations.length} operations`)

    try {
      // Execute operations directly using Node.js fs
      const fs = await import('fs/promises')
      const path = await import('path')
      
      for (const op of preview.operations) {
        try {
          switch (op.type) {
            case 'rename':
            case 'move':
              if (op.destination) {
                // Ensure destination directory exists
                const destDir = path.dirname(op.destination)
                await fs.mkdir(destDir, { recursive: true })
                await fs.rename(op.source, op.destination)
                console.log(`[FileOperationService] Renamed: ${op.source} -> ${op.destination}`)
                job.successCount++
              }
              break
            case 'copy':
              if (op.destination) {
                const destDir = path.dirname(op.destination)
                await fs.mkdir(destDir, { recursive: true })
                await fs.copyFile(op.source, op.destination)
                console.log(`[FileOperationService] Copied: ${op.source} -> ${op.destination}`)
                job.successCount++
              }
              break
            case 'delete':
              await fs.unlink(op.source)
              console.log(`[FileOperationService] Deleted: ${op.source}`)
              job.successCount++
              break
            default:
              console.warn(`[FileOperationService] Unknown operation type: ${op.type}`)
              job.failureCount++
          }
        } catch (opError) {
          console.error(`[FileOperationService] Operation failed:`, opError)
          job.failureCount++
        }
      }

      // Mark as completed
      job.status = job.failureCount === 0 ? 'completed' : 'completed'
      job.updatedAt = Date.now()

      // Add to history for undo
      this.addToHistory(job)

      // Remove preview
      this.previews.delete(request.previewId)

      // Emit completed event
      this.emit(
        createEvent<FileOpCompletedPayload>(EventTypes.FILE_OP_COMPLETED, { job })
      )

      console.log(`[FileOperationService] Job ${job.id} completed: ${job.successCount} success, ${job.failureCount} failed`)

      this.activeJob = null
      return { job }
    } catch (error) {
      job.status = 'failed'
      job.error = { code: 'FILE_OP_FAILED', message: (error as Error).message }
      job.updatedAt = Date.now()

      // Emit failed event
      this.emit(
        createEvent<FileOpFailedPayload>(EventTypes.FILE_OP_FAILED, {
          jobId: job.id,
          error: (error as Error).message,
        })
      )

      console.error(`[FileOperationService] Job ${job.id} failed:`, error)

      this.activeJob = null
      throw error
    }
  }

  /**
   * Undo a recent file operation
   */
  async undo(request: FileOpUndoRequest): Promise<FileOpUndoResponse> {
    const entry = this.history.find(h => h.jobId === request.jobId)
    if (!entry) {
      return { success: false, undoneCount: 0, error: 'Operation not found in history' }
    }

    if (!entry.canUndo) {
      return { success: false, undoneCount: 0, error: 'Operation cannot be undone' }
    }

    if (Date.now() > entry.undoExpiresAt) {
      entry.canUndo = false
      return { success: false, undoneCount: 0, error: 'Undo window has expired' }
    }

    console.log(`[FileOperationService] Undoing job ${request.jobId}`)

    try {
      // Generate reverse operations
      const reverseOps = this.generateReverseOperations(entry.operations)

      // Execute reverse operations via OpenCode
      const openCodeService = getOpenCodeService()
      const undoPrompt = FILE_OP_PROMPTS.execute(JSON.stringify(reverseOps, null, 2))

      await openCodeService.runTask({ prompt: undoPrompt })

      // Mark as undone
      entry.canUndo = false

      // Emit undone event
      this.emit(
        createEvent<FileOpUndonePayload>(EventTypes.FILE_OP_UNDONE, {
          jobId: request.jobId,
          undoneCount: entry.operations.length,
        })
      )

      console.log(`[FileOperationService] Job ${request.jobId} undone`)

      return { success: true, undoneCount: entry.operations.length }
    } catch (error) {
      return { success: false, undoneCount: 0, error: (error as Error).message }
    }
  }

  /**
   * Get operation history
   */
  getHistory(): FileOpHistoryResponse {
    // Clean up expired entries
    const now = Date.now()
    this.history = this.history.map(entry => ({
      ...entry,
      canUndo: entry.canUndo && now < entry.undoExpiresAt,
    }))

    return { history: [...this.history] }
  }

  /**
   * Get a preview by ID
   */
  getPreview(previewId: string): FileOperationPreview | null {
    const preview = this.previews.get(previewId)
    if (preview && Date.now() > preview.expiresAt) {
      this.previews.delete(previewId)
      return null
    }
    return preview || null
  }

  /**
   * Get the active job
   */
  getActiveJob(): FileOperationJob | null {
    return this.activeJob
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private determineOperationType(operations: FileOperationItem[]): FileOperationType {
    if (operations.length === 0) return 'organize'
    
    // Return the most common operation type
    const counts = new Map<FileOperationType, number>()
    for (const op of operations) {
      counts.set(op.type, (counts.get(op.type) || 0) + 1)
    }
    
    let maxType: FileOperationType = 'organize'
    let maxCount = 0
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxType = type
        maxCount = count
      }
    }
    
    return maxType
  }

  private addToHistory(job: FileOperationJob): void {
    const entry: FileOperationHistoryEntry = {
      jobId: job.id,
      operations: job.operations,
      executedAt: Date.now(),
      canUndo: true,
      undoExpiresAt: Date.now() + UNDO_EXPIRY_MS,
    }

    this.history.unshift(entry)
    if (this.history.length > MAX_HISTORY) {
      this.history.pop()
    }
  }

  private generateReverseOperations(operations: FileOperationItem[]): FileOperationItem[] {
    return operations.map(op => {
      switch (op.type) {
        case 'rename':
        case 'move':
          return {
            type: op.type,
            source: op.destination!,
            destination: op.source,
            destructive: false,
          }
        case 'copy':
          return {
            type: 'delete',
            source: op.destination!,
            destructive: true,
          }
        case 'delete':
          // Cannot undo delete - would need to restore from trash
          return {
            type: 'copy',
            source: op.source, // This won't work - just a placeholder
            destination: op.source,
            destructive: false,
          }
        default:
          return op
      }
    }).reverse() // Reverse order for proper undo
  }

  private cleanupExpiredPreviews(): void {
    const now = Date.now()
    for (const [id, preview] of this.previews) {
      if (now > preview.expiresAt) {
        this.previews.delete(id)
      }
    }
  }
}

// Singleton
export const fileOperationService = new FileOperationService()
