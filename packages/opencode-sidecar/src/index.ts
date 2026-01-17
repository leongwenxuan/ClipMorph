/**
 * OpenCode Sidecar Package
 *
 * Provides OpenCode CLI integration for ClipMorph.
 */

// Types
export * from './types'

// Sidecar class and singleton
export { OpenCodeSidecar, getOpenCodeSidecar, resetOpenCodeSidecar } from './sidecar'

// Detection utilities
export { detectOpenCode, detectOpenCodeSync, getInstallationInstructions } from './detector'
