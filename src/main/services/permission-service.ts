/**
 * Permission Service
 * Handles detection and management of system permissions (microphone, accessibility)
 * macOS-first implementation
 */

import { systemPreferences, shell } from 'electron'

export type PermissionType = 'microphone' | 'accessibility'

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PermissionState {
  microphone: PermissionStatus
  accessibility: PermissionStatus
}

export interface PermissionCheckResult {
  type: PermissionType
  status: PermissionStatus
  canRequest: boolean
}

/**
 * Check microphone permission status on macOS
 */
export function checkMicrophonePermission(): PermissionCheckResult {
  if (process.platform !== 'darwin') {
    // Non-macOS: assume granted (permissions handled differently)
    return { type: 'microphone', status: 'granted', canRequest: false }
  }

  const status = systemPreferences.getMediaAccessStatus('microphone')

  switch (status) {
    case 'granted':
      return { type: 'microphone', status: 'granted', canRequest: false }
    case 'denied':
      return { type: 'microphone', status: 'denied', canRequest: false }
    case 'not-determined':
      return { type: 'microphone', status: 'not-determined', canRequest: true }
    case 'restricted':
      return { type: 'microphone', status: 'restricted', canRequest: false }
    default:
      return { type: 'microphone', status: 'unknown', canRequest: false }
  }
}

/**
 * Check accessibility permission status on macOS
 * Required for global hotkeys
 */
export function checkAccessibilityPermission(): PermissionCheckResult {
  if (process.platform !== 'darwin') {
    // Non-macOS: assume granted
    return { type: 'accessibility', status: 'granted', canRequest: false }
  }

  const isTrusted = systemPreferences.isTrustedAccessibilityClient(false)

  return {
    type: 'accessibility',
    status: isTrusted ? 'granted' : 'denied',
    canRequest: !isTrusted,
  }
}

/**
 * Request microphone permission (macOS only)
 * Returns true if permission was granted
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return true
  }

  const currentStatus = checkMicrophonePermission()
  if (currentStatus.status === 'granted') {
    return true
  }

  if (currentStatus.status === 'not-determined') {
    // This will trigger the system permission dialog
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return granted
  }

  // Already denied or restricted - user must grant in System Preferences
  return false
}

/**
 * Request accessibility permission (macOS only)
 * Opens System Preferences if not trusted
 */
export function requestAccessibilityPermission(): boolean {
  if (process.platform !== 'darwin') {
    return true
  }

  // Check if already trusted
  const isTrusted = systemPreferences.isTrustedAccessibilityClient(false)
  
  if (!isTrusted) {
    // Open System Preferences to Accessibility pane
    // This URL scheme works on macOS Ventura and later
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  }
  
  return isTrusted
}

/**
 * Get all permission states
 */
export function getAllPermissions(): PermissionState {
  const mic = checkMicrophonePermission()
  const accessibility = checkAccessibilityPermission()

  return {
    microphone: mic.status,
    accessibility: accessibility.status,
  }
}

/**
 * Check if voice features can be enabled
 * Voice requires microphone permission
 */
export function canEnableVoice(): boolean {
  const mic = checkMicrophonePermission()
  return mic.status === 'granted'
}

/**
 * Check if global hotkeys can be enabled
 * Hotkeys require accessibility permission
 */
export function canEnableHotkeys(): boolean {
  const accessibility = checkAccessibilityPermission()
  return accessibility.status === 'granted'
}
