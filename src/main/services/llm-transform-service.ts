/**
 * LLM Transform Service - AI-powered clipboard transformations
 *
 * Uses Cerebras (preferred for speed) or OpenAI to understand and execute 
 * arbitrary text transformations. No need to predefine transforms - the LLM 
 * figures out what to do.
 */

import OpenAI from 'openai'
import { secretsService } from './secrets-service'

// Cerebras API endpoint
const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1'

export interface LLMTransformResult {
  success: boolean
  input: string
  output: string
  error?: string
}

interface ClientInfo {
  client: OpenAI
  model: string
  provider: 'cerebras' | 'openai'
}

class LLMTransformService {
  private cerebrasClient: OpenAI | null = null
  private openaiClient: OpenAI | null = null
  private cerebrasKey: string | null = null
  private openaiKey: string | null = null

  /**
   * Get best available client (Cerebras preferred for speed)
   */
  private async getClient(): Promise<ClientInfo> {
    // Try Cerebras first (much faster: ~2100 tokens/s vs ~100 tokens/s)
    const cerebrasKey = await secretsService.getCerebrasKey()
    if (cerebrasKey) {
      if (!this.cerebrasClient || this.cerebrasKey !== cerebrasKey) {
        this.cerebrasKey = cerebrasKey
        this.cerebrasClient = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: CEREBRAS_BASE_URL,
        })
      }
      return { 
        client: this.cerebrasClient, 
        model: 'gpt-oss-120b', // 120B params, ~3000 tok/s
        provider: 'cerebras'
      }
    }

    // Fall back to OpenAI
    const openaiKey = await secretsService.getOpenAIKey()
    if (openaiKey) {
      if (!this.openaiClient || this.openaiKey !== openaiKey) {
        this.openaiKey = openaiKey
        this.openaiClient = new OpenAI({ apiKey: openaiKey })
      }
      return { 
        client: this.openaiClient, 
        model: 'gpt-4o-mini',
        provider: 'openai'
      }
    }

    throw new Error('No API key configured. Set Cerebras or OpenAI key in Settings.')
  }

  /**
   * Detect if content is tabular (TSV from Excel/Sheets or HTML table)
   */
  private isTabularContent(text: string, html?: string): boolean {
    // Check HTML for table tags
    if (html && /<table[\s>]/i.test(html)) {
      return true
    }
    // Check if text has tab-separated values (multiple rows with tabs)
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length >= 2) {
      const tabCounts = lines.map(l => (l.match(/\t/g) || []).length)
      // Consistent tab count across rows suggests TSV
      if (tabCounts[0] > 0 && tabCounts.every(c => c === tabCounts[0])) {
        return true
      }
    }
    return false
  }

  /**
   * Execute an LLM-powered transform
   * 
   * @param command - What the user wants to do (e.g., "make this shorter", "translate to Spanish")
   * @param text - The clipboard content to transform
   * @param html - Optional HTML content (for rich formats like Excel tables)
   */
  async transform(command: string, text: string, html?: string): Promise<LLMTransformResult> {
    console.log(`[LLMTransformService] Transform called with command: "${command}"`)
    console.log(`[LLMTransformService] Input text length: ${text?.length || 0}`)
    
    if (!text || text.trim().length === 0) {
      console.log('[LLMTransformService] Empty clipboard, returning error')
      return {
        success: false,
        input: text,
        output: '',
        error: 'Clipboard is empty',
      }
    }

    try {
      console.log('[LLMTransformService] Getting LLM client...')
      const { client, model, provider } = await this.getClient()
      console.log(`[LLMTransformService] Using ${provider} (${model}), calling API...`)
      const isTabular = this.isTabularContent(text, html)

      // Build content to send - prefer HTML for tables as it has structure
      let contentToTransform = text
      let formatHint = ''
      
      if (isTabular) {
        if (html) {
          // Include both for context - HTML has structure, text has clean values
          contentToTransform = `[HTML Table]:\n${html}\n\n[Plain Text (tab-separated)]:\n${text}`
          formatHint = `\n\nIMPORTANT: The input is TABULAR DATA (copied from Excel/Sheets). You MUST output as TAB-SEPARATED VALUES (TSV):
- Each row on its own line
- Columns separated by TAB characters (\\t), NOT spaces or pipes
- NO markdown table syntax (no | or --- )
- NO extra formatting or borders
- This ensures the result can be pasted back into Excel/Sheets correctly.

Example output format:
Header1\tHeader2\tHeader3
Value1\tValue2\tValue3`
        } else {
          formatHint = `\n\nIMPORTANT: The input is TAB-SEPARATED tabular data. Preserve the TSV format in your output:
- Each row on its own line
- Columns separated by TAB characters (\\t)
- NO markdown table syntax`
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      try {
        const response = await client.chat.completions.create({
          model,
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
- For JSON/YAML operations, ensure valid output format${formatHint}

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
${contentToTransform}`,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent results
          max_tokens: 4096,
        }, { signal: controller.signal })

        clearTimeout(timeoutId)

        const output = response.choices[0]?.message?.content?.trim()
        console.log(`[LLMTransformService] API response received, output length: ${output?.length || 0}`)

        if (!output) {
          console.log('[LLMTransformService] Empty response from LLM')
          return {
            success: false,
            input: text,
            output: '',
            error: 'LLM returned empty response',
          }
        }

        console.log(`[LLMTransformService] Transform successful, output preview: "${output.substring(0, 100)}..."`)
        return {
          success: true,
          input: text,
          output,
        }
      } catch (apiError) {
        clearTimeout(timeoutId)
        // Check if it was a timeout
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          console.error('[LLMTransformService] API call timed out after 15s')
          return {
            success: false,
            input: text,
            output: '',
            error: 'API call timed out',
          }
        }
        throw apiError // Re-throw for outer catch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[LLMTransformService] Transform failed:', errorMessage)
      console.error('[LLMTransformService] Full error:', error)

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
    const cerebrasKey = await secretsService.getCerebrasKey()
    const openaiKey = await secretsService.getOpenAIKey()
    return !!(cerebrasKey || openaiKey)
  }
}

// Singleton export
export const llmTransformService = new LLMTransformService()
