/**
 * IntentService - Routes transcripts to capabilities
 *
 * Responsibilities:
 * - Classify transcripts into intents
 * - Route intents to appropriate handlers (transform, automation, special)
 * - Handle cancel and undo commands
 * - Report unsupported intents clearly
 */

import {
  ClipMorphEvent,
  EventTypes,
  createEvent,
  VoiceTranscriptPayload,
  LastActionSummary,
} from '../../../packages/contracts/src'
import {
  classifyIntent,
  isSpecialIntent,
  isAutomationIntent,
  isCodeIntent,
  isSubagentIntent,
  isWorkflowIntent,
  isFileIntent,
  getSubagentIdFromIntent,
  matchSubagentTrigger,
  IntentClassification,
  Intent,
} from '../../../packages/core/src'
import { WorkflowStage } from '../../../packages/contracts/src'
import { jobManager } from './job-manager'
import { clipboardService } from './clipboard-service'
import { llmTransformService } from './llm-transform-service'
import { browserAgentService } from './browser-agent-service'
import { getOpenCodeService } from './opencode-service'
import { subagentService } from './subagent-service'
import { workflowService } from './workflow-service'
import { fileOperationService } from './file-operation-service'
import { skillService } from './skill-service'
import { documentExtractorService } from './document-extractor-service'
import { chartRendererService } from './chart-renderer-service'
import { storeService } from './store-service'
import { llmIntentService } from './llm-intent-service'
import { app } from 'electron'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Intent routing result
export interface IntentRoutingResult {
  intent: Intent
  classification: IntentClassification
  handled: boolean
  jobId?: string
  error?: string
}

class IntentService {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private lastAction: LastActionSummary | null = null
  private chartImagesDir: string | null = null

  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Get the directory for storing chart images
   */
  private getChartImagesDir(): string {
    if (!this.chartImagesDir) {
      this.chartImagesDir = join(app.getPath('userData'), 'chart-images')
      if (!existsSync(this.chartImagesDir)) {
        mkdirSync(this.chartImagesDir, { recursive: true })
      }
    }
    return this.chartImagesDir
  }

  /**
   * Save a chart image and return the path
   */
  private saveChartImage(imageBuffer: Buffer, jobId: string): string {
    const dir = this.getChartImagesDir()
    const filename = `chart-${jobId}.png`
    const filepath = join(dir, filename)
    writeFileSync(filepath, imageBuffer)
    return filepath
  }

  /**
   * Emit an event to the renderer
   */
  private emit<T>(event: ClipMorphEvent<T>): void {
    if (this.eventEmitter) {
      this.eventEmitter(event)
    }
  }

  /**
   * Check if a transcript is a browser automation task
   */
  private isBrowserTask(transcript: string): boolean {
    const normalized = transcript.toLowerCase()

    // Browser action keywords
    const browserKeywords = [
      'click',
      'fill out',
      'fill in',
      'fill the',
      'submit',
      'go to',
      'navigate to',
      'open',
      'browse to',
      'visit',
      'scroll',
      'download',
      'upload',
      'sign up',
      'sign in',
      'log in',
      'login',
      'register',
      'book',
      'reserve',
      'add to cart',
      'checkout',
      'buy',
      'purchase',
      'search for',
      'find the',
      'select',
      'choose',
      'pick',
    ]

    // Check for browser keywords
    for (const keyword of browserKeywords) {
      if (normalized.includes(keyword)) {
        return true
      }
    }

    // Check for URL patterns
    if (/https?:\/\/|www\.|\.com|\.org|\.io|\.net/.test(normalized)) {
      return true
    }

    // Check for form-related phrases
    const formPhrases = [
      'form',
      'application',
      'apply',
      'this page',
      'this site',
      'this website',
      'on the page',
      'on this page',
      'the button',
      'the link',
      'the field',
      'the input',
    ]

    for (const phrase of formPhrases) {
      if (normalized.includes(phrase)) {
        return true
      }
    }

    return false
  }

  /**
   * Route a transcript to the appropriate capability
   */
  async routeTranscript(transcript: string): Promise<IntentRoutingResult> {
    // First, check for subagent triggers (before standard classification)
    const subagentMatch = matchSubagentTrigger(
      transcript,
      subagentService.getAllTriggers()
    )

    if (subagentMatch && subagentMatch.confidence >= 0.5) {
      const subagentIntent: Intent = `subagent:${subagentMatch.subagentId}`
      const classification: IntentClassification = {
        intent: subagentIntent,
        confidence: subagentMatch.confidence,
        rawTranscript: transcript,
        normalizedTranscript: transcript.toLowerCase().trim(),
        matchedPatterns: [`trigger:${subagentMatch.trigger}`],
      }
      console.log(
        `[IntentService] Matched subagent "${subagentMatch.subagentId}" with trigger "${subagentMatch.trigger}" (confidence: ${subagentMatch.confidence})`
      )
      return this.handleSubagentIntent(classification, subagentMatch.subagentId)
    }

    // Check if we should use LLM-only classification
    const useLLMOnly = storeService.getSetting('intent_mode') === 'llm'
    
    let classification: IntentClassification
    let intent: Intent

    if (useLLMOnly) {
      // LLM-only mode: skip regex, use Cerebras/OpenAI directly
      console.log(`[IntentService] Using LLM-only classification for "${transcript}"`)
      try {
        const llmResult = await llmIntentService.classifyIntent(transcript)
        console.log(
          `[IntentService] LLM classified "${transcript}" as ${llmResult.intent} (confidence: ${llmResult.confidence}, reason: ${llmResult.reasoning})`
        )
        classification = {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          rawTranscript: transcript,
          normalizedTranscript: transcript.toLowerCase().trim(),
          matchedPatterns: [`llm:${llmResult.reasoning || 'classified'}`],
        }
        intent = llmResult.intent
      } catch (err) {
        console.error(`[IntentService] LLM classification failed, falling back to regex:`, err)
        // Fall back to regex if LLM fails
        classification = classifyIntent(transcript)
        intent = classification.intent
      }
    } else {
      // Default: regex classification with optional LLM fallback
      classification = classifyIntent(transcript)
      intent = classification.intent

      console.log(
        `[IntentService] Regex classified "${transcript}" as ${intent} (confidence: ${classification.confidence})`
      )

      // If regex confidence is low, try LLM classification as fallback
      const useLLMFallback = storeService.getSetting('use_llm_intent') !== 'false'
      if (useLLMFallback && classification.confidence < 0.5 && intent === 'unsupported') {
        try {
          console.log(`[IntentService] Low confidence, trying LLM classification...`)
          const llmResult = await llmIntentService.classifyIntent(transcript)
          console.log(
            `[IntentService] LLM classified "${transcript}" as ${llmResult.intent} (confidence: ${llmResult.confidence}, reason: ${llmResult.reasoning})`
          )
          
          if (llmResult.confidence > classification.confidence) {
            classification = {
              ...classification,
              intent: llmResult.intent,
              confidence: llmResult.confidence,
              matchedPatterns: [`llm:${llmResult.reasoning || 'classified'}`],
            }
            intent = llmResult.intent
          }
        } catch (err) {
          console.error(`[IntentService] LLM classification failed:`, err)
        }
      }
    }

    // Handle special intents (cancel, undo) - always hardcoded
    if (isSpecialIntent(intent)) {
      return this.handleSpecialIntent(classification)
    }

    // Handle code intents (OpenCode) - check BEFORE browser to avoid "opencode" matching "open"
    if (isCodeIntent(intent)) {
      return this.handleCodeIntent(classification)
    }

    // Handle automation/browser intents
    if (isAutomationIntent(intent) || this.isBrowserTask(transcript)) {
      return this.handleBrowserIntent(classification)
    }

    // Handle subagent intents (if classified as such)
    if (isSubagentIntent(intent)) {
      const subagentId = getSubagentIdFromIntent(intent)
      if (subagentId) {
        return this.handleSubagentIntent(classification, subagentId)
      }
    }

    // Handle workflow intents
    if (isWorkflowIntent(intent)) {
      return this.handleWorkflowIntent(classification)
    }

    // Handle file operation intents
    if (isFileIntent(intent)) {
      return this.handleFileIntent(classification)
    }

    // Everything else (transforms, unsupported, etc.) goes through LLM
    // The LLM will figure out what to do with the clipboard content
    return this.handleLLMTransform(classification)
  }

  /**
   * Handle LLM-powered transforms
   * Routes any command through the LLM to transform clipboard content
   * Also handles chart generation requests
   */
  private async handleLLMTransform(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification
    const command = classification.rawTranscript

    // Check if this is a chart request
    const isChartRequest = chartRendererService.isChartRequest(command)
    const jobType = isChartRequest ? 'chart-render' : 'llm-transform'

    // Create a transform job
    const job = jobManager.createJob(jobType, {
      command,
      intent,
    })

    console.log(`[IntentService] Created ${jobType} job ${job.id} for command: "${command}"`)

    // Check if LLM service is available
    const isAvailable = await llmTransformService.isAvailable()
    if (!isAvailable) {
      const error = 'OpenAI API key not configured. Set it in Settings.'
      jobManager.failJob(job.id, { code: 'TRANSFORM_NOT_AVAILABLE', message: error })
      this.updateLastAction(command, jobType, false, job.id, error)
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error,
      }
    }

    // Start the job
    jobManager.startJob(job.id)

    // Read clipboard
    const clipboardText = clipboardService.readClipboard()
    const snapshot = clipboardService.getCurrentSnapshot()

    if (!clipboardText || !snapshot) {
      const error = 'Clipboard is empty'
      jobManager.failJob(job.id, { code: 'TRANSFORM_INVALID_INPUT', message: error })
      this.updateLastAction(command, jobType, false, job.id, error)
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error,
      }
    }

    // Route to chart renderer or LLM transform
    if (isChartRequest) {
      return this.handleChartRequest(command, clipboardText, snapshot, job.id, intent, classification)
    }

    // Track start time for duration
    const startTime = Date.now()

    // Execute LLM transform - pass HTML for rich content like Excel tables
    const result = await llmTransformService.transform(command, clipboardText, snapshot.html)

    if (!result.success) {
      jobManager.failJob(job.id, { code: 'TRANSFORM_EXECUTION_FAILED', message: result.error || 'Transform failed' })
      this.updateLastAction(command, 'llm-transform', false, job.id, result.error)
      
      // Log failed operation
      storeService.addOperation({
        id: job.id,
        command,
        jobType: 'llm-transform',
        inputText: clipboardText,
        inputHtml: snapshot.html,
        success: false,
        error: result.error,
        durationMs: Date.now() - startTime,
      })
      
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error: result.error,
      }
    }

    // Write result to clipboard with snapshot gating
    const writeResult = clipboardService.writeClipboardGated(result.output, snapshot.id)

    if (!writeResult.success) {
      jobManager.failJob(job.id, {
        code: writeResult.error.code,
        message: writeResult.error.message,
      })
      this.updateLastAction(command, 'llm-transform', false, job.id, writeResult.error.message)
      
      // Log failed operation (clipboard write failed)
      storeService.addOperation({
        id: job.id,
        command,
        jobType: 'llm-transform',
        inputText: clipboardText,
        inputHtml: snapshot.html,
        outputText: result.output,
        success: false,
        error: writeResult.error.message,
        durationMs: Date.now() - startTime,
      })
      
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error: writeResult.error.message,
      }
    }

    // Complete the job
    jobManager.completeJob(job.id, { output: result.output })
    this.updateLastAction(command, 'llm-transform', true, job.id)

    // Log successful operation
    storeService.addOperation({
      id: job.id,
      command,
      jobType: 'llm-transform',
      inputText: clipboardText,
      inputHtml: snapshot.html,
      outputText: result.output,
      success: true,
      durationMs: Date.now() - startTime,
    })

    console.log(`[IntentService] LLM transform completed for job ${job.id}`)

    return {
      intent,
      classification,
      handled: true,
      jobId: job.id,
    }
  }

  /**
   * Handle chart generation requests
   * Renders table data to a chart image and copies to clipboard
   */
  private async handleChartRequest(
    command: string,
    clipboardText: string,
    snapshot: { id: string; html?: string },
    jobId: string,
    intent: Intent,
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    console.log(`[IntentService] Processing chart request: "${command}"`)
    const startTime = Date.now()

    try {
      // Generate and render chart
      const chartResult = await chartRendererService.createChartFromTable(
        command,
        clipboardText,
        snapshot.html
      )

      if (!chartResult.success || !chartResult.imageBuffer) {
        const error = chartResult.error || 'Failed to generate chart'
        jobManager.failJob(jobId, { code: 'CHART_RENDER_FAILED', message: error })
        this.updateLastAction(command, 'chart-render', false, jobId, error)
        
        // Log failed operation
        storeService.addOperation({
          id: jobId,
          command,
          jobType: 'chart-render',
          inputText: clipboardText,
          inputHtml: snapshot.html,
          success: false,
          error,
          durationMs: Date.now() - startTime,
        })
        
        return {
          intent,
          classification,
          handled: false,
          jobId,
          error,
        }
      }

      // Save chart image to disk for history
      const imagePath = this.saveChartImage(chartResult.imageBuffer, jobId)
      console.log(`[IntentService] Chart image saved to ${imagePath}`)

      // Write image to clipboard with snapshot gating
      const writeResult = clipboardService.writeImageGated(chartResult.imageBuffer, snapshot.id)

      if (!writeResult.success) {
        jobManager.failJob(jobId, {
          code: writeResult.error.code,
          message: writeResult.error.message,
        })
        this.updateLastAction(command, 'chart-render', false, jobId, writeResult.error.message)
        
        // Log failed operation (still save image path since we saved it)
        storeService.addOperation({
          id: jobId,
          command,
          jobType: 'chart-render',
          inputText: clipboardText,
          inputHtml: snapshot.html,
          outputImageSize: chartResult.imageBuffer.length,
          outputImagePath: imagePath,
          success: false,
          error: writeResult.error.message,
          durationMs: Date.now() - startTime,
        })
        
        return {
          intent,
          classification,
          handled: false,
          jobId,
          error: writeResult.error.message,
        }
      }

      // Complete the job
      jobManager.completeJob(jobId, { 
        chartType: chartResult.chartConfig?.type,
        imageSize: chartResult.imageBuffer.length,
      })
      this.updateLastAction(command, 'chart-render', true, jobId)

      // Log successful operation with image path
      storeService.addOperation({
        id: jobId,
        command,
        jobType: 'chart-render',
        inputText: clipboardText,
        inputHtml: snapshot.html,
        outputImageSize: chartResult.imageBuffer.length,
        outputImagePath: imagePath,
        success: true,
        durationMs: Date.now() - startTime,
      })

      console.log(`[IntentService] Chart rendered and copied to clipboard (${chartResult.chartConfig?.type}, ${chartResult.imageBuffer.length} bytes)`)

      return {
        intent,
        classification,
        handled: true,
        jobId,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      jobManager.failJob(jobId, { code: 'CHART_RENDER_FAILED', message: errorMsg })
      this.updateLastAction(command, 'chart-render', false, jobId, errorMsg)
      return {
        intent,
        classification,
        handled: false,
        jobId,
        error: errorMsg,
      }
    }
  }

  /**
   * Handle special intents (cancel, undo)
   */
  private async handleSpecialIntent(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification

    if (intent === 'cancel') {
      return this.handleCancel(classification)
    }

    if (intent === 'undo') {
      return this.handleUndo(classification)
    }

    return this.handleUnsupported(classification)
  }

  /**
   * Handle cancel command
   */
  private handleCancel(classification: IntentClassification): IntentRoutingResult {
    // Find any running or pending jobs and cancel them
    const runningJobs = jobManager.getJobsByStatus('running')
    const pendingJobs = jobManager.getJobsByStatus('pending')
    const allJobs = [...runningJobs, ...pendingJobs]

    let cancelledCount = 0
    for (const job of allJobs) {
      if (jobManager.cancelJob(job.id)) {
        cancelledCount++
      }
    }

    const message =
      cancelledCount > 0
        ? `Cancelled ${cancelledCount} job(s)`
        : 'No active jobs to cancel'

    console.log(`[IntentService] Cancel: ${message}`)

    this.updateLastAction(classification.rawTranscript, 'cancel', true)

    return {
      intent: 'cancel',
      classification,
      handled: true,
    }
  }

  /**
   * Handle undo command
   */
  private handleUndo(classification: IntentClassification): IntentRoutingResult {
    const result = clipboardService.undo()

    if (result.success) {
      console.log('[IntentService] Undo successful')
      this.updateLastAction(classification.rawTranscript, 'undo', true)
      return {
        intent: 'undo',
        classification,
        handled: true,
      }
    }

    const errorMsg = result.error?.message || 'Nothing to undo'
    console.log('[IntentService] Undo failed:', errorMsg)
    this.updateLastAction(classification.rawTranscript, 'undo', false, undefined, errorMsg)
    return {
      intent: 'undo',
      classification,
      handled: false,
      error: errorMsg,
    }
  }

  /**
   * Handle automation/browser intents using the Browser Agent
   */
  private async handleBrowserIntent(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification
    const task = classification.rawTranscript

    // Get clipboard content for context (e.g., resume text, URL)
    const clipboardText = clipboardService.readClipboard()

    // Check for files copied to clipboard (e.g., from Finder)
    // Then check if clipboard text is a file path to a document (PDF/DOCX)
    let resumeText = clipboardText || undefined
    let documentFilePath: string | undefined

    // First, try to get file paths from clipboard (when files are copied in Finder)
    const copiedFilePaths = clipboardService.readFilePaths()
    if (copiedFilePaths.length > 0) {
      // Look for a document file in the copied files
      for (const filePath of copiedFilePaths) {
        const extraction = await documentExtractorService.extractFromClipboard(filePath)
        if (extraction.isDocument) {
          console.log(`[IntentService] Found copied document file: ${extraction.filePath}`)
          resumeText = extraction.text
          documentFilePath = extraction.filePath
          break
        }
      }
    }

    // If no document from copied files, check if clipboard text is a file path
    if (!documentFilePath && clipboardText) {
      const extraction = await documentExtractorService.extractFromClipboard(clipboardText)
      if (extraction.isDocument) {
        console.log(`[IntentService] Extracted ${extraction.text.length} chars from ${extraction.fileType}: ${extraction.filePath}`)
        resumeText = extraction.text
        documentFilePath = extraction.filePath
      }
    }

    // Check if clipboard contains a URL to use as start URL
    const urlMatch = clipboardText?.match(/https?:\/\/[^\s]+/)
    const startUrl = urlMatch ? urlMatch[0] : undefined

    console.log(`[IntentService] Starting browser agent for task: "${task}"`)
    if (startUrl) {
      console.log(`[IntentService] Using start URL from clipboard: ${startUrl}`)
    }
    if (documentFilePath) {
      console.log(`[IntentService] Using document file for uploads: ${documentFilePath}`)
    }

    // Check if browser agent is available
    const isAvailable = await browserAgentService.isAvailable()
    if (!isAvailable) {
      const error = 'OpenAI API key not configured. Set it in Settings.'
      this.updateLastAction(task, 'browser-agent', false, undefined, error)
      return {
        intent,
        classification,
        handled: false,
        error,
      }
    }

    // Run the browser agent (async, non-blocking)
    // The agent will emit events as it progresses
    browserAgentService
      .runTask(task, {
        resumeText,
        startUrl,
        documentFilePath,
      })
      .then((result) => {
        console.log(`[IntentService] Browser agent completed:`, result)
        this.updateLastAction(
          task,
          'browser-agent',
          result.success,
          undefined,
          result.error || result.reason
        )
      })
      .catch((error) => {
        console.error(`[IntentService] Browser agent error:`, error)
        this.updateLastAction(task, 'browser-agent', false, undefined, (error as Error).message)
      })

    this.updateLastAction(task, 'browser-agent', true)

    return {
      intent,
      classification,
      handled: true,
    }
  }

  /**
   * Check if text looks like a file path
   */
  private isFilePath(text: string): boolean {
    if (!text) return false
    const trimmed = text.trim()
    // Check for common file path patterns
    return (
      trimmed.startsWith('/') || // Unix absolute path
      trimmed.startsWith('~/') || // Home directory
      trimmed.startsWith('./') || // Relative path
      trimmed.startsWith('../') || // Parent relative path
      /^[a-zA-Z]:\\/.test(trimmed) || // Windows path
      /^\w+\.(js|ts|tsx|jsx|py|java|go|rs|rb|php|css|html|json|yaml|yml|md|txt)$/.test(trimmed) // Just filename with extension
    )
  }

  /**
   * Handle code intents (OpenCode CLI)
   */
  private async handleCodeIntent(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification
    const openCodeService = getOpenCodeService()

    // Get clipboard content as context for code generation
    const clipboardText = clipboardService.readClipboard()

    // Build prompt from transcript
    let prompt = classification.rawTranscript
    let context = clipboardText || undefined

    // Check if clipboard contains a file path - if so, enhance the prompt
    if (clipboardText && this.isFilePath(clipboardText)) {
      const filePath = clipboardText.trim()
      prompt = `${classification.rawTranscript}\n\nTarget file: ${filePath}`
      context = undefined // Don't pass file path as context, it's now in the prompt
      console.log(`[IntentService] Detected file path in clipboard: ${filePath}`)
    } else if (clipboardText && clipboardText.length > 0) {
      // If clipboard has code, tell OpenCode it's code context
      prompt = `${classification.rawTranscript}\n\nHere is the code from clipboard to work with:\n\`\`\`\n${clipboardText}\n\`\`\``
      context = undefined // Already included in prompt
    }

    // Match and apply relevant skills
    const matchedSkills = skillService.matchSkillsForTask(prompt)
    if (matchedSkills.length > 0) {
      prompt = skillService.buildAugmentedPrompt(prompt, matchedSkills)
      console.log(`[IntentService] Applied ${matchedSkills.length} skill(s): ${matchedSkills.map(s => s.name).join(', ')}`)
    }

    // Get working directory from settings (defaults to home directory)
    const opencodeCwd = storeService.getSetting('opencode_cwd') || process.env.HOME || process.cwd()
    
    console.log(`[IntentService] Starting OpenCode task for intent ${intent}: "${classification.rawTranscript}"`)
    console.log(`[IntentService] Working directory: ${opencodeCwd}`)

    try {
      // Run the OpenCode task
      const result = await openCodeService.runTask({
        prompt,
        context,
        cwd: opencodeCwd,
      })

      console.log(`[IntentService] Started OpenCode job ${result.jobId}`)

      this.updateLastAction(classification.rawTranscript, intent, true, result.jobId)

      return {
        intent,
        classification,
        handled: true,
        jobId: result.jobId,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error(`[IntentService] OpenCode task failed:`, errorMsg)

      this.updateLastAction(classification.rawTranscript, intent, false, undefined, errorMsg)

      return {
        intent,
        classification,
        handled: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Handle subagent intents (custom OpenCode subagents)
   */
  private async handleSubagentIntent(
    classification: IntentClassification,
    subagentId: string
  ): Promise<IntentRoutingResult> {
    const { intent } = classification
    const openCodeService = getOpenCodeService()

    // Get the subagent config
    const subagent = subagentService.get(subagentId)
    if (!subagent) {
      const errorMsg = `Subagent not found: ${subagentId}`
      console.error(`[IntentService] ${errorMsg}`)
      this.updateLastAction(classification.rawTranscript, intent, false, undefined, errorMsg)
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg,
      }
    }

    // Get clipboard content as context
    const clipboardText = clipboardService.readClipboard()

    // Build full prompt with subagent's system prompt
    const userPrompt = classification.rawTranscript
    const fullPrompt = `${subagent.systemPrompt}\n\n---\nUser request: ${userPrompt}`

    console.log(`[IntentService] Running subagent "${subagent.name}" (${subagentId})`)

    try {
      const result = await openCodeService.runTask({
        prompt: fullPrompt,
        context: clipboardText || undefined,
      })

      console.log(`[IntentService] Started subagent job ${result.jobId}`)

      this.updateLastAction(classification.rawTranscript, `subagent:${subagent.name}`, true, result.jobId)

      return {
        intent,
        classification,
        handled: true,
        jobId: result.jobId,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error(`[IntentService] Subagent task failed:`, errorMsg)

      this.updateLastAction(classification.rawTranscript, `subagent:${subagent.name}`, false, undefined, errorMsg)

      return {
        intent,
        classification,
        handled: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Handle workflow intents (multi-stage agentic workflows)
   */
  private async handleWorkflowIntent(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification

    // Get clipboard content as context
    const clipboardText = clipboardService.readClipboard()

    // Determine stages based on intent
    let stages: WorkflowStage[]
    switch (intent) {
      case 'workflow:plan-code-review':
        stages = ['plan', 'code', 'review']
        break
      case 'workflow:plan-code':
        stages = ['plan', 'code']
        break
      case 'workflow:plan-only':
        stages = ['plan']
        break
      default:
        stages = ['plan', 'code', 'review'] // Default full workflow
    }

    console.log(`[IntentService] Starting workflow with stages: ${stages.join(' → ')}`)

    try {
      const result = await workflowService.startWorkflow({
        prompt: classification.rawTranscript,
        stages,
        context: clipboardText || undefined,
      })

      console.log(`[IntentService] Started workflow job ${result.job.id}`)

      this.updateLastAction(classification.rawTranscript, intent, true, result.job.id)

      return {
        intent,
        classification,
        handled: true,
        jobId: result.job.id,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error(`[IntentService] Workflow failed to start:`, errorMsg)

      this.updateLastAction(classification.rawTranscript, intent, false, undefined, errorMsg)

      return {
        intent,
        classification,
        handled: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Handle file operation intents
   */
  private async handleFileIntent(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification

    console.log(`[IntentService] Generating file operation preview for: "${classification.rawTranscript}"`)

    try {
      // Generate a preview of the file operations
      const result = await fileOperationService.generatePreview({
        prompt: classification.rawTranscript,
      })

      console.log(`[IntentService] File operation preview generated: ${result.preview.id}`)

      this.updateLastAction(
        classification.rawTranscript,
        intent,
        true,
        result.preview.id
      )

      return {
        intent,
        classification,
        handled: true,
        jobId: result.preview.id,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error(`[IntentService] File operation preview failed:`, errorMsg)

      this.updateLastAction(classification.rawTranscript, intent, false, undefined, errorMsg)

      return {
        intent,
        classification,
        handled: false,
        error: errorMsg,
      }
    }
  }

  /**
   * Get classification for a transcript without routing
   */
  classify(transcript: string): IntentClassification {
    return classifyIntent(transcript)
  }

  /**
   * Update last action summary
   */
  private updateLastAction(
    transcript: string,
    capability: string,
    success: boolean,
    jobId?: string,
    error?: string
  ): void {
    this.lastAction = {
      timestamp: Date.now(),
      transcript,
      capability,
      success,
      jobId,
      error,
    }
  }

  /**
   * Get last action summary
   */
  getLastAction(): LastActionSummary | null {
    return this.lastAction
  }
}

// Singleton export
export const intentService = new IntentService()
