/**
 * Settings Service - High-level settings management
 *
 * Responsibilities:
 * - Provide typed settings access
 * - Emit events when settings change
 * - Validate settings values
 */

import {
  ClipMorphEvent,
  EventTypes,
  createEvent,
  SettingsChangedPayload,
} from '../../../packages/contracts/src'
import { storeService, DEFAULT_SETTINGS, SettingKey } from './store-service'

// Settings schema
export interface AppSettings {
  hotkey: {
    pushToTalk: string
  }
  transforms: {
    urlClean: { enabled: boolean }
    urlMarkdown: { enabled: boolean }
    jsonPretty: { enabled: boolean }
    jsonMinify: { enabled: boolean }
    jsonToYaml: { enabled: boolean }
    yamlToJson: { enabled: boolean }
    extractEmails: { enabled: boolean }
    extractLinks: { enabled: boolean }
    redactSecrets: { enabled: boolean }
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
  }
  audio: {
    minCaptureDuration: number
    inputDevice: string
  }
}

// Re-export the payload type from contracts
export type { SettingsChangedPayload } from '../../../packages/contracts/src'

class SettingsService {
  private eventEmitter: ((event: ClipMorphEvent) => void) | null = null
  private changeListeners: Map<string, Set<(value: string) => void>> = new Map()

  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter: (event: ClipMorphEvent) => void): void {
    this.eventEmitter = emitter
  }

  /**
   * Emit an event to the renderer
   */
  private emit<T>(event: ClipMorphEvent<T>): void {
    if (this.eventEmitter) {
      this.eventEmitter(event)
    }
  }

  /**
   * Get a setting value
   */
  get(key: SettingKey): string {
    return storeService.getSettingOrDefault(key)
  }

  /**
   * Get a boolean setting
   */
  getBoolean(key: SettingKey): boolean {
    const value = this.get(key)
    return value === 'true'
  }

  /**
   * Get a number setting
   */
  getNumber(key: SettingKey): number {
    const value = this.get(key)
    return parseInt(value, 10)
  }

  /**
   * Set a setting value
   */
  set(key: string, value: string): void {
    const previousValue = storeService.getSetting(key)
    storeService.setSetting(key, value)

    // Emit change event
    this.emit(
      createEvent<SettingsChangedPayload>(EventTypes.SETTINGS_CHANGED, {
        key,
        previousValue,
        value,
      })
    )

    // Notify listeners
    const listeners = this.changeListeners.get(key)
    if (listeners) {
      for (const listener of listeners) {
        listener(value)
      }
    }

    console.log(`[SettingsService] Setting changed: ${key} = ${value}`)
  }

  /**
   * Set a boolean setting
   */
  setBoolean(key: string, value: boolean): void {
    this.set(key, value ? 'true' : 'false')
  }

  /**
   * Set a number setting
   */
  setNumber(key: string, value: number): void {
    this.set(key, String(value))
  }

  /**
   * Get all settings as a structured object
   */
  getAll(): AppSettings {
    return {
      hotkey: {
        pushToTalk: this.get('hotkey.pushToTalk'),
      },
      transforms: {
        urlClean: { enabled: this.getBoolean('transforms.urlClean.enabled') },
        urlMarkdown: { enabled: this.getBoolean('transforms.urlMarkdown.enabled') },
        jsonPretty: { enabled: this.getBoolean('transforms.jsonPretty.enabled') },
        jsonMinify: { enabled: this.getBoolean('transforms.jsonMinify.enabled') },
        jsonToYaml: { enabled: this.getBoolean('transforms.jsonToYaml.enabled') },
        yamlToJson: { enabled: this.getBoolean('transforms.yamlToJson.enabled') },
        extractEmails: { enabled: this.getBoolean('transforms.extractEmails.enabled') },
        extractLinks: { enabled: this.getBoolean('transforms.extractLinks.enabled') },
        redactSecrets: { enabled: this.getBoolean('transforms.redactSecrets.enabled') },
      },
      ui: {
        theme: this.get('ui.theme') as 'light' | 'dark' | 'system',
      },
      audio: {
        minCaptureDuration: this.getNumber('audio.minCaptureDuration'),
        inputDevice: this.get('audio.inputDevice'),
      },
    }
  }

  /**
   * Get all settings as flat key-value pairs
   */
  getAllFlat(): Record<string, string> {
    return storeService.getAllSettings()
  }

  /**
   * Reset a setting to its default value
   */
  reset(key: SettingKey): void {
    const defaultValue = DEFAULT_SETTINGS[key]
    this.set(key, defaultValue)
  }

  /**
   * Reset all settings to defaults
   */
  resetAll(): void {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.set(key, value)
    }
  }

  /**
   * Register a listener for setting changes
   */
  onChange(key: string, listener: (value: string) => void): () => void {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, new Set())
    }
    this.changeListeners.get(key)!.add(listener)

    // Return unsubscribe function
    return () => {
      const listeners = this.changeListeners.get(key)
      if (listeners) {
        listeners.delete(listener)
      }
    }
  }

  /**
   * Check if a transform is enabled
   */
  isTransformEnabled(transformKey: string): boolean {
    const key = `transforms.${transformKey}.enabled` as SettingKey
    return this.getBoolean(key)
  }
}

// Singleton export
export const settingsService = new SettingsService()
