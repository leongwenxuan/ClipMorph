import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, NativeImage, screen, clipboard } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import {
  IpcChannels,
  EventTypes,
  AppStatus,
  JobStatus,
  createSuccessResponse,
  createErrorResponse,
  createEvent,
  ClipMorphEvent,
  StatusChangedPayload,
  PermissionType,
  PermissionChangedPayload,
  ErrorCodes,
  AutomationStartRequest,
  AutomationProvideInputRequest,
} from '../../packages/contracts/src'
import {
  getAllPermissions,
  canEnableVoice,
  canEnableHotkeys,
  checkMicrophonePermission,
  checkAccessibilityPermission,
  requestMicrophonePermission,
  requestAccessibilityPermission,
} from './services/permission-service'
import { jobManager } from './services/job-manager'
import { clipboardService } from './services/clipboard-service'
import { voiceService } from './services/voice-service'
import { intentService } from './services/intent-service'
import { transformService } from './services/transform-service'
import { storeService } from './services/store-service'
import { settingsService } from './services/settings-service'
import { automationService } from './services/automation-service'
import { secretsService, SecretKey } from './services/secrets-service'
import { getOpenCodeService } from './services/opencode-service'
import { subagentService } from './services/subagent-service'
import { workflowService } from './services/workflow-service'
import { fileOperationService } from './services/file-operation-service'
import { skillService } from './services/skill-service'
import type {
  OpenCodeRunTaskRequest,
  SubagentDiscoverRequest,
  SubagentRunRequest,
  WorkflowStartRequest,
  WorkflowApproveRequest,
  WorkflowRejectRequest,
  FileOpPreviewRequest,
  FileOpExecuteRequest,
  FileOpUndoRequest,
  SkillDiscoverRequest,
  SkillGetRequest,
  SkillExportRequest,
  SkillImportRequest,
} from '../../packages/contracts/src'

// Extend app type to include isQuitting (must be before usage)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}

// App state
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let appStatus: AppStatus = 'idle'

/**
 * Emit an event to the renderer via the events bus
 */
function emitEvent<T>(event: ClipMorphEvent<T>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannels.EVENTS, event)
  }
}

/**
 * Update app status and emit change event
 */
function setAppStatus(newStatus: AppStatus): void {
  const previousStatus = appStatus
  if (previousStatus === newStatus) return

  appStatus = newStatus
  emitEvent(
    createEvent<StatusChangedPayload>(EventTypes.STATUS_CHANGED, {
      status: newStatus,
      previousStatus,
    })
  )

  // Update tray tooltip
  if (tray) {
    tray.setToolTip(`ClipMorph - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`)
  }
}

// Window size modes
const COMPACT_SIZE = { width: 700, height: 52 } // Same width as expanded
const COMPACT_WIDE_SIZE = { width: 700, height: 600 } // Wide compact for showing logs - same size as expanded
const EXPANDED_SIZE = { width: 700, height: 600 }
type WindowMode = 'compact' | 'compact-wide' | 'expanded'
let windowMode: WindowMode = 'compact'
let isExpanded = false // Keep for backwards compat

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.size

  // Position centered at the very top (y=0)
  const x = Math.round((screenWidth - COMPACT_SIZE.width) / 2)

  mainWindow = new BrowserWindow({
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    x,
    y: 0, // Start at absolute top
    show: false, // Don't show until positioned
    frame: false,
    transparent: true, // Critical for notch area
    hasShadow: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    type: 'panel', // Panel type can go above menu bar on macOS
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Set to status level (same as menu bar items)
  mainWindow.setAlwaysOnTop(true, 'status', 1)

  mainWindow.on('ready-to-show', () => {
    const display = screen.getPrimaryDisplay()
    // Position centered, right at the top of workArea (below menu bar)
    const x = Math.round((display.bounds.width - COMPACT_SIZE.width) / 2)
    const y = display.workArea.y
    
    mainWindow?.setPosition(x, y)
    mainWindow?.show()
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  })

  // Prevent window close from quitting the app (stays resident)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Auto-compact when losing focus (switching to other apps)
  mainWindow.on('blur', () => {
    console.log('[ClipMorph] Window blur event')
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Only emit if auto-compact setting is enabled
      const autoCompact = settingsService.getBoolean('ui.autoCompactOnBlur')
      console.log('[ClipMorph] Auto-compact setting:', autoCompact)
      if (autoCompact) {
        console.log('[ClipMorph] Sending APP_BLUR event to renderer')
        mainWindow.webContents.send(IpcChannels.EVENTS, createEvent(EventTypes.APP_BLUR, {}))
      }
    }
  })

  // Load the renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  // Create a simple tray icon (16x16 for macOS menubar)
  // Using a template image for macOS dark/light mode support
  const iconPath = join(__dirname, '../../resources/tray-icon.png')

  // Create a fallback icon if the file doesn't exist yet
  let icon: NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      // Create a simple 16x16 icon programmatically
      icon = createFallbackIcon()
    }
  } catch {
    icon = createFallbackIcon()
  }

  // Mark as template for macOS automatic dark/light mode handling
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('ClipMorph - Idle')

  // Context menu for right-click
  const contextMenu = Menu.buildFromTemplate([
    { label: 'ClipMorph', enabled: false },
    { type: 'separator' },
    { label: 'Status: Idle', enabled: false },
    { type: 'separator' },
    {
      label: 'Quit',
      click: (): void => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // Left-click toggles the window
  tray.on('click', () => {
    toggleWindow()
  })
}

function createFallbackIcon(): NativeImage {
  // Create a simple 16x16 icon (a small circle)
  // This is a minimal PNG with a circle shape
  const size = 16
  const canvas = Buffer.alloc(size * size * 4) // RGBA

  // Draw a simple filled circle
  const centerX = size / 2
  const centerY = size / 2
  const radius = 6

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4

      if (distance <= radius) {
        // Inside circle - white pixel (template images use white)
        canvas[idx] = 255 // R
        canvas[idx + 1] = 255 // G
        canvas[idx + 2] = 255 // B
        canvas[idx + 3] = 255 // A
      } else {
        // Outside circle - transparent
        canvas[idx] = 0
        canvas[idx + 1] = 0
        canvas[idx + 2] = 0
        canvas[idx + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

function toggleWindow(): void {
  if (!mainWindow) return

  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    // Re-center the window at top when showing
    centerWindowAtTop()
    mainWindow.show()
    mainWindow.focus()
  }
}

function centerWindowAtTop(): void {
  if (!mainWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize
  const windowBounds = mainWindow.getBounds()

  const x = Math.round((screenWidth - windowBounds.width) / 2)
  const y = 60 // Fixed distance from top

  mainWindow.setPosition(x, y, false)
}

function positionWindowNearTray(): void {
  if (!mainWindow || !tray) return

  const trayBounds = tray.getBounds()
  const windowBounds = mainWindow.getBounds()

  // On macOS, tray.getBounds() often returns {0,0,0,0}
  // Fall back to screen-based positioning
  if (trayBounds.width === 0 || trayBounds.height === 0) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth } = primaryDisplay.workAreaSize

    // Position in top-right area of screen, below menu bar
    const x = Math.round(screenWidth - windowBounds.width - 20)
    const y = 30 // Below macOS menu bar
    mainWindow.setPosition(x, y, false)
    return
  }

  // Position window centered below the tray icon (macOS style)
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  mainWindow.setPosition(x, y, false)
}

// ============================================================================
// IPC Handlers - Using clipmorph:<domain>:<action> convention
// ============================================================================

function setWindowMode(mode: WindowMode): void {
  if (!mainWindow) return

  const display = screen.getPrimaryDisplay()
  windowMode = mode
  isExpanded = mode === 'expanded'

  let newSize: { width: number; height: number }
  switch (mode) {
    case 'compact':
      newSize = COMPACT_SIZE
      break
    case 'compact-wide':
      newSize = COMPACT_WIDE_SIZE
      break
    case 'expanded':
      newSize = EXPANDED_SIZE
      break
  }

  const x = Math.round((display.bounds.width - newSize.width) / 2)
  // Compact modes hug menu bar, expanded drops down a bit
  const y = display.workArea.y + (mode === 'expanded' ? 10 : 0)

  mainWindow.setBounds({ x, y, width: newSize.width, height: newSize.height }, true)
}

function toggleWindowSize(): void {
  if (!mainWindow) return

  // Toggle between compact and expanded (skip compact-wide in manual toggle)
  const newMode: WindowMode = windowMode === 'expanded' ? 'compact' : 'expanded'
  setWindowMode(newMode)
}

function registerIpcHandlers(): void {
ipcMain.handle(IpcChannels.STATUS_GET, () => {
  return createSuccessResponse({ status: appStatus })
})

  // Window toggle handler
  ipcMain.handle('clipmorph:window:toggle', () => {
    toggleWindowSize()
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode })
  })

  ipcMain.handle('clipmorph:window:getState', () => {
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode })
  })

  // Set window mode (for compact-wide logs view)
  ipcMain.handle('clipmorph:window:setMode', (_event, args: { mode: WindowMode }) => {
    setWindowMode(args.mode)
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode })
  })

// Permission handlers
ipcMain.handle(IpcChannels.PERMISSION_GET_ALL, () => {
  const permissions = getAllPermissions()
  return createSuccessResponse({
    permissions,
    voiceEnabled: canEnableVoice(),
    hotkeysEnabled: canEnableHotkeys(),
  })
})

ipcMain.handle(IpcChannels.PERMISSION_CHECK, (_event, args: { type: PermissionType }) => {
  const { type } = args
  if (type === 'microphone') {
    return createSuccessResponse(checkMicrophonePermission())
  } else if (type === 'accessibility') {
    return createSuccessResponse(checkAccessibilityPermission())
  }
  return createErrorResponse(ErrorCodes.INVALID_REQUEST, `Unknown permission type: ${type}`)
})

  ipcMain.handle(
    IpcChannels.PERMISSION_REQUEST,
    async (_event, args: { type: PermissionType }) => {
  const { type } = args

  if (type === 'microphone') {
    const previousStatus = checkMicrophonePermission().status
    const granted = await requestMicrophonePermission()
    const newStatus = checkMicrophonePermission().status

    if (previousStatus !== newStatus) {
      emitEvent(
        createEvent<PermissionChangedPayload>(EventTypes.PERMISSION_CHANGED, {
          type: 'microphone',
          previousStatus,
          status: newStatus,
        })
      )
    }

    return createSuccessResponse({
      type: 'microphone',
      granted,
      status: newStatus,
    })
  } else if (type === 'accessibility') {
    const previousStatus = checkAccessibilityPermission().status
    const granted = requestAccessibilityPermission()
    const newStatus = checkAccessibilityPermission().status

    if (previousStatus !== newStatus) {
      emitEvent(
        createEvent<PermissionChangedPayload>(EventTypes.PERMISSION_CHANGED, {
          type: 'accessibility',
          previousStatus,
          status: newStatus,
        })
      )
    }

    return createSuccessResponse({
      type: 'accessibility',
      granted,
      status: newStatus,
    })
  }

  return createErrorResponse(ErrorCodes.INVALID_REQUEST, `Unknown permission type: ${type}`)
    }
  )

  // Job handlers
  ipcMain.handle(IpcChannels.JOB_CREATE, (_event, args: { type: string; input?: unknown }) => {
    const job = jobManager.createJob(args.type, args.input)
    return createSuccessResponse({ job })
  })

  ipcMain.handle(IpcChannels.JOB_GET, (_event, args: { id: string }) => {
    const job = jobManager.getJob(args.id)
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Job not found: ${args.id}`)
    }
    return createSuccessResponse({ job })
  })

  ipcMain.handle(IpcChannels.JOB_CANCEL, (_event, args: { id: string }) => {
    const job = jobManager.getJob(args.id)
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Job not found: ${args.id}`)
    }

    if (jobManager.isTerminal(args.id)) {
      return createErrorResponse(
        ErrorCodes.JOB_ALREADY_COMPLETED,
        `Job is already in terminal state: ${job.status}`
      )
    }

    const success = jobManager.cancelJob(args.id)
    if (!success) {
      return createErrorResponse(ErrorCodes.JOB_CANCEL_FAILED, 'Failed to cancel job')
    }

    return createSuccessResponse({ job: jobManager.getJob(args.id) })
  })

  ipcMain.handle(IpcChannels.JOB_LIST, (_event, args?: { status?: JobStatus }) => {
    const jobs = args?.status ? jobManager.getJobsByStatus(args.status) : jobManager.getAllJobs()
    return createSuccessResponse({ jobs })
  })

  // Clipboard handlers
  ipcMain.handle(IpcChannels.CLIPBOARD_READ, () => {
    const text = clipboardService.readClipboard()
    const snapshot = clipboardService.getCurrentSnapshot()
    const filePaths = clipboardService.readFilePaths()
    const formats = clipboardService.getAvailableFormats()
    return createSuccessResponse({ text, snapshot, filePaths, formats })
  })

  ipcMain.handle(
    IpcChannels.CLIPBOARD_WRITE,
    (_event, args: { text: string; expectedSnapshotId?: string }) => {
      if (args.expectedSnapshotId) {
        // Gated write (saves to history for undo)
        const result = clipboardService.writeClipboardGated(args.text, args.expectedSnapshotId)
        if (!result.success) {
          return createErrorResponse(
            result.error.code as (typeof ErrorCodes)[keyof typeof ErrorCodes],
            result.error.message,
            result.error.details
          )
        }
      } else {
        // Ungated write (also saves to history)
        clipboardService.writeClipboard(args.text, true)
      }
      return createSuccessResponse({
        success: true,
        snapshot: clipboardService.getCurrentSnapshot(),
      })
    }
  )

  ipcMain.handle(IpcChannels.CLIPBOARD_UNDO, () => {
    const result = clipboardService.undo()
    if (!result.success) {
      return createErrorResponse(
        result.error.code as (typeof ErrorCodes)[keyof typeof ErrorCodes],
        result.error.message
      )
    }
    return createSuccessResponse({
      success: true,
      snapshot: result.snapshot,
      undoCount: clipboardService.getUndoCount(),
    })
  })

  // Voice handlers
  ipcMain.handle(IpcChannels.VOICE_START, () => {
    const success = voiceService.start()
    if (!success) {
      return createErrorResponse(
        ErrorCodes.VOICE_NOT_AVAILABLE,
        'Cannot start voice capture - microphone permission not granted'
      )
    }
    return createSuccessResponse({ success: true, state: voiceService.getState() })
  })

  ipcMain.handle(IpcChannels.VOICE_STOP, () => {
    voiceService.stop()
    return createSuccessResponse({ success: true, state: voiceService.getState() })
  })

  ipcMain.handle(IpcChannels.VOICE_GET_LAST_TRANSCRIPT, () => {
    const transcript = voiceService.getLastTranscript()
    return createSuccessResponse({ transcript })
  })

  ipcMain.handle(IpcChannels.VOICE_GET_TRANSCRIPTS, () => {
    const transcripts = voiceService.getTranscripts()
    return createSuccessResponse({ transcripts })
  })

  ipcMain.handle(IpcChannels.VOICE_CLEAR_TRANSCRIPTS, () => {
    voiceService.clearTranscripts()
    return createSuccessResponse({ success: true })
  })

  ipcMain.handle(IpcChannels.VOICE_SET_HOTKEY, (_event, args: { hotkey: string }) => {
    const result = voiceService.setHotkey(args.hotkey)
    if (!result.success) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, result.error || 'Failed to set hotkey')
    }

    // Persist the new hotkey to settings
    settingsService.set('hotkey.pushToTalk', args.hotkey)

    return createSuccessResponse({
      success: true,
      hotkey: voiceService.getHotkey(),
    })
  })

  ipcMain.handle(IpcChannels.VOICE_GET_STATE, () => {
    return createSuccessResponse(voiceService.getState())
  })

  // Text input handler (alternative to voice)
  ipcMain.handle(IpcChannels.TEXT_SUBMIT, async (_event, args: { text: string }) => {
    const text = args.text?.trim()
    if (!text) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 'Text cannot be empty')
    }

    console.log(`[ClipMorph] Text command submitted: "${text}"`)
    setAppStatus('processing')

    try {
      const result = await intentService.routeTranscript(text)
      setAppStatus('idle')
      return createSuccessResponse({
        success: result.handled,
        intent: result.intent,
        jobId: result.jobId,
        error: result.error,
      })
    } catch (error) {
      setAppStatus('idle')
      return createErrorResponse(ErrorCodes.UNKNOWN_ERROR, (error as Error).message)
    }
  })

  // Audio device handlers
  ipcMain.handle('voice:listInputDevices', async () => {
    const devices = await voiceService.listInputDevices()
    return createSuccessResponse({ devices })
  })

  ipcMain.handle('voice:getInputDevice', () => {
    const device = voiceService.getInputDevice()
    return createSuccessResponse({ device })
  })

  ipcMain.handle('voice:setInputDevice', (_event, args: { device: string }) => {
    voiceService.setInputDevice(args.device)
    return createSuccessResponse({ success: true, device: args.device })
  })

  // Intent handlers
  ipcMain.handle(IpcChannels.INTENT_CLASSIFY, (_event, args: { transcript: string }) => {
    const classification = intentService.classify(args.transcript)
    return createSuccessResponse(classification)
  })

  ipcMain.handle(IpcChannels.INTENT_ROUTE, async (_event, args: { transcript: string }) => {
    const result = await intentService.routeTranscript(args.transcript)
    return createSuccessResponse({
      intent: result.intent,
      handled: result.handled,
      jobId: result.jobId,
      error: result.error,
    })
  })

  // Action summary handlers
  ipcMain.handle(IpcChannels.ACTION_GET_LAST, () => {
    const action = intentService.getLastAction()
    return createSuccessResponse({ action })
  })

  // Settings handlers
  ipcMain.handle(IpcChannels.SETTINGS_GET, (_event, args: { key: string }) => {
    const value = settingsService.get(args.key as Parameters<typeof settingsService.get>[0])
    return createSuccessResponse({ key: args.key, value })
  })

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, args: { key: string; value: string }) => {
    settingsService.set(args.key, args.value)
    return createSuccessResponse({ key: args.key, value: args.value })
  })

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, () => {
    const settings = settingsService.getAllFlat()
    return createSuccessResponse({ settings })
  })

  ipcMain.handle(IpcChannels.SETTINGS_RESET, (_event, args?: { key?: string }) => {
    if (args?.key) {
      settingsService.reset(args.key as Parameters<typeof settingsService.reset>[0])
    } else {
      settingsService.resetAll()
    }
    return createSuccessResponse({ success: true })
  })

  // Automation handlers
  ipcMain.handle(IpcChannels.AUTOMATION_START, (_event, request: AutomationStartRequest) => {
    const job = automationService.startJob(request)
    return createSuccessResponse({ job })
  })

  ipcMain.handle(IpcChannels.AUTOMATION_CANCEL, (_event, args: { jobId: string }) => {
    const job = automationService.getJob(args.jobId)
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Automation job not found: ${args.jobId}`)
    }

    const success = automationService.cancelJob(args.jobId)
    if (!success) {
      return createErrorResponse(ErrorCodes.JOB_CANCEL_FAILED, 'Failed to cancel automation job')
    }

    return createSuccessResponse({ job: automationService.getJob(args.jobId) })
  })

  ipcMain.handle(IpcChannels.AUTOMATION_GET_STATE, () => {
    return createSuccessResponse(automationService.getState())
  })

  ipcMain.handle(
    IpcChannels.AUTOMATION_PROVIDE_INPUT,
    (_event, args: AutomationProvideInputRequest) => {
      const job = automationService.getJob(args.jobId)
      if (!job) {
        return createErrorResponse(
          ErrorCodes.JOB_NOT_FOUND,
          `Automation job not found: ${args.jobId}`
        )
      }

      if (job.status !== 'needs_input') {
        return createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          `Job is not in needs_input state: ${job.status}`
        )
      }

      if (args.action === 'cancel') {
        automationService.cancelJob(args.jobId)
      } else if (args.action === 'continue' || args.action === 'provide') {
        automationService.resumeJob(args.jobId, args.input)
      }

      return createSuccessResponse({ job: automationService.getJob(args.jobId) })
    }
  )

  // Secrets handlers (API keys via Keychain)
  ipcMain.handle(IpcChannels.SECRETS_GET, async (_event, args: { key: SecretKey }) => {
    const hasValue = await secretsService.hasSecret(args.key)
    let maskedValue: string | undefined
    if (hasValue) {
      const value = await secretsService.getSecret(args.key)
      if (value) {
        // Mask the value: show first 3 and last 4 chars
        maskedValue = value.length > 10 
          ? `${value.substring(0, 3)}${'*'.repeat(Math.min(20, value.length - 7))}${value.substring(value.length - 4)}`
          : '*'.repeat(value.length)
      }
    }
    return createSuccessResponse({ key: args.key, hasValue, maskedValue })
  })

  ipcMain.handle(IpcChannels.SECRETS_SET, async (_event, args: { key: SecretKey; value: string }) => {
    await secretsService.setSecret(args.key, args.value)
    
    // If setting OpenAI key, also update voice service
    if (args.key === 'openai-api-key') {
      voiceService.setApiKey(args.value)
    }
    
    return createSuccessResponse({ key: args.key, success: true })
  })

  ipcMain.handle(IpcChannels.SECRETS_DELETE, async (_event, args: { key: SecretKey }) => {
    const success = await secretsService.deleteSecret(args.key)
    return createSuccessResponse({ key: args.key, success })
  })

  ipcMain.handle(IpcChannels.SECRETS_HAS, async (_event, args: { key: SecretKey }) => {
    const hasValue = await secretsService.hasSecret(args.key)
    return createSuccessResponse({ key: args.key, hasValue })
  })

  // OpenCode handlers (agentic code tasks)
  const openCodeService = getOpenCodeService()
  openCodeService.on('event', emitEvent)

  ipcMain.handle(IpcChannels.OPENCODE_RUN_TASK, async (_event, args: OpenCodeRunTaskRequest) => {
    try {
      const result = await openCodeService.runTask(args)
      return createSuccessResponse(result)
    } catch (error) {
      const err = error as Error & { code?: string }
      if (err.code === 'OPENCODE_NOT_INSTALLED') {
        return createErrorResponse(ErrorCodes.OPENCODE_NOT_INSTALLED, err.message)
      }
      if (err.message.includes('busy')) {
        return createErrorResponse(ErrorCodes.OPENCODE_BUSY, err.message)
      }
      return createErrorResponse(ErrorCodes.OPENCODE_TASK_FAILED, err.message)
    }
  })

  ipcMain.handle(IpcChannels.OPENCODE_CANCEL, () => {
    const result = openCodeService.cancel()
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.OPENCODE_GET_STATE, async () => {
    const state = await openCodeService.getState()
    return createSuccessResponse(state)
  })

  ipcMain.handle(IpcChannels.OPENCODE_DETECT, async () => {
    const detection = await openCodeService.detect()
    return createSuccessResponse(detection)
  })

  ipcMain.handle(IpcChannels.OPENCODE_WRITE_INPUT, (_event, args: { input: string }) => {
    openCodeService.writeInput(args.input)
    return createSuccessResponse({ success: true })
  })

  ipcMain.handle(IpcChannels.OPENCODE_RESPOND_PERMISSION, (_event, args: { allow: boolean }) => {
    openCodeService.respondToPermission(args.allow)
    return createSuccessResponse({ success: true })
  })

  // Subagent handlers (custom OpenCode subagents)
  ipcMain.handle(IpcChannels.SUBAGENT_LIST, async () => {
    const result = await subagentService.list()
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SUBAGENT_DISCOVER, async (_event, args?: SubagentDiscoverRequest) => {
    const result = await subagentService.discover(args?.forceReload)
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SUBAGENT_RUN, async (_event, args: SubagentRunRequest) => {
    const subagent = subagentService.get(args.subagentId)
    if (!subagent) {
      return createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        `Subagent not found: ${args.subagentId}`
      )
    }

    // Build the full prompt with system prompt from subagent
    const fullPrompt = `${subagent.systemPrompt}\n\n---\nUser request: ${args.prompt}`

    try {
      const result = await openCodeService.runTask({
        prompt: fullPrompt,
        context: args.context,
        cwd: args.cwd,
      })
      return createSuccessResponse({
        ...result,
        subagent,
      })
    } catch (error) {
      const err = error as Error & { code?: string }
      if (err.code === 'OPENCODE_NOT_INSTALLED') {
        return createErrorResponse(ErrorCodes.OPENCODE_NOT_INSTALLED, err.message)
      }
      if (err.message.includes('busy')) {
        return createErrorResponse(ErrorCodes.OPENCODE_BUSY, err.message)
      }
      return createErrorResponse(ErrorCodes.OPENCODE_TASK_FAILED, err.message)
    }
  })

  // Workflow handlers (multi-stage agentic workflows)
  workflowService.setEventEmitter(emitEvent)

  ipcMain.handle(IpcChannels.WORKFLOW_START, async (_event, args: WorkflowStartRequest) => {
    try {
      const result = await workflowService.startWorkflow(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOW_APPROVE, async (_event, args: WorkflowApproveRequest) => {
    try {
      const result = await workflowService.approveCheckpoint(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOW_REJECT, async (_event, args: WorkflowRejectRequest) => {
    try {
      const result = await workflowService.rejectCheckpoint(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOW_CANCEL, (_event, args: { jobId: string }) => {
    try {
      const result = workflowService.cancelWorkflow(args.jobId)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOW_GET_STATE, () => {
    return createSuccessResponse(workflowService.getState())
  })

  // File operation handlers
  fileOperationService.setEventEmitter(emitEvent)

  ipcMain.handle(IpcChannels.FILE_OP_PREVIEW, async (_event, args: FileOpPreviewRequest) => {
    try {
      const result = await fileOperationService.generatePreview(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.FILE_OP_EXECUTE, async (_event, args: FileOpExecuteRequest) => {
    try {
      const result = await fileOperationService.execute(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.FILE_OP_UNDO, async (_event, args: FileOpUndoRequest) => {
    try {
      const result = await fileOperationService.undo(args)
      return createSuccessResponse(result)
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, (error as Error).message)
    }
  })

  ipcMain.handle(IpcChannels.FILE_OP_HISTORY, () => {
    return createSuccessResponse(fileOperationService.getHistory())
  })

  // Skill handlers (reusable instruction templates)
  skillService.setEventEmitter(emitEvent)

  ipcMain.handle(IpcChannels.SKILL_LIST, async () => {
    const result = await skillService.list()
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SKILL_DISCOVER, async (_event, args?: SkillDiscoverRequest) => {
    const result = await skillService.discover(args?.forceReload)
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SKILL_GET, (_event, args: SkillGetRequest) => {
    const result = skillService.get(args.skillId)
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SKILL_EXPORT, async (_event, args: SkillExportRequest) => {
    const result = await skillService.export(args.skillId, args.outputPath)
    return createSuccessResponse(result)
  })

  ipcMain.handle(IpcChannels.SKILL_IMPORT, async (_event, args: SkillImportRequest) => {
    const result = await skillService.import(args.source, args.global)
    return createSuccessResponse(result)
  })

  // ============================================================================
  // Operations History Handlers
  // ============================================================================

  ipcMain.handle(IpcChannels.HISTORY_GET, (_event, args?: { limit?: number }) => {
    const operations = storeService.getOperations(args?.limit ?? 50)
    return createSuccessResponse({ operations })
  })

  ipcMain.handle(IpcChannels.HISTORY_CLEAR, () => {
    storeService.clearOperations()
    return createSuccessResponse({ cleared: true })
  })

  // Copy image from path to clipboard
  ipcMain.handle(IpcChannels.HISTORY_COPY_IMAGE, (_event, args: { imagePath: string }) => {
    try {
      if (!args.imagePath || !existsSync(args.imagePath)) {
        return createErrorResponse({
          code: ErrorCodes.INVALID_ARGS,
          message: 'Image file not found',
        })
      }
      const imageBuffer = readFileSync(args.imagePath)
      const image = nativeImage.createFromBuffer(imageBuffer)
      clipboard.writeImage(image)
      return createSuccessResponse({ copied: true })
    } catch (error) {
      return createErrorResponse({
        code: ErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to copy image',
      })
    }
  })

  // Get image as base64 for preview
  ipcMain.handle(IpcChannels.HISTORY_GET_IMAGE, (_event, args: { imagePath: string }) => {
    try {
      if (!args.imagePath || !existsSync(args.imagePath)) {
        return createErrorResponse({
          code: ErrorCodes.INVALID_ARGS,
          message: 'Image file not found',
        })
      }
      const imageBuffer = readFileSync(args.imagePath)
      const base64 = imageBuffer.toString('base64')
      return createSuccessResponse({ base64, mimeType: 'image/png' })
    } catch (error) {
      return createErrorResponse({
        code: ErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to read image',
      })
    }
  })
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Set app user model id for windows
  app.setAppUserModelId('com.clipmorph')

  // Initialize database
  storeService.initialize()

  // Register IPC handlers (must be after app is ready)
  registerIpcHandlers()

  // Connect event emitters
  jobManager.setEventEmitter(emitEvent)
  clipboardService.setEventEmitter(emitEvent)
  voiceService.setEventEmitter(emitEvent)
  voiceService.setStatusCallback(setAppStatus)
  intentService.setEventEmitter(emitEvent)
  transformService.setEventEmitter(emitEvent)
  settingsService.setEventEmitter(emitEvent)
  automationService.setEventEmitter(emitEvent)

  // Start clipboard watcher
  clipboardService.startWatching()

  // Set OpenAI API key - first try Keychain, then fall back to env var
  const loadApiKey = async (): Promise<void> => {
    // Try Keychain first
    const keychainKey = await secretsService.getOpenAIKey()
    if (keychainKey) {
      voiceService.setApiKey(keychainKey)
      console.log('[ClipMorph] OpenAI API key loaded from Keychain')
      return
    }
    
    // Fall back to environment variable
    const envKey = process.env.OPENAI_API_KEY
    if (envKey) {
      voiceService.setApiKey(envKey)
      console.log('[ClipMorph] OpenAI API key loaded from environment')
      // Also save to Keychain for future use
      await secretsService.setOpenAIKey(envKey)
      return
    }
    
    console.warn('[ClipMorph] No OpenAI API key configured - set via Settings or OPENAI_API_KEY env var')
  }
  loadApiKey()

  // Register push-to-talk hotkey (if accessibility permission is granted)
  if (canEnableHotkeys()) {
    // Load hotkey from settings
    const savedHotkey = settingsService.get('hotkey.pushToTalk')
    const registered = voiceService.registerHotkey(savedHotkey)
    if (registered) {
      console.log('[ClipMorph] Push-to-talk hotkey registered:', voiceService.getHotkey())
    } else {
      console.warn('[ClipMorph] Failed to register push-to-talk hotkey')
    }
  } else {
    console.log('[ClipMorph] Hotkeys disabled - accessibility permission not granted')
  }

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    if (!app.isPackaged) {
      window.webContents.on('before-input-event', (event, input) => {
        // F12 to toggle DevTools
        if (input.key === 'F12') {
          window.webContents.toggleDevTools()
          event.preventDefault()
        }
      })
    }
  })

  createTray()
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  // For menubar apps, we don't quit when windows close
  // The app stays in the tray
})

app.on('before-quit', () => {
  app.isQuitting = true
  voiceService.cleanup()
  storeService.close()
  getOpenCodeService().dispose()
})

// Export for testing
export { appStatus, setAppStatus, emitEvent }
