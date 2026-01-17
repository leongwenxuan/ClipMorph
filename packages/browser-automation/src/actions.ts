/**
 * Action Execution Module
 * Executes validated actions on the browser page
 */

import type { Page } from 'playwright'
import type { AutomationAction, ActionResult, PageSnapshot, ElementRef } from './types'

/**
 * Action schema for validation
 */
const ACTION_SCHEMAS: Record<
  string,
  {
    requiredFields: string[]
    optionalFields: string[]
  }
> = {
  click: { requiredFields: ['ref'], optionalFields: ['description'] },
  fill: { requiredFields: ['ref', 'value'], optionalFields: ['description'] },
  select: { requiredFields: ['ref', 'value'], optionalFields: ['description'] },
  press: { requiredFields: ['key'], optionalFields: ['ref', 'description'] },
  scroll: { requiredFields: [], optionalFields: ['ref', 'description'] },
  navigate: { requiredFields: ['url'], optionalFields: ['description'] },
  wait: { requiredFields: ['duration'], optionalFields: ['description'] },
}

/**
 * Validate an action against its schema
 */
export function validateAction(action: AutomationAction): { valid: boolean; error?: string } {
  const schema = ACTION_SCHEMAS[action.type]
  if (!schema) {
    return { valid: false, error: `Unknown action type: ${action.type}` }
  }

  for (const field of schema.requiredFields) {
    if (!(field in action) || action[field as keyof AutomationAction] === undefined) {
      return { valid: false, error: `Missing required field: ${field} for action ${action.type}` }
    }
  }

  return { valid: true }
}

/**
 * Validate a list of actions
 */
export function validateActions(
  actions: AutomationAction[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (let i = 0; i < actions.length; i++) {
    const result = validateAction(actions[i])
    if (!result.valid) {
      errors.push(`Action ${i}: ${result.error}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Get a Playwright locator for an element ref
 */
async function getLocatorForRef(
  page: Page,
  snapshot: PageSnapshot,
  ref: string
): Promise<{ locator: ReturnType<Page['locator']> | null; element: ElementRef | null }> {
  const element = snapshot.elements.find((e) => e.ref === ref)
  if (!element) {
    return { locator: null, element: null }
  }

  // Build a locator based on element properties
  // Priority: role + name > text > tag + attributes
  let locator: ReturnType<Page['locator']> | null = null

  if (element.role && element.name) {
    locator = page.getByRole(element.role as Parameters<Page['getByRole']>[0], {
      name: element.name,
    })
  } else if (element.placeholder) {
    locator = page.getByPlaceholder(element.placeholder)
  } else if (element.text) {
    locator = page.getByText(element.text.substring(0, 50))
  } else if (element.href && element.tagName === 'a') {
    locator = page.locator(`a[href="${element.href}"]`)
  }

  // Fallback: use bounding box click if we have coordinates
  if (!locator && element.boundingBox) {
    // We'll handle this in the execute function
    return { locator: null, element }
  }

  return { locator, element }
}

/**
 * Execute a single action
 */
export async function executeAction(
  page: Page,
  snapshot: PageSnapshot,
  action: AutomationAction
): Promise<ActionResult> {
  const timestamp = Date.now()

  // Validate action first
  const validation = validateAction(action)
  if (!validation.valid) {
    return {
      success: false,
      action,
      error: validation.error,
      timestamp,
    }
  }

  try {
    switch (action.type) {
      case 'click': {
        const { locator, element } = await getLocatorForRef(page, snapshot, action.ref!)
        if (locator) {
          await locator.click({ timeout: 5000 })
        } else if (element?.boundingBox) {
          // Click by coordinates
          const { x, y, width, height } = element.boundingBox
          await page.mouse.click(x + width / 2, y + height / 2)
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp,
          }
        }
        break
      }

      case 'fill': {
        const { locator, element } = await getLocatorForRef(page, snapshot, action.ref!)
        if (locator) {
          await locator.fill(action.value!, { timeout: 5000 })
        } else if (element?.boundingBox) {
          // Click and type
          const { x, y, width, height } = element.boundingBox
          await page.mouse.click(x + width / 2, y + height / 2)
          await page.keyboard.type(action.value!)
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp,
          }
        }
        break
      }

      case 'select': {
        const { locator } = await getLocatorForRef(page, snapshot, action.ref!)
        if (locator) {
          await locator.selectOption(action.value!, { timeout: 5000 })
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp,
          }
        }
        break
      }

      case 'press': {
        if (action.ref) {
          const { locator } = await getLocatorForRef(page, snapshot, action.ref)
          if (locator) {
            await locator.press(action.key!, { timeout: 5000 })
          } else {
            return {
              success: false,
              action,
              error: `Element not found: ${action.ref}`,
              timestamp,
            }
          }
        } else {
          await page.keyboard.press(action.key!)
        }
        break
      }

      case 'scroll': {
        if (action.ref) {
          const { locator } = await getLocatorForRef(page, snapshot, action.ref)
          if (locator) {
            await locator.scrollIntoViewIfNeeded({ timeout: 5000 })
          }
        } else {
          await page.evaluate(() => window.scrollBy(0, 300))
        }
        break
      }

      case 'navigate': {
        await page.goto(action.url!, { timeout: 30000, waitUntil: 'domcontentloaded' })
        break
      }

      case 'wait': {
        await page.waitForTimeout(action.duration!)
        break
      }

      default:
        return {
          success: false,
          action,
          error: `Unknown action type: ${action.type}`,
          timestamp,
        }
    }

    return { success: true, action, timestamp }
  } catch (error) {
    return {
      success: false,
      action,
      error: error instanceof Error ? error.message : String(error),
      timestamp,
    }
  }
}

/**
 * Execute a list of actions in sequence
 */
export async function executeActions(
  page: Page,
  snapshot: PageSnapshot,
  actions: AutomationAction[]
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const action of actions) {
    const result = await executeAction(page, snapshot, action)
    results.push(result)

    // Stop on failure
    if (!result.success) {
      break
    }

    // Small delay between actions
    await page.waitForTimeout(100)
  }

  return results
}
