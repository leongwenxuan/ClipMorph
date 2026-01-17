/**
 * Extract Transforms
 *
 * Extract emails and links from text.
 */

export interface ExtractResult {
  original: string
  extracted: string[]
  count: number
}

// Email regex pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// URL regex pattern (more permissive)
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

// Additional URL pattern for www links
const WWW_PATTERN = /www\.[^\s<>"{}|\\^`[\]]+/gi

/**
 * Extract email addresses from text
 */
export function extractEmails(input: string): ExtractResult {
  const matches = input.match(EMAIL_PATTERN) || []

  // Deduplicate and sort
  const unique = [...new Set(matches)].sort()

  return {
    original: input,
    extracted: unique,
    count: unique.length,
  }
}

/**
 * Extract URLs/links from text
 */
export function extractLinks(input: string): ExtractResult {
  const httpMatches = input.match(URL_PATTERN) || []
  const wwwMatches = (input.match(WWW_PATTERN) || []).map((m) => `https://${m}`)

  // Combine and deduplicate
  const all = [...httpMatches, ...wwwMatches]
  const unique = [...new Set(all)].sort()

  return {
    original: input,
    extracted: unique,
    count: unique.length,
  }
}

/**
 * Format extracted items as text (one per line)
 */
export function formatExtracted(result: ExtractResult): string {
  if (result.count === 0) {
    return ''
  }
  return result.extracted.join('\n')
}
