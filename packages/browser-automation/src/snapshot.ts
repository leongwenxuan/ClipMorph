/**
 * Page Snapshot Module
 * Creates ref-based snapshots of page elements for automation
 */

import type { Page } from 'playwright'
import type { PageSnapshot, ElementRef } from './types'

/**
 * Generate a unique snapshot ID
 */
function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Generate a unique element reference
 */
function generateRef(index: number): string {
  return `e${index}`
}

/**
 * Take a snapshot of the current page state
 * Returns all interactive elements with stable refs
 */
export async function takeSnapshot(page: Page): Promise<PageSnapshot> {
  const snapshotId = generateSnapshotId()
  const url = page.url()
  const title = await page.title()

  // Get all interactive elements using accessibility tree
  const elements = await page.evaluate(() => {
    const results: Array<{
      tagName: string
      role: string
      name: string
      text: string
      value: string
      href: string
      placeholder: string
      isEditable: boolean
      isClickable: boolean
      isVisible: boolean
      rect: DOMRect | null
    }> = []

    // Query all potentially interactive elements
    const selectors = [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[onclick]',
      '[tabindex]',
    ]

    const allElements = document.querySelectorAll(selectors.join(','))

    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement
      const rect = htmlEl.getBoundingClientRect()

      // Check visibility
      const style = window.getComputedStyle(htmlEl)
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0

      if (!isVisible) return

      // Determine role
      let role = htmlEl.getAttribute('role') || ''
      if (!role) {
        const tagName = htmlEl.tagName.toLowerCase()
        if (tagName === 'a') role = 'link'
        else if (tagName === 'button') role = 'button'
        else if (tagName === 'input') {
          const type = (htmlEl as HTMLInputElement).type
          if (type === 'submit' || type === 'button') role = 'button'
          else if (type === 'checkbox') role = 'checkbox'
          else if (type === 'radio') role = 'radio'
          else role = 'textbox'
        } else if (tagName === 'select') role = 'combobox'
        else if (tagName === 'textarea') role = 'textbox'
        else role = 'generic'
      }

      // Get accessible name
      const name =
        htmlEl.getAttribute('aria-label') ||
        htmlEl.getAttribute('title') ||
        (htmlEl as HTMLInputElement).placeholder ||
        ''

      // Get text content (truncated)
      const text = (htmlEl.textContent || '').trim().substring(0, 100)

      // Get value for inputs
      const value = (htmlEl as HTMLInputElement).value || ''

      // Get href for links
      const href = (htmlEl as HTMLAnchorElement).href || ''

      // Get placeholder
      const placeholder = (htmlEl as HTMLInputElement).placeholder || ''

      // Determine if editable
      const isEditable =
        htmlEl.tagName.toLowerCase() === 'input' ||
        htmlEl.tagName.toLowerCase() === 'textarea' ||
        htmlEl.tagName.toLowerCase() === 'select' ||
        htmlEl.isContentEditable

      // Determine if clickable
      const isClickable =
        htmlEl.tagName.toLowerCase() === 'a' ||
        htmlEl.tagName.toLowerCase() === 'button' ||
        role === 'button' ||
        role === 'link' ||
        !!htmlEl.onclick ||
        style.cursor === 'pointer'

      results.push({
        tagName: htmlEl.tagName.toLowerCase(),
        role,
        name,
        text,
        value,
        href,
        placeholder,
        isEditable,
        isClickable,
        isVisible,
        rect: isVisible ? rect : null,
      })
    })

    return results
  })

  // Convert to ElementRef with stable refs
  const elementRefs: ElementRef[] = elements.map((el, index) => ({
    ref: generateRef(index),
    role: el.role,
    name: el.name || undefined,
    tagName: el.tagName,
    text: el.text || undefined,
    value: el.value || undefined,
    href: el.href || undefined,
    placeholder: el.placeholder || undefined,
    isEditable: el.isEditable,
    isClickable: el.isClickable,
    isVisible: el.isVisible,
    boundingBox: el.rect
      ? {
          x: el.rect.x,
          y: el.rect.y,
          width: el.rect.width,
          height: el.rect.height,
        }
      : undefined,
  }))

  // Categorize elements
  const formFields = elementRefs.filter((e) => e.isEditable)
  const buttons = elementRefs.filter((e) => e.role === 'button' || e.tagName === 'button')
  const links = elementRefs.filter((e) => e.role === 'link' || e.tagName === 'a')

  return {
    id: snapshotId,
    url,
    title,
    timestamp: Date.now(),
    elements: elementRefs,
    formFields,
    buttons,
    links,
  }
}

/**
 * Find an element in the snapshot by ref
 */
export function findElementByRef(snapshot: PageSnapshot, ref: string): ElementRef | undefined {
  return snapshot.elements.find((e) => e.ref === ref)
}

/**
 * Find elements by role
 */
export function findElementsByRole(snapshot: PageSnapshot, role: string): ElementRef[] {
  return snapshot.elements.filter((e) => e.role === role)
}

/**
 * Find elements by text content (partial match)
 */
export function findElementsByText(snapshot: PageSnapshot, text: string): ElementRef[] {
  const lowerText = text.toLowerCase()
  return snapshot.elements.filter(
    (e) =>
      (e.text && e.text.toLowerCase().includes(lowerText)) ||
      (e.name && e.name.toLowerCase().includes(lowerText)) ||
      (e.placeholder && e.placeholder.toLowerCase().includes(lowerText))
  )
}
