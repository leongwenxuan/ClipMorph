/**
 * Intent Classification
 *
 * Deterministic intent classifier that routes transcripts to capabilities.
 * Uses keyword matching and regex patterns for reliability.
 */

import {
  Intent,
  IntentClassification,
  IntentPattern,
} from './intent-types'

// Intent patterns - ordered by priority (higher first)
const INTENT_PATTERNS: IntentPattern[] = [
  // Special intents (highest priority)
  {
    intent: 'cancel',
    patterns: [/\bcancel\b/i, /\bstop\b/i, /\babort\b/i, /\bnevermind\b/i],
    keywords: ['cancel', 'stop', 'abort', 'nevermind', 'never mind'],
    priority: 100,
  },
  {
    intent: 'undo',
    patterns: [/\bundo\b/i, /\brevert\b/i, /\brestore\b/i],
    keywords: ['undo', 'revert', 'restore', 'go back'],
    priority: 99,
  },

  // URL transforms
  {
    intent: 'url:clean',
    patterns: [
      /clean\s*(the\s*)?(url|link)/i,
      /remove\s*(tracking|utm|query)/i,
      /strip\s*(tracking|utm|query)/i,
      /sanitize\s*(the\s*)?(url|link)/i,
    ],
    keywords: ['clean url', 'clean link', 'remove tracking', 'strip utm', 'sanitize url'],
    priority: 50,
  },
  {
    intent: 'url:markdown',
    patterns: [
      /markdown\s*(link|url)/i,
      /(url|link)\s*to\s*markdown/i,
      /make\s*(it\s*)?(a\s*)?markdown\s*(link)?/i,
      /convert\s*(to\s*)?markdown/i,
    ],
    keywords: ['markdown link', 'markdown url', 'to markdown', 'make markdown'],
    priority: 50,
  },

  // JSON transforms
  {
    intent: 'json:pretty',
    patterns: [
      /pretty\s*(print)?\s*(json)?/i,
      /format\s*(the\s*)?(json)?/i,
      /beautify\s*(json)?/i,
      /indent\s*(json)?/i,
    ],
    keywords: ['pretty', 'pretty print', 'format json', 'beautify', 'indent'],
    priority: 50,
  },
  {
    intent: 'json:minify',
    patterns: [
      /minify\s*(json)?/i,
      /compress\s*(json)?/i,
      /compact\s*(json)?/i,
      /one\s*line\s*(json)?/i,
    ],
    keywords: ['minify', 'compress', 'compact', 'one line'],
    priority: 50,
  },
  {
    intent: 'json:to-yaml',
    patterns: [
      /json\s*to\s*yaml/i,
      /convert\s*(to\s*)?yaml/i,
      /make\s*(it\s*)?yaml/i,
    ],
    keywords: ['json to yaml', 'to yaml', 'convert yaml', 'make yaml'],
    priority: 50,
  },
  {
    intent: 'yaml:to-json',
    patterns: [
      /yaml\s*to\s*json/i,
      /convert\s*(to\s*)?json/i,
      /make\s*(it\s*)?json/i,
    ],
    keywords: ['yaml to json', 'to json', 'convert json', 'make json'],
    priority: 50,
  },

  // Extract transforms
  {
    intent: 'extract:emails',
    patterns: [
      /extract\s*(all\s*)?(the\s*)?emails?/i,
      /get\s*(all\s*)?(the\s*)?emails?/i,
      /find\s*(all\s*)?(the\s*)?emails?/i,
      /pull\s*(out\s*)?(the\s*)?emails?/i,
    ],
    keywords: ['extract email', 'get email', 'find email', 'pull email'],
    priority: 50,
  },
  {
    intent: 'extract:links',
    patterns: [
      /extract\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /get\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /find\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /pull\s*(out\s*)?(the\s*)?(links?|urls?)/i,
    ],
    keywords: ['extract link', 'extract url', 'get link', 'find link'],
    priority: 50,
  },

  // Redact transform
  {
    intent: 'redact:secrets',
    patterns: [
      /redact\s*(secrets?|keys?|tokens?|passwords?)?/i,
      /hide\s*(secrets?|keys?|tokens?|passwords?)/i,
      /mask\s*(secrets?|keys?|tokens?|passwords?)/i,
      /remove\s*(secrets?|keys?|tokens?|passwords?)/i,
    ],
    keywords: ['redact', 'hide secret', 'mask key', 'remove password'],
    priority: 50,
  },

  // Automation intents
  {
    intent: 'automation:portal',
    patterns: [
      /apply\s*(to\s*)?(this\s*)?(job|portal|site)/i,
      /fill\s*(out\s*)?(this\s*)?(form|application)/i,
      /start\s*automation/i,
    ],
    keywords: ['apply', 'fill form', 'fill application', 'automation'],
    priority: 30,
  },

  // Code intents (OpenCode CLI) - only for actual code/programming tasks
  {
    intent: 'code:generate',
    patterns: [
      /generate\s*(a\s*)?([\w\s]*\s*)?(code|function|component|class|module|script|api|endpoint|hook|service|util)/i,
      /create\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module|script|api|endpoint|hook|service|util)/i,
      /write\s*(a\s*)?([\w\s]*\s*)?(code|function|component|class|module|script)/i,
      /make\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module)/i,
      /build\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module|api)/i,
      /implement\s*(a\s*)?([\w\s]*\s*)?(function|feature|component|class)/i,
      /code\s*(a\s*)?([\w\s]*\s*)?(function|feature|component)/i,
    ],
    keywords: ['create function', 'write code', 'make component', 'build class', 'generate code', 'implement function'],
    priority: 40,
  },
  {
    intent: 'code:refactor',
    patterns: [
      /refactor\s*(this|the)?\s*(code|function|component)?/i,
      /restructure\s*(this|the)?\s*(code|function)?/i,
      /rewrite\s*(this|the)?\s*(code|function)?/i,
      /clean\s*up\s*(this|the)?\s*(code|function)?/i,
    ],
    keywords: ['refactor', 'restructure', 'rewrite', 'clean up code'],
    priority: 40,
  },
  {
    intent: 'code:fix',
    patterns: [
      /fix\s*(this|the)?\s*(bug|error|issue|code|function)?/i,
      /debug\s*(this|the)?\s*(code|function)?/i,
      /repair\s*(this|the)?\s*(code|function)?/i,
      /solve\s*(this|the)?\s*(bug|error|issue)?/i,
    ],
    keywords: ['fix', 'debug', 'repair', 'solve bug', 'fix error'],
    priority: 40,
  },
  {
    intent: 'code:explain',
    patterns: [
      /explain\s*(this|the)?\s*(code|function|component)?/i,
      /what\s*does\s*(this|the)?\s*(code|function)?\s*do/i,
      /how\s*does\s*(this|the)?\s*(code|function)?\s*work/i,
      /describe\s*(this|the)?\s*(code|function)?/i,
    ],
    keywords: ['explain', 'what does', 'how does', 'describe code'],
    priority: 40,
  },
  {
    intent: 'code:improve',
    patterns: [
      /improve\s*(this|the)?\s*(code|function|performance)?/i,
      /optimize\s*(this|the)?\s*(code|function)?/i,
      /enhance\s*(this|the)?\s*(code|function)?/i,
      /make\s*(this|the)?\s*(code|function)?\s*(better|faster)/i,
    ],
    keywords: ['improve', 'optimize', 'enhance', 'make better', 'make faster'],
    priority: 40,
  },
  {
    intent: 'code:convert',
    patterns: [
      /convert\s*(this|the)?\s*(code|file|to)?\s*(to\s*)?(typescript|ts|javascript|js|python|py|java|go|rust)/i,
      /migrate\s*(this|the)?\s*(code|file)?\s*(to\s*)?(typescript|ts|javascript|js)/i,
      /transform\s*(this|the)?\s*(code)?\s*(to|into)\s*(typescript|ts)/i,
      /change\s*(this|the)?\s*(code)?\s*(to|into)\s*(typescript|ts)/i,
      /port\s*(this|the)?\s*(code)?\s*(to\s*)?(typescript|ts|python|java)/i,
      /add\s*types?\s*(to\s*)?(this|the)?\s*(code|file)?/i,
      /typescript\s*(this|convert)/i,
    ],
    keywords: ['convert to typescript', 'migrate to ts', 'add types', 'convert to ts', 'port to'],
    priority: 40,
  },
  // Direct OpenCode trigger - use "opencode" or "code agent" prefix
  {
    intent: 'code:generate',
    patterns: [
      /^opencode\s+/i,           // "opencode do something"
      /^code\s*agent\s+/i,       // "code agent do something"  
      /^agent\s+code\s+/i,       // "agent code something"
      /^use\s*opencode\s+/i,     // "use opencode to..."
    ],
    keywords: ['opencode', 'code agent'],
    priority: 60, // High priority to override other matches
  },

  // Workflow intents (multi-stage)
  {
    intent: 'workflow:plan-code-review',
    patterns: [
      /full\s*(review\s*)?(workflow|process)/i,
      /plan\s*(and|then)?\s*(implement|code)\s*(and|then)?\s*review/i,
      /complete\s*(development\s*)?(workflow|cycle)/i,
      /full\s*(dev\s*)?cycle/i,
    ],
    keywords: ['full workflow', 'full review', 'plan implement review', 'complete workflow', 'full cycle'],
    priority: 45,
  },
  {
    intent: 'workflow:plan-code',
    patterns: [
      /plan\s*(and|then)?\s*(implement|code|build|create)/i,
      /design\s*(and|then)?\s*(implement|code|build)/i,
      /architect\s*(and|then)?\s*(implement|code|build)/i,
    ],
    keywords: ['plan and implement', 'plan and code', 'design and build', 'architect and code'],
    priority: 44,
  },
  {
    intent: 'workflow:plan-only',
    patterns: [
      /just\s*plan/i,
      /only\s*plan/i,
      /plan\s*first/i,
      /create\s*(a\s*)?plan\s*(for)?/i,
      /design\s*(a\s*)?plan/i,
    ],
    keywords: ['just plan', 'only plan', 'plan first', 'create plan', 'design plan'],
    priority: 43,
  },

  // File operation intents
  {
    intent: 'file:organize',
    patterns: [
      /organize\s*(my\s*)?(files?|folders?|downloads?|documents?)/i,
      /sort\s*(my\s*)?(files?|folders?|downloads?)/i,
      /clean\s*up\s*(my\s*)?(files?|folders?|downloads?|desktop)/i,
      /tidy\s*(up\s*)?(my\s*)?(files?|folders?)/i,
    ],
    keywords: ['organize files', 'organize folder', 'sort files', 'clean up downloads', 'tidy files'],
    priority: 42,
  },
  {
    intent: 'file:rename',
    patterns: [
      /rename\s*(files?|folders?|all)/i,
      /batch\s*rename/i,
      /change\s*(file\s*)?names?/i,
    ],
    keywords: ['rename files', 'rename folder', 'batch rename', 'change names'],
    priority: 42,
  },
  {
    intent: 'file:move',
    patterns: [
      /move\s*(files?|folders?|all)\s*(to|into)/i,
      /relocate\s*(files?|folders?)/i,
      /transfer\s*(files?|folders?)/i,
    ],
    keywords: ['move files', 'move folder', 'relocate', 'transfer files'],
    priority: 42,
  },
  {
    intent: 'file:delete',
    patterns: [
      /delete\s*(files?|folders?|all)/i,
      /remove\s*(files?|folders?|all)/i,
      /trash\s*(files?|folders?)/i,
      /clean\s*(out|up)\s*(old\s*)?(files?|folders?)/i,
    ],
    keywords: ['delete files', 'delete folder', 'remove files', 'trash files'],
    priority: 42,
  },
  {
    intent: 'file:find',
    patterns: [
      /find\s*(files?|folders?)/i,
      /search\s*(for\s*)?(files?|folders?)/i,
      /locate\s*(files?|folders?)/i,
      /where\s*(is|are)\s*(my\s*)?(files?|folders?)/i,
    ],
    keywords: ['find files', 'find folder', 'search files', 'locate files', 'where is'],
    priority: 42,
  },
  {
    intent: 'file:copy',
    patterns: [
      /copy\s*(files?|folders?|all)\s*(to|into)/i,
      /duplicate\s*(files?|folders?)/i,
      /backup\s*(files?|folders?)/i,
    ],
    keywords: ['copy files', 'copy folder', 'duplicate files', 'backup files'],
    priority: 42,
  },
]

/**
 * Normalize transcript for matching
 */
function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
}

/**
 * Calculate match score for a pattern against transcript
 */
function calculateMatchScore(
  normalizedTranscript: string,
  pattern: IntentPattern
): { score: number; matchedPatterns: string[] } {
  const matchedPatterns: string[] = []
  let score = 0

  // Check regex patterns
  for (const regex of pattern.patterns) {
    if (regex.test(normalizedTranscript)) {
      score += 0.5
      matchedPatterns.push(regex.source)
    }
  }

  // Check keywords
  for (const keyword of pattern.keywords) {
    if (normalizedTranscript.includes(keyword.toLowerCase())) {
      score += 0.3
      matchedPatterns.push(`keyword:${keyword}`)
    }
  }

  // Boost for exact matches
  if (pattern.keywords.some((k) => normalizedTranscript === k.toLowerCase())) {
    score += 0.5
  }

  return { score, matchedPatterns }
}

/**
 * Classify a transcript into an intent
 */
export function classifyIntent(transcript: string): IntentClassification {
  const normalizedTranscript = normalizeTranscript(transcript)

  // Find best matching intent
  let bestMatch: {
    intent: Intent
    score: number
    matchedPatterns: string[]
    priority: number
  } | null = null

  for (const pattern of INTENT_PATTERNS) {
    const { score, matchedPatterns } = calculateMatchScore(normalizedTranscript, pattern)

    if (score > 0) {
      // Compare with current best
      if (
        !bestMatch ||
        score > bestMatch.score ||
        (score === bestMatch.score && pattern.priority > bestMatch.priority)
      ) {
        bestMatch = {
          intent: pattern.intent,
          score,
          matchedPatterns,
          priority: pattern.priority,
        }
      }
    }
  }

  // Return result
  if (bestMatch && bestMatch.score >= 0.3) {
    return {
      intent: bestMatch.intent,
      confidence: Math.min(bestMatch.score, 1),
      rawTranscript: transcript,
      normalizedTranscript,
      matchedPatterns: bestMatch.matchedPatterns,
    }
  }

  // No match - unsupported
  return {
    intent: 'unsupported',
    confidence: 0,
    rawTranscript: transcript,
    normalizedTranscript,
    matchedPatterns: [],
  }
}

/**
 * Check if an intent is a transform intent
 */
export function isTransformIntent(intent: Intent): boolean {
  return (
    intent.startsWith('url:') ||
    intent.startsWith('json:') ||
    intent.startsWith('yaml:') ||
    intent.startsWith('extract:') ||
    intent.startsWith('redact:')
  )
}

/**
 * Check if an intent is a special intent (cancel, undo)
 */
export function isSpecialIntent(intent: Intent): boolean {
  return intent === 'cancel' || intent === 'undo'
}

/**
 * Check if an intent is an automation intent
 */
export function isAutomationIntent(intent: Intent): boolean {
  return intent.startsWith('automation:')
}

/**
 * Check if an intent is a code intent (OpenCode)
 */
export function isCodeIntent(intent: Intent): boolean {
  return intent.startsWith('code:')
}

/**
 * Check if an intent is a subagent intent
 */
export function isSubagentIntent(intent: Intent): boolean {
  return intent.startsWith('subagent:')
}

/**
 * Check if an intent is a workflow intent
 */
export function isWorkflowIntent(intent: Intent): boolean {
  return intent.startsWith('workflow:')
}

/**
 * Check if an intent is a file operation intent
 */
export function isFileIntent(intent: Intent): boolean {
  return intent.startsWith('file:')
}

/**
 * Extract subagent ID from a subagent intent
 */
export function getSubagentIdFromIntent(intent: Intent): string | null {
  if (!isSubagentIntent(intent)) return null
  return intent.replace('subagent:', '')
}

/**
 * Try to match a transcript against subagent triggers
 * Returns the matched subagent ID and trigger, or null if no match
 */
export function matchSubagentTrigger(
  transcript: string,
  triggers: Array<{ trigger: string; subagentId: string }>
): { subagentId: string; trigger: string; confidence: number } | null {
  const normalizedTranscript = normalizeTranscript(transcript)
  
  for (const { trigger, subagentId } of triggers) {
    const normalizedTrigger = normalizeTranscript(trigger)
    
    // Exact match
    if (normalizedTranscript === normalizedTrigger) {
      return { subagentId, trigger, confidence: 1.0 }
    }
    
    // Starts with trigger
    if (normalizedTranscript.startsWith(normalizedTrigger + ' ')) {
      return { subagentId, trigger, confidence: 0.9 }
    }
    
    // Contains trigger
    if (normalizedTranscript.includes(normalizedTrigger)) {
      return { subagentId, trigger, confidence: 0.7 }
    }
  }
  
  return null
}

/**
 * Get supported intents list
 */
export function getSupportedIntents(): Intent[] {
  return INTENT_PATTERNS.map((p) => p.intent)
}
