/**
 * Browser Automation Types
 * Ref-based snapshot approach for robust automation
 */

/**
 * Element reference in a page snapshot
 * Uses stable refs instead of CSS selectors
 */
export interface ElementRef {
  ref: string // Unique reference ID
  role: string // ARIA role
  name?: string // Accessible name
  tagName: string
  text?: string
  value?: string
  href?: string
  placeholder?: string
  isEditable: boolean
  isClickable: boolean
  isVisible: boolean
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Page snapshot containing all interactive elements
 */
export interface PageSnapshot {
  id: string
  url: string
  title: string
  timestamp: number
  elements: ElementRef[]
  formFields: ElementRef[]
  buttons: ElementRef[]
  links: ElementRef[]
  textContent?: string
}

/**
 * Action types for automation
 */
export type ActionType = 'click' | 'fill' | 'select' | 'press' | 'scroll' | 'navigate' | 'wait'

/**
 * Action to perform on the page
 */
export interface AutomationAction {
  type: ActionType
  ref?: string // Element reference
  value?: string // For fill/select actions
  key?: string // For press action
  url?: string // For navigate action
  duration?: number // For wait action
  description?: string // Human-readable description
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  success: boolean
  action: AutomationAction
  error?: string
  timestamp: number
}

/**
 * Loop state for automation
 */
export type LoopState = 'running' | 'needs_input' | 'completed' | 'failed' | 'cancelled'

/**
 * Reason for needs_input state
 */
export type NeedsInputReason = 'login' | 'captcha' | 'ambiguity' | 'confirmation' | 'other'

/**
 * Automation loop iteration result
 */
export interface LoopIterationResult {
  state: LoopState
  snapshot: PageSnapshot
  actionsExecuted: ActionResult[]
  needsInputReason?: NeedsInputReason
  needsInputMessage?: string
  error?: string
}

/**
 * Configuration for the automation loop
 */
export interface AutomationConfig {
  maxIterations?: number
  timeout?: number
  headless?: boolean
  userDataDir?: string
}
