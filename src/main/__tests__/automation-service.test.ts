import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AutomationService } from '../services/automation-service'
import { EventTypes } from '../../../packages/contracts/src'

describe('AutomationService', () => {
  let automationService: AutomationService
  let emittedEvents: Array<{ type: string; payload: unknown; jobId?: string }>

  beforeEach(() => {
    automationService = new AutomationService()
    emittedEvents = []
    automationService.setEventEmitter((event) => {
      emittedEvents.push({
        type: event.type,
        payload: event.payload,
        jobId: event.jobId,
      })
    })
  })

  describe('startJob', () => {
    it('should create an automation job with pending → running transition', () => {
      const job = automationService.startJob({ type: 'portal' })

      expect(job.id).toBeDefined()
      expect(job.type).toBe('portal')
      // Job transitions to running immediately after creation
      expect(job.status).toBe('running')
      expect(job.createdAt).toBeDefined()
    })

    it('should set targetUrl when provided', () => {
      const job = automationService.startJob({
        type: 'portal',
        targetUrl: 'https://example.com',
      })

      expect(job.targetUrl).toBe('https://example.com')
    })

    it('should emit AUTOMATION_STARTED event', () => {
      automationService.startJob({ type: 'portal' })

      expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_STARTED)).toBe(true)
    })

    it('should cancel existing active job when starting a new one', () => {
      const job1 = automationService.startJob({ type: 'portal' })
      const job2 = automationService.startJob({ type: 'form-fill' })

      const oldJob = automationService.getJob(job1.id)
      expect(oldJob?.status).toBe('cancelled')
      expect(automationService.getActiveJob()?.id).toBe(job2.id)
    })
  })

  describe('getState', () => {
    it('should return current automation state', () => {
      const job = automationService.startJob({ type: 'portal' })
      const state = automationService.getState()

      expect(state.activeJob?.id).toBe(job.id)
      expect(state.recentJobs).toHaveLength(0)
    })

    it('should include recent jobs after completion', () => {
      const job = automationService.startJob({ type: 'portal' })
      automationService.completeJob(job.id, { success: true })

      const state = automationService.getState()

      expect(state.activeJob).toBeNull()
      expect(state.recentJobs).toHaveLength(1)
      expect(state.recentJobs[0].id).toBe(job.id)
    })
  })

  describe('status transitions', () => {
    describe('completeJob (running → completed)', () => {
      it('should transition from running to completed', () => {
        const job = automationService.startJob({ type: 'portal' })
        const success = automationService.completeJob(job.id, { result: 'done' })

        expect(success).toBe(true)
        const updated = automationService.getJob(job.id)
        expect(updated?.status).toBe('completed')
        expect(updated?.output).toEqual({ result: 'done' })
      })

      it('should emit AUTOMATION_COMPLETED event', () => {
        const job = automationService.startJob({ type: 'portal' })
        emittedEvents = []
        automationService.completeJob(job.id)

        expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_COMPLETED)).toBe(true)
      })

      it('should move job to recent after completion', () => {
        const job = automationService.startJob({ type: 'portal' })
        automationService.completeJob(job.id)

        expect(automationService.getActiveJob()).toBeNull()
        expect(automationService.getState().recentJobs).toHaveLength(1)
      })
    })

    describe('failJob (running → failed)', () => {
      it('should transition from running to failed', () => {
        const job = automationService.startJob({ type: 'portal' })
        const error = { code: 'BROWSER_ERROR', message: 'Browser crashed' }
        const success = automationService.failJob(job.id, error)

        expect(success).toBe(true)
        const updated = automationService.getJob(job.id)
        expect(updated?.status).toBe('failed')
        expect(updated?.error).toEqual(error)
      })

      it('should emit AUTOMATION_FAILED event', () => {
        const job = automationService.startJob({ type: 'portal' })
        emittedEvents = []
        automationService.failJob(job.id, { code: 'ERROR', message: 'error' })

        expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_FAILED)).toBe(true)
      })
    })

    describe('cancelJob', () => {
      it('should cancel a running job', () => {
        const job = automationService.startJob({ type: 'portal' })
        const success = automationService.cancelJob(job.id)

        expect(success).toBe(true)
        expect(automationService.getJob(job.id)?.status).toBe('cancelled')
      })

      it('should emit AUTOMATION_CANCELLED event', () => {
        const job = automationService.startJob({ type: 'portal' })
        emittedEvents = []
        automationService.cancelJob(job.id)

        expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_CANCELLED)).toBe(true)
      })

      it('should not cancel a completed job', () => {
        const job = automationService.startJob({ type: 'portal' })
        automationService.completeJob(job.id)
        const success = automationService.cancelJob(job.id)

        expect(success).toBe(false)
        expect(automationService.getJob(job.id)?.status).toBe('completed')
      })
    })

    describe('needsInput (running → needs_input)', () => {
      it('should transition from running to needs_input', () => {
        const job = automationService.startJob({ type: 'portal' })
        const success = automationService.needsInput(job.id, 'login', 'Please log in')

        expect(success).toBe(true)
        const updated = automationService.getJob(job.id)
        expect(updated?.status).toBe('needs_input')
        expect(updated?.needsInputReason).toBe('login')
        expect(updated?.needsInputMessage).toBe('Please log in')
      })

      it('should emit AUTOMATION_NEEDS_INPUT event', () => {
        const job = automationService.startJob({ type: 'portal' })
        emittedEvents = []
        automationService.needsInput(job.id, 'captcha')

        expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_NEEDS_INPUT)).toBe(true)
      })
    })

    describe('resumeJob (needs_input → running)', () => {
      it('should transition from needs_input to running', () => {
        const job = automationService.startJob({ type: 'portal' })
        automationService.needsInput(job.id, 'login')
        const success = automationService.resumeJob(job.id)

        expect(success).toBe(true)
        expect(automationService.getJob(job.id)?.status).toBe('running')
      })

      it('should clear needs_input fields on resume', () => {
        const job = automationService.startJob({ type: 'portal' })
        automationService.needsInput(job.id, 'login', 'Please log in')
        automationService.resumeJob(job.id)

        const updated = automationService.getJob(job.id)
        expect(updated?.needsInputReason).toBeUndefined()
        expect(updated?.needsInputMessage).toBeUndefined()
      })

      it('should not resume a non-needs_input job', () => {
        const job = automationService.startJob({ type: 'portal' })
        const success = automationService.resumeJob(job.id)

        expect(success).toBe(false)
      })
    })
  })

  describe('updateStep', () => {
    it('should update the current step of a running job', () => {
      const job = automationService.startJob({ type: 'portal' })
      const success = automationService.updateStep(job.id, 'Navigating to page')

      expect(success).toBe(true)
      const updated = automationService.getJob(job.id)
      expect(updated?.currentStep).toBe('Navigating to page')
      expect(updated?.stepCount).toBe(1)
    })

    it('should increment step count', () => {
      const job = automationService.startJob({ type: 'portal' })
      automationService.updateStep(job.id, 'Step 1')
      automationService.updateStep(job.id, 'Step 2')

      const updated = automationService.getJob(job.id)
      expect(updated?.stepCount).toBe(2)
    })

    it('should emit AUTOMATION_STEP event', () => {
      const job = automationService.startJob({ type: 'portal' })
      emittedEvents = []
      automationService.updateStep(job.id, 'New step')

      expect(emittedEvents.some((e) => e.type === EventTypes.AUTOMATION_STEP)).toBe(true)
    })

    it('should not update step for non-running job', () => {
      const job = automationService.startJob({ type: 'portal' })
      automationService.completeJob(job.id)
      const success = automationService.updateStep(job.id, 'Late step')

      expect(success).toBe(false)
    })
  })

  describe('hasActiveJob', () => {
    it('should return true when there is an active non-terminal job', () => {
      automationService.startJob({ type: 'portal' })

      expect(automationService.hasActiveJob()).toBe(true)
    })

    it('should return false when there is no active job', () => {
      expect(automationService.hasActiveJob()).toBe(false)
    })

    it('should return false after job completes', () => {
      const job = automationService.startJob({ type: 'portal' })
      automationService.completeJob(job.id)

      expect(automationService.hasActiveJob()).toBe(false)
    })
  })

  describe('recent jobs management', () => {
    it('should keep only the last 10 recent jobs', () => {
      // Create and complete 12 jobs
      for (let i = 0; i < 12; i++) {
        const job = automationService.startJob({ type: 'portal' })
        automationService.completeJob(job.id)
      }

      const state = automationService.getState()
      expect(state.recentJobs).toHaveLength(10)
    })

    it('should order recent jobs with newest first', () => {
      const job1 = automationService.startJob({ type: 'portal' })
      automationService.completeJob(job1.id)

      const job2 = automationService.startJob({ type: 'form-fill' })
      automationService.completeJob(job2.id)

      const state = automationService.getState()
      expect(state.recentJobs[0].id).toBe(job2.id)
      expect(state.recentJobs[1].id).toBe(job1.id)
    })
  })

  describe('full lifecycle test', () => {
    it('should handle complete automation lifecycle: pending → running → needs_input → running → completed', () => {
      // Start job
      const job = automationService.startJob({
        type: 'portal',
        targetUrl: 'https://example.com',
      })
      expect(job.status).toBe('running')

      // Update progress
      automationService.updateStep(job.id, 'Loading page')
      expect(automationService.getJob(job.id)?.currentStep).toBe('Loading page')

      // Hit login requirement
      automationService.needsInput(job.id, 'login', 'Please log in to continue')
      expect(automationService.getJob(job.id)?.status).toBe('needs_input')

      // User logs in, resume
      automationService.resumeJob(job.id)
      expect(automationService.getJob(job.id)?.status).toBe('running')

      // Continue processing
      automationService.updateStep(job.id, 'Filling form')

      // Complete
      automationService.completeJob(job.id, { formSubmitted: true })
      expect(automationService.getJob(job.id)?.status).toBe('completed')

      // Verify events were emitted in order
      const eventTypes = emittedEvents.map((e) => e.type)
      expect(eventTypes).toContain(EventTypes.AUTOMATION_STARTED)
      expect(eventTypes).toContain(EventTypes.AUTOMATION_STEP)
      expect(eventTypes).toContain(EventTypes.AUTOMATION_NEEDS_INPUT)
      expect(eventTypes).toContain(EventTypes.AUTOMATION_COMPLETED)
    })
  })
})
