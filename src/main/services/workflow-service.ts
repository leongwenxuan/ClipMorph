/**
 * Workflow Service
 *
 * Orchestrates multi-stage agentic workflows (plan → code → review).
 * Each stage runs via OpenCode and pauses at checkpoints for user approval.
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'
import {
  ClipMorphEvent,
  createEvent,
  EventTypes,
  WorkflowJob,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowStartRequest,
  WorkflowStartResponse,
  WorkflowApproveRequest,
  WorkflowRejectRequest,
  WorkflowControlResponse,
  WorkflowState,
  WorkflowStartedPayload,
  WorkflowStageStartedPayload,
  WorkflowCheckpointPayload,
  WorkflowStageCompletedPayload,
  WorkflowStageFailedPayload,
  WorkflowCompletedPayload,
  WorkflowCancelledPayload,
} from '../../../packages/contracts/src'
import { getOpenCodeService } from './opencode-service'

// ============================================================================
// Stage Prompts
// ============================================================================

const STAGE_PROMPTS: Record<WorkflowStage, (task: string, previousOutput?: string) => string> = {
  plan: (task: string) => `
You are a software architect. Create a detailed implementation plan for the following task.

## Task
${task}

## Instructions
1. Break down the task into clear, actionable steps
2. Identify key components, files, and functions needed
3. Note any potential challenges or edge cases
4. Suggest a testing strategy
5. Keep the plan concise but comprehensive

Output a structured plan that a developer can follow to implement this task.
`,

  code: (task: string, previousOutput?: string) => `
You are a senior software developer. Implement the following task based on the provided plan.

## Original Task
${task}

## Implementation Plan
${previousOutput || 'No plan provided - implement based on best practices.'}

## Instructions
1. Write clean, well-documented code
2. Follow the plan's structure and recommendations
3. Include error handling and edge cases
4. Add inline comments for complex logic
5. Keep code modular and testable

Implement the code following the plan above.
`,

  review: (task: string, previousOutput?: string) => `
You are a code reviewer. Review the following implementation for quality, correctness, and best practices.

## Original Task
${task}

## Implementation to Review
${previousOutput || 'No implementation provided.'}

## Instructions
1. Check for bugs, logic errors, and edge cases
2. Evaluate code quality and readability
3. Verify error handling is adequate
4. Suggest improvements if needed
5. Note any security concerns

Provide a thorough code review with specific feedback and recommendations.
`,
}

// ============================================================================
// Workflow Service
// ============================================================================

class WorkflowService extends EventEmitter {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private activeJob: WorkflowJob | null = null
  private recentJobs: WorkflowJob[] = []
  private maxRecentJobs = 10

  /**
   * Set the event emitter for broadcasting events
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
   * Start a new workflow
   */
  async startWorkflow(request: WorkflowStartRequest): Promise<WorkflowStartResponse> {
    // Check if there's already an active workflow
    if (this.activeJob && !this.isTerminal(this.activeJob)) {
      throw new Error('A workflow is already in progress. Cancel it first.')
    }

    // Default stages if not provided
    const stages = request.stages || ['plan', 'code', 'review']

    // Create workflow job
    const now = Date.now()
    const job: WorkflowJob = {
      id: crypto.randomUUID(),
      type: 'workflow',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      stages,
      currentStage: null,
      currentStageIndex: -1,
      stageResults: [],
      prompt: request.prompt,
      context: request.context,
      atCheckpoint: false,
    }

    this.activeJob = job

    // Emit workflow started event
    this.emit(
      createEvent<WorkflowStartedPayload>(EventTypes.WORKFLOW_STARTED, { job })
    )

    console.log(`[WorkflowService] Started workflow ${job.id} with stages: ${stages.join(' → ')}`)

    // Start the first stage
    await this.runNextStage()

    return { job: this.activeJob }
  }

  /**
   * Run the next stage in the workflow
   */
  private async runNextStage(): Promise<void> {
    if (!this.activeJob) return

    const nextIndex = this.activeJob.currentStageIndex + 1
    if (nextIndex >= this.activeJob.stages.length) {
      // All stages complete
      await this.completeWorkflow()
      return
    }

    const stage = this.activeJob.stages[nextIndex]
    this.activeJob.currentStage = stage
    this.activeJob.currentStageIndex = nextIndex
    this.activeJob.status = 'running'
    this.activeJob.atCheckpoint = false
    this.activeJob.updatedAt = Date.now()

    // Emit stage started event
    this.emit(
      createEvent<WorkflowStageStartedPayload>(EventTypes.WORKFLOW_STAGE_STARTED, {
        jobId: this.activeJob.id,
        stage,
        stageIndex: nextIndex,
      })
    )

    console.log(`[WorkflowService] Running stage ${nextIndex + 1}/${this.activeJob.stages.length}: ${stage}`)

    // Get previous stage output for context
    const previousOutput = this.activeJob.stageResults.length > 0
      ? this.activeJob.stageResults[this.activeJob.stageResults.length - 1].output
      : undefined

    // Build the prompt for this stage
    const stagePrompt = STAGE_PROMPTS[stage](this.activeJob.prompt, previousOutput)

    // Run the stage via OpenCode
    const startTime = Date.now()
    try {
      const openCodeService = getOpenCodeService()
      
      // Run the task and wait for completion
      const result = await openCodeService.runTask({
        prompt: stagePrompt,
        context: this.activeJob.context,
      })

      // Wait for the task to complete by polling state
      let output = ''
      let completed = false
      let failed = false
      let error = ''
      
      // Poll for completion (max 5 minutes)
      const maxWaitTime = 5 * 60 * 1000
      const pollInterval = 500
      const startPoll = Date.now()
      
      while (!completed && !failed && (Date.now() - startPoll) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        const state = await openCodeService.getState()
        
        if (state.state === 'ready' || state.state === 'stopped') {
          // Task completed
          completed = true
          // Get output from the last result (simplified - in real impl would capture from events)
          output = `Stage ${stage} completed successfully.`
        } else if (state.state === 'error') {
          failed = true
          error = 'OpenCode task failed'
        }
      }

      if (!completed && !failed) {
        failed = true
        error = 'Stage timed out'
      }

      const endTime = Date.now()

      if (failed) {
        await this.failStage(stage, error, startTime, endTime)
        return
      }

      // Stage completed successfully
      const stageResult: WorkflowStageResult = {
        stage,
        status: 'completed',
        output,
        startedAt: startTime,
        completedAt: endTime,
      }

      this.activeJob.stageResults.push(stageResult)
      this.activeJob.updatedAt = Date.now()

      // Emit stage completed event
      this.emit(
        createEvent<WorkflowStageCompletedPayload>(EventTypes.WORKFLOW_STAGE_COMPLETED, {
          jobId: this.activeJob.id,
          stage,
          result: stageResult,
        })
      )

      console.log(`[WorkflowService] Stage ${stage} completed in ${endTime - startTime}ms`)

      // Check if this is the last stage
      if (this.activeJob.currentStageIndex >= this.activeJob.stages.length - 1) {
        // Last stage - complete workflow
        await this.completeWorkflow()
      } else {
        // Pause at checkpoint for approval
        await this.pauseAtCheckpoint(stageResult)
      }

    } catch (err) {
      const endTime = Date.now()
      await this.failStage(stage, (err as Error).message, startTime, endTime)
    }
  }

  /**
   * Pause at a checkpoint for user approval
   */
  private async pauseAtCheckpoint(stageResult: WorkflowStageResult): Promise<void> {
    if (!this.activeJob) return

    const nextStage = this.activeJob.stages[this.activeJob.currentStageIndex + 1] || null
    const message = nextStage
      ? `Stage "${stageResult.stage}" completed. Approve to proceed to "${nextStage}" stage, or reject to retry/abort.`
      : `Stage "${stageResult.stage}" completed. This is the final stage.`

    this.activeJob.status = 'needs_input'
    this.activeJob.atCheckpoint = true
    this.activeJob.checkpointMessage = message
    this.activeJob.updatedAt = Date.now()

    // Emit checkpoint event
    this.emit(
      createEvent<WorkflowCheckpointPayload>(EventTypes.WORKFLOW_CHECKPOINT, {
        jobId: this.activeJob.id,
        stage: stageResult.stage,
        stageOutput: stageResult.output,
        message,
        nextStage,
      })
    )

    console.log(`[WorkflowService] Paused at checkpoint after ${stageResult.stage}`)
  }

  /**
   * Fail a stage
   */
  private async failStage(
    stage: WorkflowStage,
    error: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    if (!this.activeJob) return

    const stageResult: WorkflowStageResult = {
      stage,
      status: 'failed',
      output: '',
      startedAt: startTime,
      completedAt: endTime,
      error,
    }

    this.activeJob.stageResults.push(stageResult)
    this.activeJob.status = 'needs_input' // Pause for retry/abort decision
    this.activeJob.atCheckpoint = true
    this.activeJob.checkpointMessage = `Stage "${stage}" failed: ${error}. Retry or abort?`
    this.activeJob.updatedAt = Date.now()

    // Emit stage failed event
    this.emit(
      createEvent<WorkflowStageFailedPayload>(EventTypes.WORKFLOW_STAGE_FAILED, {
        jobId: this.activeJob.id,
        stage,
        error,
      })
    )

    console.log(`[WorkflowService] Stage ${stage} failed: ${error}`)
  }

  /**
   * Complete the workflow
   */
  private async completeWorkflow(): Promise<void> {
    if (!this.activeJob) return

    this.activeJob.status = 'completed'
    this.activeJob.currentStage = null
    this.activeJob.atCheckpoint = false
    this.activeJob.updatedAt = Date.now()

    // Move to recent jobs
    this.addToRecentJobs(this.activeJob)

    // Emit workflow completed event
    this.emit(
      createEvent<WorkflowCompletedPayload>(EventTypes.WORKFLOW_COMPLETED, {
        job: this.activeJob,
      })
    )

    console.log(`[WorkflowService] Workflow ${this.activeJob.id} completed`)
    this.activeJob = null
  }

  /**
   * Approve the current checkpoint and proceed to next stage
   */
  async approveCheckpoint(request: WorkflowApproveRequest): Promise<WorkflowControlResponse> {
    if (!this.activeJob || this.activeJob.id !== request.jobId) {
      throw new Error(`Workflow not found: ${request.jobId}`)
    }

    if (!this.activeJob.atCheckpoint) {
      throw new Error('Workflow is not at a checkpoint')
    }

    // If feedback provided, append to context
    if (request.feedback) {
      this.activeJob.context = (this.activeJob.context || '') + `\n\nUser feedback: ${request.feedback}`
    }

    console.log(`[WorkflowService] Checkpoint approved for ${this.activeJob.id}`)

    // Proceed to next stage
    await this.runNextStage()

    return { job: this.activeJob! }
  }

  /**
   * Reject the current checkpoint
   */
  async rejectCheckpoint(request: WorkflowRejectRequest): Promise<WorkflowControlResponse> {
    if (!this.activeJob || this.activeJob.id !== request.jobId) {
      throw new Error(`Workflow not found: ${request.jobId}`)
    }

    if (!this.activeJob.atCheckpoint) {
      throw new Error('Workflow is not at a checkpoint')
    }

    if (request.action === 'abort') {
      // Cancel the workflow
      return this.cancelWorkflow(request.jobId)
    }

    // Retry: remove the last stage result and re-run
    if (this.activeJob.stageResults.length > 0) {
      this.activeJob.stageResults.pop()
    }
    this.activeJob.currentStageIndex--

    // Add feedback to context
    if (request.feedback) {
      this.activeJob.context = (this.activeJob.context || '') + `\n\nRetry feedback: ${request.feedback}`
    }

    console.log(`[WorkflowService] Retrying stage for ${this.activeJob.id}`)

    // Re-run the current stage
    await this.runNextStage()

    return { job: this.activeJob! }
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(jobId: string): WorkflowControlResponse {
    if (!this.activeJob || this.activeJob.id !== jobId) {
      throw new Error(`Workflow not found: ${jobId}`)
    }

    const cancelledAtStage = this.activeJob.currentStage

    this.activeJob.status = 'cancelled'
    this.activeJob.atCheckpoint = false
    this.activeJob.updatedAt = Date.now()

    // Move to recent jobs
    this.addToRecentJobs(this.activeJob)

    // Emit cancelled event
    this.emit(
      createEvent<WorkflowCancelledPayload>(EventTypes.WORKFLOW_CANCELLED, {
        jobId,
        cancelledAtStage,
      })
    )

    console.log(`[WorkflowService] Workflow ${jobId} cancelled at stage ${cancelledAtStage}`)

    const job = this.activeJob
    this.activeJob = null

    return { job }
  }

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return {
      activeJob: this.activeJob,
      recentJobs: [...this.recentJobs],
    }
  }

  /**
   * Get a workflow job by ID
   */
  getJob(jobId: string): WorkflowJob | null {
    if (this.activeJob?.id === jobId) {
      return this.activeJob
    }
    return this.recentJobs.find(j => j.id === jobId) || null
  }

  /**
   * Check if a job is in a terminal state
   */
  private isTerminal(job: WorkflowJob): boolean {
    return ['completed', 'failed', 'cancelled'].includes(job.status)
  }

  /**
   * Add a job to recent jobs
   */
  private addToRecentJobs(job: WorkflowJob): void {
    this.recentJobs.unshift(job)
    if (this.recentJobs.length > this.maxRecentJobs) {
      this.recentJobs.pop()
    }
  }
}

// Singleton
export const workflowService = new WorkflowService()
