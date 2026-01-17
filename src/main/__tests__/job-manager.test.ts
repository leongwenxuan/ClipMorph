import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JobManager } from '../services/job-manager'
import { EventTypes } from '../../../packages/contracts/src'

describe('JobManager', () => {
  let jobManager: JobManager
  let emittedEvents: Array<{ type: string; payload: unknown; jobId?: string }>

  beforeEach(() => {
    jobManager = new JobManager()
    emittedEvents = []
    jobManager.setEventEmitter((event) => {
      emittedEvents.push({
        type: event.type,
        payload: event.payload,
        jobId: event.jobId,
      })
    })
  })

  describe('createJob', () => {
    it('should create a job with pending status', () => {
      const job = jobManager.createJob('transform')

      expect(job.id).toBeDefined()
      expect(job.type).toBe('transform')
      expect(job.status).toBe('pending')
      expect(job.createdAt).toBeDefined()
      expect(job.updatedAt).toBeDefined()
    })

    it('should create a job with input data', () => {
      const input = { text: 'hello' }
      const job = jobManager.createJob('transform', input)

      expect(job.input).toEqual(input)
    })

    it('should emit JOB_CREATED event', () => {
      const job = jobManager.createJob('transform')

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0].type).toBe(EventTypes.JOB_CREATED)
      expect(emittedEvents[0].jobId).toBe(job.id)
    })

    it('should generate unique job IDs', () => {
      const job1 = jobManager.createJob('transform')
      const job2 = jobManager.createJob('transform')

      expect(job1.id).not.toBe(job2.id)
    })
  })

  describe('getJob', () => {
    it('should return a job by ID', () => {
      const created = jobManager.createJob('transform')
      const retrieved = jobManager.getJob(created.id)

      expect(retrieved).toEqual(created)
    })

    it('should return undefined for non-existent job', () => {
      const retrieved = jobManager.getJob('non-existent')

      expect(retrieved).toBeUndefined()
    })
  })

  describe('getAllJobs', () => {
    it('should return all jobs', () => {
      jobManager.createJob('transform1')
      jobManager.createJob('transform2')

      const jobs = jobManager.getAllJobs()

      expect(jobs).toHaveLength(2)
    })
  })

  describe('getJobsByStatus', () => {
    it('should filter jobs by status', () => {
      const job1 = jobManager.createJob('transform1')
      const job2 = jobManager.createJob('transform2')
      jobManager.startJob(job1.id)

      const pendingJobs = jobManager.getJobsByStatus('pending')
      const runningJobs = jobManager.getJobsByStatus('running')

      expect(pendingJobs).toHaveLength(1)
      expect(pendingJobs[0].id).toBe(job2.id)
      expect(runningJobs).toHaveLength(1)
      expect(runningJobs[0].id).toBe(job1.id)
    })
  })

  describe('status transitions', () => {
    describe('startJob (pending → running)', () => {
      it('should transition from pending to running', () => {
        const job = jobManager.createJob('transform')
        const success = jobManager.startJob(job.id)

        expect(success).toBe(true)
        expect(jobManager.getJob(job.id)?.status).toBe('running')
      })

      it('should emit JOB_UPDATED event', () => {
        const job = jobManager.createJob('transform')
        emittedEvents = [] // Clear create event
        jobManager.startJob(job.id)

        expect(emittedEvents[0].type).toBe(EventTypes.JOB_UPDATED)
      })
    })

    describe('completeJob (running → completed)', () => {
      it('should transition from running to completed', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        const success = jobManager.completeJob(job.id, { result: 'done' })

        expect(success).toBe(true)
        const updated = jobManager.getJob(job.id)
        expect(updated?.status).toBe('completed')
        expect(updated?.output).toEqual({ result: 'done' })
      })

      it('should emit JOB_COMPLETED event', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        emittedEvents = []
        jobManager.completeJob(job.id)

        expect(emittedEvents[0].type).toBe(EventTypes.JOB_COMPLETED)
      })
    })

    describe('failJob (running → failed)', () => {
      it('should transition from running to failed', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        const error = { code: 'TEST_ERROR', message: 'Test error' }
        const success = jobManager.failJob(job.id, error)

        expect(success).toBe(true)
        const updated = jobManager.getJob(job.id)
        expect(updated?.status).toBe('failed')
        expect(updated?.error).toEqual(error)
      })

      it('should emit JOB_FAILED event', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        emittedEvents = []
        jobManager.failJob(job.id, { code: 'ERROR', message: 'error' })

        expect(emittedEvents[0].type).toBe(EventTypes.JOB_FAILED)
      })
    })

    describe('cancelJob', () => {
      it('should cancel a pending job', () => {
        const job = jobManager.createJob('transform')
        const success = jobManager.cancelJob(job.id)

        expect(success).toBe(true)
        expect(jobManager.getJob(job.id)?.status).toBe('cancelled')
      })

      it('should cancel a running job', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        const success = jobManager.cancelJob(job.id)

        expect(success).toBe(true)
        expect(jobManager.getJob(job.id)?.status).toBe('cancelled')
      })

      it('should emit JOB_CANCELLED event', () => {
        const job = jobManager.createJob('transform')
        emittedEvents = []
        jobManager.cancelJob(job.id)

        expect(emittedEvents[0].type).toBe(EventTypes.JOB_CANCELLED)
      })
    })

    describe('needsInputJob (running → needs_input)', () => {
      it('should transition from running to needs_input', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        const success = jobManager.needsInputJob(job.id)

        expect(success).toBe(true)
        expect(jobManager.getJob(job.id)?.status).toBe('needs_input')
      })

      it('should emit JOB_NEEDS_INPUT event', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        emittedEvents = []
        jobManager.needsInputJob(job.id)

        expect(emittedEvents[0].type).toBe(EventTypes.JOB_NEEDS_INPUT)
      })
    })

    describe('resumeJob (needs_input → running)', () => {
      it('should transition from needs_input to running', () => {
        const job = jobManager.createJob('transform')
        jobManager.startJob(job.id)
        jobManager.needsInputJob(job.id)
        const success = jobManager.resumeJob(job.id)

        expect(success).toBe(true)
        expect(jobManager.getJob(job.id)?.status).toBe('running')
      })
    })
  })

  describe('invalid transitions', () => {
    it('should reject invalid transitions', () => {
      const job = jobManager.createJob('transform')
      // Can't go directly from pending to completed
      const success = jobManager.transitionJob(job.id, 'completed')

      expect(success).toBe(false)
      expect(jobManager.getJob(job.id)?.status).toBe('pending')
    })

    it('should reject transitions from terminal states', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)
      jobManager.completeJob(job.id)

      const success = jobManager.transitionJob(job.id, 'running')

      expect(success).toBe(false)
      expect(jobManager.getJob(job.id)?.status).toBe('completed')
    })
  })

  describe('isTerminal', () => {
    it('should return true for completed jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)
      jobManager.completeJob(job.id)

      expect(jobManager.isTerminal(job.id)).toBe(true)
    })

    it('should return true for failed jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)
      jobManager.failJob(job.id, { code: 'ERROR', message: 'error' })

      expect(jobManager.isTerminal(job.id)).toBe(true)
    })

    it('should return true for cancelled jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.cancelJob(job.id)

      expect(jobManager.isTerminal(job.id)).toBe(true)
    })

    it('should return false for running jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)

      expect(jobManager.isTerminal(job.id)).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should remove old terminal jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)
      jobManager.completeJob(job.id)

      // Manually set updatedAt to the past
      const storedJob = jobManager.getJob(job.id)
      if (storedJob) {
        storedJob.updatedAt = Date.now() - 10 * 60 * 1000 // 10 minutes ago
      }

      const cleaned = jobManager.cleanup(5 * 60 * 1000) // 5 minute threshold

      expect(cleaned).toBe(1)
      expect(jobManager.getJob(job.id)).toBeUndefined()
    })

    it('should not remove recent terminal jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)
      jobManager.completeJob(job.id)

      const cleaned = jobManager.cleanup(5 * 60 * 1000)

      expect(cleaned).toBe(0)
      expect(jobManager.getJob(job.id)).toBeDefined()
    })

    it('should not remove non-terminal jobs', () => {
      const job = jobManager.createJob('transform')
      jobManager.startJob(job.id)

      const cleaned = jobManager.cleanup(0) // 0ms threshold

      expect(cleaned).toBe(0)
      expect(jobManager.getJob(job.id)).toBeDefined()
    })
  })

  describe('timestamps', () => {
    it('should update updatedAt on status transition', async () => {
      const job = jobManager.createJob('transform')
      const initialUpdatedAt = job.updatedAt

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      jobManager.startJob(job.id)
      const updated = jobManager.getJob(job.id)

      expect(updated?.updatedAt).toBeGreaterThan(initialUpdatedAt)
    })
  })
})
