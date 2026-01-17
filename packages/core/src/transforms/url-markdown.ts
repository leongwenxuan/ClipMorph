/**
 * URL to Markdown Link Transform
 *
 * Converts a URL to a markdown link format [title](url)
 * Attempts to fetch the page title if possible, otherwise uses the domain.
 */

import { isUrl } from './url-clean'

export interface UrlMarkdownResult {
  original: string
  markdown: string
  title: string
  isUrl: boolean
}

/**
 * Extract domain from URL for fallback title
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Convert a URL to markdown link format
 * Uses domain as title (fetching page title would require network)
 */
export function urlToMarkdown(input: string): UrlMarkdownResult {
  const trimmed = input.trim()

  if (!isUrl(trimmed)) {
    return {
      original: input,
      markdown: input,
      title: '',
      isUrl: false,
    }
  }

  // Normalize URL
  let url = trimmed
  if (url.startsWith('www.')) {
    url = `https://${url}`
  }

  // Extract domain for title
  const title = extractDomain(url)

  // Create markdown link
  const markdown = `[${title}](${url})`

  return {
    original: input,
    markdown,
    title,
    isUrl: true,
  }
}

/**
 * Convert a URL to markdown with a custom title
 */
export function urlToMarkdownWithTitle(url: string, title: string): string {
  const trimmed = url.trim()

  if (!isUrl(trimmed)) {
    return trimmed
  }

  let normalizedUrl = trimmed
  if (normalizedUrl.startsWith('www.')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  return `[${title}](${normalizedUrl})`
}
