/**
 * Intent Classification Tests
 */

import { describe, it, expect } from 'vitest'
import {
  classifyIntent,
  isTransformIntent,
  isSpecialIntent,
  isAutomationIntent,
  getSupportedIntents,
} from '../intent'

describe('Intent Classification', () => {
  describe('Special Intents', () => {
    it('should classify "cancel" command', () => {
      const result = classifyIntent('cancel')
      expect(result.intent).toBe('cancel')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should classify "stop" as cancel', () => {
      const result = classifyIntent('stop')
      expect(result.intent).toBe('cancel')
    })

    it('should classify "undo" command', () => {
      const result = classifyIntent('undo')
      expect(result.intent).toBe('undo')
    })

    it('should classify "revert" as undo', () => {
      const result = classifyIntent('revert')
      expect(result.intent).toBe('undo')
    })
  })

  describe('URL Transforms', () => {
    it('should classify "clean url"', () => {
      const result = classifyIntent('clean url')
      expect(result.intent).toBe('url:clean')
    })

    it('should classify "remove tracking"', () => {
      const result = classifyIntent('remove tracking')
      expect(result.intent).toBe('url:clean')
    })

    it('should classify "markdown link"', () => {
      const result = classifyIntent('markdown link')
      expect(result.intent).toBe('url:markdown')
    })

    it('should classify "convert to markdown"', () => {
      const result = classifyIntent('convert to markdown')
      expect(result.intent).toBe('url:markdown')
    })
  })

  describe('JSON Transforms', () => {
    it('should classify "pretty print"', () => {
      const result = classifyIntent('pretty print')
      expect(result.intent).toBe('json:pretty')
    })

    it('should classify "format json"', () => {
      const result = classifyIntent('format json')
      expect(result.intent).toBe('json:pretty')
    })

    it('should classify "minify"', () => {
      const result = classifyIntent('minify')
      expect(result.intent).toBe('json:minify')
    })

    it('should classify "json to yaml"', () => {
      const result = classifyIntent('json to yaml')
      expect(result.intent).toBe('json:to-yaml')
    })

    it('should classify "yaml to json"', () => {
      const result = classifyIntent('yaml to json')
      expect(result.intent).toBe('yaml:to-json')
    })
  })

  describe('Extract Transforms', () => {
    it('should classify "extract emails"', () => {
      const result = classifyIntent('extract emails')
      expect(result.intent).toBe('extract:emails')
    })

    it('should classify "get all emails"', () => {
      const result = classifyIntent('get all emails')
      expect(result.intent).toBe('extract:emails')
    })

    it('should classify "extract links"', () => {
      const result = classifyIntent('extract links')
      expect(result.intent).toBe('extract:links')
    })

    it('should classify "find all urls"', () => {
      const result = classifyIntent('find all urls')
      expect(result.intent).toBe('extract:links')
    })
  })

  describe('Redact Transform', () => {
    it('should classify "redact secrets"', () => {
      const result = classifyIntent('redact secrets')
      expect(result.intent).toBe('redact:secrets')
    })

    it('should classify "hide passwords"', () => {
      const result = classifyIntent('hide passwords')
      expect(result.intent).toBe('redact:secrets')
    })
  })

  describe('Automation Intents', () => {
    it('should classify "apply to this job"', () => {
      const result = classifyIntent('apply to this job')
      expect(result.intent).toBe('automation:portal')
    })

    it('should classify "fill out this form"', () => {
      const result = classifyIntent('fill out this form')
      expect(result.intent).toBe('automation:portal')
    })
  })

  describe('Unsupported Intents', () => {
    it('should classify gibberish as unsupported', () => {
      const result = classifyIntent('asdfghjkl')
      expect(result.intent).toBe('unsupported')
      expect(result.confidence).toBe(0)
    })

    it('should classify unrelated text as unsupported', () => {
      const result = classifyIntent('hello how are you')
      expect(result.intent).toBe('unsupported')
    })
  })

  describe('Intent Type Helpers', () => {
    it('isTransformIntent should return true for transform intents', () => {
      expect(isTransformIntent('url:clean')).toBe(true)
      expect(isTransformIntent('json:pretty')).toBe(true)
      expect(isTransformIntent('extract:emails')).toBe(true)
    })

    it('isTransformIntent should return false for non-transform intents', () => {
      expect(isTransformIntent('cancel')).toBe(false)
      expect(isTransformIntent('automation:portal')).toBe(false)
    })

    it('isSpecialIntent should return true for special intents', () => {
      expect(isSpecialIntent('cancel')).toBe(true)
      expect(isSpecialIntent('undo')).toBe(true)
    })

    it('isSpecialIntent should return false for non-special intents', () => {
      expect(isSpecialIntent('url:clean')).toBe(false)
    })

    it('isAutomationIntent should return true for automation intents', () => {
      expect(isAutomationIntent('automation:portal')).toBe(true)
    })

    it('isAutomationIntent should return false for non-automation intents', () => {
      expect(isAutomationIntent('url:clean')).toBe(false)
    })
  })

  describe('getSupportedIntents', () => {
    it('should return all supported intents', () => {
      const intents = getSupportedIntents()
      expect(intents).toContain('cancel')
      expect(intents).toContain('undo')
      expect(intents).toContain('url:clean')
      expect(intents).toContain('json:pretty')
      expect(intents.length).toBeGreaterThan(10)
    })
  })

  describe('Normalization', () => {
    it('should handle uppercase input', () => {
      const result = classifyIntent('CLEAN URL')
      expect(result.intent).toBe('url:clean')
    })

    it('should handle mixed case input', () => {
      const result = classifyIntent('Pretty Print')
      expect(result.intent).toBe('json:pretty')
    })

    it('should handle extra whitespace', () => {
      const result = classifyIntent('  clean   url  ')
      expect(result.intent).toBe('url:clean')
    })

    it('should handle punctuation', () => {
      const result = classifyIntent('clean url!')
      expect(result.intent).toBe('url:clean')
    })
  })
})
