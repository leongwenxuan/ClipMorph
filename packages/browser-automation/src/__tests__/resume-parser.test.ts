/**
 * Resume Parser Tests
 */

import { describe, it, expect } from 'vitest'
import {
  parseResume,
  identifyFieldType,
  getResumeValueForField,
} from '../resume-parser'

describe('parseResume', () => {
  const sampleResume = `
John Doe
Software Engineer

Email: john.doe@example.com
Phone: (555) 123-4567
LinkedIn: https://linkedin.com/in/johndoe
GitHub: https://github.com/johndoe

123 Main Street
San Francisco, CA 94102

Summary:
Experienced software engineer with 5+ years of experience.
`

  it('should extract email from resume', () => {
    const result = parseResume(sampleResume)
    expect(result.email).toBe('john.doe@example.com')
  })

  it('should extract phone number', () => {
    const result = parseResume(sampleResume)
    expect(result.phone).toBeDefined()
    expect(result.phone).toContain('555')
  })

  it('should extract name', () => {
    const result = parseResume(sampleResume)
    expect(result.name).toBe('John Doe')
    expect(result.firstName).toBe('John')
    expect(result.lastName).toBe('Doe')
  })

  it('should extract LinkedIn URL', () => {
    const result = parseResume(sampleResume)
    expect(result.linkedIn).toContain('linkedin.com/in/johndoe')
  })

  it('should extract GitHub URL', () => {
    const result = parseResume(sampleResume)
    expect(result.github).toContain('github.com/johndoe')
  })

  it('should extract city and state', () => {
    const result = parseResume(sampleResume)
    expect(result.city).toBe('San Francisco')
    expect(result.state).toBe('CA')
  })

  it('should extract ZIP code', () => {
    const result = parseResume(sampleResume)
    expect(result.zipCode).toBe('94102')
  })

  it('should preserve raw text', () => {
    const result = parseResume(sampleResume)
    expect(result.rawText).toBe(sampleResume)
  })

  it('should handle minimal resume', () => {
    const minimal = 'Jane Smith\njane@email.com'
    const result = parseResume(minimal)
    expect(result.name).toBe('Jane Smith')
    expect(result.email).toBe('jane@email.com')
  })

  it('should handle resume without name', () => {
    const noName = 'test@email.com\n555-123-4567'
    const result = parseResume(noName)
    expect(result.email).toBe('test@email.com')
    expect(result.name).toBeUndefined()
  })
})

describe('identifyFieldType', () => {
  it('should identify email field', () => {
    expect(identifyFieldType('Email', undefined, 'email')).toBe('email')
    expect(identifyFieldType('E-mail Address', undefined, undefined)).toBe('email')
  })

  it('should identify phone field', () => {
    expect(identifyFieldType('Phone Number', undefined, 'phone')).toBe('phone')
    expect(identifyFieldType('Mobile', undefined, undefined)).toBe('phone')
    expect(identifyFieldType('Cell Phone', undefined, undefined)).toBe('phone')
  })

  it('should identify name fields', () => {
    expect(identifyFieldType('First Name', undefined, 'firstName')).toBe('firstName')
    expect(identifyFieldType('Last Name', undefined, 'lastName')).toBe('lastName')
    expect(identifyFieldType('Full Name', undefined, 'name')).toBe('name')
  })

  it('should identify address fields', () => {
    expect(identifyFieldType('City', undefined, 'city')).toBe('city')
    expect(identifyFieldType('State', undefined, 'state')).toBe('state')
    expect(identifyFieldType('ZIP Code', undefined, 'zip')).toBe('zipCode')
  })

  it('should identify social links', () => {
    expect(identifyFieldType('LinkedIn Profile', undefined, 'linkedin')).toBe('linkedIn')
    expect(identifyFieldType('GitHub URL', undefined, 'github')).toBe('github')
    expect(identifyFieldType('Personal Website', undefined, 'website')).toBe('website')
  })

  it('should return unknown for unrecognized fields', () => {
    expect(identifyFieldType('Favorite Color', undefined, 'color')).toBe('unknown')
    expect(identifyFieldType(undefined, undefined, undefined)).toBe('unknown')
  })
})

describe('getResumeValueForField', () => {
  const resume = {
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '5551234567',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102',
    linkedIn: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe',
    rawText: '',
  }

  it('should return correct values for each field type', () => {
    expect(getResumeValueForField(resume, 'name')).toBe('John Doe')
    expect(getResumeValueForField(resume, 'firstName')).toBe('John')
    expect(getResumeValueForField(resume, 'lastName')).toBe('Doe')
    expect(getResumeValueForField(resume, 'email')).toBe('john@example.com')
    expect(getResumeValueForField(resume, 'phone')).toBe('5551234567')
    expect(getResumeValueForField(resume, 'city')).toBe('San Francisco')
    expect(getResumeValueForField(resume, 'state')).toBe('CA')
    expect(getResumeValueForField(resume, 'zipCode')).toBe('94102')
    expect(getResumeValueForField(resume, 'linkedIn')).toBe('https://linkedin.com/in/johndoe')
    expect(getResumeValueForField(resume, 'github')).toBe('https://github.com/johndoe')
  })

  it('should return undefined for unknown field type', () => {
    expect(getResumeValueForField(resume, 'unknown')).toBeUndefined()
  })

  it('should return undefined for missing values', () => {
    const partial = { rawText: '' }
    expect(getResumeValueForField(partial, 'email')).toBeUndefined()
  })
})
