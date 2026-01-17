/**
 * Automation Loop Module
 * Implements the snapshot → decide → execute → resnapshot loop
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import type {
  AutomationAction,
  AutomationConfig,
  LoopIterationResult,
  LoopState,
  NeedsInputReason,
  PageSnapshot,
} from './types'
import { takeSnapshot } from './snapshot'
import { executeActions, validateActions } from './actions'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AutomationConfig> = {
  maxIterations: 50,
  timeout: 120000, // 2 minutes
  headless: false, // Show browser for debugging
  userDataDir: '',
}

/**
 * Action decider callback type
 * Given a snapshot, returns actions to execute or a terminal state
 */
export type ActionDecider = (
  snapshot: PageSnapshot,
  iteration: number
) => Promise<
  | { actions: AutomationAction[] }
  | { state: 'completed'; output?: unknown }
  | { state: 'needs_input'; reason: NeedsInputReason; message?: string }
  | { state: 'failed'; error: string }
>

/**
 * Detect if the page requires user input (login, captcha, etc.)
 */
function detectNeedsInput(snapshot: PageSnapshot): {
  needsInput: boolean
  reason?: NeedsInputReason
  message?: string
} {
  const url = snapshot.url.toLowerCase()
  const title = snapshot.title.toLowerCase()

  // Check for login pages
  const loginIndicators = ['login', 'sign in', 'signin', 'log in', 'authenticate']
  const hasLoginIndicator =
    loginIndicators.some((i) => url.includes(i) || title.includes(i)) ||
    snapshot.formFields.some(
      (f) =>
        f.name?.toLowerCase().includes('password') ||
        f.placeholder?.toLowerCase().includes('password')
    )

  if (hasLoginIndicator) {
    return {
      needsInput: true,
      reason: 'login',
      message: 'Login required. Please log in and then continue.',
    }
  }

  // Check for CAPTCHA
  const captchaIndicators = ['captcha', 'recaptcha', 'hcaptcha', 'verify you are human']
  const hasCaptcha =
    captchaIndicators.some((i) => title.includes(i)) ||
    snapshot.elements.some((e) => e.text?.toLowerCase().includes('captcha'))

  if (hasCaptcha) {
    return {
      needsInput: true,
      reason: 'captcha',
      message: 'CAPTCHA detected. Please solve it and then continue.',
    }
  }

  return { needsInput: false }
}

/**
 * Browser automation loop
 */
export class AutomationLoop {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private config: Required<AutomationConfig>
  private state: LoopState = 'running'
  private iteration = 0
  private lastSnapshot: PageSnapshot | null = null

  constructor(config: AutomationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
    })

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      viewport: { width: 1280, height: 800 },
    }

    if (this.config.userDataDir) {
      // Use persistent context for user data
      this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
        headless: this.config.headless,
        viewport: { width: 1280, height: 800 },
      })
      this.page = this.context.pages()[0] || (await this.context.newPage())
    } else {
      this.context = await this.browser.newContext(contextOptions)
      this.page = await this.context.newPage()
    }
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string): Promise<PageSnapshot> {
    if (!this.page) throw new Error('Browser not initialized')

    await this.page.goto(url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    })

    // Wait for network to settle
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Timeout is ok, continue anyway
    })

    this.lastSnapshot = await takeSnapshot(this.page)
    return this.lastSnapshot
  }

  /**
   * Get the current page snapshot
   */
  async getSnapshot(): Promise<PageSnapshot> {
    if (!this.page) throw new Error('Browser not initialized')
    this.lastSnapshot = await takeSnapshot(this.page)
    return this.lastSnapshot
  }

  /**
   * Run a single iteration of the loop
   */
  async runIteration(decider: ActionDecider): Promise<LoopIterationResult> {
    if (!this.page) throw new Error('Browser not initialized')

    this.iteration++
    const snapshot = await this.getSnapshot()

    // Check for needs_input conditions
    const needsInputCheck = detectNeedsInput(snapshot)
    if (needsInputCheck.needsInput) {
      this.state = 'needs_input'
      return {
        state: 'needs_input',
        snapshot,
        actionsExecuted: [],
        needsInputReason: needsInputCheck.reason,
        needsInputMessage: needsInputCheck.message,
      }
    }

    // Get actions from decider
    const decision = await decider(snapshot, this.iteration)

    // Handle terminal states
    if ('state' in decision) {
      if (decision.state === 'completed') {
        this.state = 'completed'
        return {
          state: 'completed',
          snapshot,
          actionsExecuted: [],
        }
      }
      if (decision.state === 'needs_input') {
        this.state = 'needs_input'
        return {
          state: 'needs_input',
          snapshot,
          actionsExecuted: [],
          needsInputReason: decision.reason,
          needsInputMessage: decision.message,
        }
      }
      if (decision.state === 'failed') {
        this.state = 'failed'
        return {
          state: 'failed',
          snapshot,
          actionsExecuted: [],
          error: decision.error,
        }
      }
    }

    // Validate and execute actions
    const actions = decision.actions
    const validation = validateActions(actions)
    if (!validation.valid) {
      return {
        state: 'running',
        snapshot,
        actionsExecuted: [],
        error: `Invalid actions: ${validation.errors.join(', ')}`,
      }
    }

    const results = await executeActions(this.page, snapshot, actions)

    // Check for failures
    const failedAction = results.find((r) => !r.success)
    if (failedAction) {
      return {
        state: 'running',
        snapshot,
        actionsExecuted: results,
        error: failedAction.error,
      }
    }

    return {
      state: 'running',
      snapshot,
      actionsExecuted: results,
    }
  }

  /**
   * Run the full automation loop until completion or terminal state
   */
  async run(
    startUrl: string,
    decider: ActionDecider,
    onIteration?: (result: LoopIterationResult) => void
  ): Promise<LoopIterationResult> {
    await this.initialize()
    await this.navigateTo(startUrl)

    const startTime = Date.now()

    while (
      this.state === 'running' &&
      this.iteration < this.config.maxIterations &&
      Date.now() - startTime < this.config.timeout
    ) {
      const result = await this.runIteration(decider)

      if (onIteration) {
        onIteration(result)
      }

      if (result.state !== 'running') {
        return result
      }

      // Small delay between iterations
      await this.page?.waitForTimeout(500)
    }

    // Check why we exited
    if (this.iteration >= this.config.maxIterations) {
      this.state = 'failed'
      return {
        state: 'failed',
        snapshot: this.lastSnapshot!,
        actionsExecuted: [],
        error: `Max iterations (${this.config.maxIterations}) reached`,
      }
    }

    if (Date.now() - startTime >= this.config.timeout) {
      this.state = 'failed'
      return {
        state: 'failed',
        snapshot: this.lastSnapshot!,
        actionsExecuted: [],
        error: `Timeout (${this.config.timeout}ms) reached`,
      }
    }

    return {
      state: this.state,
      snapshot: this.lastSnapshot!,
      actionsExecuted: [],
    }
  }

  /**
   * Resume from needs_input state
   */
  async resume(): Promise<void> {
    if (this.state !== 'needs_input') {
      throw new Error('Cannot resume: not in needs_input state')
    }
    this.state = 'running'
  }

  /**
   * Cancel the automation
   */
  cancel(): void {
    this.state = 'cancelled'
  }

  /**
   * Get current state
   */
  getState(): LoopState {
    return this.state
  }

  /**
   * Get current iteration count
   */
  getIteration(): number {
    return this.iteration
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {})
    }
    if (this.context) {
      await this.context.close().catch(() => {})
    }
    if (this.browser) {
      await this.browser.close().catch(() => {})
    }
    this.page = null
    this.context = null
    this.browser = null
  }
}
