/**
 * Resume Parser Module
 * Extracts structured data from resume text for form filling
 */

/**
 * Parsed resume data structure
 */
export interface ParsedResume {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  linkedIn?: string
  github?: string
  website?: string
  summary?: string
  rawText: string
}

/**
 * Email regex pattern
 */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/

/**
 * Phone regex patterns (various formats)
 */
const PHONE_PATTERNS = [
  /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
  /\+?[0-9]{1,3}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/,
]

/**
 * LinkedIn URL pattern
 */
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i

/**
 * GitHub URL pattern
 */
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i

/**
 * US State abbreviations
 */
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]

/**
 * ZIP code pattern
 */
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/

/**
 * Parse resume text and extract structured data
 */
export function parseResume(text: string): ParsedResume {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const result: ParsedResume = { rawText: text }

  // Extract email
  const emailMatch = text.match(EMAIL_REGEX)
  if (emailMatch) {
    result.email = emailMatch[0]
  }

  // Extract phone
  for (const pattern of PHONE_PATTERNS) {
    const phoneMatch = text.match(pattern)
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/[^\d+]/g, '')
      break
    }
  }

  // Extract LinkedIn
  const linkedInMatch = text.match(LINKEDIN_REGEX)
  if (linkedInMatch) {
    result.linkedIn = linkedInMatch[0]
  }

  // Extract GitHub
  const githubMatch = text.match(GITHUB_REGEX)
  if (githubMatch) {
    result.github = githubMatch[0]
  }

  // Extract name (usually first non-empty line that's not an email/phone/URL)
  for (const line of lines.slice(0, 5)) {
    // Skip if it looks like contact info
    if (
      EMAIL_REGEX.test(line) ||
      PHONE_PATTERNS.some((p) => p.test(line)) ||
      line.includes('http') ||
      line.includes('linkedin') ||
      line.includes('github')
    ) {
      continue
    }

    // Check if it looks like a name (2-4 words, mostly letters)
    const words = line.split(/\s+/)
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      words.every((w) => /^[A-Za-z'-]+$/.test(w))
    ) {
      result.name = line
      result.firstName = words[0]
      result.lastName = words[words.length - 1]
      break
    }
  }

  // Extract address components
  // Look for lines that might be addresses
  for (const line of lines) {
    // Check for ZIP code
    const zipMatch = line.match(ZIP_REGEX)
    if (zipMatch) {
      result.zipCode = zipMatch[0]

      // Try to extract city and state from the same line
      const beforeZip = line.substring(0, line.indexOf(zipMatch[0])).trim()
      const parts = beforeZip.split(',').map((p) => p.trim())

      if (parts.length >= 2) {
        result.city = parts[parts.length - 2]
        const statePart = parts[parts.length - 1]
        // Check if it's a state abbreviation
        const stateMatch = statePart.match(/\b([A-Z]{2})\b/)
        if (stateMatch && US_STATES.includes(stateMatch[1])) {
          result.state = stateMatch[1]
        }
      }
      break
    }
  }

  // Extract website (non-LinkedIn, non-GitHub URLs)
  const urlRegex = /https?:\/\/[^\s]+/gi
  const urls = text.match(urlRegex) || []
  for (const url of urls) {
    if (!url.includes('linkedin') && !url.includes('github')) {
      result.website = url
      break
    }
  }

  return result
}

/**
 * Field type for form matching
 */
export type FieldType =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'country'
  | 'linkedIn'
  | 'github'
  | 'website'
  | 'unknown'

/**
 * Patterns for identifying field types
 * Note: Order matters - more specific patterns should come first
 */
const FIELD_PATTERNS: Record<FieldType, RegExp[]> = {
  firstName: [/\bfirst\s*name\b/i, /\bgiven\s*name\b/i, /\bfirst\b/i],
  lastName: [/\blast\s*name\b/i, /\bsurname\b/i, /\bfamily\s*name\b/i, /\blast\b/i],
  name: [/\bfull\s*name\b/i, /\byour\s*name\b/i],
  email: [/\be-?mail\b/i, /\bemail\s*address\b/i],
  phone: [/\bphone\b/i, /\bmobile\b/i, /\bcell\b/i, /\btelephone\b/i, /\bcontact\s*number\b/i],
  address: [/\bstreet\s*address\b/i, /\baddress\b/i, /\bstreet\b/i],
  city: [/\bcity\b/i, /\btown\b/i],
  state: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i],
  zipCode: [/\bzip\b/i, /\bpostal\b/i, /\bpost\s*code\b/i],
  country: [/\bcountry\b/i, /\bnation\b/i],
  linkedIn: [/\blinkedin\b/i, /\blinked\s*in\b/i],
  github: [/\bgithub\b/i, /\bgit\s*hub\b/i],
  website: [/\bwebsite\b/i, /\bportfolio\b/i, /\burl\b/i, /\bweb\s*page\b/i],
  unknown: [],
}

/**
 * Identify the type of a form field based on its label/placeholder/name
 */
export function identifyFieldType(
  label?: string,
  placeholder?: string,
  name?: string
): FieldType {
  const searchText = [label, placeholder, name].filter(Boolean).join(' ').toLowerCase()

  for (const [type, patterns] of Object.entries(FIELD_PATTERNS)) {
    if (type === 'unknown') continue
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return type as FieldType
      }
    }
  }

  return 'unknown'
}

/**
 * Get the value from parsed resume for a field type
 */
export function getResumeValueForField(
  resume: ParsedResume,
  fieldType: FieldType
): string | undefined {
  switch (fieldType) {
    case 'name':
      return resume.name
    case 'firstName':
      return resume.firstName
    case 'lastName':
      return resume.lastName
    case 'email':
      return resume.email
    case 'phone':
      return resume.phone
    case 'address':
      return resume.address
    case 'city':
      return resume.city
    case 'state':
      return resume.state
    case 'zipCode':
      return resume.zipCode
    case 'country':
      return resume.country
    case 'linkedIn':
      return resume.linkedIn
    case 'github':
      return resume.github
    case 'website':
      return resume.website
    default:
      return undefined
  }
}
