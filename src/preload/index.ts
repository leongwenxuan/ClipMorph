import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  IpcResponse,
  StatusGetResponse,
  ClipMorphEvent,
  PermissionGetAllResponse,
  PermissionCheckResult,
  PermissionRequestResponse,
  PermissionType,
  Job,
  JobStatus,
  ClipboardReadResponse,
  ClipboardWriteResponse,
  ClipboardUndoResponse,
  VoiceStateResponse,
  TranscriptResponse,
  TranscriptsResponse,
  IntentClassificationResponse,
  IntentRoutingResponse,
  LastActionResponse,
  SettingsGetResponse,
  SettingsSetResponse,
  SettingsGetAllResponse,
  SettingsResetResponse,
  VoiceSetHotkeyResponse,
  VoiceGetStateResponse,
  TextSubmitResponse,
  AutomationStartRequest,
  AutomationStartResponse,
  AutomationState,
  AutomationJob,
  SecretKey,
  SecretsGetResponse,
  SecretsSetResponse,
  SecretsDeleteResponse,
  SecretsHasResponse,
  OpenCodeRunTaskRequest,
  OpenCodeRunTaskResponse,
  OpenCodeStateResponse,
  OpenCodeDetectResponse,
  SubagentListResponse,
  SubagentDiscoverResponse,
  SubagentRunRequest,
  SubagentRunResponse,
  WorkflowStartRequest,
  WorkflowStartResponse,
  WorkflowApproveRequest,
  WorkflowRejectRequest,
  WorkflowControlResponse,
  WorkflowState,
  FileOpPreviewRequest,
  FileOpPreviewResponse,
  FileOpExecuteRequest,
  FileOpExecuteResponse,
  FileOpUndoResponse,
  FileOpHistoryResponse,
  SkillListResponse,
  SkillDiscoverResponse,
  SkillGetResponse,
  SkillExportResponse,
  SkillImportResponse,
  OperationHistoryResponse,
} from '../../packages/contracts/src'

// ============================================================================
// ClipMorph Preload API
// Exposes a minimal, typed API to the renderer via contextBridge
// NO direct access to ipcRenderer - only specific, validated methods
// ============================================================================

export interface ClipMorphAPI {
  /**
   * Get the current app status
   * @returns Promise resolving to IPC response with status
   */
  getAppStatus: () => Promise<IpcResponse<StatusGetResponse>>

  /**
   * Subscribe to events from the main process
   * Events bus channel: clipmorph:events
   * @param callback Function called when events are received
   * @returns Unsubscribe function
   */
  onEvent: (callback: (event: ClipMorphEvent) => void) => () => void

  /**
   * Get all permission states
   * @returns Promise resolving to all permissions and feature availability
   */
  getPermissions: () => Promise<IpcResponse<PermissionGetAllResponse>>

  /**
   * Check a specific permission
   * @param type The permission type to check
   * @returns Promise resolving to permission check result
   */
  checkPermission: (type: PermissionType) => Promise<IpcResponse<PermissionCheckResult>>

  /**
   * Request a specific permission
   * @param type The permission type to request
   * @returns Promise resolving to permission request result
   */
  requestPermission: (type: PermissionType) => Promise<IpcResponse<PermissionRequestResponse>>

  /**
   * Create a new job
   * @param type The job type
   * @param input Optional input data for the job
   * @returns Promise resolving to the created job
   */
  createJob: (type: string, input?: unknown) => Promise<IpcResponse<{ job: Job }>>

  /**
   * Get a job by ID
   * @param id The job ID
   * @returns Promise resolving to the job
   */
  getJob: (id: string) => Promise<IpcResponse<{ job: Job }>>

  /**
   * Cancel a job
   * @param id The job ID to cancel
   * @returns Promise resolving to the cancelled job
   */
  cancelJob: (id: string) => Promise<IpcResponse<{ job: Job }>>

  /**
   * List all jobs, optionally filtered by status
   * @param status Optional status filter
   * @returns Promise resolving to list of jobs
   */
  listJobs: (status?: JobStatus) => Promise<IpcResponse<{ jobs: Job[] }>>

  /**
   * Read the current clipboard content
   * @returns Promise resolving to clipboard text and snapshot
   */
  readClipboard: () => Promise<IpcResponse<ClipboardReadResponse>>

  /**
   * Write text to clipboard
   * @param text The text to write
   * @param expectedSnapshotId Optional snapshot ID for gated write
   * @returns Promise resolving to write result
   */
  writeClipboard: (
    text: string,
    expectedSnapshotId?: string
  ) => Promise<IpcResponse<ClipboardWriteResponse>>

  /**
   * Undo the last clipboard write by ClipMorph
   * @returns Promise resolving to undo result with restored snapshot
   */
  undoClipboard: () => Promise<IpcResponse<ClipboardUndoResponse>>

  /**
   * Start voice capture (alternative to hotkey)
   * @returns Promise resolving to voice state
   */
  startVoice: () => Promise<IpcResponse<VoiceStateResponse>>

  /**
   * Stop voice capture
   * @returns Promise resolving to voice state
   */
  stopVoice: () => Promise<IpcResponse<VoiceStateResponse>>

  /**
   * Get the last transcript
   * @returns Promise resolving to the last transcript record
   */
  getLastTranscript: () => Promise<IpcResponse<TranscriptResponse>>

  /**
   * Get all transcripts (last 20)
   * @returns Promise resolving to all transcript records
   */
  getTranscripts: () => Promise<IpcResponse<TranscriptsResponse>>

  /**
   * Clear transcript history
   * @returns Promise resolving to success
   */
  clearTranscripts: () => Promise<IpcResponse<{ success: boolean }>>

  /**
   * Set the push-to-talk hotkey
   * @param hotkey The new hotkey string (e.g., "Ctrl+Shift+V")
   * @returns Promise resolving to the result
   */
  setVoiceHotkey: (hotkey: string) => Promise<IpcResponse<VoiceSetHotkeyResponse>>

  /**
   * Get the current voice state
   * @returns Promise resolving to voice state
   */
  getVoiceState: () => Promise<IpcResponse<VoiceGetStateResponse>>

  /**
   * Submit text command (alternative to voice)
   * @param text The command text to process
   * @returns Promise resolving to the routing result
   */
  submitText: (text: string) => Promise<IpcResponse<TextSubmitResponse>>

  /**
   * Classify a transcript into an intent
   * @param transcript The transcript text to classify
   * @returns Promise resolving to intent classification
   */
  classifyIntent: (transcript: string) => Promise<IpcResponse<IntentClassificationResponse>>

  /**
   * Route a transcript to the appropriate capability
   * @param transcript The transcript text to route
   * @returns Promise resolving to routing result
   */
  routeIntent: (transcript: string) => Promise<IpcResponse<IntentRoutingResponse>>

  /**
   * Get the last action summary
   * @returns Promise resolving to last action summary or null
   */
  getLastAction: () => Promise<IpcResponse<LastActionResponse>>

  /**
   * Get a setting value
   * @param key The setting key
   * @returns Promise resolving to the setting value
   */
  getSetting: (key: string) => Promise<IpcResponse<SettingsGetResponse>>

  /**
   * Set a setting value
   * @param key The setting key
   * @param value The value to set
   * @returns Promise resolving to the updated setting
   */
  setSetting: (key: string, value: string) => Promise<IpcResponse<SettingsSetResponse>>

  /**
   * Get all settings
   * @returns Promise resolving to all settings
   */
  getAllSettings: () => Promise<IpcResponse<SettingsGetAllResponse>>

  /**
   * Reset settings to defaults
   * @param key Optional specific key to reset, or all if not provided
   * @returns Promise resolving to success
   */
  resetSettings: (key?: string) => Promise<IpcResponse<SettingsResetResponse>>

  /**
   * Start an automation job
   * @param request The automation request
   * @returns Promise resolving to the created automation job
   */
  startAutomation: (request: AutomationStartRequest) => Promise<IpcResponse<AutomationStartResponse>>

  /**
   * Cancel an automation job
   * @param jobId The job ID to cancel
   * @returns Promise resolving to the cancelled job
   */
  cancelAutomation: (jobId: string) => Promise<IpcResponse<{ job: AutomationJob }>>

  /**
   * Get the current automation state
   * @returns Promise resolving to automation state
   */
  getAutomationState: () => Promise<IpcResponse<AutomationState>>

  /**
   * Provide input to a needs_input automation job
   * @param jobId The job ID
   * @param action The action to take
   * @param input Optional input data
   * @returns Promise resolving to the updated job
   */
  provideAutomationInput: (
    jobId: string,
    action: 'continue' | 'cancel' | 'provide',
    input?: unknown
  ) => Promise<IpcResponse<{ job: AutomationJob }>>

  // ============================================================================
  // Secrets API (API Keys via Keychain)
  // ============================================================================

  /**
   * Get a secret (returns masked value for display)
   * @param key The secret key
   * @returns Promise resolving to secret info with masked value
   */
  getSecret: (key: SecretKey) => Promise<IpcResponse<SecretsGetResponse>>

  /**
   * Set a secret value
   * @param key The secret key
   * @param value The value to store
   * @returns Promise resolving to success
   */
  setSecret: (key: SecretKey, value: string) => Promise<IpcResponse<SecretsSetResponse>>

  /**
   * Delete a secret
   * @param key The secret key
   * @returns Promise resolving to success
   */
  deleteSecret: (key: SecretKey) => Promise<IpcResponse<SecretsDeleteResponse>>

  /**
   * Check if a secret exists
   * @param key The secret key
   * @returns Promise resolving to whether the secret exists
   */
  hasSecret: (key: SecretKey) => Promise<IpcResponse<SecretsHasResponse>>

  // ============================================================================
  // Window Control API
  // ============================================================================

  /**
   * Toggle window between compact and expanded mode
   * @returns Promise resolving to current expanded state
   */
  toggleWindow: () => Promise<IpcResponse<{ expanded: boolean }>>

  /**
   * Get current window state
   * @returns Promise resolving to current expanded state and mode
   */
  getWindowState: () => Promise<IpcResponse<{ expanded: boolean; mode: 'compact' | 'compact-wide' | 'expanded' }>>

  /**
   * Set window mode (compact, compact-wide, or expanded)
   * @param mode The window mode to set
   * @returns Promise resolving to updated window state
   */
  setWindowMode: (mode: 'compact' | 'compact-wide' | 'expanded') => Promise<IpcResponse<{ expanded: boolean; mode: 'compact' | 'compact-wide' | 'expanded' }>>

  // ============================================================================
  // OpenCode API (Agentic Code Tasks)
  // ============================================================================

  /**
   * Run an OpenCode task
   * @param request The task request with prompt and optional context
   * @returns Promise resolving to job ID and started status
   */
  runOpenCodeTask: (request: OpenCodeRunTaskRequest) => Promise<IpcResponse<OpenCodeRunTaskResponse>>

  /**
   * Cancel the current OpenCode task
   * @returns Promise resolving to cancelled status
   */
  cancelOpenCode: () => Promise<IpcResponse<{ cancelled: boolean; jobId?: string }>>

  /**
   * Get OpenCode state (including installation status)
   * @returns Promise resolving to OpenCode state
   */
  getOpenCodeState: () => Promise<IpcResponse<OpenCodeStateResponse>>

  /**
   * Detect OpenCode CLI installation
   * @returns Promise resolving to detection result with install instructions
   */
  detectOpenCode: () => Promise<IpcResponse<OpenCodeDetectResponse>>

  /**
   * Write input to the active OpenCode task (for interactive prompts)
   * @param input The input string to send
   * @returns Promise resolving to success
   */
  writeOpenCodeInput: (input: string) => Promise<IpcResponse<{ success: boolean }>>

  /**
   * Respond to a permission request from OpenCode
   * @param allow Whether to allow the permission
   * @returns Promise resolving to success
   */
  respondToOpenCodePermission: (allow: boolean) => Promise<IpcResponse<{ success: boolean }>>

  // ============================================================================
  // Subagent API (Custom OpenCode Subagents)
  // ============================================================================

  /**
   * List all discovered subagents
   * @returns Promise resolving to subagent list
   */
  listSubagents: () => Promise<IpcResponse<SubagentListResponse>>

  /**
   * Discover/reload subagents from config directories
   * @param forceReload Force reload even if cached
   * @returns Promise resolving to discovery result
   */
  discoverSubagents: (forceReload?: boolean) => Promise<IpcResponse<SubagentDiscoverResponse>>

  /**
   * Run a subagent with a prompt
   * @param request The subagent run request
   * @returns Promise resolving to run result with job ID
   */
  runSubagent: (request: SubagentRunRequest) => Promise<IpcResponse<SubagentRunResponse>>

  // ============================================================================
  // Workflow API (Multi-Stage Agentic Workflows)
  // ============================================================================

  /**
   * Start a multi-stage workflow
   * @param request The workflow start request
   * @returns Promise resolving to the created workflow job
   */
  startWorkflow: (request: WorkflowStartRequest) => Promise<IpcResponse<WorkflowStartResponse>>

  /**
   * Approve the current workflow checkpoint and proceed to next stage
   * @param jobId The workflow job ID
   * @param feedback Optional feedback for the next stage
   * @returns Promise resolving to the updated workflow job
   */
  approveWorkflowCheckpoint: (jobId: string, feedback?: string) => Promise<IpcResponse<WorkflowControlResponse>>

  /**
   * Reject the current workflow checkpoint
   * @param jobId The workflow job ID
   * @param action Whether to retry the stage or abort the workflow
   * @param feedback Feedback for retry (what to fix)
   * @returns Promise resolving to the updated workflow job
   */
  rejectWorkflowCheckpoint: (
    jobId: string,
    action: 'retry' | 'abort',
    feedback?: string
  ) => Promise<IpcResponse<WorkflowControlResponse>>

  /**
   * Cancel a workflow
   * @param jobId The workflow job ID
   * @returns Promise resolving to the cancelled workflow job
   */
  cancelWorkflow: (jobId: string) => Promise<IpcResponse<WorkflowControlResponse>>

  /**
   * Get current workflow state
   * @returns Promise resolving to workflow state
   */
  getWorkflowState: () => Promise<IpcResponse<WorkflowState>>

  // ============================================================================
  // File Operation API
  // ============================================================================

  /**
   * Generate a preview of file operations
   * @param request The preview request with prompt and optional target directory
   * @returns Promise resolving to the operation preview
   */
  previewFileOperation: (request: FileOpPreviewRequest) => Promise<IpcResponse<FileOpPreviewResponse>>

  /**
   * Execute file operations from a preview
   * @param previewId The preview ID
   * @param approved Whether destructive operations are approved
   * @returns Promise resolving to the execution result
   */
  executeFileOperation: (previewId: string, approved: boolean) => Promise<IpcResponse<FileOpExecuteResponse>>

  /**
   * Undo a recent file operation
   * @param jobId The job ID to undo
   * @returns Promise resolving to the undo result
   */
  undoFileOperation: (jobId: string) => Promise<IpcResponse<FileOpUndoResponse>>

  /**
   * Get file operation history
   * @returns Promise resolving to operation history
   */
  getFileOperationHistory: () => Promise<IpcResponse<FileOpHistoryResponse>>

  // ============================================================================
  // Skill API (Reusable Instruction Templates)
  // ============================================================================

  /**
   * List all available skills
   * @returns Promise resolving to skill list
   */
  listSkills: () => Promise<IpcResponse<SkillListResponse>>

  /**
   * Discover/reload skills from directories
   * @param forceReload Force reload even if cached
   * @returns Promise resolving to discovery result
   */
  discoverSkills: (forceReload?: boolean) => Promise<IpcResponse<SkillDiscoverResponse>>

  /**
   * Get a specific skill by ID
   * @param skillId The skill ID
   * @returns Promise resolving to the skill
   */
  getSkill: (skillId: string) => Promise<IpcResponse<SkillGetResponse>>

  /**
   * Export a skill to a file
   * @param skillId The skill ID to export
   * @param outputPath Optional output path
   * @returns Promise resolving to export result
   */
  exportSkill: (skillId: string, outputPath?: string) => Promise<IpcResponse<SkillExportResponse>>

  /**
   * Import a skill from a file
   * @param source Path to skill file or URL
   * @param global Whether to import to global directory
   * @returns Promise resolving to import result
   */
  importSkill: (source: string, global?: boolean) => Promise<IpcResponse<SkillImportResponse>>

  // ============================================================================
  // Operations History API
  // ============================================================================

  /**
   * Get operations history (last N operations with input/output)
   * @param limit Optional limit (default 50)
   * @returns Promise resolving to operations list
   */
  getOperationsHistory: (limit?: number) => Promise<IpcResponse<OperationHistoryResponse>>

  /**
   * Clear operations history
   * @returns Promise resolving to success
   */
  clearOperationsHistory: () => Promise<IpcResponse<{ cleared: boolean }>>

  /**
   * Copy an image from path to clipboard
   * @param imagePath The path to the image file
   * @returns Promise resolving to success
   */
  copyImageToClipboard: (imagePath: string) => Promise<IpcResponse<{ copied: boolean }>>

  /**
   * Get an image as base64 for preview
   * @param imagePath The path to the image file
   * @returns Promise resolving to base64 data
   */
  getImageBase64: (imagePath: string) => Promise<IpcResponse<{ base64: string; mimeType: string }>>
}

// Expose a minimal, typed API to the renderer
const api: ClipMorphAPI = {
  getAppStatus: () => ipcRenderer.invoke(IpcChannels.STATUS_GET),

  onEvent: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ClipMorphEvent): void => {
      console.log('[Preload] Event received:', data.type)
      callback(data)
    }

    ipcRenderer.on(IpcChannels.EVENTS, handler)

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(IpcChannels.EVENTS, handler)
    }
  },

  getPermissions: () => ipcRenderer.invoke(IpcChannels.PERMISSION_GET_ALL),

  checkPermission: (type: PermissionType) =>
    ipcRenderer.invoke(IpcChannels.PERMISSION_CHECK, { type }),

  requestPermission: (type: PermissionType) =>
    ipcRenderer.invoke(IpcChannels.PERMISSION_REQUEST, { type }),

  createJob: (type: string, input?: unknown) =>
    ipcRenderer.invoke(IpcChannels.JOB_CREATE, { type, input }),

  getJob: (id: string) => ipcRenderer.invoke(IpcChannels.JOB_GET, { id }),

  cancelJob: (id: string) => ipcRenderer.invoke(IpcChannels.JOB_CANCEL, { id }),

  listJobs: (status?: JobStatus) => ipcRenderer.invoke(IpcChannels.JOB_LIST, { status }),

  readClipboard: () => ipcRenderer.invoke(IpcChannels.CLIPBOARD_READ),

  writeClipboard: (text: string, expectedSnapshotId?: string) =>
    ipcRenderer.invoke(IpcChannels.CLIPBOARD_WRITE, { text, expectedSnapshotId }),

  undoClipboard: () => ipcRenderer.invoke(IpcChannels.CLIPBOARD_UNDO),

  startVoice: () => ipcRenderer.invoke(IpcChannels.VOICE_START),

  stopVoice: () => ipcRenderer.invoke(IpcChannels.VOICE_STOP),

  getLastTranscript: () => ipcRenderer.invoke(IpcChannels.VOICE_GET_LAST_TRANSCRIPT),

  getTranscripts: () => ipcRenderer.invoke(IpcChannels.VOICE_GET_TRANSCRIPTS),

  clearTranscripts: () => ipcRenderer.invoke(IpcChannels.VOICE_CLEAR_TRANSCRIPTS),

  setVoiceHotkey: (hotkey: string) =>
    ipcRenderer.invoke(IpcChannels.VOICE_SET_HOTKEY, { hotkey }),

  getVoiceState: () => ipcRenderer.invoke(IpcChannels.VOICE_GET_STATE),

  submitText: (text: string) =>
    ipcRenderer.invoke(IpcChannels.TEXT_SUBMIT, { text }),

  classifyIntent: (transcript: string) =>
    ipcRenderer.invoke(IpcChannels.INTENT_CLASSIFY, { transcript }),

  routeIntent: (transcript: string) =>
    ipcRenderer.invoke(IpcChannels.INTENT_ROUTE, { transcript }),

  getLastAction: () => ipcRenderer.invoke(IpcChannels.ACTION_GET_LAST),

  getSetting: (key: string) => ipcRenderer.invoke(IpcChannels.SETTINGS_GET, { key }),

  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, { key, value }),

  getAllSettings: () => ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),

  resetSettings: (key?: string) => ipcRenderer.invoke(IpcChannels.SETTINGS_RESET, { key }),

  startAutomation: (request: AutomationStartRequest) =>
    ipcRenderer.invoke(IpcChannels.AUTOMATION_START, request),

  cancelAutomation: (jobId: string) =>
    ipcRenderer.invoke(IpcChannels.AUTOMATION_CANCEL, { jobId }),

  getAutomationState: () => ipcRenderer.invoke(IpcChannels.AUTOMATION_GET_STATE),

  provideAutomationInput: (
    jobId: string,
    action: 'continue' | 'cancel' | 'provide',
    input?: unknown
  ) => ipcRenderer.invoke(IpcChannels.AUTOMATION_PROVIDE_INPUT, { jobId, action, input }),

  // Secrets API
  getSecret: (key: SecretKey) => ipcRenderer.invoke(IpcChannels.SECRETS_GET, { key }),

  setSecret: (key: SecretKey, value: string) =>
    ipcRenderer.invoke(IpcChannels.SECRETS_SET, { key, value }),

  deleteSecret: (key: SecretKey) => ipcRenderer.invoke(IpcChannels.SECRETS_DELETE, { key }),

  hasSecret: (key: SecretKey) => ipcRenderer.invoke(IpcChannels.SECRETS_HAS, { key }),

  // Window control
  toggleWindow: () => ipcRenderer.invoke('clipmorph:window:toggle'),
  getWindowState: () => ipcRenderer.invoke('clipmorph:window:getState'),
  setWindowMode: (mode: 'compact' | 'compact-wide' | 'expanded') =>
    ipcRenderer.invoke('clipmorph:window:setMode', { mode }),

  // OpenCode API
  runOpenCodeTask: (request: OpenCodeRunTaskRequest) =>
    ipcRenderer.invoke(IpcChannels.OPENCODE_RUN_TASK, request),

  cancelOpenCode: () => ipcRenderer.invoke(IpcChannels.OPENCODE_CANCEL),

  getOpenCodeState: () => ipcRenderer.invoke(IpcChannels.OPENCODE_GET_STATE),

  detectOpenCode: () => ipcRenderer.invoke(IpcChannels.OPENCODE_DETECT),

  writeOpenCodeInput: (input: string) =>
    ipcRenderer.invoke(IpcChannels.OPENCODE_WRITE_INPUT, { input }),

  respondToOpenCodePermission: (allow: boolean) =>
    ipcRenderer.invoke(IpcChannels.OPENCODE_RESPOND_PERMISSION, { allow }),

  // Subagent API
  listSubagents: () => ipcRenderer.invoke(IpcChannels.SUBAGENT_LIST),

  discoverSubagents: (forceReload?: boolean) =>
    ipcRenderer.invoke(IpcChannels.SUBAGENT_DISCOVER, { forceReload }),

  runSubagent: (request: SubagentRunRequest) =>
    ipcRenderer.invoke(IpcChannels.SUBAGENT_RUN, request),

  // Workflow API
  startWorkflow: (request: WorkflowStartRequest) =>
    ipcRenderer.invoke(IpcChannels.WORKFLOW_START, request),

  approveWorkflowCheckpoint: (jobId: string, feedback?: string) =>
    ipcRenderer.invoke(IpcChannels.WORKFLOW_APPROVE, { jobId, feedback } as WorkflowApproveRequest),

  rejectWorkflowCheckpoint: (jobId: string, action: 'retry' | 'abort', feedback?: string) =>
    ipcRenderer.invoke(IpcChannels.WORKFLOW_REJECT, { jobId, action, feedback } as WorkflowRejectRequest),

  cancelWorkflow: (jobId: string) =>
    ipcRenderer.invoke(IpcChannels.WORKFLOW_CANCEL, { jobId }),

  getWorkflowState: () => ipcRenderer.invoke(IpcChannels.WORKFLOW_GET_STATE),

  // File Operation API
  previewFileOperation: (request: FileOpPreviewRequest) =>
    ipcRenderer.invoke(IpcChannels.FILE_OP_PREVIEW, request),

  executeFileOperation: (previewId: string, approved: boolean) =>
    ipcRenderer.invoke(IpcChannels.FILE_OP_EXECUTE, { previewId, approved } as FileOpExecuteRequest),

  undoFileOperation: (jobId: string) =>
    ipcRenderer.invoke(IpcChannels.FILE_OP_UNDO, { jobId }),

  getFileOperationHistory: () => ipcRenderer.invoke(IpcChannels.FILE_OP_HISTORY),

  // Skill API
  listSkills: () => ipcRenderer.invoke(IpcChannels.SKILL_LIST),

  discoverSkills: (forceReload?: boolean) =>
    ipcRenderer.invoke(IpcChannels.SKILL_DISCOVER, { forceReload }),

  getSkill: (skillId: string) =>
    ipcRenderer.invoke(IpcChannels.SKILL_GET, { skillId }),

  exportSkill: (skillId: string, outputPath?: string) =>
    ipcRenderer.invoke(IpcChannels.SKILL_EXPORT, { skillId, outputPath }),

  importSkill: (source: string, global?: boolean) =>
    ipcRenderer.invoke(IpcChannels.SKILL_IMPORT, { source, global }),

  // Operations History API
  getOperationsHistory: (limit?: number) =>
    ipcRenderer.invoke(IpcChannels.HISTORY_GET, { limit }),

  clearOperationsHistory: () =>
    ipcRenderer.invoke(IpcChannels.HISTORY_CLEAR),

  copyImageToClipboard: (imagePath: string) =>
    ipcRenderer.invoke(IpcChannels.HISTORY_COPY_IMAGE, { imagePath }),

  getImageBase64: (imagePath: string) =>
    ipcRenderer.invoke(IpcChannels.HISTORY_GET_IMAGE, { imagePath }),
}

// Expose the API via contextBridge (secure, isolated)
contextBridge.exposeInMainWorld('clipmorph', api)

// Type augmentation for window.clipmorph
declare global {
  interface Window {
    clipmorph: ClipMorphAPI
  }
}
