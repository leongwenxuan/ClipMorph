import { describe, it, expect } from 'vitest'
import {
  IpcChannels,
  ErrorCodes,
  EventTypes,
  createSuccessResponse,
  createErrorResponse,
  createEvent,
  isIpcSuccess,
  isIpcError,
  generateRequestId,
} from '../index'

describe('IPC Contracts', () => {
  describe('IpcChannels', () => {
    it('should follow clipmorph:<domain>:<action> naming convention', () => {
      // All channels should start with 'clipmorph:'
      // Events bus is special: clipmorph:events (no action part)
      Object.entries(IpcChannels).forEach(([key, channel]) => {
        if (key === 'EVENTS') {
          expect(channel).toBe('clipmorph:events')
        } else {
          expect(channel).toMatch(/^clipmorph:[a-z]+:[a-z]+$/)
        }
      })
    })

    it('should have unique channel names', () => {
      const channels = Object.values(IpcChannels)
      const uniqueChannels = new Set(channels)
      expect(uniqueChannels.size).toBe(channels.length)
    })

    it('should have STATUS_GET channel', () => {
      expect(IpcChannels.STATUS_GET).toBe('clipmorph:status:get')
    })

    it('should have EVENTS channel', () => {
      expect(IpcChannels.EVENTS).toBe('clipmorph:events')
    })
  })

  describe('Response Helpers', () => {
    describe('createSuccessResponse', () => {
      it('should create a valid success response with data', () => {
        const data = { status: 'idle' }
        const response = createSuccessResponse(data)

        expect(response.ok).toBe(true)
        expect(response.data).toEqual(data)
        expect(response.requestId).toBeDefined()
        expect(typeof response.requestId).toBe('string')
      })

      it('should use provided requestId', () => {
        const requestId = 'test-request-123'
        const response = createSuccessResponse({ foo: 'bar' }, requestId)

        expect(response.requestId).toBe(requestId)
      })
    })

    describe('createErrorResponse', () => {
      it('should create a valid error response', () => {
        const response = createErrorResponse(
          ErrorCodes.CLIPBOARD_READ_FAILED,
          'Failed to read clipboard'
        )

        expect(response.ok).toBe(false)
        expect(response.error.code).toBe('CLIPBOARD_READ_FAILED')
        expect(response.error.message).toBe('Failed to read clipboard')
        expect(response.requestId).toBeDefined()
      })

      it('should include details when provided', () => {
        const details = { reason: 'permission denied' }
        const response = createErrorResponse(
          ErrorCodes.PERMISSION_DENIED,
          'Access denied',
          details
        )

        expect(response.error.details).toEqual(details)
      })

      it('should use provided requestId', () => {
        const requestId = 'error-request-456'
        const response = createErrorResponse(
          ErrorCodes.UNKNOWN_ERROR,
          'Something went wrong',
          undefined,
          requestId
        )

        expect(response.requestId).toBe(requestId)
      })
    })

    describe('isIpcSuccess / isIpcError', () => {
      it('should correctly identify success responses', () => {
        const success = createSuccessResponse({ data: 'test' })
        const error = createErrorResponse(ErrorCodes.UNKNOWN_ERROR, 'error')

        expect(isIpcSuccess(success)).toBe(true)
        expect(isIpcSuccess(error)).toBe(false)
      })

      it('should correctly identify error responses', () => {
        const success = createSuccessResponse({ data: 'test' })
        const error = createErrorResponse(ErrorCodes.UNKNOWN_ERROR, 'error')

        expect(isIpcError(error)).toBe(true)
        expect(isIpcError(success)).toBe(false)
      })
    })

    describe('generateRequestId', () => {
      it('should generate unique IDs', () => {
        const ids = new Set<string>()
        for (let i = 0; i < 100; i++) {
          ids.add(generateRequestId())
        }
        expect(ids.size).toBe(100)
      })

      it('should include timestamp component', () => {
        const before = Date.now()
        const id = generateRequestId()
        const after = Date.now()

        const timestamp = parseInt(id.split('-')[0], 10)
        expect(timestamp).toBeGreaterThanOrEqual(before)
        expect(timestamp).toBeLessThanOrEqual(after)
      })
    })
  })

  describe('Event Helpers', () => {
    describe('createEvent', () => {
      it('should create a valid event with type only', () => {
        const event = createEvent(EventTypes.STATUS_CHANGED)

        expect(event.type).toBe('status-changed')
        expect(event.timestamp).toBeDefined()
        expect(typeof event.timestamp).toBe('number')
      })

      it('should include payload when provided', () => {
        const payload = { status: 'listening', previousStatus: 'idle' }
        const event = createEvent(EventTypes.STATUS_CHANGED, payload)

        expect(event.payload).toEqual(payload)
      })

      it('should include jobId when provided', () => {
        const event = createEvent(EventTypes.JOB_COMPLETED, { result: 'success' }, 'job-123')

        expect(event.jobId).toBe('job-123')
      })
    })
  })

  describe('EventTypes', () => {
    it('should have STATUS_CHANGED event type', () => {
      expect(EventTypes.STATUS_CHANGED).toBe('status-changed')
    })

    it('should have job-related event types', () => {
      expect(EventTypes.JOB_CREATED).toBe('job-created')
      expect(EventTypes.JOB_UPDATED).toBe('job-updated')
      expect(EventTypes.JOB_COMPLETED).toBe('job-completed')
      expect(EventTypes.JOB_FAILED).toBe('job-failed')
      expect(EventTypes.JOB_CANCELLED).toBe('job-cancelled')
      expect(EventTypes.JOB_NEEDS_INPUT).toBe('job-needs-input')
    })
  })

  describe('ErrorCodes', () => {
    it('should have clipboard-related error codes', () => {
      expect(ErrorCodes.CLIPBOARD_READ_FAILED).toBe('CLIPBOARD_READ_FAILED')
      expect(ErrorCodes.CLIPBOARD_WRITE_FAILED).toBe('CLIPBOARD_WRITE_FAILED')
      expect(ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH).toBe('CLIPBOARD_SNAPSHOT_MISMATCH')
    })

    it('should have automation-related error codes', () => {
      expect(ErrorCodes.AUTOMATION_NEEDS_INPUT).toBe('AUTOMATION_NEEDS_INPUT')
      expect(ErrorCodes.AUTOMATION_BROWSER_ERROR).toBe('AUTOMATION_BROWSER_ERROR')
    })
  })
})
