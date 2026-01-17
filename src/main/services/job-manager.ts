/**
 * Job Manager Service
 * Manages job lifecycle with monotonic status transitions
 * Status: pending → running → (needs_input | completed | failed | cancelled)
 */

import {
  Job,
  JobStatus,
  IpcError,
  EventTypes,
  createEvent,
  JobEventPayload,
  ClipMorphEvent,
} from '../../../packages/contracts/src'

// Valid status transitions (monotonic)
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['needs_input', 'completed', 'failed', 'cancelled'],
  needs_input: ['running', 'completed', 'failed', 'cancelled'],
  completed: [], // Terminal state
  failed: [], // Terminal state
  cancelled: [], // Terminal state
}

export type JobEventEmitter = <T>(event: ClipMorphEvent<T>) => void

export class JobManager {
  private jobs: Map<string, Job> = new Map()
  private jobCounter = 0
  private eventEmitter: JobEventEmitter | null = null

  /**
   * Set the event emitter for broadcasting job events
   */
  setEventEmitter(emitter: JobEventEmitter): void {
    this.eventEmitter = emitter
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    this.jobCounter++
    return `job-${Date.now()}-${this.jobCounter}`
  }

  /**
   * Emit a job event
   */
  private emitJobEvent(type: (typeof EventTypes)[keyof typeof EventTypes], job: Job): void {
    if (this.eventEmitter) {
      this.eventEmitter(createEvent<JobEventPayload>(type, { job }, job.id))
    }
  }

  /**
   * Create a new job
   */
  createJob(type: string, input?: unknown): Job {
    const now = Date.now()
    const job: Job = {
      id: this.generateJobId(),
      type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      input,
    }

    this.jobs.set(job.id, job)
    this.emitJobEvent(EventTypes.JOB_CREATED, job)

    return job
  }

  /**
   * Get a job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return Array.from(this.jobs.values()).filter((job) => job.status === status)
  }

  /**
   * Check if a status transition is valid
   */
  isValidTransition(from: JobStatus, to: JobStatus): boolean {
    return VALID_TRANSITIONS[from].includes(to)
  }

  /**
   * Transition a job to a new status
   * Returns true if transition was successful, false if invalid
   */
  transitionJob(
    id: string,
    newStatus: JobStatus,
    options?: {
      output?: unknown
      error?: IpcError
    }
  ): boolean {
    const job = this.jobs.get(id)
    if (!job) {
      return false
    }

    if (!this.isValidTransition(job.status, newStatus)) {
      console.warn(
        `Invalid job transition: ${job.status} → ${newStatus} for job ${id}`
      )
      return false
    }

    const previousStatus = job.status
    job.status = newStatus
    job.updatedAt = Date.now()

    if (options?.output !== undefined) {
      job.output = options.output
    }
    if (options?.error !== undefined) {
      job.error = options.error
    }

    // Emit appropriate event based on new status
    switch (newStatus) {
      case 'completed':
        this.emitJobEvent(EventTypes.JOB_COMPLETED, job)
        break
      case 'failed':
        this.emitJobEvent(EventTypes.JOB_FAILED, job)
        break
      case 'cancelled':
        this.emitJobEvent(EventTypes.JOB_CANCELLED, job)
        break
      case 'needs_input':
        this.emitJobEvent(EventTypes.JOB_NEEDS_INPUT, job)
        break
      default:
        this.emitJobEvent(EventTypes.JOB_UPDATED, job)
    }

    return true
  }

  /**
   * Start a job (pending → running)
   */
  startJob(id: string): boolean {
    return this.transitionJob(id, 'running')
  }

  /**
   * Complete a job (running → completed)
   */
  completeJob(id: string, output?: unknown): boolean {
    return this.transitionJob(id, 'completed', { output })
  }

  /**
   * Fail a job (running → failed)
   */
  failJob(id: string, error: IpcError): boolean {
    return this.transitionJob(id, 'failed', { error })
  }

  /**
   * Cancel a job (pending | running | needs_input → cancelled)
   */
  cancelJob(id: string): boolean {
    return this.transitionJob(id, 'cancelled')
  }

  /**
   * Mark job as needing input (running → needs_input)
   */
  needsInputJob(id: string): boolean {
    return this.transitionJob(id, 'needs_input')
  }

  /**
   * Resume a job from needs_input (needs_input → running)
   */
  resumeJob(id: string): boolean {
    return this.transitionJob(id, 'running')
  }

  /**
   * Check if a job is in a terminal state
   */
  isTerminal(id: string): boolean {
    const job = this.jobs.get(id)
    if (!job) return true
    return ['completed', 'failed', 'cancelled'].includes(job.status)
  }

  /**
   * Clean up old completed/failed/cancelled jobs
   * Keeps jobs for at least `maxAgeMs` milliseconds
   */
  cleanup(maxAgeMs: number = 5 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [id, job] of this.jobs.entries()) {
      if (this.isTerminal(id) && now - job.updatedAt > maxAgeMs) {
        this.jobs.delete(id)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Clear all jobs (for testing)
   */
  clear(): void {
    this.jobs.clear()
    this.jobCounter = 0
  }
}

// Singleton instance
export const jobManager = new JobManager()
