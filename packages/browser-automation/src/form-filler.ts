/**
 * Form Filler Module
 * Maps resume data to form fields and generates fill actions
 */

import type { PageSnapshot, ElementRef, AutomationAction } from './types'
import {
  ParsedResume,
  identifyFieldType,
  getResumeValueForField,
  FieldType,
} from './resume-parser'

/**
 * Field mapping result
 */
export interface FieldMapping {
  element: ElementRef
  fieldType: FieldType
  value: string
  confidence: number
}

/**
 * Form fill result
 */
export interface FormFillResult {
  mappings: FieldMapping[]
  actions: AutomationAction[]
  unmappedFields: ElementRef[]
  coverage: number // Percentage of form fields that could be filled
}

/**
 * Analyze a form field and determine its type
 */
function analyzeField(field: ElementRef): FieldType {
  return identifyFieldType(field.name, field.placeholder, field.text)
}

/**
 * Calculate confidence score for a field mapping
 */
function calculateConfidence(field: ElementRef, fieldType: FieldType): number {
  let confidence = 0.5 // Base confidence

  // Higher confidence if multiple indicators match
  const indicators = [field.name, field.placeholder, field.text].filter(Boolean)
  const matchingIndicators = indicators.filter((indicator) => {
    const type = identifyFieldType(indicator)
    return type === fieldType
  })

  confidence += (matchingIndicators.length / Math.max(indicators.length, 1)) * 0.3

  // Higher confidence for common field types
  const commonTypes: FieldType[] = ['email', 'phone', 'firstName', 'lastName']
  if (commonTypes.includes(fieldType)) {
    confidence += 0.2
  }

  return Math.min(confidence, 1)
}

/**
 * Map form fields to resume data
 */
export function mapFormFields(
  snapshot: PageSnapshot,
  resume: ParsedResume
): FieldMapping[] {
  const mappings: FieldMapping[] = []

  for (const field of snapshot.formFields) {
    // Skip non-text fields (checkboxes, radios, etc.)
    if (field.role === 'checkbox' || field.role === 'radio') {
      continue
    }

    // Skip fields that already have values
    if (field.value && field.value.trim().length > 0) {
      continue
    }

    // Analyze the field type
    const fieldType = analyzeField(field)
    if (fieldType === 'unknown') {
      continue
    }

    // Get the corresponding value from resume
    const value = getResumeValueForField(resume, fieldType)
    if (!value) {
      continue
    }

    // Calculate confidence
    const confidence = calculateConfidence(field, fieldType)

    mappings.push({
      element: field,
      fieldType,
      value,
      confidence,
    })
  }

  return mappings
}

/**
 * Generate fill actions from field mappings
 */
export function generateFillActions(mappings: FieldMapping[]): AutomationAction[] {
  return mappings
    .filter((m) => m.confidence >= 0.5) // Only fill high-confidence fields
    .map((mapping) => ({
      type: 'fill' as const,
      ref: mapping.element.ref,
      value: mapping.value,
      description: `Fill ${mapping.fieldType}: ${mapping.value.substring(0, 20)}${mapping.value.length > 20 ? '...' : ''}`,
    }))
}

/**
 * Analyze a form and generate fill actions
 */
export function analyzeAndFillForm(
  snapshot: PageSnapshot,
  resume: ParsedResume
): FormFillResult {
  const mappings = mapFormFields(snapshot, resume)
  const actions = generateFillActions(mappings)

  // Find unmapped fields
  const mappedRefs = new Set(mappings.map((m) => m.element.ref))
  const unmappedFields = snapshot.formFields.filter(
    (f) =>
      !mappedRefs.has(f.ref) &&
      f.role !== 'checkbox' &&
      f.role !== 'radio' &&
      (!f.value || f.value.trim().length === 0)
  )

  // Calculate coverage
  const totalFillableFields = snapshot.formFields.filter(
    (f) =>
      f.role !== 'checkbox' &&
      f.role !== 'radio' &&
      (!f.value || f.value.trim().length === 0)
  ).length

  const coverage = totalFillableFields > 0 ? mappings.length / totalFillableFields : 0

  return {
    mappings,
    actions,
    unmappedFields,
    coverage,
  }
}

/**
 * Check if a snapshot appears to be an application form
 */
export function isApplicationForm(snapshot: PageSnapshot): boolean {
  // Check for common application form indicators
  const indicators = [
    'apply',
    'application',
    'resume',
    'cv',
    'job',
    'career',
    'employment',
    'candidate',
  ]

  const pageText = [snapshot.title, snapshot.url].join(' ').toLowerCase()

  // Check if page contains application-related text
  const hasIndicator = indicators.some((i) => pageText.includes(i))

  // Check if there are enough form fields
  const hasFormFields = snapshot.formFields.length >= 3

  // Check for common field types
  const fieldTypes = snapshot.formFields.map((f) => analyzeField(f))
  const hasCommonFields =
    fieldTypes.includes('email') ||
    fieldTypes.includes('phone') ||
    fieldTypes.includes('firstName') ||
    fieldTypes.includes('lastName')

  return hasIndicator || (hasFormFields && hasCommonFields)
}
