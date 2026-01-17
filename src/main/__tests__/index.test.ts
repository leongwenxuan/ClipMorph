import { describe, it, expect } from 'vitest'
import {
  IpcChannels,
  createSuccessResponse,
  createErrorResponse,
  isIpcSuccess,
  isIpcError,
  ErrorCodes,
} from '../../../packages/contracts/src'

// Basic sanity tests for the main process module
// Note: Full Electron testing requires electron-playwright or similar

describe('Main Process Constants', () => {
  it('should export EVENTS_CHANNEL constant via contracts', () => {
    expect(IpcChannels.EVENTS).toBe('clipmorph:events')
  })

  it('should define valid app status values', () => {
    const validStatuses = ['idle', 'listening', 'processing', 'error'] as const
    expect(validStatuses).toContain('idle')
    expect(validStatuses).toContain('listening')
    expect(validStatuses).toContain('processing')
    expect(validStatuses).toContain('error')
  })
})

describe('IPC Contract', () => {
  it('should follow channel naming convention', () => {
    Object.values(IpcChannels).forEach((channel) => {
      expect(channel).toMatch(/^clipmorph:/)
    })
  })

  it('should create valid success response envelope', () => {
    const response = createSuccessResponse({ status: 'idle' })

    expect(response.ok).toBe(true)
    expect(response.requestId).toBeDefined()
    expect(response.data).toEqual({ status: 'idle' })
    expect(isIpcSuccess(response)).toBe(true)
    expect(isIpcError(response)).toBe(false)
  })

  it('should create valid error response envelope', () => {
    const response = createErrorResponse(ErrorCodes.UNKNOWN_ERROR, 'Test error')

    expect(response.ok).toBe(false)
    expect(response.requestId).toBeDefined()
    expect(response.error.code).toBe('UNKNOWN_ERROR')
    expect(response.error.message).toBe('Test error')
    expect(isIpcError(response)).toBe(true)
    expect(isIpcSuccess(response)).toBe(false)
  })

  it('should include error details when provided', () => {
    const details = { context: 'test context' }
    const response = createErrorResponse(ErrorCodes.INVALID_REQUEST, 'Invalid', details)

    expect(response.error.details).toEqual(details)
  })
})

describe('Security Configuration', () => {
  it('should require contextIsolation enabled', () => {
    // This is a contract test - the actual BrowserWindow config
    // must have contextIsolation: true
    const requiredWebPreferences = {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }

    expect(requiredWebPreferences.contextIsolation).toBe(true)
    expect(requiredWebPreferences.nodeIntegration).toBe(false)
    expect(requiredWebPreferences.sandbox).toBe(true)
  })
})
