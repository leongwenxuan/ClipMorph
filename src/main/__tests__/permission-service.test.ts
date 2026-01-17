import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock must be hoisted - use vi.hoisted
const mockSystemPreferences = vi.hoisted(() => ({
  getMediaAccessStatus: vi.fn(),
  isTrustedAccessibilityClient: vi.fn(),
  askForMediaAccess: vi.fn(),
}))

vi.mock('electron', () => ({
  systemPreferences: mockSystemPreferences,
}))

// Import after mocking
import {
  checkMicrophonePermission,
  checkAccessibilityPermission,
  requestMicrophonePermission,
  getAllPermissions,
  canEnableVoice,
  canEnableHotkeys,
} from '../services/permission-service'

describe('Permission Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default to macOS
    Object.defineProperty(process, 'platform', { value: 'darwin' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkMicrophonePermission', () => {
    it('should return granted when microphone access is granted', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted')

      const result = checkMicrophonePermission()

      expect(result.type).toBe('microphone')
      expect(result.status).toBe('granted')
      expect(result.canRequest).toBe(false)
    })

    it('should return denied when microphone access is denied', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('denied')

      const result = checkMicrophonePermission()

      expect(result.status).toBe('denied')
      expect(result.canRequest).toBe(false)
    })

    it('should return not-determined with canRequest true when not determined', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('not-determined')

      const result = checkMicrophonePermission()

      expect(result.status).toBe('not-determined')
      expect(result.canRequest).toBe(true)
    })

    it('should return restricted when microphone access is restricted', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('restricted')

      const result = checkMicrophonePermission()

      expect(result.status).toBe('restricted')
      expect(result.canRequest).toBe(false)
    })
  })

  describe('checkAccessibilityPermission', () => {
    it('should return granted when accessibility is trusted', () => {
      mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true)

      const result = checkAccessibilityPermission()

      expect(result.type).toBe('accessibility')
      expect(result.status).toBe('granted')
      expect(result.canRequest).toBe(false)
    })

    it('should return denied when accessibility is not trusted', () => {
      mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false)

      const result = checkAccessibilityPermission()

      expect(result.status).toBe('denied')
      expect(result.canRequest).toBe(true)
    })
  })

  describe('requestMicrophonePermission', () => {
    it('should return true immediately if already granted', async () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted')

      const result = await requestMicrophonePermission()

      expect(result).toBe(true)
      expect(mockSystemPreferences.askForMediaAccess).not.toHaveBeenCalled()
    })

    it('should request permission if not determined', async () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('not-determined')
      mockSystemPreferences.askForMediaAccess.mockResolvedValue(true)

      const result = await requestMicrophonePermission()

      expect(result).toBe(true)
      expect(mockSystemPreferences.askForMediaAccess).toHaveBeenCalledWith('microphone')
    })

    it('should return false if already denied', async () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('denied')

      const result = await requestMicrophonePermission()

      expect(result).toBe(false)
      expect(mockSystemPreferences.askForMediaAccess).not.toHaveBeenCalled()
    })
  })

  describe('getAllPermissions', () => {
    it('should return all permission states', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted')
      mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true)

      const result = getAllPermissions()

      expect(result.microphone).toBe('granted')
      expect(result.accessibility).toBe('granted')
    })
  })

  describe('canEnableVoice', () => {
    it('should return true when microphone is granted', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted')

      expect(canEnableVoice()).toBe(true)
    })

    it('should return false when microphone is not granted', () => {
      mockSystemPreferences.getMediaAccessStatus.mockReturnValue('denied')

      expect(canEnableVoice()).toBe(false)
    })
  })

  describe('canEnableHotkeys', () => {
    it('should return true when accessibility is trusted', () => {
      mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true)

      expect(canEnableHotkeys()).toBe(true)
    })

    it('should return false when accessibility is not trusted', () => {
      mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false)

      expect(canEnableHotkeys()).toBe(false)
    })
  })
})
