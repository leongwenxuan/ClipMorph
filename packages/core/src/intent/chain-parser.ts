/**
 * Chain Parser
 *
 * Parses multi-step transform commands from transcripts.
 * Detects chaining keywords like "then", "and", "and then".
 */

import { classifyIntent, Intent, TransformIntent, isTransformIntent } from './classify-intent'

// Chain separator patterns
const CHAIN_SEPARATORS = [
  /\s+then\s+/i,
  /\s+and\s+then\s+/i,
  /\s+and\s+/i,
  /\s*,\s+then\s+/i,
  /\s*,\s+/i,
]

export interface ChainedIntent {
  intents: TransformIntent[]
  isChain: boolean
  rawSegments: string[]
}

/**
 * Parse a transcript for chained intents
 */
export function parseChain(transcript: string): ChainedIntent {
  const normalized = transcript.toLowerCase().trim()

  // Try to split by chain separators
  let segments: string[] = [normalized]

  for (const separator of CHAIN_SEPARATORS) {
    const newSegments: string[] = []
    for (const segment of segments) {
      const parts = segment.split(separator).filter((p) => p.trim())
      newSegments.push(...parts)
    }
    if (newSegments.length > segments.length) {
      segments = newSegments
    }
  }

  // If no chaining detected
  if (segments.length === 1) {
    const classification = classifyIntent(segments[0])
    if (isTransformIntent(classification.intent)) {
      return {
        intents: [classification.intent as TransformIntent],
        isChain: false,
        rawSegments: segments,
      }
    }
    return {
      intents: [],
      isChain: false,
      rawSegments: segments,
    }
  }

  // Classify each segment
  const intents: TransformIntent[] = []
  for (const segment of segments) {
    const classification = classifyIntent(segment.trim())
    if (isTransformIntent(classification.intent)) {
      intents.push(classification.intent as TransformIntent)
    }
  }

  return {
    intents,
    isChain: intents.length > 1,
    rawSegments: segments,
  }
}

/**
 * Check if a transcript contains chaining keywords
 */
export function hasChainKeywords(transcript: string): boolean {
  const normalized = transcript.toLowerCase()
  return CHAIN_SEPARATORS.some((sep) => sep.test(normalized))
}
