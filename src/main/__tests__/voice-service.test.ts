/**
 * VoiceService Tests
 *
 * Tests for push-to-talk hotkey and voice capture functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { globalShortcut } from 'electron'
import { voiceService } from '../services/voice-service'
import { EventTypes, ClipMorphEvent } from '../../../packages/contracts/src'

// Mock Electron's globalShortcut
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-clipmorph'),
  },
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    isRegistered: vi.fn(),
  },
  systemPreferences: {
    getMediaAccessStatus: vi.fn().mockReturnValue('granted'),
  },
}))

// Mock permission service
vi.mock('../services/permission-service', () => ({
  checkMicrophonePermission: vi.fn().mockReturnValue({
    type: 'microphone',
    status: 'granted',
    canRequest: false,
  }),
}))

// Mock store service
vi.mock('../services/store-service', () => ({
  storeService: {
    addTranscript: vi.fn(),
    getTranscripts: vi.fn().mockReturnValue([]),
    clearTranscripts: vi.fn(),
    getLastTranscript: vi.fn().mockReturnValue(null),
  },
}))

describe('VoiceService', () => {
  let emittedEvents: ClipMorphEvent[]
  let statusChanges: string[]

  beforeEach(() => {
    emittedEvents = []
    statusChanges = []

    // Set up event emitter mock
    voiceService.setEventEmitter((event) => {
      emittedEvents.push(event)
    })

    // Set up status callback mock
    voiceService.setStatusCallback((status) => {
      statusChanges.push(status)
    })

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    voiceService.cleanup()
  })

  describe('Hotkey Registration', () => {
    it('should register the default push-to-talk hotkey', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      const result = voiceService.registerHotkey()

      expect(result).toBe(true)
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+V',
        expect.any(Function)
      )
    })

    it('should register a custom hotkey', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      const result = voiceService.registerHotkey('CommandOrControl+Shift+M')

      expect(result).toBe(true)
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+M',
        expect.any(Function)
      )
    })

    it('should return false when registration fails', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(false)

      const result = voiceService.registerHotkey()

      expect(result).toBe(false)
    })

    it('should unregister previous hotkey before registering new one', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      voiceService.registerHotkey()

      // Reset to track the unregister call from the second registration
      vi.mocked(globalShortcut.unregister).mockClear()

      voiceService.registerHotkey('CommandOrControl+Shift+M')

      // The first hotkey should have been unregistered
      expect(globalShortcut.unregister).toHaveBeenCalled()
    })

    it('should unregister hotkey on cleanup', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      voiceService.registerHotkey()
      voiceService.cleanup()

      expect(globalShortcut.unregister).toHaveBeenCalled()
    })
  })

  describe('Voice Capture State', () => {
    it('should return initial state correctly', () => {
      const state = voiceService.getState()

      expect(state.isCapturing).toBe(false)
      expect(state.canEnable).toBe(true) // mocked permission is granted
    })

    it('should start capture when start() is called', () => {
      const result = voiceService.start()

      expect(result).toBe(true)
      expect(voiceService.isCapturing()).toBe(true)
    })

    it('should emit VOICE_STARTED event when capture starts', () => {
      voiceService.start()

      expect(emittedEvents).toContainEqual(
        expect.objectContaining({ type: EventTypes.VOICE_STARTED })
      )
    })

    it('should update app status to listening when capture starts', () => {
      voiceService.start()

      expect(statusChanges).toContain('listening')
    })

    it('should stop capture when stop() is called', () => {
      voiceService.start()
      voiceService.stop()

      expect(voiceService.isCapturing()).toBe(false)
    })

    it('should emit VOICE_STOPPED event when capture stops', () => {
      voiceService.start()
      voiceService.stop()

      expect(emittedEvents).toContainEqual(
        expect.objectContaining({ type: EventTypes.VOICE_STOPPED })
      )
    })
  })

  describe('Permission Handling', () => {
    it('should check microphone permission before enabling', () => {
      const canEnable = voiceService.canEnable()
      expect(canEnable).toBe(true)
    })

    it('should report canEnable in state', () => {
      const state = voiceService.getState()
      expect(state.canEnable).toBe(true)
    })
  })

  describe('Hotkey State', () => {
    it('should track hotkey registration status', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      expect(voiceService.getState().isHotkeyRegistered).toBe(false)

      voiceService.registerHotkey()

      expect(voiceService.getState().isHotkeyRegistered).toBe(true)
    })

    it('should return current hotkey', () => {
      vi.mocked(globalShortcut.register).mockReturnValue(true)

      voiceService.registerHotkey('CommandOrControl+Shift+M')

      expect(voiceService.getHotkey()).toBe('CommandOrControl+Shift+M')
    })
  })

  describe('Short Capture Handling', () => {
    it('should ignore captures shorter than 200ms', async () => {
      voiceService.start()

      // Immediately stop (< 200ms)
      voiceService.stop()

      // Should return to idle, not processing
      // Give time for async operations
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(statusChanges).toContain('idle')
      expect(voiceService.isCapturing()).toBe(false)
    })
  })
})
