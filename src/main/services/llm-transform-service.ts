/**
 * LLM Transform Service - AI-powered clipboard transformations
 *
 * Uses OpenAI to understand and execute arbitrary text transformations.
 * No need to predefine transforms - the LLM figures out what to do.
 */

import OpenAI from 'openai'
import { secretsService } from './secrets-service'

export interface LLMTransformResult {
  success: boolean
  input: string
  output: string
  error?: string
}

class LLMTransformService {
  private client: OpenAI | null = null
  private apiKey: string | null = null

  /**
   * Initialize or get the OpenAI client
   */
  private async getClient(): Promise<OpenAI> {
    // Check if we need to refresh the API key
    const currentKey = await secretsService.getOpenAIKey()
    
    if (!currentKey) {
      throw new Error('OpenAI API key not configured. Set it in Settings.')
    }

    // Create new client if key changed or doesn't exist
    if (!this.client || this.apiKey !== currentKey) {
      this.apiKey = currentKey
      this.client = new OpenAI({ apiKey: currentKey })
    }

    return this.client
  }

  /**
   * Execute an LLM-powered transform
   * 
   * @param command - What the user wants to do (e.g., "make this shorter", "translate to Spanish")
   * @param text - The clipboard content to transform
   */
  async transform(command: string, text: string): Promise<LLMTransformResult> {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        input: text,
        output: '',
        error: 'Clipboard is empty',
      }
    }

    try {
      const client = await this.getClient()

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a text transformation assistant. The user will give you a command and some text.
Your job is to transform the text according to the command and return ONLY the transformed result.

Rules:
- Return ONLY the transformed text, no explanations or commentary
- If the command is unclear, make your best interpretation
- If the text cannot be transformed as requested (e.g., "translate" but no target language), make a reasonable assumption
- Preserve formatting when appropriate (e.g., keep code as code)
- For JSON/YAML operations, ensure valid output format

Examples:
- "make shorter" → condense the text while keeping meaning
- "fix grammar" → correct grammatical errors
- "translate to X" → translate to language X
- "summarize" → create a brief summary
- "bullet points" → convert to bullet list
- "pretty json" → format JSON with indentation
- "extract emails" → pull out email addresses
- "clean url" → remove tracking parameters from URLs`,
          },
          {
            role: 'user',
            content: `Command: ${command}

Text to transform:
${text}`,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 4096,
      })

      const output = response.choices[0]?.message?.content?.trim()

      if (!output) {
        return {
          success: false,
          input: text,
          output: '',
          error: 'LLM returned empty response',
        }
      }

      return {
        success: true,
        input: text,
        output,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[LLMTransformService] Transform failed:', errorMessage)

      return {
        success: false,
        input: text,
        output: '',
        error: errorMessage,
      }
    }
  }

  /**
   * Check if the service is available (has API key)
   */
  async isAvailable(): Promise<boolean> {
    const key = await secretsService.getOpenAIKey()
    return !!key
  }
}

// Singleton export
export const llmTransformService = new LLMTransformService()
