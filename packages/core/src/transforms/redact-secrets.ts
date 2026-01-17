/**
 * Redact Secrets Transform
 *
 * Detect and redact potential secrets using heuristics.
 * No LLM required - uses pattern matching.
 */

export interface RedactResult {
  original: string
  redacted: string
  redactedCount: number
  detectedTypes: string[]
}

// Secret patterns with their types
const SECRET_PATTERNS: { pattern: RegExp; type: string; replacement: string }[] = [
  // API Keys (generic patterns)
  {
    pattern: /\b(api[_-]?key|apikey)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: 'API Key',
    replacement: '$1=[REDACTED]',
  },
  {
    pattern: /\b(secret[_-]?key|secretkey)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: 'Secret Key',
    replacement: '$1=[REDACTED]',
  },
  {
    pattern: /\b(access[_-]?token|accesstoken)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: 'Access Token',
    replacement: '$1=[REDACTED]',
  },

  // AWS
  {
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    type: 'AWS Access Key',
    replacement: '[AWS_KEY_REDACTED]',
  },
  {
    pattern: /\b(aws[_-]?secret[_-]?access[_-]?key)[=:\s]+['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    type: 'AWS Secret',
    replacement: '$1=[REDACTED]',
  },

  // GitHub
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    type: 'GitHub PAT',
    replacement: '[GITHUB_TOKEN_REDACTED]',
  },
  {
    pattern: /\b(gho_[a-zA-Z0-9]{36})\b/g,
    type: 'GitHub OAuth',
    replacement: '[GITHUB_OAUTH_REDACTED]',
  },
  {
    pattern: /\b(ghu_[a-zA-Z0-9]{36})\b/g,
    type: 'GitHub User Token',
    replacement: '[GITHUB_USER_REDACTED]',
  },

  // Stripe
  {
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    type: 'Stripe Secret Key',
    replacement: '[STRIPE_SK_REDACTED]',
  },
  {
    pattern: /\b(pk_live_[a-zA-Z0-9]{24,})\b/g,
    type: 'Stripe Publishable Key',
    replacement: '[STRIPE_PK_REDACTED]',
  },

  // OpenAI
  {
    pattern: /\b(sk-[a-zA-Z0-9]{48})\b/g,
    type: 'OpenAI API Key',
    replacement: '[OPENAI_KEY_REDACTED]',
  },

  // Slack
  {
    pattern: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g,
    type: 'Slack Token',
    replacement: '[SLACK_TOKEN_REDACTED]',
  },

  // Generic Bearer tokens
  {
    pattern: /\b(Bearer\s+)([a-zA-Z0-9_\-.]{20,})\b/gi,
    type: 'Bearer Token',
    replacement: '$1[REDACTED]',
  },

  // Passwords in common formats
  {
    pattern: /\b(password|passwd|pwd)[=:\s]+['"]?([^\s'"]{8,})['"]?/gi,
    type: 'Password',
    replacement: '$1=[REDACTED]',
  },

  // Private keys (PEM format)
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    type: 'Private Key',
    replacement: '[PRIVATE_KEY_REDACTED]',
  },

  // JWT tokens
  {
    pattern: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
    type: 'JWT Token',
    replacement: '[JWT_REDACTED]',
  },

  // Database connection strings
  {
    pattern: /(mongodb(\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi,
    type: 'MongoDB Password',
    replacement: '$1[REDACTED]$4',
  },
  {
    pattern: /(postgres(ql)?:\/\/[^:]+:)([^@]+)(@)/gi,
    type: 'PostgreSQL Password',
    replacement: '$1[REDACTED]$4',
  },
  {
    pattern: /(mysql:\/\/[^:]+:)([^@]+)(@)/gi,
    type: 'MySQL Password',
    replacement: '$1[REDACTED]$3',
  },

  // Generic high-entropy strings that look like secrets (32+ chars, mixed case/numbers)
  {
    pattern: /\b([a-zA-Z0-9]{32,64})\b/g,
    type: 'Potential Secret',
    replacement: (match) => {
      // Only redact if it looks random (has mix of upper, lower, numbers)
      const hasUpper = /[A-Z]/.test(match)
      const hasLower = /[a-z]/.test(match)
      const hasNumber = /[0-9]/.test(match)
      if (hasUpper && hasLower && hasNumber) {
        return '[POTENTIAL_SECRET_REDACTED]'
      }
      return match
    },
  },
]

/**
 * Redact potential secrets from text
 */
export function redactSecrets(input: string): RedactResult {
  let redacted = input
  let redactedCount = 0
  const detectedTypes: Set<string> = new Set()

  for (const { pattern, type, replacement } of SECRET_PATTERNS) {
    const matches = redacted.match(pattern)
    if (matches) {
      if (typeof replacement === 'function') {
        redacted = redacted.replace(pattern, replacement as (match: string) => string)
      } else {
        redacted = redacted.replace(pattern, replacement)
      }

      // Count actual replacements
      const newMatches = redacted.match(pattern)
      const replaced = matches.length - (newMatches?.length || 0)
      if (replaced > 0) {
        redactedCount += replaced
        detectedTypes.add(type)
      }
    }
  }

  return {
    original: input,
    redacted,
    redactedCount,
    detectedTypes: [...detectedTypes],
  }
}
