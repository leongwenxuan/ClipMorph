/**
 * URL Clean Transform Tests
 */

import { describe, it, expect } from 'vitest'
import { cleanUrl, isUrl, cleanUrlsInText } from '../transforms'

describe('URL Clean Transform', () => {
  describe('isUrl', () => {
    it('should detect http URLs', () => {
      expect(isUrl('http://example.com')).toBe(true)
    })

    it('should detect https URLs', () => {
      expect(isUrl('https://example.com')).toBe(true)
    })

    it('should detect www URLs', () => {
      expect(isUrl('www.example.com')).toBe(true)
    })

    it('should reject plain text', () => {
      expect(isUrl('hello world')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isUrl('')).toBe(false)
    })
  })

  describe('cleanUrl', () => {
    describe('UTM parameters', () => {
      it('should remove utm_source', () => {
        const result = cleanUrl('https://example.com?utm_source=google')
        expect(result.cleaned).toBe('https://example.com')
        expect(result.removedParams).toContain('utm_source')
      })

      it('should remove all UTM parameters', () => {
        const result = cleanUrl(
          'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test'
        )
        expect(result.cleaned).toBe('https://example.com')
        expect(result.removedParams).toContain('utm_source')
        expect(result.removedParams).toContain('utm_medium')
        expect(result.removedParams).toContain('utm_campaign')
      })
    })

    describe('Facebook tracking', () => {
      it('should remove fbclid', () => {
        const result = cleanUrl('https://example.com?fbclid=abc123')
        expect(result.cleaned).toBe('https://example.com')
        expect(result.removedParams).toContain('fbclid')
      })
    })

    describe('Google tracking', () => {
      it('should remove gclid', () => {
        const result = cleanUrl('https://example.com?gclid=abc123')
        expect(result.cleaned).toBe('https://example.com')
        expect(result.removedParams).toContain('gclid')
      })
    })

    describe('Preserving legitimate parameters', () => {
      it('should keep search query (q)', () => {
        const result = cleanUrl('https://google.com/search?q=test&utm_source=ads')
        expect(result.cleaned).toBe('https://google.com/search?q=test')
        expect(result.removedParams).toContain('utm_source')
      })

      it('should keep video ID (v)', () => {
        const result = cleanUrl('https://youtube.com/watch?v=abc123&utm_source=share')
        expect(result.cleaned).toBe('https://youtube.com/watch?v=abc123')
      })

      it('should keep timestamp (t)', () => {
        const result = cleanUrl('https://youtube.com/watch?v=abc123&t=120')
        expect(result.cleaned).toBe('https://youtube.com/watch?v=abc123&t=120')
      })
    })

    describe('Edge cases', () => {
      it('should handle URL without parameters', () => {
        const result = cleanUrl('https://example.com/page')
        expect(result.cleaned).toBe('https://example.com/page')
        expect(result.removedParams).toHaveLength(0)
      })

      it('should handle URL with only tracking parameters', () => {
        const result = cleanUrl('https://example.com?utm_source=test')
        expect(result.cleaned).toBe('https://example.com')
      })

      it('should handle URL with path and tracking', () => {
        const result = cleanUrl('https://example.com/path/to/page?utm_source=test')
        expect(result.cleaned).toBe('https://example.com/path/to/page')
      })

      it('should handle non-URL input', () => {
        const result = cleanUrl('not a url')
        expect(result.isUrl).toBe(false)
        expect(result.cleaned).toBe('not a url')
      })

      it('should handle www prefix', () => {
        const result = cleanUrl('www.example.com?utm_source=test')
        expect(result.cleaned).toBe('https://www.example.com')
      })

      it('should preserve original if not a URL', () => {
        const result = cleanUrl('hello world')
        expect(result.cleaned).toBe('hello world')
        expect(result.isUrl).toBe(false)
      })
    })

    describe('Complex URLs', () => {
      it('should handle Amazon affiliate URLs', () => {
        const result = cleanUrl(
          'https://amazon.com/dp/B08N5WRWNW?ref=some_ref&utm_source=affiliate'
        )
        expect(result.cleaned).toBe('https://amazon.com/dp/B08N5WRWNW')
        expect(result.removedParams).toContain('ref')
        expect(result.removedParams).toContain('utm_source')
      })

      it('should handle multiple tracking parameters', () => {
        const result = cleanUrl(
          'https://example.com?fbclid=123&gclid=456&utm_source=test&utm_medium=cpc'
        )
        expect(result.cleaned).toBe('https://example.com')
        expect(result.removedParams.length).toBe(4)
      })
    })
  })

  describe('cleanUrlsInText', () => {
    it('should clean URLs in text', () => {
      const text = 'Check out https://example.com?utm_source=email for more info'
      const result = cleanUrlsInText(text)
      expect(result).toBe('Check out https://example.com for more info')
    })

    it('should clean multiple URLs in text', () => {
      const text = 'Link 1: https://a.com?fbclid=1 Link 2: https://b.com?gclid=2'
      const result = cleanUrlsInText(text)
      expect(result).toBe('Link 1: https://a.com Link 2: https://b.com')
    })

    it('should leave non-URL text unchanged', () => {
      const text = 'This is just regular text'
      const result = cleanUrlsInText(text)
      expect(result).toBe(text)
    })
  })
})
