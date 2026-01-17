/**
 * URL Clean Transform
 *
 * Removes tracking parameters, UTM codes, and other noise from URLs.
 * Deterministic implementation - no LLM required.
 */

// Common tracking parameters to remove
const TRACKING_PARAMS = new Set([
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_cid',

  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',

  // Google
  'gclid',
  'gclsrc',
  'dclid',

  // Microsoft/Bing
  'msclkid',

  // Twitter
  'twclid',

  // General tracking
  'ref',
  'ref_',
  'referer',
  'referrer',
  'source',
  'mc_cid',
  'mc_eid',
  'ml_subscriber',
  'ml_subscriber_hash',
  '_hsenc',
  '_hsmi',
  'mkt_tok',
  'vero_id',
  'oly_enc_id',
  'oly_anon_id',
  '__s',
  'share',
  'spm',
  'from',

  // Analytics
  '_ga',
  '_gl',
  '_ke',

  // Session/tracking IDs
  'sid',
  'sessionid',
  'tracking_id',
  'trk',
  'track',
  'clickid',
  'click_id',

  // Affiliate
  'aff',
  'affiliate',
  'affid',
  'affiliate_id',
  'partner',
  'partner_id',

  // Email
  'email',
  'e',
  'em',
  'subscriber',

  // Social
  'igshid',
  'share_token',
  's',  // Twitter share param
])

// Parameters that are usually safe to keep (whitelist approach for some sites)
const SAFE_PARAMS = new Set([
  'q',      // Search query
  'query',  // Search query
  'search', // Search query
  'id',     // Content ID (context-dependent)
  'v',      // Video ID (YouTube)
  't',      // Timestamp (YouTube)
  'p',      // Page number
  'page',   // Page number
  'sort',   // Sort order
  'order',  // Sort order
  'filter', // Filter
  'category', // Category
  'lang',   // Language
  'locale', // Locale
])

export interface UrlCleanResult {
  original: string
  cleaned: string
  removedParams: string[]
  isUrl: boolean
}

/**
 * Check if a string looks like a URL
 */
export function isUrl(text: string): boolean {
  const trimmed = text.trim()

  // Check for common URL patterns
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true
  }

  // Check for www. prefix
  if (trimmed.startsWith('www.')) {
    return true
  }

  // Try to parse as URL
  try {
    new URL(trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed)
    return true
  } catch {
    return false
  }
}

/**
 * Clean a URL by removing tracking parameters
 */
export function cleanUrl(input: string): UrlCleanResult {
  const trimmed = input.trim()

  // Check if it's a valid URL
  if (!isUrl(trimmed)) {
    return {
      original: input,
      cleaned: input,
      removedParams: [],
      isUrl: false,
    }
  }

  // Normalize URL (add protocol if missing)
  let urlString = trimmed
  if (urlString.startsWith('www.')) {
    urlString = `https://${urlString}`
  }

  try {
    const url = new URL(urlString)
    const removedParams: string[] = []

    // Get all parameters
    const params = new URLSearchParams(url.search)
    const newParams = new URLSearchParams()

    // Filter parameters
    for (const [key, value] of params) {
      const lowerKey = key.toLowerCase()

      if (TRACKING_PARAMS.has(lowerKey)) {
        removedParams.push(key)
      } else {
        newParams.set(key, value)
      }
    }

    // Reconstruct URL
    url.search = newParams.toString()

    // Remove hash if it looks like tracking (e.g., #ref=...)
    if (url.hash && url.hash.includes('=')) {
      const hashContent = url.hash.slice(1)
      if (TRACKING_PARAMS.has(hashContent.split('=')[0].toLowerCase())) {
        url.hash = ''
        removedParams.push(`#${hashContent.split('=')[0]}`)
      }
    }

    // Get cleaned URL
    let cleaned = url.toString()

    // Remove trailing slash if the original didn't have one
    if (!trimmed.endsWith('/') && cleaned.endsWith('/') && url.pathname === '/') {
      cleaned = cleaned.slice(0, -1)
    }

    return {
      original: input,
      cleaned,
      removedParams,
      isUrl: true,
    }
  } catch {
    // If URL parsing fails, return original
    return {
      original: input,
      cleaned: input,
      removedParams: [],
      isUrl: false,
    }
  }
}

/**
 * Extract URLs from text and clean them
 */
export function cleanUrlsInText(text: string): string {
  // URL regex pattern
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

  return text.replace(urlPattern, (match) => {
    const result = cleanUrl(match)
    return result.cleaned
  })
}
