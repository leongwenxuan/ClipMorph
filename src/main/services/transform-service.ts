/**
 * TransformService - Executes clipboard transformations
 *
 * Responsibilities:
 * - Execute transform jobs based on intent
 * - Read clipboard, apply transform, write result
 * - Respect snapshot gating for clipboard safety
 */

import {
  ClipMorphEvent,
  EventTypes,
  createEvent,
} from '../../../packages/contracts/src'
import {
  cleanUrl,
  urlToMarkdown,
  jsonPretty,
  jsonMinify,
  jsonToYaml,
  yamlToJson,
  extractEmails,
  extractLinks,
  formatExtracted,
  redactSecrets,
  TransformIntent,
  parseChain,
} from '../../../packages/core/src'
import { jobManager } from './job-manager'
import { clipboardService } from './clipboard-service'

// Transform result
export interface TransformResult {
  success: boolean
  input: string
  output: string
  error?: string
}

class TransformService {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null

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
   * Execute a transform job
   */
  async executeTransform(jobId: string): Promise<TransformResult> {
    const job = jobManager.getJob(jobId)
    if (!job) {
      return { success: false, input: '', output: '', error: 'Job not found' }
    }

    const jobInput = job.input as { intent?: TransformIntent; transcript?: string }
    const intent = jobInput?.intent
    const transcript = jobInput?.transcript

    if (!intent) {
      jobManager.failJob(jobId, { code: 'TRANSFORM_INVALID_INPUT', message: 'No intent specified' })
      return { success: false, input: '', output: '', error: 'No intent specified' }
    }

    // Start the job
    jobManager.startJob(jobId)

    // Emit transform started event
    this.emit(createEvent(EventTypes.TRANSFORM_STARTED, { jobId, intent }))

    // Read clipboard
    const clipboardText = clipboardService.readClipboard()
    const snapshot = clipboardService.getCurrentSnapshot()

    if (!clipboardText || !snapshot) {
      const error = 'Clipboard is empty'
      jobManager.failJob(jobId, { code: 'TRANSFORM_INVALID_INPUT', message: error })
      this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error }))
      return { success: false, input: '', output: '', error }
    }

    try {
      // Check for chained transforms
      const chain = transcript ? parseChain(transcript) : null

      let result: TransformResult

      if (chain && chain.isChain && chain.intents.length > 1) {
        // Execute chain
        result = await this.executeChain(chain.intents, clipboardText)
      } else {
        // Execute single transform
        result = await this.applyTransform(intent, clipboardText)
      }

      if (!result.success) {
        jobManager.failJob(jobId, { code: 'TRANSFORM_EXECUTION_FAILED', message: result.error || 'Transform failed' })
        this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: result.error }))
        return result
      }

      // Write result to clipboard with snapshot gating
      const writeResult = clipboardService.writeClipboardGated(result.output, snapshot.id)

      if (!writeResult.success) {
        jobManager.failJob(jobId, {
          code: writeResult.error.code,
          message: writeResult.error.message,
        })
        this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: writeResult.error.message }))
        return { success: false, input: clipboardText, output: result.output, error: writeResult.error.message }
      }

      // Complete the job
      jobManager.completeJob(jobId, { output: result.output })
      this.emit(createEvent(EventTypes.TRANSFORM_COMPLETED, { jobId, output: result.output }))

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      jobManager.failJob(jobId, { code: 'TRANSFORM_EXECUTION_FAILED', message: errorMessage })
      this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: errorMessage })  )
      return { success: false, input: clipboardText, output: '', error: errorMessage }
    }
  }

  /**
   * Execute a chain of transforms
   */
  private async executeChain(intents: TransformIntent[], input: string): Promise<TransformResult> {
    let currentOutput = input

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i]
      const result = await this.applyTransform(intent, currentOutput)

      if (!result.success) {
        return {
          success: false,
          input,
          output: currentOutput,
          error: `Step ${i + 1} (${intent}) failed: ${result.error}`,
        }
      }

      currentOutput = result.output
    }

    return {
      success: true,
      input,
      output: currentOutput,
    }
  }

  /**
   * Apply a transform to text based on intent
   */
  private async applyTransform(intent: TransformIntent, text: string): Promise<TransformResult> {
    switch (intent) {
      case 'url:clean':
        return this.transformUrlClean(text)

      case 'url:markdown':
        return this.transformUrlMarkdown(text)

      case 'json:pretty':
        return this.transformJsonPretty(text)

      case 'json:minify':
        return this.transformJsonMinify(text)

      case 'json:to-yaml':
        return this.transformJsonToYaml(text)

      case 'yaml:to-json':
        return this.transformYamlToJson(text)

      case 'extract:emails':
        return this.transformExtractEmails(text)

      case 'extract:links':
        return this.transformExtractLinks(text)

      case 'redact:secrets':
        return this.transformRedactSecrets(text)

      default:
        return {
          success: false,
          input: text,
          output: '',
          error: `Unknown transform intent: ${intent}`,
        }
    }
  }

  /**
   * URL Clean transform
   */
  private transformUrlClean(text: string): TransformResult {
    const result = cleanUrl(text)

    if (!result.isUrl) {
      return {
        success: false,
        input: text,
        output: text,
        error: 'Clipboard does not contain a valid URL',
      }
    }

    return {
      success: true,
      input: text,
      output: result.cleaned,
    }
  }

  /**
   * URL to Markdown transform
   */
  private transformUrlMarkdown(text: string): TransformResult {
    const result = urlToMarkdown(text)

    if (!result.isUrl) {
      return {
        success: false,
        input: text,
        output: text,
        error: 'Clipboard does not contain a valid URL',
      }
    }

    return {
      success: true,
      input: text,
      output: result.markdown,
    }
  }

  /**
   * JSON Pretty transform
   */
  private transformJsonPretty(text: string): TransformResult {
    const result = jsonPretty(text)

    if (!result.isValidJson) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || 'Clipboard does not contain valid JSON',
      }
    }

    return {
      success: true,
      input: text,
      output: result.formatted,
    }
  }

  /**
   * JSON Minify transform
   */
  private transformJsonMinify(text: string): TransformResult {
    const result = jsonMinify(text)

    if (!result.isValidJson) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || 'Clipboard does not contain valid JSON',
      }
    }

    return {
      success: true,
      input: text,
      output: result.formatted,
    }
  }

  /**
   * JSON to YAML transform
   */
  private transformJsonToYaml(text: string): TransformResult {
    const result = jsonToYaml(text)

    if (!result.success) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || 'Clipboard does not contain valid JSON',
      }
    }

    return {
      success: true,
      input: text,
      output: result.converted,
    }
  }

  /**
   * YAML to JSON transform
   */
  private transformYamlToJson(text: string): TransformResult {
    const result = yamlToJson(text)

    if (!result.success) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || 'Clipboard does not contain valid YAML',
      }
    }

    return {
      success: true,
      input: text,
      output: result.converted,
    }
  }

  /**
   * Extract Emails transform
   */
  private transformExtractEmails(text: string): TransformResult {
    const result = extractEmails(text)

    if (result.count === 0) {
      return {
        success: false,
        input: text,
        output: text,
        error: 'No email addresses found in clipboard',
      }
    }

    return {
      success: true,
      input: text,
      output: formatExtracted(result),
    }
  }

  /**
   * Extract Links transform
   */
  private transformExtractLinks(text: string): TransformResult {
    const result = extractLinks(text)

    if (result.count === 0) {
      return {
        success: false,
        input: text,
        output: text,
        error: 'No links found in clipboard',
      }
    }

    return {
      success: true,
      input: text,
      output: formatExtracted(result),
    }
  }

  /**
   * Redact Secrets transform
   */
  private transformRedactSecrets(text: string): TransformResult {
    const result = redactSecrets(text)

    // Always succeed, even if no secrets found
    return {
      success: true,
      input: text,
      output: result.redacted,
    }
  }
}

// Singleton export
export const transformService = new TransformService()
