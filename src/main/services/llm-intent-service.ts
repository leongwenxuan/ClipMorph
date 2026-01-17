/**
 * LLM Intent Classification Service
 * 
 * Uses Cerebras (or OpenAI) to classify intents when regex matching
 * has low confidence. Fast fallback for natural language commands.
 */

import OpenAI from 'openai'
import { secretsService } from './secrets-service'
import { Intent, IntentClassification } from '../../../packages/core/src'

// Cerebras API endpoint
const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1'

export interface LLMIntentResult {
  intent: Intent
  confidence: number
  reasoning?: string
}

class LLMIntentService {
  private client: OpenAI | null = null
  private apiKey: string | null = null

  /**
   * Get Cerebras client (falls back to OpenAI if no Cerebras key)
   */
  private async getClient(): Promise<{ client: OpenAI; model: string }> {
    // Try Cerebras first (faster)
    const cerebrasKey = await secretsService.getCerebrasKey()
    if (cerebrasKey) {
      if (!this.client || this.apiKey !== cerebrasKey) {
        this.apiKey = cerebrasKey
        this.client = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: CEREBRAS_BASE_URL,
        })
      }
      return { client: this.client, model: 'llama-3.3-70b' }
    }

    // Fall back to OpenAI
    const openaiKey = await secretsService.getOpenAIKey()
    if (openaiKey) {
      if (!this.client || this.apiKey !== openaiKey) {
        this.apiKey = openaiKey
        this.client = new OpenAI({ apiKey: openaiKey })
      }
      return { client: this.client, model: 'gpt-4o-mini' }
    }

    throw new Error('No API key configured (Cerebras or OpenAI)')
  }

  /**
   * Classify intent using LLM
   */
  async classifyIntent(transcript: string): Promise<LLMIntentResult> {
    const { client, model } = await this.getClient()

    const systemPrompt = `You are an intent classifier for a voice-controlled clipboard assistant called ClipMorph.

Given a user's voice command, classify it into ONE of these intents:

CODE INTENTS (use OpenCode CLI for agentic coding):
- code:generate - Create new code, functions, components, classes
- code:refactor - Refactor, restructure, rewrite existing code
- code:fix - Fix bugs, debug, repair code
- code:explain - Explain what code does
- code:improve - Optimize, enhance, make code better
- code:convert - Convert code to another language (e.g., TypeScript)

TRANSFORM INTENTS (use LLM to transform clipboard text):
- Use "transform" for: summarize, translate, reformat, shorten, expand, clean up text, extract info, etc.

BROWSER INTENTS (automate web browser):
- automation:portal - Fill forms, click buttons, navigate websites, sign up, log in

FILE INTENTS (file system operations):
- file:organize - Organize/sort files
- file:rename - Rename files
- file:move - Move files
- file:delete - Delete files
- file:copy - Copy files

SPECIAL INTENTS:
- cancel - Cancel current operation
- undo - Undo last action

If the command is about writing, creating, or modifying CODE/FUNCTIONS/COMPONENTS → use code:* intents
If the command is about transforming TEXT content → use "transform"
If unsure, use "transform" as the safe default.

Respond with JSON only: {"intent": "<intent>", "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Classify this command: "${transcript}"` },
      ],
      temperature: 0.1,
      max_tokens: 150,
    })

    const content = response.choices[0]?.message?.content || ''
    
    try {
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        // Map "transform" to "unsupported" which routes to LLM transform
        let intent: Intent = parsed.intent
        if (intent === 'transform' || !this.isValidIntent(intent)) {
          intent = 'unsupported'
        }
        
        return {
          intent,
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
          reasoning: parsed.reasoning,
        }
      }
    } catch (e) {
      console.error('[LLMIntentService] Failed to parse response:', content, e)
    }

    // Default fallback
    return {
      intent: 'unsupported',
      confidence: 0.5,
      reasoning: 'Failed to parse LLM response',
    }
  }

  /**
   * Check if intent is valid
   */
  private isValidIntent(intent: string): intent is Intent {
    const validIntents = [
      'code:generate', 'code:refactor', 'code:fix', 'code:explain', 'code:improve', 'code:convert',
      'automation:portal',
      'file:organize', 'file:rename', 'file:move', 'file:delete', 'file:copy', 'file:find',
      'cancel', 'undo',
      'url:clean', 'url:markdown', 'json:pretty', 'json:minify', 'json:to-yaml', 'yaml:to-json',
      'extract:emails', 'extract:links', 'redact:secrets',
      'unsupported',
    ]
    return validIntents.includes(intent)
  }

  /**
   * Check if LLM classification is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const cerebrasKey = await secretsService.getCerebrasKey()
      const openaiKey = await secretsService.getOpenAIKey()
      return !!(cerebrasKey || openaiKey)
    } catch {
      return false
    }
  }
}

export const llmIntentService = new LLMIntentService()
