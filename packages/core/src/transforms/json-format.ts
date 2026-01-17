/**
 * JSON Format Transforms
 *
 * Pretty print and minify JSON.
 */

export interface JsonFormatResult {
  original: string
  formatted: string
  isValidJson: boolean
  error?: string
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/**
 * Pretty print JSON with indentation
 */
export function jsonPretty(input: string, indent = 2): JsonFormatResult {
  const trimmed = input.trim()

  try {
    const parsed = JSON.parse(trimmed)
    const formatted = JSON.stringify(parsed, null, indent)

    return {
      original: input,
      formatted,
      isValidJson: true,
    }
  } catch (error) {
    return {
      original: input,
      formatted: input,
      isValidJson: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

/**
 * Minify JSON (remove whitespace)
 */
export function jsonMinify(input: string): JsonFormatResult {
  const trimmed = input.trim()

  try {
    const parsed = JSON.parse(trimmed)
    const formatted = JSON.stringify(parsed)

    return {
      original: input,
      formatted,
      isValidJson: true,
    }
  } catch (error) {
    return {
      original: input,
      formatted: input,
      isValidJson: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}
