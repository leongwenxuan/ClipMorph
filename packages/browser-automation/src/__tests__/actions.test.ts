/**
 * Actions Module Tests
 */

import { describe, it, expect } from 'vitest'
import { validateAction, validateActions } from '../actions'
import type { AutomationAction } from '../types'

describe('validateAction', () => {
  describe('click action', () => {
    it('should validate valid click action', () => {
      const action: AutomationAction = { type: 'click', ref: 'e0' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should reject click action without ref', () => {
      const action: AutomationAction = { type: 'click' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('ref')
    })
  })

  describe('fill action', () => {
    it('should validate valid fill action', () => {
      const action: AutomationAction = { type: 'fill', ref: 'e0', value: 'test' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should reject fill action without ref', () => {
      const action: AutomationAction = { type: 'fill', value: 'test' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })

    it('should reject fill action without value', () => {
      const action: AutomationAction = { type: 'fill', ref: 'e0' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })
  })

  describe('navigate action', () => {
    it('should validate valid navigate action', () => {
      const action: AutomationAction = { type: 'navigate', url: 'https://example.com' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should reject navigate action without url', () => {
      const action: AutomationAction = { type: 'navigate' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })
  })

  describe('press action', () => {
    it('should validate valid press action', () => {
      const action: AutomationAction = { type: 'press', key: 'Enter' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should validate press action with ref', () => {
      const action: AutomationAction = { type: 'press', key: 'Tab', ref: 'e0' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should reject press action without key', () => {
      const action: AutomationAction = { type: 'press' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })
  })

  describe('wait action', () => {
    it('should validate valid wait action', () => {
      const action: AutomationAction = { type: 'wait', duration: 1000 }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should reject wait action without duration', () => {
      const action: AutomationAction = { type: 'wait' }
      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })
  })

  describe('scroll action', () => {
    it('should validate scroll action without ref', () => {
      const action: AutomationAction = { type: 'scroll' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })

    it('should validate scroll action with ref', () => {
      const action: AutomationAction = { type: 'scroll', ref: 'e0' }
      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })
  })

  describe('unknown action', () => {
    it('should reject unknown action type', () => {
      const action = { type: 'unknown' } as AutomationAction
      const result = validateAction(action)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unknown action type')
    })
  })
})

describe('validateActions', () => {
  it('should validate list of valid actions', () => {
    const actions: AutomationAction[] = [
      { type: 'click', ref: 'e0' },
      { type: 'fill', ref: 'e1', value: 'test' },
      { type: 'press', key: 'Enter' },
    ]
    const result = validateActions(actions)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should collect all errors from invalid actions', () => {
    const actions: AutomationAction[] = [
      { type: 'click' }, // missing ref
      { type: 'fill', ref: 'e1' }, // missing value
      { type: 'navigate' }, // missing url
    ]
    const result = validateActions(actions)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(3)
  })

  it('should handle empty action list', () => {
    const result = validateActions([])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
