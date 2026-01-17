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
import { automationService } from './automation-service'
import { getOpenCodeService } from './opencode-service'
import { subagentService } from './subagent-service'
import { workflowService } from './workflow-service'
import { fileOperationService } from './file-operation-service'
import { skillService } from './skill-service'

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

  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
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

    // Classify the intent using standard patterns
    const classification = classifyIntent(transcript)
    const { intent } = classification

    console.log(
      `[IntentService] Classified "${transcript}" as ${intent} (confidence: ${classification.confidence})`
    )

    // Handle special intents (cancel, undo) - always hardcoded
    if (isSpecialIntent(intent)) {
      return this.handleSpecialIntent(classification)
    }

    // Handle automation intents
    if (isAutomationIntent(intent)) {
      return this.handleAutomationIntent(classification)
    }

    // Handle code intents (OpenCode)
    if (isCodeIntent(intent)) {
      return this.handleCodeIntent(classification)
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
   */
  private async handleLLMTransform(
    classification: IntentClassification
  ): Promise<IntentRoutingResult> {
    const { intent } = classification
    const command = classification.rawTranscript

    // Create a transform job
    const job = jobManager.createJob('llm-transform', {
      command,
      intent,
    })

    console.log(`[IntentService] Created LLM transform job ${job.id} for command: "${command}"`)

    // Check if LLM service is available
    const isAvailable = await llmTransformService.isAvailable()
    if (!isAvailable) {
      const error = 'OpenAI API key not configured. Set it in Settings.'
      jobManager.failJob(job.id, { code: 'TRANSFORM_NOT_AVAILABLE', message: error })
      this.updateLastAction(command, 'llm-transform', false, job.id, error)
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
      this.updateLastAction(command, 'llm-transform', false, job.id, error)
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error,
      }
    }

    // Execute LLM transform
    const result = await llmTransformService.transform(command, clipboardText)

    if (!result.success) {
      jobManager.failJob(job.id, { code: 'TRANSFORM_EXECUTION_FAILED', message: result.error || 'Transform failed' })
      this.updateLastAction(command, 'llm-transform', false, job.id, result.error)
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

    console.log(`[IntentService] LLM transform completed for job ${job.id}`)

    return {
      intent,
      classification,
      handled: true,
      jobId: job.id,
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
   * Handle automation intents
   */
  private handleAutomationIntent(classification: IntentClassification): IntentRoutingResult {
    const { intent } = classification

    // Get clipboard content for automation context (e.g., resume text)
    const clipboardText = clipboardService.readClipboard()

    // Start automation job via the automation service
    const job = automationService.startJob({
      type: 'portal',
      context: {
        intent,
        transcript: classification.rawTranscript,
        clipboardContent: clipboardText,
      },
    })

    console.log(`[IntentService] Started automation job ${job.id} for intent ${intent}`)

    this.updateLastAction(classification.rawTranscript, intent, true, job.id)

    return {
      intent,
      classification,
      handled: true,
      jobId: job.id,
    }
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

    // Match and apply relevant skills
    const matchedSkills = skillService.matchSkillsForTask(prompt)
    if (matchedSkills.length > 0) {
      prompt = skillService.buildAugmentedPrompt(prompt, matchedSkills)
      console.log(`[IntentService] Applied ${matchedSkills.length} skill(s): ${matchedSkills.map(s => s.name).join(', ')}`)
    }

    console.log(`[IntentService] Starting OpenCode task for intent ${intent}: "${classification.rawTranscript}"`)

    try {
      // Run the OpenCode task
      const result = await openCodeService.runTask({
        prompt,
        context: clipboardText || undefined,
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
