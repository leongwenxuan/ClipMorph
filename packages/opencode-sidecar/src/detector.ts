/**
 * OpenCode CLI Detection Utilities
 *
 * Detects if OpenCode CLI is installed and available.
 */

import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import { DetectionResult } from './types'

const execAsync = promisify(exec)

/**
 * Check if a command exists in PATH
 */
function commandExists(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return result || null
  } catch {
    return null
  }
}

/**
 * Get OpenCode version
 */
async function getVersion(binaryPath: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`"${binaryPath}" --version`, {
      timeout: 5000,
    })
    return stdout.trim() || null
  } catch {
    // Version flag might not exist, that's ok
    return null
  }
}

/**
 * Detect if OpenCode CLI is installed and available
 */
export async function detectOpenCode(): Promise<DetectionResult> {
  // Try common binary names
  const binaryNames = ['opencode', 'oc']

  for (const name of binaryNames) {
    const path = commandExists(name)
    if (path) {
      const version = await getVersion(path)
      return {
        installed: true,
        binaryPath: path,
        version: version ?? undefined,
      }
    }
  }

  // Check common installation paths
  const commonPaths = [
    '/usr/local/bin/opencode',
    '/opt/homebrew/bin/opencode',
    `${process.env.HOME}/.local/bin/opencode`,
    `${process.env.HOME}/.npm-global/bin/opencode`,
  ]

  for (const path of commonPaths) {
    try {
      execSync(`test -x "${path}"`, { stdio: 'pipe' })
      const version = await getVersion(path)
      return {
        installed: true,
        binaryPath: path,
        version: version ?? undefined,
      }
    } catch {
      // Path doesn't exist or isn't executable
    }
  }

  return {
    installed: false,
    error: 'OpenCode CLI not found. Install it with: npm install -g opencode',
  }
}

/**
 * Synchronous detection (for startup checks)
 */
export function detectOpenCodeSync(): DetectionResult {
  const binaryNames = ['opencode', 'oc']

  for (const name of binaryNames) {
    const path = commandExists(name)
    if (path) {
      return {
        installed: true,
        binaryPath: path,
      }
    }
  }

  return {
    installed: false,
    error: 'OpenCode CLI not found. Install it with: npm install -g opencode',
  }
}

/**
 * Get installation instructions based on platform
 */
export function getInstallationInstructions(): string {
  const platform = process.platform

  const instructions = `
OpenCode CLI is not installed.

Installation options:

1. Using npm (recommended):
   npm install -g opencode

2. Using Homebrew (macOS):
   brew install opencode

3. Manual installation:
   Visit https://opencode.ai for download links

After installation, restart ClipMorph or run a new voice command.
`.trim()

  if (platform === 'darwin') {
    return instructions
  }

  // Generic instructions for other platforms
  return `
OpenCode CLI is not installed.

Installation:
   npm install -g opencode

Visit https://opencode.ai for more options.
`.trim()
}
