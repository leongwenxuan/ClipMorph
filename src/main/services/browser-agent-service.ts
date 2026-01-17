/**
 * Browser Agent Service - AI-powered browser automation
 *
 * Uses agent-browser CLI for browser control and GPT-4 for decision making.
 * Implements a snapshot → decide → execute → resnapshot loop.
 */

import { spawn } from 'child_process'
import OpenAI from 'openai'
import { secretsService } from './secrets-service'
import { jobManager } from './job-manager'
import { storeService } from './store-service'
import {
  ClipMorphEvent,
  EventTypes,
  createEvent,
} from '../../../packages/contracts/src'

// Types for agent-browser responses
interface AgentBrowserSnapshot {
  success: boolean
  data?: {
    snapshot: string
    refs: Record<string, { role: string; name: string; [key: string]: unknown }>
  }
  error?: string
}

interface AgentBrowserResult {
  success: boolean
  data?: unknown
  error?: string
}

// Action types the LLM can return
type BrowserAction =
  | { type: 'click'; ref: string }
  | { type: 'fill'; ref: string; value: string }
  | { type: 'select'; ref: string; value: string }
  | { type: 'hover'; ref: string }
  | { type: 'scroll'; direction: 'up' | 'down' }
  | { type: 'wait'; seconds: number }
  | { type: 'navigate'; url: string }
  | { type: 'upload'; ref: string } // Upload the document file to a file input

// LLM decision response
type LLMDecision =
  | { type: 'actions'; actions: BrowserAction[] }
  | { type: 'completed'; reason: string }
  | { type: 'needs_input'; reason: string; message: string }
  | { type: 'failed'; reason: string }

// Task result
export interface BrowserTaskResult {
  success: boolean
  state: 'completed' | 'failed' | 'needs_input' | 'cancelled'
  reason?: string
  message?: string
  actionsExecuted: number
  error?: string
}

// Task context
export interface BrowserTaskContext {
  resumeText?: string
  startUrl?: string
  documentFilePath?: string // Path to document file for file uploads
  additionalInfo?: Record<string, string>
}

class BrowserAgentService {
  private cerebrasClient: OpenAI | null = null
  private openaiClient: OpenAI | null = null
  private apiKey: string | null = null
  private cerebrasKey: string | null = null
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private activeJobId: string | null = null
  private cancelled = false

  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Emit an event
   */
  private emit<T>(event: ClipMorphEvent<T>): void {
    if (this.eventEmitter) {
      this.eventEmitter(event)
    }
  }

  /**
   * Get or create Cerebras client (preferred for browser agent - much faster inference)
   * Falls back to OpenAI if Cerebras key not configured
   */
  private async getLLMClient(): Promise<{ client: OpenAI; model: string }> {
    // Try Cerebras first (preferred for speed: ~2100+ tokens/s vs ~100 tokens/s)
    const cerebrasKey = await secretsService.getCerebrasKey()
    if (cerebrasKey) {
      if (!this.cerebrasClient || this.cerebrasKey !== cerebrasKey) {
        this.cerebrasKey = cerebrasKey
        this.cerebrasClient = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: 'https://api.cerebras.ai/v1',
        })
      }
      // Get model from settings, default to qwen-3-32b
      const model = storeService.getSetting('cerebras.model') || 'qwen-3-32b'
      return { client: this.cerebrasClient, model }
    }

    // Fall back to OpenAI
    const openaiKey = await secretsService.getOpenAIKey()
    if (!openaiKey) {
      throw new Error('No API key configured. Set Cerebras or OpenAI key in Settings.')
    }

    if (!this.openaiClient || this.apiKey !== openaiKey) {
      this.apiKey = openaiKey
      this.openaiClient = new OpenAI({ apiKey: openaiKey })
    }

    return { client: this.openaiClient, model: 'gpt-4o' }
  }

  /**
   * Escape a string for shell usage (wrap in single quotes, escape internal quotes)
   */
  private escapeShellArg(arg: string): string {
    // Wrap in single quotes and escape any single quotes within
    // foo'bar becomes 'foo'\''bar'
    return `'${arg.replace(/'/g, "'\\''")}'`
  }

  /**
   * Execute an agent-browser CLI command
   */
  private async execAgentBrowser(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = 'npx'
      // Escape args that might contain special characters
      const escapedArgs = args.map((arg, i) => {
        // First arg is the subcommand (open, fill, click, etc.) - don't escape
        if (i === 0) return arg
        // Refs like @e1, flags like --values, -i, --json are safe
        if (arg.startsWith('@') || arg.startsWith('-')) return arg
        // URLs starting with http are generally safe but may have special chars
        if (arg.startsWith('http://') || arg.startsWith('https://')) {
          return this.escapeShellArg(arg)
        }
        // Everything else (values for fill, select, etc.) should be escaped
        // This handles spaces, quotes, apostrophes, brackets, etc.
        return this.escapeShellArg(arg)
      })
      const fullArgs = ['agent-browser', ...escapedArgs]
      
      console.log(`[BrowserAgent] Executing: ${cmd} ${fullArgs.join(' ')}`)
      
      // Use npx to run agent-browser from node_modules
      const proc = spawn(cmd, fullArgs, {
        cwd: process.cwd(),
        env: { 
          ...process.env,
          // Ensure PATH includes common node locations
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`,
        },
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        const str = data.toString()
        stdout += str
        console.log(`[BrowserAgent stdout] ${str.trim()}`)
      })

      proc.stderr?.on('data', (data) => {
        const str = data.toString()
        stderr += str
        console.log(`[BrowserAgent stderr] ${str.trim()}`)
      })

      proc.on('close', (code) => {
        console.log(`[BrowserAgent] Command exited with code ${code}`)
        if (code === 0) {
          resolve(stdout.trim())
        } else {
          reject(new Error(stderr || `agent-browser exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        console.error(`[BrowserAgent] Spawn error:`, err)
        reject(err)
      })
    })
  }

  /**
   * Open a URL in the browser (launches browser if not already open)
   */
  async open(url: string): Promise<void> {
    console.log(`[BrowserAgent] Opening: ${url}`)
    await this.execAgentBrowser(['open', url, '--headed'])
  }

  /**
   * Get a snapshot of the current page
   */
  async snapshot(): Promise<AgentBrowserSnapshot> {
    console.log('[BrowserAgent] Taking snapshot...')
    const output = await this.execAgentBrowser(['snapshot', '-i', '--json'])

    try {
      return JSON.parse(output)
    } catch {
      return { success: false, error: 'Failed to parse snapshot' }
    }
  }

  /**
   * Click an element by ref
   */
  async click(ref: string): Promise<AgentBrowserResult> {
    console.log(`[BrowserAgent] Clicking: ${ref}`)
    try {
      await this.execAgentBrowser(['click', ref])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Fill a text field by ref
   */
  async fill(ref: string, value: string): Promise<AgentBrowserResult> {
    console.log(`[BrowserAgent] Filling ${ref}: "${value.substring(0, 50)}..."`)
    try {
      await this.execAgentBrowser(['fill', ref, value])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Select an option by ref
   * agent-browser expects: select <ref> <value>
   */
  async select(ref: string, value: string): Promise<AgentBrowserResult> {
    console.log(`[BrowserAgent] Selecting ${ref}: "${value}"`)
    try {
      // agent-browser select expects: select @ref "value"
      await this.execAgentBrowser(['select', ref, value])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Hover over an element by ref
   */
  async hover(ref: string): Promise<AgentBrowserResult> {
    console.log(`[BrowserAgent] Hovering: ${ref}`)
    try {
      await this.execAgentBrowser(['hover', ref])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Scroll the page
   */
  async scroll(direction: 'up' | 'down'): Promise<AgentBrowserResult> {
    try {
      await this.execAgentBrowser(['scroll', direction])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    console.log('[BrowserAgent] Closing browser')
    try {
      await this.execAgentBrowser(['close'])
    } catch {
      // Ignore close errors
    }
  }

  /**
   * Ask the LLM what to do next
   */
  private async decideNextActions(
    snapshot: AgentBrowserSnapshot,
    task: string,
    context: BrowserTaskContext,
    actionHistory: string[]
  ): Promise<LLMDecision> {
    const { client, model } = await this.getLLMClient()

    const systemPrompt = `You are a browser automation agent. You control a web browser to complete tasks for the user.

You receive:
1. A TASK describing what the user wants to accomplish
2. A PAGE SNAPSHOT showing the current page state with element refs (like @e1, @e2)
3. CONTEXT with additional information (e.g., resume text, user info)
4. ACTION HISTORY showing what you've already done

Your job is to decide what actions to take next.

AVAILABLE ACTIONS:
- click: Click an element (buttons, links, radio buttons, checkboxes). { "type": "click", "ref": "@e5" }
- fill: Fill a text field/textbox. { "type": "fill", "ref": "@e3", "value": "John Doe" }
- select: Select from a dropdown/listbox. { "type": "select", "ref": "@e7", "value": "California" }
- hover: Hover over an element. { "type": "hover", "ref": "@e2" }
- scroll: Scroll the page. { "type": "scroll", "direction": "down" }
- wait: Wait for a moment. { "type": "wait", "seconds": 2 }
- navigate: Go to a URL. { "type": "navigate", "url": "https://..." }
- upload: Upload the user's document to a file input. { "type": "upload", "ref": "@e8" }

ELEMENT TYPES:
- textbox: Use "fill" action
- listbox/combobox: For Google Forms and similar, click the OPTION element directly (e.g., click @e6 for "Software Engineering" option). Do NOT use "select" action on Google Forms.
- radio: Use "click" action to select the radio option
- checkbox: Use "click" action to toggle the checkbox
- button/link: Use "click" action
- option: Use "click" action to select the option in a dropdown

RESPONSE FORMAT (JSON only):
1. To execute actions:
   { "type": "actions", "actions": [{ "type": "click", "ref": "@e5" }, { "type": "fill", "ref": "@e3", "value": "John" }] }

2. When task is complete:
   { "type": "completed", "reason": "Successfully submitted the form" }

3. When user input is needed (login, captcha, ambiguity):
   { "type": "needs_input", "reason": "login", "message": "Please log in to continue" }

4. When task cannot be completed:
   { "type": "failed", "reason": "Cannot find the submit button on this page" }

IMPORTANT RULES:
- Only use refs that exist in the current snapshot
- Fill forms with information from the CONTEXT when available
- A "Sign in" link on a page does NOT mean login is required - many forms work without login
- Only return needs_input for login if the page BLOCKS you from proceeding (e.g., "You must sign in to continue")
- If you see a CAPTCHA that blocks progress, return needs_input

FORM FILLING RULES (CRITICAL):
- When you see a form, you MUST fill ALL visible input fields before clicking submit
- Fill textboxes, select dropdowns, check checkboxes, and select radio buttons
- Do NOT click submit until you have filled every field on the form
- For each iteration, fill 3-5 fields at a time, then get a new snapshot to see remaining fields
- If you don't have specific info for a field, generate reasonable placeholder values (e.g., "Software Engineer" for job title, "5 years" for experience)
- For date fields, use today's date or a reasonable date
- For rating/scale questions (1-5), pick a reasonable middle value like 3 or 4
- Only click Submit/Next AFTER all visible fields are filled
- AFTER selecting radio buttons (especially for work location like On-site/Hybrid/Remote), NEW FIELDS may appear. Always scroll down and check for new fields before submitting.
- If a required field asks for information not in your context (like office location), use a reasonable placeholder like "San Francisco, CA" or "Remote"

DETECTING STUCK LOOPS:
- If you click Submit and the page snapshot looks THE SAME (same fields, same refs), the form has validation errors
- Look for any unfilled required fields and fill them
- Scroll down to check for fields you might have missed
- If stuck after 3 submit attempts, return { "type": "needs_input", "reason": "validation", "message": "Form has required fields I cannot fill - please review" }

- Respond with ONLY valid JSON, no explanations`

    let contextStr = 'No additional context provided.'
    if (context.resumeText) {
      contextStr = `RESUME/USER INFO:\n${context.resumeText}`
      if (context.additionalInfo) {
        contextStr += '\n\n' + Object.entries(context.additionalInfo)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      }
    }
    if (context.documentFilePath) {
      contextStr += `\n\nDOCUMENT FILE AVAILABLE: ${context.documentFilePath}\nYou can use the "upload" action to upload this file to file input fields.`
    }

    const historyStr =
      actionHistory.length > 0
        ? `PREVIOUS ACTIONS:\n${actionHistory.slice(-10).join('\n')}`
        : 'No actions taken yet.'

    const userPrompt = `TASK: ${task}

PAGE SNAPSHOT:
${snapshot.data?.snapshot || 'Failed to get snapshot'}

CONTEXT:
${contextStr}

${historyStr}

What should I do next? Respond with JSON only.`

    try {
      console.log(`[BrowserAgent] Using model: ${model}`)
      
      // Build request - only use response_format for OpenAI models (Cerebras may not support it)
      const isOpenAI = model.startsWith('gpt-')
      
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        // Only add response_format for OpenAI (Cerebras models may not support it)
        ...(isOpenAI ? { response_format: { type: 'json_object' as const } } : {}),
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        return { type: 'failed', reason: 'LLM returned empty response' }
      }

      // Parse JSON - handle potential markdown code blocks and thinking tags
      let jsonStr = content.trim()
      
      // Strip Qwen's <think>...</think> reasoning block
      const thinkEndIndex = jsonStr.indexOf('</think>')
      if (thinkEndIndex !== -1) {
        jsonStr = jsonStr.slice(thinkEndIndex + 8).trim()
      }
      
      // Strip markdown code blocks
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()
      
      let decision: LLMDecision
      try {
        decision = JSON.parse(jsonStr) as LLMDecision
      } catch (parseError) {
        // Try to repair truncated JSON by closing brackets
        console.warn('[BrowserAgent] JSON parse failed, attempting repair...')
        let repairedJson = jsonStr
        
        // Count open/close brackets
        const openBraces = (repairedJson.match(/{/g) || []).length
        const closeBraces = (repairedJson.match(/}/g) || []).length
        const openBrackets = (repairedJson.match(/\[/g) || []).length
        const closeBrackets = (repairedJson.match(/]/g) || []).length
        
        // Add missing closing brackets
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repairedJson += ']'
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          repairedJson += '}'
        }
        
        try {
          decision = JSON.parse(repairedJson) as LLMDecision
          console.log('[BrowserAgent] JSON repair successful')
        } catch {
          // If repair fails, return error
          throw parseError
        }
      }
      
      console.log('[BrowserAgent] LLM decision:', JSON.stringify(decision, null, 2))
      
      // Handle empty object response
      if (!decision.type && Object.keys(decision).length === 0) {
        return { type: 'failed', reason: 'LLM returned empty JSON object - retrying' }
      }
      
      return decision
    } catch (error) {
      console.error('[BrowserAgent] LLM error:', error)
      return { type: 'failed', reason: `LLM error: ${(error as Error).message}` }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: BrowserAction, context?: BrowserTaskContext): Promise<AgentBrowserResult> {
    switch (action.type) {
      case 'click':
        return this.click(action.ref)
      case 'fill':
        return this.fill(action.ref, action.value)
      case 'select':
        return this.select(action.ref, action.value)
      case 'hover':
        return this.hover(action.ref)
      case 'scroll':
        // agent-browser doesn't have scroll, use keyboard
        try {
          await this.execAgentBrowser(['press', action.direction === 'down' ? 'PageDown' : 'PageUp'])
          return { success: true }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      case 'wait':
        await new Promise((resolve) => setTimeout(resolve, action.seconds * 1000))
        return { success: true }
      case 'navigate':
        try {
          await this.open(action.url)
          return { success: true }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      case 'upload':
        return this.upload(action.ref, context?.documentFilePath)
      default:
        return { success: false, error: `Unknown action type: ${(action as BrowserAction).type}` }
    }
  }

  /**
   * Upload a file to a file input element
   */
  async upload(ref: string, filePath?: string): Promise<AgentBrowserResult> {
    if (!filePath) {
      return { success: false, error: 'No document file available for upload' }
    }
    console.log(`[BrowserAgent] Uploading file to ${ref}: ${filePath}`)
    try {
      const output = await this.execAgentBrowser(['upload', ref, filePath])
      return { success: true, data: output }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Run a browser automation task
   */
  async runTask(task: string, context: BrowserTaskContext = {}): Promise<BrowserTaskResult> {
    this.cancelled = false

    // Create a job
    const job = jobManager.createJob('browser-agent', { task, context })
    this.activeJobId = job.id
    jobManager.startJob(job.id)

    console.log(`[BrowserAgent] Starting task: "${task}"`)
    this.emit(createEvent(EventTypes.AUTOMATION_STARTED, { jobId: job.id, task }))

    const actionHistory: string[] = []
    let actionsExecuted = 0
    const maxIterations = 30

    try {
      // Extract URL from task - try multiple patterns
      // 1. After explicit navigation words
      const urlAfterNavWord = task.match(/(?:go to|navigate to|open|visit|browse to)\s+(https?:\/\/[^\s]+|[^\s]+\.[^\s]+)/i)
      // 2. Any https:// URL in the task
      const anyHttpsUrl = task.match(/(https?:\/\/[^\s]+)/i)
      // 3. After "at" (e.g., "apply for job at https://...")
      const urlAfterAt = task.match(/\bat\s+(https?:\/\/[^\s]+)/i)
      
      const extractedUrl = urlAfterNavWord?.[1] || urlAfterAt?.[1] || anyHttpsUrl?.[1] || null
      
      // Determine start URL: explicit context > extracted from task > default
      let startUrl = context.startUrl
      if (!startUrl && extractedUrl) {
        // Add https:// if missing
        startUrl = extractedUrl.startsWith('http') ? extractedUrl : `https://${extractedUrl}`
      }
      
      // Must have a URL to start - if none provided, let LLM navigate
      if (!startUrl) {
        // Use Google as a safe default starting point
        // The LLM can navigate from here based on the task
        startUrl = 'https://www.google.com'
      }
      
      console.log(`[BrowserAgent] Opening browser at: ${startUrl}`)
      await this.open(startUrl)
      await new Promise((resolve) => setTimeout(resolve, 3000)) // Wait for page load

      // Track submit attempts and previous snapshots for loop detection
      let submitAttempts = 0
      let previousSnapshotText = ''

      // Main loop
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (this.cancelled) {
          jobManager.cancelJob(job.id)
          return {
            success: false,
            state: 'cancelled',
            actionsExecuted,
          }
        }

        // Scroll down to reveal any hidden/conditional fields before taking snapshot
        await this.scroll('down')
        await new Promise((resolve) => setTimeout(resolve, 500))
        await this.scroll('up') // Scroll back up to see the full form
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Get snapshot
        const snapshot = await this.snapshot()
        if (!snapshot.success) {
          jobManager.failJob(job.id, { code: 'BROWSER_ERROR', message: snapshot.error || 'Snapshot failed' })
          return {
            success: false,
            state: 'failed',
            error: snapshot.error || 'Failed to get page snapshot',
            actionsExecuted,
          }
        }

        // Detect stuck loop: if snapshot is identical after a submit, we're likely hitting validation errors
        const currentSnapshotText = snapshot.data?.snapshot || ''
        if (currentSnapshotText === previousSnapshotText && submitAttempts > 0) {
          submitAttempts++
          console.log(`[BrowserAgent] Detected same snapshot after submit (attempt ${submitAttempts})`)
          if (submitAttempts >= 3) {
            // Add hint to action history about stuck loop
            actionHistory.push('WARNING: Form submission failed 3 times - page unchanged. There are likely unfilled required fields or validation errors. Scroll to find hidden fields.')
          }
        }
        previousSnapshotText = currentSnapshotText

        // Ask LLM what to do
        const decision = await this.decideNextActions(snapshot, task, context, actionHistory)

        // Handle terminal states
        if (decision.type === 'completed') {
          jobManager.completeJob(job.id, { reason: decision.reason })
          await this.close()
          return {
            success: true,
            state: 'completed',
            reason: decision.reason,
            actionsExecuted,
          }
        }

        if (decision.type === 'needs_input') {
          jobManager.transitionJob(job.id, 'needs_input')
          return {
            success: false,
            state: 'needs_input',
            reason: decision.reason,
            message: decision.message,
            actionsExecuted,
          }
        }

        if (decision.type === 'failed') {
          jobManager.failJob(job.id, { code: 'TASK_FAILED', message: decision.reason })
          await this.close()
          return {
            success: false,
            state: 'failed',
            error: decision.reason,
            actionsExecuted,
          }
        }

        // Handle actions - either wrapped in { type: 'actions', actions: [...] } or direct action object
        let actionsToExecute: BrowserAction[] = []
        
        if (decision.type === 'actions' && decision.actions.length > 0) {
          actionsToExecute = decision.actions
        } else if ('url' in decision || 'ref' in decision || 'direction' in decision || 'seconds' in decision) {
          // LLM returned a direct action object instead of wrapped - handle it
          actionsToExecute = [decision as unknown as BrowserAction]
        }

        if (actionsToExecute.length > 0) {
          for (const action of actionsToExecute) {
            if (this.cancelled) break

            const actionStr = JSON.stringify(action)
            console.log(`[BrowserAgent] Executing: ${actionStr}`)

            const result = await this.executeAction(action, context)
            actionsExecuted++
            actionHistory.push(`${actionStr} → ${result.success ? 'OK' : result.error}`)

            // Track submit button clicks for loop detection
            if (action.type === 'click' && result.success) {
              // Check if we clicked something that looks like a submit button
              const refLower = (action.ref || '').toLowerCase()
              if (refLower.includes('submit') || actionStr.toLowerCase().includes('submit')) {
                submitAttempts++
                console.log(`[BrowserAgent] Submit click detected (attempt ${submitAttempts})`)
              }
            }

            this.emit(
              createEvent(EventTypes.AUTOMATION_STEP, {
                jobId: job.id,
                action: actionStr,
                success: result.success,
              })
            )

            if (!result.success) {
              console.warn(`[BrowserAgent] Action failed: ${result.error}`)
              // Don't fail immediately, let LLM decide what to do
            }

            // Small delay between actions
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }

        // Wait a bit before next iteration
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Max iterations reached
      jobManager.failJob(job.id, { code: 'MAX_ITERATIONS', message: 'Max iterations reached' })
      await this.close()
      return {
        success: false,
        state: 'failed',
        error: 'Max iterations reached without completing task',
        actionsExecuted,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error('[BrowserAgent] Task error:', errorMsg)
      jobManager.failJob(job.id, { code: 'BROWSER_ERROR', message: errorMsg })
      await this.close()
      return {
        success: false,
        state: 'failed',
        error: errorMsg,
        actionsExecuted,
      }
    } finally {
      this.activeJobId = null
    }
  }

  /**
   * Cancel the current task
   */
  cancel(): void {
    this.cancelled = true
    if (this.activeJobId) {
      jobManager.cancelJob(this.activeJobId)
    }
  }

  /**
   * Check if a task is running
   */
  isRunning(): boolean {
    return this.activeJobId !== null
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    const cerebrasKey = await secretsService.getCerebrasKey()
    if (cerebrasKey) return true
    const openaiKey = await secretsService.getOpenAIKey()
    return !!openaiKey
  }
}

// Singleton export
export const browserAgentService = new BrowserAgentService()
