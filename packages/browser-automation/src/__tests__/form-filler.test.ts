/**
 * Form Filler Tests
 */

import { describe, it, expect } from 'vitest'
import {
  mapFormFields,
  generateFillActions,
  analyzeAndFillForm,
  isApplicationForm,
} from '../form-filler'
import type { PageSnapshot, ElementRef } from '../types'
import type { ParsedResume } from '../resume-parser'

describe('mapFormFields', () => {
  const createMockSnapshot = (formFields: ElementRef[]): PageSnapshot => ({
    id: 'snap-1',
    url: 'https://example.com/apply',
    title: 'Job Application',
    timestamp: Date.now(),
    elements: formFields,
    formFields,
    buttons: [],
    links: [],
  })

  const mockResume: ParsedResume = {
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '5551234567',
    city: 'San Francisco',
    state: 'CA',
    rawText: '',
  }

  it('should map email field', () => {
    const snapshot = createMockSnapshot([
      {
        ref: 'e0',
        role: 'textbox',
        name: 'Email',
        tagName: 'input',
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
    ])

    const mappings = mapFormFields(snapshot, mockResume)
    expect(mappings).toHaveLength(1)
    expect(mappings[0].fieldType).toBe('email')
    expect(mappings[0].value).toBe('john@example.com')
  })

  it('should map multiple fields', () => {
    const snapshot = createMockSnapshot([
      {
        ref: 'e0',
        role: 'textbox',
        name: 'First Name',
        tagName: 'input',
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
      {
        ref: 'e1',
        role: 'textbox',
        name: 'Last Name',
        tagName: 'input',
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
      {
        ref: 'e2',
        role: 'textbox',
        name: 'Email',
        tagName: 'input',
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
    ])

    const mappings = mapFormFields(snapshot, mockResume)
    expect(mappings).toHaveLength(3)
    expect(mappings.map((m) => m.fieldType)).toContain('firstName')
    expect(mappings.map((m) => m.fieldType)).toContain('lastName')
    expect(mappings.map((m) => m.fieldType)).toContain('email')
  })

  it('should skip fields with existing values', () => {
    const snapshot = createMockSnapshot([
      {
        ref: 'e0',
        role: 'textbox',
        name: 'Email',
        tagName: 'input',
        value: 'existing@email.com', // Already filled
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
    ])

    const mappings = mapFormFields(snapshot, mockResume)
    expect(mappings).toHaveLength(0)
  })

  it('should skip checkbox and radio fields', () => {
    const snapshot = createMockSnapshot([
      {
        ref: 'e0',
        role: 'checkbox',
        name: 'Email',
        tagName: 'input',
        isEditable: true,
        isClickable: true,
        isVisible: true,
      },
    ])

    const mappings = mapFormFields(snapshot, mockResume)
    expect(mappings).toHaveLength(0)
  })

  it('should skip unknown field types', () => {
    const snapshot = createMockSnapshot([
      {
        ref: 'e0',
        role: 'textbox',
        name: 'Favorite Color',
        tagName: 'input',
        isEditable: true,
        isClickable: false,
        isVisible: true,
      },
    ])

    const mappings = mapFormFields(snapshot, mockResume)
    expect(mappings).toHaveLength(0)
  })
})

describe('generateFillActions', () => {
  it('should generate fill actions for high confidence mappings', () => {
    const mappings = [
      {
        element: { ref: 'e0' } as ElementRef,
        fieldType: 'email' as const,
        value: 'john@example.com',
        confidence: 0.8,
      },
      {
        element: { ref: 'e1' } as ElementRef,
        fieldType: 'phone' as const,
        value: '5551234567',
        confidence: 0.7,
      },
    ]

    const actions = generateFillActions(mappings)
    expect(actions).toHaveLength(2)
    expect(actions[0].type).toBe('fill')
    expect(actions[0].ref).toBe('e0')
    expect(actions[0].value).toBe('john@example.com')
  })

  it('should skip low confidence mappings', () => {
    const mappings = [
      {
        element: { ref: 'e0' } as ElementRef,
        fieldType: 'email' as const,
        value: 'john@example.com',
        confidence: 0.3, // Too low
      },
    ]

    const actions = generateFillActions(mappings)
    expect(actions).toHaveLength(0)
  })

  it('should include description in actions', () => {
    const mappings = [
      {
        element: { ref: 'e0' } as ElementRef,
        fieldType: 'email' as const,
        value: 'john@example.com',
        confidence: 0.8,
      },
    ]

    const actions = generateFillActions(mappings)
    expect(actions[0].description).toContain('email')
  })
})

describe('analyzeAndFillForm', () => {
  it('should calculate coverage correctly', () => {
    const snapshot: PageSnapshot = {
      id: 'snap-1',
      url: 'https://example.com/apply',
      title: 'Job Application',
      timestamp: Date.now(),
      elements: [],
      formFields: [
        {
          ref: 'e0',
          role: 'textbox',
          name: 'Email',
          tagName: 'input',
          isEditable: true,
          isClickable: false,
          isVisible: true,
        },
        {
          ref: 'e1',
          role: 'textbox',
          name: 'Unknown Field',
          tagName: 'input',
          isEditable: true,
          isClickable: false,
          isVisible: true,
        },
      ],
      buttons: [],
      links: [],
    }

    const resume: ParsedResume = {
      email: 'john@example.com',
      rawText: '',
    }

    const result = analyzeAndFillForm(snapshot, resume)
    expect(result.mappings).toHaveLength(1)
    expect(result.unmappedFields).toHaveLength(1)
    expect(result.coverage).toBe(0.5) // 1 out of 2 fields
  })
})

describe('isApplicationForm', () => {
  it('should detect application form by URL', () => {
    const snapshot: PageSnapshot = {
      id: 'snap-1',
      url: 'https://example.com/apply',
      title: 'Page',
      timestamp: Date.now(),
      elements: [],
      formFields: [],
      buttons: [],
      links: [],
    }

    expect(isApplicationForm(snapshot)).toBe(true)
  })

  it('should detect application form by title', () => {
    const snapshot: PageSnapshot = {
      id: 'snap-1',
      url: 'https://example.com',
      title: 'Job Application Form',
      timestamp: Date.now(),
      elements: [],
      formFields: [],
      buttons: [],
      links: [],
    }

    expect(isApplicationForm(snapshot)).toBe(true)
  })

  it('should detect application form by common fields', () => {
    const snapshot: PageSnapshot = {
      id: 'snap-1',
      url: 'https://example.com',
      title: 'Form',
      timestamp: Date.now(),
      elements: [],
      formFields: [
        {
          ref: 'e0',
          role: 'textbox',
          name: 'Email',
          tagName: 'input',
          isEditable: true,
          isClickable: false,
          isVisible: true,
        },
        {
          ref: 'e1',
          role: 'textbox',
          name: 'Phone',
          tagName: 'input',
          isEditable: true,
          isClickable: false,
          isVisible: true,
        },
        {
          ref: 'e2',
          role: 'textbox',
          name: 'First Name',
          tagName: 'input',
          isEditable: true,
          isClickable: false,
          isVisible: true,
        },
      ],
      buttons: [],
      links: [],
    }

    expect(isApplicationForm(snapshot)).toBe(true)
  })

  it('should not detect non-application pages', () => {
    const snapshot: PageSnapshot = {
      id: 'snap-1',
      url: 'https://example.com/about',
      title: 'About Us',
      timestamp: Date.now(),
      elements: [],
      formFields: [],
      buttons: [],
      links: [],
    }

    expect(isApplicationForm(snapshot)).toBe(false)
  })
})
