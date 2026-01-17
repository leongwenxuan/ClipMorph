import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock child_process before importing the service
vi.mock('child_process', () => {
  return {
    execSync: vi.fn((cmd: string) => {
      if (cmd.includes('which')) {
        throw new Error('not found')
      }
      if (cmd.includes('test -x')) {
        throw new Error('not found')
      }
      return ''
    }),
    exec: vi.fn(),
  }
})

// Mock node-pty
vi.mock('node-pty', () => {
  return {
    spawn: vi.fn(() => {
      const emitter = new EventEmitter() as EventEmitter & {
        write: ReturnType<typeof vi.fn>
        resize: ReturnType<typeof vi.fn>
        kill: ReturnType<typeof vi.fn>
        onData: (callback: (data: string) => void) => void
        onExit: (callback: (info: { exitCode: number; signal?: number }) => void) => void
      }
      emitter.write = vi.fn()
      emitter.resize = vi.fn()
      emitter.kill = vi.fn()
      emitter.onData = (callback: (data: string) => void) => {
        emitter.on('data', callback)
      }
      emitter.onExit = (callback: (info: { exitCode: number; signal?: number }) => void) => {
        emitter.on('exit', callback)
      }
      return emitter
    }),
  }
})

// Import after mocking
import {
  OpenCodeService,
  getOpenCodeService,
  resetOpenCodeService,
} from '../services/opencode-service'

describe('OpenCodeService', () => {
  let service: OpenCodeService
  let emittedEvents: Array<{ type: string; payload: unknown; jobId?: string }>

  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenCodeService()

    service = new OpenCodeService()
    emittedEvents = []

    service.on('event', (event) => {
      emittedEvents.push({
        type: event.type,
        payload: event.payload,
        jobId: event.jobId,
      })
    })
  })

  afterEach(async () => {
    if (service) {
      await service.dispose()
    }
  })

  describe('getState', () => {
    it('should return current state', async () => {
      const state = await service.getState()

      expect(state.state).toBeDefined()
      expect(typeof state.installed).toBe('boolean')
    })

    it('should include install instructions when not installed', async () => {
      const state = await service.getState()

      expect(state.installed).toBe(false)
      expect(state.installInstructions).toContain('npm install -g opencode')
    })

    it('should return ready state initially', async () => {
      const state = await service.getState()
      expect(state.state).toBe('ready')
    })
  })

  describe('detect', () => {
    it('should return detection result with instructions', async () => {
      const detection = await service.detect()

      expect(typeof detection.installed).toBe('boolean')
      expect(detection.installInstructions).toBeDefined()
      expect(detection.installInstructions).toContain('opencode')
    })

    it('should return not installed when CLI not found', async () => {
      const detection = await service.detect()

      expect(detection.installed).toBe(false)
      expect(detection.error).toContain('not found')
    })
  })

  describe('runTask', () => {
    it('should throw OPENCODE_NOT_INSTALLED when CLI not found', async () => {
      try {
        await service.runTask({ prompt: 'Test prompt' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error & { code?: string }).code).toBe('OPENCODE_NOT_INSTALLED')
      }
    })

    it('should include installation instructions in error message', async () => {
      try {
        await service.runTask({ prompt: 'Test prompt' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toContain('npm install -g opencode')
      }
    })
  })

  describe('cancel', () => {
    it('should return false when no active job', () => {
      const result = service.cancel()

      expect(result.cancelled).toBe(false)
      expect(result.jobId).toBeUndefined()
    })
  })

  describe('getActiveJob', () => {
    it('should return null when no job is active', () => {
      expect(service.getActiveJob()).toBeNull()
    })
  })

  describe('getRecentJobs', () => {
    it('should return empty array initially', () => {
      expect(service.getRecentJobs()).toEqual([])
    })
  })

  describe('singleton', () => {
    it('should return same instance from getOpenCodeService', () => {
      resetOpenCodeService()
      const instance1 = getOpenCodeService()
      const instance2 = getOpenCodeService()

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', async () => {
      resetOpenCodeService()
      const instance1 = getOpenCodeService()
      await instance1.dispose()
      resetOpenCodeService()
      const instance2 = getOpenCodeService()

      expect(instance1).not.toBe(instance2)
    })
  })

  describe('dispose', () => {
    it('should complete without error', async () => {
      await expect(service.dispose()).resolves.not.toThrow()
    })

    it('should be safe to call multiple times', async () => {
      await service.dispose()
      await expect(service.dispose()).resolves.not.toThrow()
    })
  })

  describe('writeInput', () => {
    it('should be callable without error', () => {
      expect(() => service.writeInput('test')).not.toThrow()
    })
  })

  describe('respondToPermission', () => {
    it('should be callable without error', () => {
      expect(() => service.respondToPermission(true)).not.toThrow()
      expect(() => service.respondToPermission(false)).not.toThrow()
    })
  })
})

describe('OpenCodeService state management', () => {
  let service: OpenCodeService

  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenCodeService()
    service = new OpenCodeService()
  })

  afterEach(async () => {
    if (service) {
      await service.dispose()
    }
  })

  it('should track active job ID in state when set', async () => {
    // Force set an active job for testing
    const fakeJob = {
      id: 'test-job-123',
      status: 'running' as const,
      prompt: 'test',
      output: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    ;(service as unknown as { activeJob: typeof fakeJob }).activeJob = fakeJob

    const state = await service.getState()
    expect(state.activeJobId).toBe('test-job-123')
  })

  it('should not have activeJobId when no job is active', async () => {
    const state = await service.getState()
    expect(state.activeJobId).toBeUndefined()
  })
})

describe('OpenCodeService job management', () => {
  let service: OpenCodeService

  beforeEach(() => {
    vi.clearAllMocks()
    resetOpenCodeService()
    service = new OpenCodeService()
  })

  afterEach(async () => {
    if (service) {
      await service.dispose()
    }
  })

  it('should limit recent jobs to 10', () => {
    // Access private method via type assertion for testing
    const archiveJob = (service as unknown as { archiveJob: (job: unknown) => void }).archiveJob.bind(service)

    // Add 15 jobs
    for (let i = 0; i < 15; i++) {
      archiveJob({
        id: `job-${i}`,
        status: 'completed',
        prompt: `test ${i}`,
        output: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }

    const recentJobs = service.getRecentJobs()
    expect(recentJobs.length).toBe(10)
    // Most recent should be first
    expect(recentJobs[0].id).toBe('job-14')
  })

  it('should order recent jobs with newest first', () => {
    const archiveJob = (service as unknown as { archiveJob: (job: unknown) => void }).archiveJob.bind(service)

    archiveJob({
      id: 'job-1',
      status: 'completed',
      prompt: 'first',
      output: '',
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
    })

    archiveJob({
      id: 'job-2',
      status: 'completed',
      prompt: 'second',
      output: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const recentJobs = service.getRecentJobs()
    expect(recentJobs[0].id).toBe('job-2')
    expect(recentJobs[1].id).toBe('job-1')
  })
})
