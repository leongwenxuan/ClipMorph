/**
 * JSON/YAML Conversion Transforms
 *
 * Convert between JSON and YAML formats.
 * Uses simple implementation without external YAML library.
 */

export interface ConversionResult {
  original: string
  converted: string
  success: boolean
  error?: string
}

/**
 * Simple YAML parser (handles basic cases)
 * For full YAML support, would need js-yaml library
 */
function parseSimpleYaml(yaml: string): unknown {
  const lines = yaml.split('\n')
  const result: Record<string, unknown> = {}
  let currentIndent = 0
  const stack: { obj: Record<string, unknown>; indent: number }[] = [{ obj: result, indent: -1 }]

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Calculate indent
    const indent = line.search(/\S/)
    const content = line.trim()

    // Check for key: value pattern
    const colonIndex = content.indexOf(':')
    if (colonIndex === -1) continue

    const key = content.slice(0, colonIndex).trim()
    const value = content.slice(colonIndex + 1).trim()

    // Pop stack until we find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].obj

    if (value === '' || value === '|' || value === '>') {
      // Nested object or multiline string (simplified)
      const newObj: Record<string, unknown> = {}
      parent[key] = newObj
      stack.push({ obj: newObj, indent })
    } else {
      // Simple value
      parent[key] = parseYamlValue(value)
    }

    currentIndent = indent
  }

  return result
}

/**
 * Parse a YAML value
 */
function parseYamlValue(value: string): unknown {
  // Boolean
  if (value === 'true' || value === 'True' || value === 'TRUE') return true
  if (value === 'false' || value === 'False' || value === 'FALSE') return false

  // Null
  if (value === 'null' || value === 'Null' || value === 'NULL' || value === '~') return null

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)

  // Quoted string
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  // Array (inline)
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  // Plain string
  return value
}

/**
 * Convert object to YAML string
 */
function toYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (obj === null) return 'null'
  if (typeof obj === 'boolean') return obj.toString()
  if (typeof obj === 'number') return obj.toString()
  if (typeof obj === 'string') {
    // Quote strings with special characters
    if (obj.includes(':') || obj.includes('#') || obj.includes('\n')) {
      return `"${obj.replace(/"/g, '\\"')}"`
    }
    return obj
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => `${spaces}- ${toYaml(item, indent + 1).trim()}`).join('\n')
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (entries.length === 0) return '{}'

    return entries
      .map(([key, value]) => {
        const yamlValue = toYaml(value, indent + 1)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${spaces}${key}:\n${yamlValue}`
        }
        return `${spaces}${key}: ${yamlValue.trim()}`
      })
      .join('\n')
  }

  return String(obj)
}

/**
 * Convert JSON to YAML
 */
export function jsonToYaml(input: string): ConversionResult {
  const trimmed = input.trim()

  try {
    const parsed = JSON.parse(trimmed)
    const yaml = toYaml(parsed)

    return {
      original: input,
      converted: yaml,
      success: true,
    }
  } catch (error) {
    return {
      original: input,
      converted: input,
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    }
  }
}

/**
 * Convert YAML to JSON
 */
export function yamlToJson(input: string): ConversionResult {
  const trimmed = input.trim()

  // Check if it's already JSON
  try {
    JSON.parse(trimmed)
    // It's valid JSON, just pretty print it
    return {
      original: input,
      converted: JSON.stringify(JSON.parse(trimmed), null, 2),
      success: true,
    }
  } catch {
    // Not JSON, try to parse as YAML
  }

  try {
    const parsed = parseSimpleYaml(trimmed)
    const json = JSON.stringify(parsed, null, 2)

    return {
      original: input,
      converted: json,
      success: true,
    }
  } catch (error) {
    return {
      original: input,
      converted: input,
      success: false,
      error: error instanceof Error ? error.message : 'Invalid YAML',
    }
  }
}
