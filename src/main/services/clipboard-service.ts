/**
 * Clipboard Service
 * Handles clipboard watching, snapshot gating, self-trigger immunity, and undo history
 */

import { clipboard } from 'electron'
import {
  EventTypes,
  createEvent,
  ClipMorphEvent,
  ErrorCodes,
  IpcError,
} from '../../../packages/contracts/src'

export type ClipboardContentType = 'text' | 'html' | 'rtf'

export interface ClipboardSnapshot {
  id: string
  text: string
  html?: string
  rtf?: string
  contentType: ClipboardContentType
  timestamp: number
  hash: string
}

export interface ClipboardChangedPayload {
  snapshot: ClipboardSnapshot
  previousSnapshot?: ClipboardSnapshot
}

export type ClipboardEventEmitter = <T>(event: ClipMorphEvent<T>) => void

// Shadow history depth (2-deep as per architecture)
const SHADOW_HISTORY_DEPTH = 2

/**
 * Generate a simple hash for content comparison
 */
function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

export class ClipboardService {
  private eventEmitter: ClipboardEventEmitter | null = null
  private currentSnapshot: ClipboardSnapshot | null = null
  private watchInterval: ReturnType<typeof setInterval> | null = null
  private isWatching = false
  private pollIntervalMs = 500

  // Self-trigger immunity: track hashes of content we've written
  private selfWrittenHashes: Set<string> = new Set()
  private selfWriteExpiryMs = 2000 // Ignore self-writes for 2 seconds

  // Shadow clipboard history (2-deep for undo)
  private shadowHistory: ClipboardSnapshot[] = []

  /**
   * Set the event emitter for broadcasting clipboard events
   */
  setEventEmitter(emitter: ClipboardEventEmitter): void {
    this.eventEmitter = emitter
  }

  /**
   * Create a snapshot from the current clipboard content
   */
  private createSnapshot(text: string): ClipboardSnapshot {
    // Try to get rich content types
    let html: string | undefined
    let rtf: string | undefined
    let contentType: ClipboardContentType = 'text'

    try {
      const htmlContent = clipboard.readHTML()
      if (htmlContent && htmlContent.trim()) {
        html = htmlContent
        contentType = 'html'
      }
    } catch {
      // HTML not available
    }

    try {
      const rtfContent = clipboard.readRTF()
      if (rtfContent && rtfContent.trim()) {
        rtf = rtfContent
        if (contentType === 'text') {
          contentType = 'rtf'
        }
      }
    } catch {
      // RTF not available
    }

    return {
      id: generateSnapshotId(),
      text,
      html,
      rtf,
      contentType,
      timestamp: Date.now(),
      hash: hashContent(text),
    }
  }

  /**
   * Emit a clipboard changed event
   */
  private emitClipboardChanged(
    snapshot: ClipboardSnapshot,
    previousSnapshot?: ClipboardSnapshot
  ): void {
    if (this.eventEmitter) {
      this.eventEmitter(
        createEvent<ClipboardChangedPayload>(EventTypes.CLIPBOARD_CHANGED, {
          snapshot,
          previousSnapshot,
        })
      )
    }
  }

  /**
   * Check if a hash was written by us recently (self-trigger immunity)
   */
  private isSelfWrite(hash: string): boolean {
    return this.selfWrittenHashes.has(hash)
  }

  /**
   * Mark a hash as self-written (for immunity)
   */
  private markAsSelfWrite(hash: string): void {
    this.selfWrittenHashes.add(hash)
    // Auto-expire after a delay
    setTimeout(() => {
      this.selfWrittenHashes.delete(hash)
    }, this.selfWriteExpiryMs)
  }

  /**
   * Push current snapshot to shadow history before overwriting
   */
  private pushToShadowHistory(snapshot: ClipboardSnapshot): void {
    // Add to front of history
    this.shadowHistory.unshift(snapshot)
    // Keep only SHADOW_HISTORY_DEPTH items
    if (this.shadowHistory.length > SHADOW_HISTORY_DEPTH) {
      this.shadowHistory.pop()
    }
  }

  /**
   * Poll the clipboard and check for changes
   */
  private pollClipboard(): void {
    try {
      const currentText = clipboard.readText()
      const currentHash = hashContent(currentText)

      // Check if content has changed
      if (!this.currentSnapshot || this.currentSnapshot.hash !== currentHash) {
        // Check for self-trigger immunity
        if (this.isSelfWrite(currentHash)) {
          // This is our own write, update snapshot but don't emit event
          this.currentSnapshot = this.createSnapshot(currentText)
          return
        }

        const previousSnapshot = this.currentSnapshot || undefined
        this.currentSnapshot = this.createSnapshot(currentText)
        this.emitClipboardChanged(this.currentSnapshot, previousSnapshot)
      }
    } catch (error) {
      console.error('Error polling clipboard:', error)
    }
  }

  /**
   * Start watching the clipboard for changes
   */
  startWatching(): void {
    if (this.isWatching) return

    this.isWatching = true

    // Take initial snapshot
    const initialText = clipboard.readText()
    this.currentSnapshot = this.createSnapshot(initialText)

    // Start polling
    this.watchInterval = setInterval(() => {
      this.pollClipboard()
    }, this.pollIntervalMs)
  }

  /**
   * Stop watching the clipboard
   */
  stopWatching(): void {
    if (!this.isWatching) return

    this.isWatching = false
    if (this.watchInterval) {
      clearInterval(this.watchInterval)
      this.watchInterval = null
    }
  }

  /**
   * Get the current clipboard snapshot
   */
  getCurrentSnapshot(): ClipboardSnapshot | null {
    return this.currentSnapshot
  }

  /**
   * Read the current clipboard text
   */
  readClipboard(): string {
    return clipboard.readText()
  }

  /**
   * Write text to the clipboard (with self-trigger immunity)
   * Optionally saves to shadow history for undo
   */
  writeClipboard(text: string, saveToHistory = false): void {
    // Save current content to shadow history if requested
    if (saveToHistory && this.currentSnapshot) {
      this.pushToShadowHistory(this.currentSnapshot)
    }

    const hash = hashContent(text)
    this.markAsSelfWrite(hash)
    clipboard.writeText(text)

    // Update our snapshot to reflect the write
    this.currentSnapshot = this.createSnapshot(text)
  }

  /**
   * Write with full content restoration (preserves HTML/RTF if available)
   */
  writeClipboardWithSnapshot(snapshot: ClipboardSnapshot, saveToHistory = false): void {
    // Save current content to shadow history if requested
    if (saveToHistory && this.currentSnapshot) {
      this.pushToShadowHistory(this.currentSnapshot)
    }

    const hash = hashContent(snapshot.text)
    this.markAsSelfWrite(hash)

    // Write based on content type
    if (snapshot.html && snapshot.contentType === 'html') {
      clipboard.write({
        text: snapshot.text,
        html: snapshot.html,
        rtf: snapshot.rtf,
      })
    } else if (snapshot.rtf && snapshot.contentType === 'rtf') {
      clipboard.write({
        text: snapshot.text,
        rtf: snapshot.rtf,
      })
    } else {
      clipboard.writeText(snapshot.text)
    }

    // Update our snapshot
    this.currentSnapshot = this.createSnapshot(snapshot.text)
  }

  /**
   * Validate that a snapshot is still current (for gating)
   * Returns true if the provided snapshot matches current clipboard
   */
  validateSnapshot(snapshotId: string): boolean {
    if (!this.currentSnapshot) return false
    return this.currentSnapshot.id === snapshotId
  }

  /**
   * Attempt to write clipboard only if snapshot is still valid (snapshot gating)
   * Saves to shadow history for undo capability
   * Returns error if snapshot mismatch
   */
  writeClipboardGated(
    text: string,
    expectedSnapshotId: string
  ): { success: true } | { success: false; error: IpcError } {
    if (!this.validateSnapshot(expectedSnapshotId)) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH,
          message: 'Clipboard has changed since job started. Result not applied.',
          details: {
            expectedSnapshotId,
            currentSnapshotId: this.currentSnapshot?.id,
          },
        },
      }
    }

    // Save to history before overwriting (for undo)
    this.writeClipboard(text, true)
    return { success: true }
  }

  /**
   * Undo the last clipboard write by ClipMorph
   * Restores from shadow history
   */
  undo(): { success: true; snapshot: ClipboardSnapshot } | { success: false; error: IpcError } {
    if (this.shadowHistory.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CLIPBOARD_UNDO_EMPTY,
          message: 'No clipboard history to undo',
        },
      }
    }

    // Pop the most recent from shadow history
    const previousSnapshot = this.shadowHistory.shift()!

    // Restore the clipboard content
    this.writeClipboardWithSnapshot(previousSnapshot, false)

    return { success: true, snapshot: previousSnapshot }
  }

  /**
   * Get the shadow history (for UI display)
   */
  getShadowHistory(): ClipboardSnapshot[] {
    return [...this.shadowHistory]
  }

  /**
   * Get the number of undo levels available
   */
  getUndoCount(): number {
    return this.shadowHistory.length
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.shadowHistory.length > 0
  }

  /**
   * Check if currently watching
   */
  isCurrentlyWatching(): boolean {
    return this.isWatching
  }

  /**
   * Set poll interval (for testing)
   */
  setPollInterval(ms: number): void {
    this.pollIntervalMs = ms
    if (this.isWatching) {
      this.stopWatching()
      this.startWatching()
    }
  }

  /**
   * Clear state (for testing)
   */
  clear(): void {
    this.stopWatching()
    this.currentSnapshot = null
    this.selfWrittenHashes.clear()
    this.shadowHistory = []
  }
}

// Singleton instance
export const clipboardService = new ClipboardService()
