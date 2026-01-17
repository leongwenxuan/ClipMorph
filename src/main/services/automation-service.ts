/**
 * Automation Service
 * Orchestrates browser automation jobs with lifecycle management
 * Status: pending → running → (needs_input | completed | failed | cancelled)
 */

import {
  AutomationJob,
  AutomationJobType,
  AutomationStartRequest,
  AutomationState,
  NeedsInputReason,
  JobStatus,
  EventTypes,
  createEvent,
  ClipMorphEvent,
  AutomationStatusPayload,
  IpcError,
} from '../../../packages/contracts/src'
import { jobManager } from './job-manager'
import {
  AutomationLoop,
  type ActionDecider,
  type LoopIterationResult,
} from '../../../packages/browser-automation/src'

export type AutomationEventEmitter = <T>(event: ClipMorphEvent<T>) => void

/**
 * Maximum number of recent jobs to keep in memory
 */
const MAX_RECENT_JOBS = 10

/**
 * Automation Service class
 * Manages automation job lifecycle and state
 */
export class AutomationService {
  private activeJob: AutomationJob | null = null
  private recentJobs: AutomationJob[] = []
  private eventEmitter: AutomationEventEmitter | null = null
  private jobCounter = 0
  private activeLoop: AutomationLoop | null = null

  /**
   * Set the event emitter for broadcasting automation events
   */
  setEventEmitter(emitter: AutomationEventEmitter): void {
    this.eventEmitter = emitter
  }

  /**
   * Emit an automation event
   */
  private emitEvent(
    type: (typeof EventTypes)[keyof typeof EventTypes],
    job: AutomationJob,
    previousStatus?: JobStatus
  ): void {
    if (this.eventEmitter) {
      this.eventEmitter(
        createEvent<AutomationStatusPayload>(type, { job, previousStatus }, job.id)
      )
    }
  }

  /**
   * Generate a unique automation job ID
   */
  private generateJobId(): string {
    this.jobCounter++
    return `auto-${Date.now()}-${this.jobCounter}`
  }

  /**
   * Create and start a new automation job
   */
  startJob(request: AutomationStartRequest): AutomationJob {
    // Cancel any existing active job
    if (this.activeJob && !this.isTerminal(this.activeJob.status)) {
      this.cancelJob(this.activeJob.id)
    }

    const now = Date.now()
    const job: AutomationJob = {
      id: this.generateJobId(),
      type: request.type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      targetUrl: request.targetUrl,
      input: request.context,
      stepCount: 0,
    }

    this.activeJob = job

    // Also register with the global job manager
    const baseJob = jobManager.createJob(request.type, request.context)
    job.id = baseJob.id // Use the job manager's ID for consistency

    this.emitEvent(EventTypes.AUTOMATION_STARTED, job)

    // Transition to running
    this.transitionJob(job.id, 'running')

    return job
  }

  /**
   * Get the current automation state
   */
  getState(): AutomationState {
    return {
      activeJob: this.activeJob,
      recentJobs: [...this.recentJobs],
    }
  }

  /**
   * Get a job by ID
   */
  getJob(id: string): AutomationJob | null {
    if (this.activeJob?.id === id) {
      return this.activeJob
    }
    return this.recentJobs.find((j) => j.id === id) ?? null
  }

  /**
   * Check if a status is terminal
   */
  private isTerminal(status: JobStatus): boolean {
    return ['completed', 'failed', 'cancelled'].includes(status)
  }

  /**
   * Transition a job to a new status
   */
  transitionJob(
    id: string,
    newStatus: JobStatus,
    options?: {
      output?: unknown
      error?: IpcError
      currentStep?: string
      needsInputReason?: NeedsInputReason
      needsInputMessage?: string
    }
  ): boolean {
    const job = this.getJob(id)
    if (!job) return false

    // Delegate to job manager for validation
    const success = jobManager.transitionJob(id, newStatus, {
      output: options?.output,
      error: options?.error,
    })

    if (!success) return false

    const previousStatus = job.status
    job.status = newStatus
    job.updatedAt = Date.now()

    if (options?.output !== undefined) {
      job.output = options.output
    }
    if (options?.error !== undefined) {
      job.error = options.error
    }
    if (options?.currentStep !== undefined) {
      job.currentStep = options.currentStep
      job.stepCount = (job.stepCount ?? 0) + 1
    }
    if (options?.needsInputReason !== undefined) {
      job.needsInputReason = options.needsInputReason
    }
    if (options?.needsInputMessage !== undefined) {
      job.needsInputMessage = options.needsInputMessage
    }

    // Emit appropriate event
    switch (newStatus) {
      case 'running':
        if (options?.currentStep) {
          this.emitEvent(EventTypes.AUTOMATION_STEP, job, previousStatus)
        }
        break
      case 'completed':
        this.emitEvent(EventTypes.AUTOMATION_COMPLETED, job, previousStatus)
        this.moveToRecent(job)
        break
      case 'failed':
        this.emitEvent(EventTypes.AUTOMATION_FAILED, job, previousStatus)
        this.moveToRecent(job)
        break
      case 'cancelled':
        this.emitEvent(EventTypes.AUTOMATION_CANCELLED, job, previousStatus)
        this.moveToRecent(job)
        break
      case 'needs_input':
        this.emitEvent(EventTypes.AUTOMATION_NEEDS_INPUT, job, previousStatus)
        break
    }

    return true
  }

  /**
   * Move a job from active to recent
   */
  private moveToRecent(job: AutomationJob): void {
    if (this.activeJob?.id === job.id) {
      this.activeJob = null
    }

    // Add to recent, keeping only MAX_RECENT_JOBS
    this.recentJobs.unshift(job)
    if (this.recentJobs.length > MAX_RECENT_JOBS) {
      this.recentJobs.pop()
    }
  }

  /**
   * Update the current step of a running job
   */
  updateStep(id: string, step: string): boolean {
    const job = this.getJob(id)
    if (!job || job.status !== 'running') return false

    job.currentStep = step
    job.stepCount = (job.stepCount ?? 0) + 1
    job.updatedAt = Date.now()

    this.emitEvent(EventTypes.AUTOMATION_STEP, job)
    return true
  }

  /**
   * Mark a job as needing user input
   */
  needsInput(id: string, reason: NeedsInputReason, message?: string): boolean {
    return this.transitionJob(id, 'needs_input', {
      needsInputReason: reason,
      needsInputMessage: message,
    })
  }

  /**
   * Resume a job from needs_input state
   */
  resumeJob(id: string, input?: unknown): boolean {
    const job = this.getJob(id)
    if (!job || job.status !== 'needs_input') return false

    // Clear needs_input state
    job.needsInputReason = undefined
    job.needsInputMessage = undefined

    if (input !== undefined) {
      job.input = { ...(job.input as Record<string, unknown>), userInput: input }
    }

    return this.transitionJob(id, 'running')
  }

  /**
   * Complete a job successfully
   */
  completeJob(id: string, output?: unknown): boolean {
    return this.transitionJob(id, 'completed', { output })
  }

  /**
   * Fail a job with an error
   */
  failJob(id: string, error: IpcError): boolean {
    return this.transitionJob(id, 'failed', { error })
  }

  /**
   * Cancel a job
   */
  cancelJob(id: string): boolean {
    const job = this.getJob(id)
    if (!job || this.isTerminal(job.status)) return false

    return this.transitionJob(id, 'cancelled')
  }

  /**
   * Get the active job (if any)
   */
  getActiveJob(): AutomationJob | null {
    return this.activeJob
  }

  /**
   * Check if there's an active (non-terminal) job
   */
  hasActiveJob(): boolean {
    return this.activeJob !== null && !this.isTerminal(this.activeJob.status)
  }

  /**
   * Clear all jobs (for testing)
   */
  clear(): void {
    this.activeJob = null
    this.recentJobs = []
    this.jobCounter = 0
    this.activeLoop = null
  }

  /**
   * Run the automation loop for a job
   * This is the core snapshot → decide → execute → resnapshot loop
   */
  async runAutomationLoop(
    jobId: string,
    startUrl: string,
    decider: ActionDecider
  ): Promise<void> {
    const job = this.getJob(jobId)
    if (!job || job.status !== 'running') {
      console.error(`[AutomationService] Cannot run loop: job ${jobId} not in running state`)
      return
    }

    // Create and run the loop
    this.activeLoop = new AutomationLoop({
      maxIterations: 50,
      timeout: 120000, // 2 minutes (NFR3 target)
      headless: false, // Show browser for MVP
    })

    try {
      const result = await this.activeLoop.run(
        startUrl,
        decider,
        (iterationResult: LoopIterationResult) => {
          // Update job step on each iteration
          if (iterationResult.actionsExecuted.length > 0) {
            const lastAction = iterationResult.actionsExecuted[iterationResult.actionsExecuted.length - 1]
            this.updateStep(jobId, lastAction.action.description || lastAction.action.type)
          }

          // Handle needs_input state
          if (iterationResult.state === 'needs_input') {
            this.needsInput(
              jobId,
              iterationResult.needsInputReason || 'other',
              iterationResult.needsInputMessage
            )
          }
        }
      )

      // Handle final result
      if (result.state === 'completed') {
        this.completeJob(jobId, { url: result.snapshot.url })
      } else if (result.state === 'failed') {
        this.failJob(jobId, {
          code: 'AUTOMATION_BROWSER_ERROR',
          message: result.error || 'Automation failed',
        })
      } else if (result.state === 'cancelled') {
        // Already cancelled, no action needed
      }
      // needs_input is handled in the iteration callback
    } catch (error) {
      this.failJob(jobId, {
        code: 'AUTOMATION_BROWSER_ERROR',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      await this.activeLoop.cleanup()
      this.activeLoop = null
    }
  }

  /**
   * Get the active automation loop (for testing)
   */
  getActiveLoop(): AutomationLoop | null {
    return this.activeLoop
  }
}

// Singleton instance
export const automationService = new AutomationService()
