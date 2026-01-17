/**
 * Intent Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the core module to include matchSubagentTrigger
vi.mock('../../../packages/core/src', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../packages/core/src')>()
  return {
    ...actual,
    matchSubagentTrigger: vi.fn(() => null), // Return null = no subagent match
  }
})

// Mock dependencies before importing the service
vi.mock('../services/job-manager', () => ({
  jobManager: {
    createJob: vi.fn(() => ({ id: 'test-job-id', status: 'pending' })),
    getJob: vi.fn(),
    getJobsByStatus: vi.fn(() => []),
    cancelJob: vi.fn(() => true),
  },
}))

vi.mock('../services/clipboard-service', () => ({
  clipboardService: {
    undo: vi.fn(() => ({ success: true })),
    readClipboard: vi.fn(() => 'test content'),
    getCurrentSnapshot: vi.fn(() => ({ id: 'snap-1', text: 'test content' })),
  },
}))

vi.mock('../services/transform-service', () => ({
  transformService: {
    executeTransform: vi.fn(() => ({ success: true, output: 'transformed' })),
    setEventEmitter: vi.fn(),
  },
}))

vi.mock('../services/automation-service', () => ({
  automationService: {
    startJob: vi.fn(() => ({
      id: 'auto-job-id',
      type: 'portal',
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    setEventEmitter: vi.fn(),
  },
}))

vi.mock('../services/opencode-service', () => ({
  getOpenCodeService: vi.fn(() => ({
    runTask: vi.fn(() => Promise.resolve({ jobId: 'opencode-job-id', started: true })),
    cancel: vi.fn(() => ({ cancelled: false })),
    getState: vi.fn(() => Promise.resolve({ state: 'ready', installed: true })),
    detect: vi.fn(() => Promise.resolve({ installed: true })),
  })),
}))

vi.mock('../services/subagent-service', () => ({
  subagentService: {
    getAllTriggers: vi.fn(() => []),
    get: vi.fn(() => null),
    list: vi.fn(() => Promise.resolve({ subagents: [], configDir: '', configDirExists: false })),
    discover: vi.fn(() => Promise.resolve({ subagents: [], newCount: 0, updatedCount: 0, errors: [] })),
  },
}))

vi.mock('../services/workflow-service', () => ({
  workflowService: {
    startWorkflow: vi.fn(() => Promise.resolve({
      job: {
        id: 'workflow-job-id',
        type: 'workflow',
        status: 'running',
        stages: ['plan', 'code', 'review'],
        currentStage: 'plan',
        currentStageIndex: 0,
        stageResults: [],
        prompt: 'test',
        atCheckpoint: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })),
    approveCheckpoint: vi.fn(),
    rejectCheckpoint: vi.fn(),
    cancelWorkflow: vi.fn(),
    getState: vi.fn(() => ({ activeJob: null, recentJobs: [] })),
    setEventEmitter: vi.fn(),
  },
}))

vi.mock('../services/file-operation-service', () => ({
  fileOperationService: {
    generatePreview: vi.fn(() => Promise.resolve({
      preview: {
        id: 'preview-id',
        operations: [],
        fileCount: 0,
        folderCount: 0,
        hasDestructive: false,
        summary: 'Test preview',
        prompt: 'test',
        createdAt: Date.now(),
        expiresAt: Date.now() + 300000,
      },
    })),
    execute: vi.fn(),
    undo: vi.fn(),
    getHistory: vi.fn(() => ({ history: [] })),
    setEventEmitter: vi.fn(),
  },
}))

vi.mock('../services/skill-service', () => ({
  skillService: {
    matchSkillsForTask: vi.fn(() => []),
    buildAugmentedPrompt: vi.fn((prompt) => prompt),
    list: vi.fn(() => Promise.resolve({ skills: [], projectDir: '', globalDir: '', projectDirExists: false })),
    discover: vi.fn(() => Promise.resolve({ skills: [], newCount: 0, updatedCount: 0, errors: [] })),
    get: vi.fn(() => ({ skill: null })),
    setEventEmitter: vi.fn(),
  },
}))

// Import after mocks
import { intentService, IntentRoutingResult } from '../services/intent-service'

describe('IntentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset last action
    // @ts-expect-error - accessing private for test
    intentService.lastAction = null
  })

  describe('classify', () => {
    it('should classify url clean intent', () => {
      const result = intentService.classify('clean url')
      expect(result.intent).toBe('url:clean')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should classify json pretty intent', () => {
      const result = intentService.classify('pretty print json')
      expect(result.intent).toBe('json:pretty')
    })

    it('should classify cancel intent', () => {
      const result = intentService.classify('cancel')
      expect(result.intent).toBe('cancel')
    })

    it('should return unsupported for unknown commands', () => {
      const result = intentService.classify('do something random')
      expect(result.intent).toBe('unsupported')
    })
  })

  describe('routeTranscript', () => {
    it('should route cancel intent and update last action', async () => {
      const result = await intentService.routeTranscript('cancel')

      expect(result.intent).toBe('cancel')
      expect(result.handled).toBe(true)

      const lastAction = intentService.getLastAction()
      expect(lastAction).not.toBeNull()
      expect(lastAction?.capability).toBe('cancel')
      expect(lastAction?.success).toBe(true)
    })

    it('should route unsupported intent and update last action with error', async () => {
      const result = await intentService.routeTranscript('blah blah blah')

      expect(result.intent).toBe('unsupported')
      expect(result.handled).toBe(false)
      expect(result.error).toBeDefined()

      const lastAction = intentService.getLastAction()
      expect(lastAction).not.toBeNull()
      expect(lastAction?.capability).toBe('unsupported')
      expect(lastAction?.success).toBe(false)
      expect(lastAction?.error).toBeDefined()
    })

    it('should route transform intent and update last action', async () => {
      const result = await intentService.routeTranscript('clean url')

      expect(result.intent).toBe('url:clean')
      expect(result.handled).toBe(true)
      expect(result.jobId).toBe('test-job-id')

      const lastAction = intentService.getLastAction()
      expect(lastAction).not.toBeNull()
      expect(lastAction?.capability).toBe('url:clean')
      expect(lastAction?.success).toBe(true)
      expect(lastAction?.jobId).toBe('test-job-id')
    })
  })

  describe('getLastAction', () => {
    it('should return null when no action has been performed', () => {
      const lastAction = intentService.getLastAction()
      expect(lastAction).toBeNull()
    })

    it('should return the most recent action', async () => {
      await intentService.routeTranscript('cancel')
      await intentService.routeTranscript('clean url')

      const lastAction = intentService.getLastAction()
      expect(lastAction?.capability).toBe('url:clean')
    })
  })

  describe('automation intents', () => {
    it('should route "apply to this portal" to automation service', async () => {
      const { automationService } = await import('../services/automation-service')

      const result = await intentService.routeTranscript('apply to this portal')

      expect(result.intent).toBe('automation:portal')
      expect(result.handled).toBe(true)
      expect(result.jobId).toBe('auto-job-id')

      expect(automationService.startJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'portal',
          context: expect.objectContaining({
            intent: 'automation:portal',
            clipboardContent: 'test content',
          }),
        })
      )

      const lastAction = intentService.getLastAction()
      expect(lastAction?.capability).toBe('automation:portal')
      expect(lastAction?.success).toBe(true)
    })

    it('should route "fill out this form" to automation service', async () => {
      const result = await intentService.routeTranscript('fill out this form')

      expect(result.intent).toBe('automation:portal')
      expect(result.handled).toBe(true)
    })

    it('should route "start automation" to automation service', async () => {
      const result = await intentService.routeTranscript('start automation')

      expect(result.intent).toBe('automation:portal')
      expect(result.handled).toBe(true)
    })
  })

  describe('code intents', () => {
    it('should classify "generate a function" as code:generate', () => {
      const result = intentService.classify('generate a function to sort an array')
      expect(result.intent).toBe('code:generate')
    })

    it('should classify "create a component" as code:generate', () => {
      const result = intentService.classify('create a React component for user profile')
      expect(result.intent).toBe('code:generate')
    })

    it('should classify "refactor this code" as code:refactor', () => {
      const result = intentService.classify('refactor this code')
      expect(result.intent).toBe('code:refactor')
    })

    it('should classify "fix this bug" as code:fix', () => {
      const result = intentService.classify('fix this bug')
      expect(result.intent).toBe('code:fix')
    })

    it('should classify "explain this function" as code:explain', () => {
      const result = intentService.classify('explain this function')
      expect(result.intent).toBe('code:explain')
    })

    it('should classify "what does this code do" as code:explain', () => {
      const result = intentService.classify('what does this code do')
      expect(result.intent).toBe('code:explain')
    })

    it('should classify "improve this code" as code:improve', () => {
      const result = intentService.classify('improve this code')
      expect(result.intent).toBe('code:improve')
    })

    it('should classify "optimize this function" as code:improve', () => {
      const result = intentService.classify('optimize this function')
      expect(result.intent).toBe('code:improve')
    })

    it('should route code:generate to OpenCode service', async () => {
      const result = await intentService.routeTranscript('generate a function to add numbers')

      expect(result.intent).toBe('code:generate')
      expect(result.handled).toBe(true)
      expect(result.jobId).toBe('opencode-job-id')

      const lastAction = intentService.getLastAction()
      expect(lastAction?.capability).toBe('code:generate')
      expect(lastAction?.success).toBe(true)
    })

    it('should route code:refactor to OpenCode service', async () => {
      const result = await intentService.routeTranscript('refactor this function')

      expect(result.intent).toBe('code:refactor')
      expect(result.handled).toBe(true)
      expect(result.jobId).toBe('opencode-job-id')
    })

    it('should route code:fix to OpenCode service', async () => {
      const result = await intentService.routeTranscript('fix this bug in the code')

      expect(result.intent).toBe('code:fix')
      expect(result.handled).toBe(true)
      expect(result.jobId).toBe('opencode-job-id')
    })
  })
})
