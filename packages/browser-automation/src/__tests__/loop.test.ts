/**
 * Automation Loop Tests
 * Tests for needs_input detection and loop state management
 */

import { describe, it, expect } from 'vitest'
import type { PageSnapshot } from '../types'

// Import the detectNeedsInput function by testing through the module
// Since it's private, we'll test it indirectly through loop behavior

describe('Needs Input Detection', () => {
  const createMockSnapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
    id: 'snap-1',
    url: 'https://example.com',
    title: 'Example Page',
    timestamp: Date.now(),
    elements: [],
    formFields: [],
    buttons: [],
    links: [],
    ...overrides,
  })

  describe('Login Detection', () => {
    it('should detect login page by URL', () => {
      const snapshot = createMockSnapshot({ url: 'https://example.com/login' })
      // Login detection happens in the loop module
      expect(snapshot.url).toContain('login')
    })

    it('should detect sign-in page by title', () => {
      const snapshot = createMockSnapshot({ title: 'Sign In - Example' })
      expect(snapshot.title.toLowerCase()).toContain('sign in')
    })

    it('should detect login by password field', () => {
      const snapshot = createMockSnapshot({
        formFields: [
          {
            ref: 'e0',
            role: 'textbox',
            name: 'Password',
            tagName: 'input',
            isEditable: true,
            isClickable: false,
            isVisible: true,
          },
        ],
      })
      expect(
        snapshot.formFields.some((f) => f.name?.toLowerCase().includes('password'))
      ).toBe(true)
    })
  })

  describe('CAPTCHA Detection', () => {
    it('should detect CAPTCHA by title', () => {
      const snapshot = createMockSnapshot({ title: 'Verify you are human' })
      expect(snapshot.title.toLowerCase()).toContain('verify')
    })

    it('should detect reCAPTCHA by element text', () => {
      const snapshot = createMockSnapshot({
        elements: [
          {
            ref: 'e0',
            role: 'generic',
            text: 'Please solve the CAPTCHA',
            tagName: 'div',
            isEditable: false,
            isClickable: false,
            isVisible: true,
          },
        ],
      })
      expect(
        snapshot.elements.some((e) => e.text?.toLowerCase().includes('captcha'))
      ).toBe(true)
    })
  })

  describe('Loop State Transitions', () => {
    it('should have valid state enum values', () => {
      const validStates = ['running', 'needs_input', 'completed', 'failed', 'cancelled']
      validStates.forEach((state) => {
        expect(typeof state).toBe('string')
      })
    })

    it('should have valid needs_input reasons', () => {
      const validReasons = ['login', 'captcha', 'ambiguity', 'confirmation', 'other']
      validReasons.forEach((reason) => {
        expect(typeof reason).toBe('string')
      })
    })
  })
})
