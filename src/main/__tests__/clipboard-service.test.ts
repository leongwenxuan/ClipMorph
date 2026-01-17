import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventTypes, ErrorCodes } from '../../../packages/contracts/src'

// Mock electron's clipboard
const mockClipboard = vi.hoisted(() => ({
  readText: vi.fn(),
  writeText: vi.fn(),
  readHTML: vi.fn(),
  readRTF: vi.fn(),
  write: vi.fn(),
}))

vi.mock('electron', () => ({
  clipboard: mockClipboard,
}))

// Import after mocking
import { ClipboardService } from '../services/clipboard-service'

describe('ClipboardService', () => {
  let clipboardService: ClipboardService
  let emittedEvents: Array<{ type: string; payload: unknown }>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    mockClipboard.readText.mockReturnValue('initial text')
    mockClipboard.readHTML.mockReturnValue('')
    mockClipboard.readRTF.mockReturnValue('')

    clipboardService = new ClipboardService()
    emittedEvents = []
    clipboardService.setEventEmitter((event) => {
      emittedEvents.push({
        type: event.type,
        payload: event.payload,
      })
    })
  })

  afterEach(() => {
    clipboardService.clear()
    vi.useRealTimers()
  })

  describe('startWatching / stopWatching', () => {
    it('should start watching and take initial snapshot', () => {
      clipboardService.startWatching()

      expect(clipboardService.isCurrentlyWatching()).toBe(true)
      expect(clipboardService.getCurrentSnapshot()).toBeDefined()
      expect(clipboardService.getCurrentSnapshot()?.text).toBe('initial text')
    })

    it('should stop watching', () => {
      clipboardService.startWatching()
      clipboardService.stopWatching()

      expect(clipboardService.isCurrentlyWatching()).toBe(false)
    })

    it('should not start twice', () => {
      clipboardService.startWatching()
      clipboardService.startWatching()

      expect(clipboardService.isCurrentlyWatching()).toBe(true)
    })
  })

  describe('clipboard change detection', () => {
    it('should emit CLIPBOARD_CHANGED when content changes', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()

      // Change clipboard content
      mockClipboard.readText.mockReturnValue('new text')

      // Advance timers to trigger poll
      vi.advanceTimersByTime(100)

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].type).toBe(EventTypes.CLIPBOARD_CHANGED)
      const payload = emittedEvents[0].payload as { snapshot: { text: string } }
      expect(payload.snapshot.text).toBe('new text')
    })

    it('should not emit when content is the same', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()

      // Keep same content
      mockClipboard.readText.mockReturnValue('initial text')

      // Advance timers
      vi.advanceTimersByTime(100)

      expect(emittedEvents).toHaveLength(0)
    })

    it('should include previous snapshot in event', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()

      // Change clipboard content
      mockClipboard.readText.mockReturnValue('new text')
      vi.advanceTimersByTime(100)

      const payload = emittedEvents[0].payload as {
        snapshot: { text: string }
        previousSnapshot: { text: string }
      }
      expect(payload.previousSnapshot?.text).toBe('initial text')
    })
  })

  describe('self-trigger immunity', () => {
    it('should not emit event for self-written content', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()

      // Write to clipboard ourselves
      clipboardService.writeClipboard('self-written')

      // Simulate clipboard read returning our written content
      mockClipboard.readText.mockReturnValue('self-written')

      // Advance timers
      vi.advanceTimersByTime(100)

      // Should not emit event for self-write
      expect(emittedEvents).toHaveLength(0)
    })

    it('should emit event after self-write immunity expires', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()

      // Write to clipboard ourselves
      clipboardService.writeClipboard('self-written')
      mockClipboard.readText.mockReturnValue('self-written')

      // Advance past immunity expiry (2000ms)
      vi.advanceTimersByTime(2100)

      // Now change to same content again - should emit since immunity expired
      mockClipboard.readText.mockReturnValue('external change')
      vi.advanceTimersByTime(100)

      expect(emittedEvents.length).toBeGreaterThan(0)
    })
  })

  describe('readClipboard', () => {
    it('should return current clipboard text', () => {
      mockClipboard.readText.mockReturnValue('test content')

      const text = clipboardService.readClipboard()

      expect(text).toBe('test content')
      expect(mockClipboard.readText).toHaveBeenCalled()
    })
  })

  describe('writeClipboard', () => {
    it('should write text to clipboard', () => {
      clipboardService.writeClipboard('new content')

      expect(mockClipboard.writeText).toHaveBeenCalledWith('new content')
    })

    it('should update current snapshot after write', () => {
      clipboardService.startWatching()
      clipboardService.writeClipboard('written content')

      expect(clipboardService.getCurrentSnapshot()?.text).toBe('written content')
    })
  })

  describe('snapshot gating', () => {
    it('should allow write when snapshot is valid', () => {
      clipboardService.startWatching()
      const snapshot = clipboardService.getCurrentSnapshot()

      const result = clipboardService.writeClipboardGated('new text', snapshot!.id)

      expect(result.success).toBe(true)
      expect(mockClipboard.writeText).toHaveBeenCalledWith('new text')
    })

    it('should reject write when snapshot is invalid', () => {
      clipboardService.startWatching()

      const result = clipboardService.writeClipboardGated('new text', 'invalid-snapshot-id')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH)
      }
      expect(mockClipboard.writeText).not.toHaveBeenCalled()
    })

    it('should reject write when clipboard changed between snapshot and write', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()
      const originalSnapshot = clipboardService.getCurrentSnapshot()

      // Simulate external clipboard change
      mockClipboard.readText.mockReturnValue('external change')
      vi.advanceTimersByTime(100)

      // Try to write with old snapshot
      const result = clipboardService.writeClipboardGated('new text', originalSnapshot!.id)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH)
      }
    })
  })

  describe('validateSnapshot', () => {
    it('should return true for current snapshot', () => {
      clipboardService.startWatching()
      const snapshot = clipboardService.getCurrentSnapshot()

      expect(clipboardService.validateSnapshot(snapshot!.id)).toBe(true)
    })

    it('should return false for old snapshot', () => {
      clipboardService.setPollInterval(100)
      clipboardService.startWatching()
      const oldSnapshot = clipboardService.getCurrentSnapshot()

      // Change clipboard
      mockClipboard.readText.mockReturnValue('changed')
      vi.advanceTimersByTime(100)

      expect(clipboardService.validateSnapshot(oldSnapshot!.id)).toBe(false)
    })

    it('should return false when no snapshot exists', () => {
      expect(clipboardService.validateSnapshot('any-id')).toBe(false)
    })
  })

  describe('getCurrentSnapshot', () => {
    it('should return null when not watching', () => {
      expect(clipboardService.getCurrentSnapshot()).toBeNull()
    })

    it('should return snapshot when watching', () => {
      clipboardService.startWatching()

      const snapshot = clipboardService.getCurrentSnapshot()

      expect(snapshot).toBeDefined()
      expect(snapshot?.id).toBeDefined()
      expect(snapshot?.text).toBe('initial text')
      expect(snapshot?.timestamp).toBeDefined()
      expect(snapshot?.hash).toBeDefined()
    })
  })

  describe('shadow history and undo', () => {
    it('should save to shadow history when writing with saveToHistory=true', () => {
      clipboardService.startWatching()
      expect(clipboardService.getUndoCount()).toBe(0)

      clipboardService.writeClipboard('new text', true)

      expect(clipboardService.getUndoCount()).toBe(1)
      expect(clipboardService.canUndo()).toBe(true)
    })

    it('should not save to shadow history when saveToHistory=false', () => {
      clipboardService.startWatching()

      clipboardService.writeClipboard('new text', false)

      expect(clipboardService.getUndoCount()).toBe(0)
      expect(clipboardService.canUndo()).toBe(false)
    })

    it('should maintain 2-deep shadow history', () => {
      clipboardService.startWatching()

      // Write 3 times
      clipboardService.writeClipboard('text 1', true)
      mockClipboard.readText.mockReturnValue('text 1')

      clipboardService.writeClipboard('text 2', true)
      mockClipboard.readText.mockReturnValue('text 2')

      clipboardService.writeClipboard('text 3', true)
      mockClipboard.readText.mockReturnValue('text 3')

      // Should only have 2 in history (2-deep)
      expect(clipboardService.getUndoCount()).toBe(2)
    })

    it('should undo to previous clipboard content', () => {
      clipboardService.startWatching()
      const originalSnapshot = clipboardService.getCurrentSnapshot()

      clipboardService.writeClipboard('new text', true)

      const result = clipboardService.undo()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.snapshot.text).toBe('initial text')
      }
    })

    it('should return error when no undo history', () => {
      clipboardService.startWatching()

      const result = clipboardService.undo()

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCodes.CLIPBOARD_UNDO_EMPTY)
      }
    })

    it('should support multiple undos up to history depth', () => {
      clipboardService.startWatching()

      clipboardService.writeClipboard('text 1', true)
      mockClipboard.readText.mockReturnValue('text 1')

      clipboardService.writeClipboard('text 2', true)
      mockClipboard.readText.mockReturnValue('text 2')

      // First undo
      const result1 = clipboardService.undo()
      expect(result1.success).toBe(true)
      if (result1.success) {
        expect(result1.snapshot.text).toBe('text 1')
      }

      // Second undo
      const result2 = clipboardService.undo()
      expect(result2.success).toBe(true)
      if (result2.success) {
        expect(result2.snapshot.text).toBe('initial text')
      }

      // Third undo should fail (only 2-deep)
      const result3 = clipboardService.undo()
      expect(result3.success).toBe(false)
    })

    it('should save to history on gated writes', () => {
      clipboardService.startWatching()
      const snapshot = clipboardService.getCurrentSnapshot()

      clipboardService.writeClipboardGated('gated write', snapshot!.id)

      expect(clipboardService.getUndoCount()).toBe(1)
    })

    it('should get shadow history', () => {
      clipboardService.startWatching()

      clipboardService.writeClipboard('text 1', true)
      mockClipboard.readText.mockReturnValue('text 1')

      clipboardService.writeClipboard('text 2', true)

      const history = clipboardService.getShadowHistory()

      expect(history).toHaveLength(2)
      expect(history[0].text).toBe('text 1')
      expect(history[1].text).toBe('initial text')
    })
  })

  describe('content type detection', () => {
    it('should detect HTML content', () => {
      mockClipboard.readHTML.mockReturnValue('<p>Hello</p>')
      clipboardService.startWatching()

      const snapshot = clipboardService.getCurrentSnapshot()

      expect(snapshot?.contentType).toBe('html')
      expect(snapshot?.html).toBe('<p>Hello</p>')
    })

    it('should detect RTF content', () => {
      mockClipboard.readRTF.mockReturnValue('{\\rtf1 Hello}')
      clipboardService.startWatching()

      const snapshot = clipboardService.getCurrentSnapshot()

      expect(snapshot?.contentType).toBe('rtf')
      expect(snapshot?.rtf).toBe('{\\rtf1 Hello}')
    })

    it('should default to text content type', () => {
      mockClipboard.readHTML.mockReturnValue('')
      mockClipboard.readRTF.mockReturnValue('')
      clipboardService.startWatching()

      const snapshot = clipboardService.getCurrentSnapshot()

      expect(snapshot?.contentType).toBe('text')
    })
  })
})
