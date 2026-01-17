/**
 * ClipMorph IPC Contracts
 * Single source of truth for all IPC types and channel definitions
 */

// ============================================================================
// IPC Channel Constants
// ============================================================================

/**
 * Channel naming convention: clipmorph:<domain>:<action>
 */
export const IpcChannels = {
  // Status domain
  STATUS_GET: 'clipmorph:status:get',

  // Events bus (single channel for all events)
  EVENTS: 'clipmorph:events',

  // Clipboard domain (future stories)
  CLIPBOARD_READ: 'clipmorph:clipboard:read',
  CLIPBOARD_WRITE: 'clipmorph:clipboard:write',
  CLIPBOARD_UNDO: 'clipmorph:clipboard:undo',

  // Job domain (future stories)
  JOB_CREATE: 'clipmorph:job:create',
  JOB_GET: 'clipmorph:job:get',
  JOB_CANCEL: 'clipmorph:job:cancel',
  JOB_LIST: 'clipmorph:job:list',

  // Voice domain
  VOICE_START: 'clipmorph:voice:start',
  VOICE_STOP: 'clipmorph:voice:stop',
  VOICE_GET_LAST_TRANSCRIPT: 'clipmorph:voice:lasttranscript',
  VOICE_GET_TRANSCRIPTS: 'clipmorph:voice:transcripts',
  VOICE_CLEAR_TRANSCRIPTS: 'clipmorph:voice:clear',
  VOICE_SET_HOTKEY: 'clipmorph:voice:sethotkey',
  VOICE_GET_STATE: 'clipmorph:voice:state',

  // Text input domain (alternative to voice)
  TEXT_SUBMIT: 'clipmorph:text:submit',

  // Settings domain
  SETTINGS_GET: 'clipmorph:settings:get',
  SETTINGS_SET: 'clipmorph:settings:set',
  SETTINGS_GET_ALL: 'clipmorph:settings:all',
  SETTINGS_RESET: 'clipmorph:settings:reset',

  // Transform domain
  TRANSFORM_EXECUTE: 'clipmorph:transform:execute',
  TRANSFORM_LIST: 'clipmorph:transform:list',

  // Intent domain
  INTENT_CLASSIFY: 'clipmorph:intent:classify',
  INTENT_ROUTE: 'clipmorph:intent:route',

  // Action summary domain
  ACTION_GET_LAST: 'clipmorph:action:last',

  // Permission domain
  PERMISSION_GET_ALL: 'clipmorph:permission:getall',
  PERMISSION_CHECK: 'clipmorph:permission:check',
  PERMISSION_REQUEST: 'clipmorph:permission:request',

  // Automation domain
  AUTOMATION_START: 'clipmorph:automation:start',
  AUTOMATION_CANCEL: 'clipmorph:automation:cancel',
  AUTOMATION_GET_STATE: 'clipmorph:automation:state',
  AUTOMATION_PROVIDE_INPUT: 'clipmorph:automation:input',

  // Secrets domain (API keys via Keychain)
  SECRETS_GET: 'clipmorph:secrets:get',
  SECRETS_SET: 'clipmorph:secrets:set',
  SECRETS_DELETE: 'clipmorph:secrets:delete',
  SECRETS_HAS: 'clipmorph:secrets:has',

  // OpenCode domain (agentic code tasks)
  OPENCODE_RUN_TASK: 'clipmorph:opencode:runtask',
  OPENCODE_CANCEL: 'clipmorph:opencode:cancel',
  OPENCODE_GET_STATE: 'clipmorph:opencode:state',
  OPENCODE_DETECT: 'clipmorph:opencode:detect',
  OPENCODE_WRITE_INPUT: 'clipmorph:opencode:input',
  OPENCODE_RESPOND_PERMISSION: 'clipmorph:opencode:permission',

  // Subagent domain
  SUBAGENT_LIST: 'clipmorph:subagent:list',
  SUBAGENT_DISCOVER: 'clipmorph:subagent:discover',
  SUBAGENT_RUN: 'clipmorph:subagent:run',

  // Workflow domain (multi-stage agentic workflows)
  WORKFLOW_START: 'clipmorph:workflow:start',
  WORKFLOW_APPROVE: 'clipmorph:workflow:approve',
  WORKFLOW_REJECT: 'clipmorph:workflow:reject',
  WORKFLOW_CANCEL: 'clipmorph:workflow:cancel',
  WORKFLOW_GET_STATE: 'clipmorph:workflow:state',

  // File operations domain
  FILE_OP_PREVIEW: 'clipmorph:fileop:preview',
  FILE_OP_EXECUTE: 'clipmorph:fileop:execute',
  FILE_OP_UNDO: 'clipmorph:fileop:undo',
  FILE_OP_HISTORY: 'clipmorph:fileop:history',

  // Skills domain
  SKILL_LIST: 'clipmorph:skill:list',
  SKILL_DISCOVER: 'clipmorph:skill:discover',
  SKILL_GET: 'clipmorph:skill:get',
  SKILL_EXPORT: 'clipmorph:skill:export',
  SKILL_IMPORT: 'clipmorph:skill:import',

  // Operations history domain
  HISTORY_GET: 'clipmorph:history:get',
  HISTORY_CLEAR: 'clipmorph:history:clear',
  HISTORY_COPY_IMAGE: 'clipmorph:history:copy-image',
  HISTORY_GET_IMAGE: 'clipmorph:history:get-image',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

// ============================================================================
// IPC Envelope Types (Mandatory Structure)
// ============================================================================

/**
 * Error structure for IPC responses
 */
export interface IpcError {
  code: string
  message: string
  details?: unknown
}

/**
 * Success response envelope
 */
export interface IpcSuccessResponse<T> {
  ok: true
  requestId: string
  data: T
}

/**
 * Error response envelope
 */
export interface IpcErrorResponse {
  ok: false
  requestId: string
  error: IpcError
}

/**
 * Union type for all IPC responses
 */
export type IpcResponse<T> = IpcSuccessResponse<T> | IpcErrorResponse

/**
 * Type guard to check if response is successful
 */
export function isIpcSuccess<T>(response: IpcResponse<T>): response is IpcSuccessResponse<T> {
  return response.ok === true
}

/**
 * Type guard to check if response is an error
 */
export function isIpcError<T>(response: IpcResponse<T>): response is IpcErrorResponse {
  return response.ok === false
}

// ============================================================================
// Error Codes (Explicit, not stringly typed)
// ============================================================================

export const ErrorCodes = {
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  HANDLER_NOT_FOUND: 'HANDLER_NOT_FOUND',

  // Clipboard errors
  CLIPBOARD_READ_FAILED: 'CLIPBOARD_READ_FAILED',
  CLIPBOARD_WRITE_FAILED: 'CLIPBOARD_WRITE_FAILED',
  CLIPBOARD_SNAPSHOT_MISMATCH: 'CLIPBOARD_SNAPSHOT_MISMATCH',
  CLIPBOARD_UNDO_EMPTY: 'CLIPBOARD_UNDO_EMPTY',

  // Job errors
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_COMPLETED: 'JOB_ALREADY_COMPLETED',
  JOB_CANCEL_FAILED: 'JOB_CANCEL_FAILED',

  // Voice errors
  VOICE_NOT_AVAILABLE: 'VOICE_NOT_AVAILABLE',
  VOICE_ALREADY_LISTENING: 'VOICE_ALREADY_LISTENING',
  VOICE_TRANSCRIPTION_FAILED: 'VOICE_TRANSCRIPTION_FAILED',

  // Transform errors
  TRANSFORM_NOT_FOUND: 'TRANSFORM_NOT_FOUND',
  TRANSFORM_INVALID_INPUT: 'TRANSFORM_INVALID_INPUT',
  TRANSFORM_EXECUTION_FAILED: 'TRANSFORM_EXECUTION_FAILED',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PERMISSION_NOT_GRANTED: 'PERMISSION_NOT_GRANTED',

  // Automation errors
  AUTOMATION_NEEDS_INPUT: 'AUTOMATION_NEEDS_INPUT',
  AUTOMATION_BROWSER_ERROR: 'AUTOMATION_BROWSER_ERROR',

  // OpenCode errors
  OPENCODE_NOT_INSTALLED: 'OPENCODE_NOT_INSTALLED',
  OPENCODE_TASK_FAILED: 'OPENCODE_TASK_FAILED',
  OPENCODE_TASK_TIMEOUT: 'OPENCODE_TASK_TIMEOUT',
  OPENCODE_BUSY: 'OPENCODE_BUSY',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ============================================================================
// App Status Types
// ============================================================================

export type AppStatus = 'idle' | 'listening' | 'processing' | 'error'

export interface StatusGetResponse {
  status: AppStatus
}

// ============================================================================
// Permission Types
// ============================================================================

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

export interface PermissionGetAllResponse {
  permissions: PermissionState
  voiceEnabled: boolean
  hotkeysEnabled: boolean
}

export interface PermissionCheckRequest {
  type: PermissionType
}

export interface PermissionRequestRequest {
  type: PermissionType
}

export interface PermissionRequestResponse {
  type: PermissionType
  granted: boolean
  status: PermissionStatus
}

// ============================================================================
// Job Model Types (Mandatory Semantics)
// ============================================================================

/**
 * Job status enum - monotonic transitions only
 * pending → running → (needs_input | completed | failed | cancelled)
 */
export type JobStatus = 'pending' | 'running' | 'needs_input' | 'completed' | 'failed' | 'cancelled'

export interface Job {
  id: string
  type: string
  status: JobStatus
  createdAt: number
  updatedAt: number
  input?: unknown
  output?: unknown
  error?: IpcError
}

// ============================================================================
// Events Bus Types
// ============================================================================

/**
 * Base event structure for the events bus
 */
export interface ClipMorphEvent<T = unknown> {
  type: string
  jobId?: string
  payload?: T
  timestamp: number
}

/**
 * Event types
 */
export const EventTypes = {
  STATUS_CHANGED: 'status-changed',
  JOB_CREATED: 'job-created',
  JOB_UPDATED: 'job-updated',
  JOB_COMPLETED: 'job-completed',
  JOB_FAILED: 'job-failed',
  JOB_CANCELLED: 'job-cancelled',
  JOB_NEEDS_INPUT: 'job-needs-input',
  CLIPBOARD_CHANGED: 'clipboard-changed',
  VOICE_STARTED: 'voice-started',
  VOICE_STOPPED: 'voice-stopped',
  VOICE_TRANSCRIPT: 'voice-transcript',
  TRANSFORM_STARTED: 'transform-started',
  TRANSFORM_COMPLETED: 'transform-completed',
  TRANSFORM_FAILED: 'transform-failed',
  PERMISSION_CHANGED: 'permission-changed',
  SETTINGS_CHANGED: 'settings-changed',
  AUTOMATION_STARTED: 'automation-started',
  AUTOMATION_STEP: 'automation-step',
  AUTOMATION_COMPLETED: 'automation-completed',
  AUTOMATION_FAILED: 'automation-failed',
  AUTOMATION_NEEDS_INPUT: 'automation-needs-input',
  AUTOMATION_CANCELLED: 'automation-cancelled',
  OPENCODE_STARTED: 'opencode-started',
  OPENCODE_OUTPUT: 'opencode-output',
  OPENCODE_PERMISSION_REQUEST: 'opencode-permission-request',
  OPENCODE_COMPLETED: 'opencode-completed',
  OPENCODE_FAILED: 'opencode-failed',
  OPENCODE_CANCELLED: 'opencode-cancelled',
  // Workflow events
  WORKFLOW_STARTED: 'workflow-started',
  WORKFLOW_STAGE_STARTED: 'workflow-stage-started',
  WORKFLOW_CHECKPOINT: 'workflow-checkpoint',
  WORKFLOW_STAGE_COMPLETED: 'workflow-stage-completed',
  WORKFLOW_STAGE_FAILED: 'workflow-stage-failed',
  WORKFLOW_COMPLETED: 'workflow-completed',
  WORKFLOW_CANCELLED: 'workflow-cancelled',
  // File operation events
  FILE_OP_PREVIEW_READY: 'fileop-preview-ready',
  FILE_OP_STARTED: 'fileop-started',
  FILE_OP_COMPLETED: 'fileop-completed',
  FILE_OP_FAILED: 'fileop-failed',
  FILE_OP_UNDONE: 'fileop-undone',
  // Skill events
  SKILL_DISCOVERED: 'skill-discovered',
  SKILL_APPLIED: 'skill-applied',
  SKILL_IMPORTED: 'skill-imported',
  SKILL_EXPORTED: 'skill-exported',
  // Window events
  APP_BLUR: 'app-blur',
  APP_FOCUS: 'app-focus',
} as const

export type EventType = (typeof EventTypes)[keyof typeof EventTypes]

// Typed event payloads
export interface StatusChangedPayload {
  status: AppStatus
  previousStatus?: AppStatus
}

export interface JobEventPayload {
  job: Job
}

export interface VoiceTranscriptPayload {
  text: string
  isFinal: boolean
  isPartial?: boolean
  isExecuting?: boolean
  isDone?: boolean
}

export interface VoiceStateResponse {
  success: boolean
  state: {
    isCapturing: boolean
    isHotkeyRegistered: boolean
    hotkey: string
    canEnable: boolean
  }
}

export interface TranscriptRecord {
  id: string
  text: string
  timestamp: number
  durationMs?: number
}

export interface TranscriptResponse {
  transcript: TranscriptRecord | null
}

export interface TranscriptsResponse {
  transcripts: TranscriptRecord[]
}

export interface VoiceSetHotkeyRequest {
  hotkey: string
}

export interface VoiceSetHotkeyResponse {
  success: boolean
  hotkey: string
  error?: string
}

export interface VoiceGetStateResponse {
  isCapturing: boolean
  isHotkeyRegistered: boolean
  hotkey: string
  canEnable: boolean
}

// Text input types (alternative to voice)
export interface TextSubmitRequest {
  text: string
}

export interface TextSubmitResponse {
  success: boolean
  intent?: string
  jobId?: string
  error?: string
}

// Intent types
export type Intent =
  | 'url:clean'
  | 'url:markdown'
  | 'json:pretty'
  | 'json:minify'
  | 'json:to-yaml'
  | 'yaml:to-json'
  | 'extract:emails'
  | 'extract:links'
  | 'redact:secrets'
  | 'cancel'
  | 'undo'
  | 'automation:portal'
  | 'code:generate'
  | 'code:refactor'
  | 'code:fix'
  | 'code:explain'
  | 'code:improve'
  | 'unsupported'

export interface IntentClassificationResponse {
  intent: Intent
  confidence: number
  rawTranscript: string
  normalizedTranscript: string
  matchedPatterns?: string[]
}

export interface IntentRoutingResponse {
  intent: Intent
  handled: boolean
  jobId?: string
  error?: string
}

// Action summary types
export interface LastActionSummary {
  timestamp: number
  transcript: string
  capability: string
  success: boolean
  error?: string
  jobId?: string
}

export interface LastActionResponse {
  action: LastActionSummary | null
}

export interface PermissionChangedPayload {
  type: PermissionType
  previousStatus: PermissionStatus
  status: PermissionStatus
}

// Clipboard types
export type ClipboardContentType = 'text' | 'html' | 'rtf'

export interface ClipboardSnapshot {
  id: string
  text: string
  html?: string
  rtf?: string
  contentType: ClipboardContentType
  timestamp: number
  hash: string
}

export interface ClipboardChangedPayload {
  snapshot: ClipboardSnapshot
  previousSnapshot?: ClipboardSnapshot
}

export interface ClipboardReadResponse {
  text: string
  snapshot: ClipboardSnapshot
  /** File paths if files were copied (e.g., from Finder) */
  filePaths?: string[]
  /** Available clipboard formats */
  formats?: string[]
}

export interface ClipboardWriteRequest {
  text: string
  expectedSnapshotId?: string // For gated writes
}

export interface ClipboardWriteResponse {
  success: boolean
  snapshot: ClipboardSnapshot
}

export interface ClipboardUndoResponse {
  success: boolean
  snapshot?: ClipboardSnapshot
  undoCount: number
}

// Settings types
export interface SettingsGetRequest {
  key: string
}

export interface SettingsGetResponse {
  key: string
  value: string | null
}

export interface SettingsSetRequest {
  key: string
  value: string
}

export interface SettingsSetResponse {
  key: string
  value: string
}

export interface SettingsGetAllResponse {
  settings: Record<string, string>
}

export interface SettingsResetRequest {
  key?: string // If not provided, resets all settings
}

export interface SettingsResetResponse {
  success: boolean
}

// ============================================================================
// Automation Types
// ============================================================================

/**
 * Automation job type - for browser automation tasks
 */
export type AutomationJobType = 'portal' | 'form-fill'

/**
 * Reason why automation needs user input
 */
export type NeedsInputReason = 'login' | 'captcha' | 'ambiguity' | 'confirmation' | 'other'

/**
 * Automation job state (extends base Job with automation-specific fields)
 */
export interface AutomationJob extends Job {
  type: AutomationJobType
  targetUrl?: string
  currentStep?: string
  stepCount?: number
  needsInputReason?: NeedsInputReason
  needsInputMessage?: string
}

/**
 * Request to start an automation job
 */
export interface AutomationStartRequest {
  type: AutomationJobType
  targetUrl?: string
  context?: Record<string, unknown>
}

/**
 * Response from starting an automation job
 */
export interface AutomationStartResponse {
  job: AutomationJob
}

/**
 * Request to provide input for a needs_input job
 */
export interface AutomationProvideInputRequest {
  jobId: string
  action: 'continue' | 'cancel' | 'provide'
  input?: unknown
}

/**
 * Current automation state
 */
export interface AutomationState {
  activeJob: AutomationJob | null
  recentJobs: AutomationJob[]
}

/**
 * Event payload for automation status changes
 */
export interface AutomationStatusPayload {
  job: AutomationJob
  previousStatus?: JobStatus
}

export interface SettingsChangedPayload {
  key: string
  previousValue: string | null
  value: string
}

// ============================================================================
// Secrets Types (API Keys via Keychain)
// ============================================================================

export type SecretKey = 'openai-api-key' | 'anthropic-api-key' | 'cerebras-api-key' | 'google-api-key' | 'xai-api-key' | 'zai-api-key' | 'groq-api-key' | 'elevenlabs-api-key'

export interface SecretsGetRequest {
  key: SecretKey
}

export interface SecretsGetResponse {
  key: SecretKey
  hasValue: boolean
  // Note: We don't return the actual value for security, only masked version
  maskedValue?: string
}

export interface SecretsSetRequest {
  key: SecretKey
  value: string
}

export interface SecretsSetResponse {
  key: SecretKey
  success: boolean
}

export interface SecretsDeleteRequest {
  key: SecretKey
}

export interface SecretsDeleteResponse {
  key: SecretKey
  success: boolean
}

export interface SecretsHasRequest {
  key: SecretKey
}

export interface SecretsHasResponse {
  key: SecretKey
  hasValue: boolean
}

// ============================================================================
// OpenCode Types (Agentic Code Tasks)
// ============================================================================

/**
 * OpenCode sidecar state
 */
export type OpenCodeState = 'stopped' | 'ready' | 'busy' | 'error'

/**
 * Request to run an OpenCode task
 */
export interface OpenCodeRunTaskRequest {
  /** The prompt/task to execute */
  prompt: string
  /** Optional context (e.g., clipboard content) */
  context?: string
  /** Optional working directory */
  cwd?: string
}

/**
 * Response from running an OpenCode task
 */
export interface OpenCodeRunTaskResponse {
  /** Job ID for tracking */
  jobId: string
  /** Whether the task was started successfully */
  started: boolean
}

/**
 * OpenCode task result
 */
export interface OpenCodeTaskResult {
  /** Whether the task completed successfully */
  success: boolean
  /** The output from OpenCode */
  output: string
  /** Exit code from the process */
  exitCode: number | null
  /** Duration in milliseconds */
  durationMs: number
  /** Error message if failed */
  error?: string
}

/**
 * OpenCode state response
 */
export interface OpenCodeStateResponse {
  /** Current state */
  state: OpenCodeState
  /** Whether OpenCode CLI is installed */
  installed: boolean
  /** Path to binary if found */
  binaryPath?: string
  /** Version if available */
  version?: string
  /** Active job ID if busy */
  activeJobId?: string
  /** Installation instructions if not installed */
  installInstructions?: string
}

/**
 * OpenCode detection response
 */
export interface OpenCodeDetectResponse {
  /** Whether OpenCode CLI is installed */
  installed: boolean
  /** Path to binary if found */
  binaryPath?: string
  /** Version if available */
  version?: string
  /** Error message if detection failed */
  error?: string
  /** Installation instructions */
  installInstructions: string
}

/**
 * OpenCode output chunk (for streaming)
 */
export interface OpenCodeOutputChunk {
  /** Type of output */
  type: 'stdout' | 'stderr'
  /** The data */
  data: string
  /** Timestamp */
  timestamp: number
  /** Job ID */
  jobId: string
}

/**
 * OpenCode event payloads
 */
export interface OpenCodeStartedPayload {
  jobId: string
  prompt: string
}

export interface OpenCodeOutputPayload {
  jobId: string
  chunk: OpenCodeOutputChunk
}

export interface OpenCodePermissionRequestPayload {
  jobId: string
  type: 'file_write' | 'file_delete' | 'shell_command' | 'other'
  action: string
  context: string
}

export interface OpenCodeCompletedPayload {
  jobId: string
  result: OpenCodeTaskResult
}

export interface OpenCodeFailedPayload {
  jobId: string
  error: string
}

export interface OpenCodeCancelledPayload {
  jobId: string
}

// ============================================================================
// Subagent Types (Custom OpenCode Subagents)
// ============================================================================

/**
 * Subagent configuration from .clipmorph/subagents/*.md files
 */
export interface SubagentConfig {
  /** Unique identifier (filename without extension) */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** Voice trigger phrases */
  triggers: string[]
  /** System prompt / instructions */
  systemPrompt: string
  /** Optional model override */
  model?: string
  /** Optional temperature */
  temperature?: number
  /** File path to the config */
  filePath: string
  /** Last modified timestamp */
  lastModified: number
}

/**
 * Response from listing subagents
 */
export interface SubagentListResponse {
  subagents: SubagentConfig[]
  /** Directory where subagents are stored */
  configDir: string
  /** Whether the config directory exists */
  configDirExists: boolean
}

/**
 * Request to discover/reload subagents
 */
export interface SubagentDiscoverRequest {
  /** Force reload even if cached */
  forceReload?: boolean
}

/**
 * Response from discovering subagents
 */
export interface SubagentDiscoverResponse {
  subagents: SubagentConfig[]
  /** Number of new subagents found */
  newCount: number
  /** Number of updated subagents */
  updatedCount: number
  /** Errors encountered during discovery */
  errors: Array<{ file: string; error: string }>
}

/**
 * Request to run a subagent
 */
export interface SubagentRunRequest {
  /** Subagent ID */
  subagentId: string
  /** User prompt/input */
  prompt: string
  /** Optional context (e.g., clipboard content) */
  context?: string
  /** Optional working directory */
  cwd?: string
}

/**
 * Response from running a subagent
 */
export interface SubagentRunResponse {
  /** Job ID for tracking */
  jobId: string
  /** Whether the task was started successfully */
  started: boolean
  /** The subagent that was invoked */
  subagent: SubagentConfig
}

// ============================================================================
// Workflow Types (Multi-Stage Agentic Workflows)
// ============================================================================

/**
 * Workflow stage types
 */
export type WorkflowStage = 'plan' | 'code' | 'review'

/**
 * Workflow status
 */
export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'checkpoint' // Waiting for user approval
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Stage result from a completed stage
 */
export interface WorkflowStageResult {
  stage: WorkflowStage
  status: 'completed' | 'failed' | 'skipped'
  output: string
  startedAt: number
  completedAt: number
  error?: string
}

/**
 * Workflow job (extends base Job)
 */
export interface WorkflowJob extends Job {
  type: 'workflow'
  /** The stages to execute in order */
  stages: WorkflowStage[]
  /** Current stage being executed (or waiting for approval) */
  currentStage: WorkflowStage | null
  /** Index of current stage in stages array */
  currentStageIndex: number
  /** Results from completed stages */
  stageResults: WorkflowStageResult[]
  /** The original prompt/task */
  prompt: string
  /** Optional context (e.g., clipboard content) */
  context?: string
  /** Whether currently at a checkpoint */
  atCheckpoint: boolean
  /** Checkpoint message if at checkpoint */
  checkpointMessage?: string
}

/**
 * Request to start a workflow
 */
export interface WorkflowStartRequest {
  /** The prompt/task for the workflow */
  prompt: string
  /** Stages to execute (defaults to ['plan', 'code', 'review']) */
  stages?: WorkflowStage[]
  /** Optional context */
  context?: string
  /** Optional working directory */
  cwd?: string
}

/**
 * Response from starting a workflow
 */
export interface WorkflowStartResponse {
  /** The created workflow job */
  job: WorkflowJob
}

/**
 * Request to approve a workflow checkpoint
 */
export interface WorkflowApproveRequest {
  /** Workflow job ID */
  jobId: string
  /** Optional feedback/modifications for next stage */
  feedback?: string
}

/**
 * Request to reject a workflow checkpoint
 */
export interface WorkflowRejectRequest {
  /** Workflow job ID */
  jobId: string
  /** Action to take: retry current stage or abort workflow */
  action: 'retry' | 'abort'
  /** Feedback for retry (what to fix) */
  feedback?: string
}

/**
 * Response from workflow control operations
 */
export interface WorkflowControlResponse {
  /** Updated workflow job */
  job: WorkflowJob
}

/**
 * Current workflow state
 */
export interface WorkflowState {
  /** Active workflow job (if any) */
  activeJob: WorkflowJob | null
  /** Recent completed/cancelled workflows */
  recentJobs: WorkflowJob[]
}

/**
 * Workflow event payloads
 */
export interface WorkflowStartedPayload {
  job: WorkflowJob
}

export interface WorkflowStageStartedPayload {
  jobId: string
  stage: WorkflowStage
  stageIndex: number
}

export interface WorkflowCheckpointPayload {
  jobId: string
  stage: WorkflowStage
  stageOutput: string
  message: string
  nextStage: WorkflowStage | null
}

export interface WorkflowStageCompletedPayload {
  jobId: string
  stage: WorkflowStage
  result: WorkflowStageResult
}

export interface WorkflowStageFailedPayload {
  jobId: string
  stage: WorkflowStage
  error: string
}

export interface WorkflowCompletedPayload {
  job: WorkflowJob
}

export interface WorkflowCancelledPayload {
  jobId: string
  cancelledAtStage: WorkflowStage | null
}

// ============================================================================
// File Operation Types
// ============================================================================

/**
 * Types of file operations
 */
export type FileOperationType = 'rename' | 'move' | 'delete' | 'copy' | 'organize'

/**
 * A single file operation in a preview/execution
 */
export interface FileOperationItem {
  /** Operation type */
  type: FileOperationType
  /** Source path */
  source: string
  /** Destination path (for rename/move/copy) */
  destination?: string
  /** Whether this is a destructive operation */
  destructive: boolean
}

/**
 * Preview of planned file operations
 */
export interface FileOperationPreview {
  /** Unique preview ID */
  id: string
  /** The operations to be performed */
  operations: FileOperationItem[]
  /** Total file count */
  fileCount: number
  /** Total folder count */
  folderCount: number
  /** Whether any operations are destructive */
  hasDestructive: boolean
  /** Human-readable summary */
  summary: string
  /** The original prompt */
  prompt: string
  /** Timestamp */
  createdAt: number
  /** Expiry time (preview is only valid for a limited time) */
  expiresAt: number
}

/**
 * File operation job
 */
export interface FileOperationJob extends Job {
  type: 'file-operation'
  /** The operation type */
  operationType: FileOperationType
  /** Preview ID (if executing from preview) */
  previewId?: string
  /** Operations executed */
  operations: FileOperationItem[]
  /** Operations that succeeded */
  successCount: number
  /** Operations that failed */
  failureCount: number
  /** Original prompt */
  prompt: string
  /** Whether approval was required */
  requiredApproval: boolean
}

/**
 * File operation history entry (for undo)
 */
export interface FileOperationHistoryEntry {
  /** Job ID */
  jobId: string
  /** Operations performed */
  operations: FileOperationItem[]
  /** Timestamp */
  executedAt: number
  /** Whether this can be undone */
  canUndo: boolean
  /** Undo expiry time */
  undoExpiresAt: number
}

/**
 * Request to preview file operations
 */
export interface FileOpPreviewRequest {
  /** The natural language prompt */
  prompt: string
  /** Optional target directory */
  targetDir?: string
}

/**
 * Response from preview request
 */
export interface FileOpPreviewResponse {
  /** The preview */
  preview: FileOperationPreview
}

/**
 * Request to execute file operations
 */
export interface FileOpExecuteRequest {
  /** Preview ID to execute */
  previewId: string
  /** Explicit approval (required for destructive ops) */
  approved: boolean
}

/**
 * Response from execute request
 */
export interface FileOpExecuteResponse {
  /** The job */
  job: FileOperationJob
}

/**
 * Request to undo file operations
 */
export interface FileOpUndoRequest {
  /** Job ID to undo */
  jobId: string
}

/**
 * Response from undo request
 */
export interface FileOpUndoResponse {
  /** Whether undo succeeded */
  success: boolean
  /** Operations that were undone */
  undoneCount: number
  /** Error if failed */
  error?: string
}

/**
 * Response from history request
 */
export interface FileOpHistoryResponse {
  /** Recent operations */
  history: FileOperationHistoryEntry[]
}

/**
 * File operation event payloads
 */
export interface FileOpPreviewReadyPayload {
  preview: FileOperationPreview
}

export interface FileOpStartedPayload {
  job: FileOperationJob
}

export interface FileOpCompletedPayload {
  job: FileOperationJob
}

export interface FileOpFailedPayload {
  jobId: string
  error: string
}

export interface FileOpUndonePayload {
  jobId: string
  undoneCount: number
}

// ============================================================================
// Skill Types (Reusable Instruction Templates)
// ============================================================================

/**
 * Skill configuration from SKILL.md files
 */
export interface SkillConfig {
  /** Unique identifier (directory name) */
  id: string
  /** Display name */
  name: string
  /** Description of what the skill does */
  description: string
  /** Version (semver format) */
  version: string
  /** Trigger keywords for auto-matching */
  triggers: string[]
  /** Other skills this depends on */
  requires: string[]
  /** The instruction content */
  instructions: string
  /** File path to SKILL.md */
  filePath: string
  /** Whether this is a global or project skill */
  scope: 'global' | 'project'
  /** Last modified timestamp */
  lastModified: number
}

/**
 * Response from listing skills
 */
export interface SkillListResponse {
  /** All discovered skills */
  skills: SkillConfig[]
  /** Project skills directory */
  projectDir: string
  /** Global skills directory */
  globalDir: string
  /** Whether project dir exists */
  projectDirExists: boolean
}

/**
 * Request to discover/reload skills
 */
export interface SkillDiscoverRequest {
  /** Force reload even if cached */
  forceReload?: boolean
}

/**
 * Response from discovering skills
 */
export interface SkillDiscoverResponse {
  /** All discovered skills */
  skills: SkillConfig[]
  /** Number of new skills found */
  newCount: number
  /** Number of updated skills */
  updatedCount: number
  /** Errors encountered */
  errors: Array<{ path: string; error: string }>
}

/**
 * Request to get a specific skill
 */
export interface SkillGetRequest {
  /** Skill ID */
  skillId: string
}

/**
 * Response from getting a skill
 */
export interface SkillGetResponse {
  /** The skill (or null if not found) */
  skill: SkillConfig | null
}

/**
 * Request to export a skill
 */
export interface SkillExportRequest {
  /** Skill ID to export */
  skillId: string
  /** Output path (optional, defaults to Downloads) */
  outputPath?: string
}

/**
 * Response from exporting a skill
 */
export interface SkillExportResponse {
  /** Whether export succeeded */
  success: boolean
  /** Path to exported file */
  exportPath?: string
  /** Error if failed */
  error?: string
}

/**
 * Request to import a skill
 */
export interface SkillImportRequest {
  /** Path to .skill file or URL */
  source: string
  /** Whether to import to global (default: project) */
  global?: boolean
}

/**
 * Response from importing a skill
 */
export interface SkillImportResponse {
  /** Whether import succeeded */
  success: boolean
  /** The imported skill */
  skill?: SkillConfig
  /** Error if failed */
  error?: string
}

/**
 * Skill event payloads
 */
export interface SkillDiscoveredPayload {
  skills: SkillConfig[]
  newCount: number
}

export interface SkillAppliedPayload {
  skillId: string
  skillName: string
  taskPrompt: string
}

export interface SkillImportedPayload {
  skill: SkillConfig
  source: string
}

export interface SkillExportedPayload {
  skillId: string
  exportPath: string
}

// ============================================================================
// Operations History Types
// ============================================================================

/**
 * A single operation history entry
 */
export interface OperationHistoryEntry {
  id: string
  command: string
  job_type: string
  input_text: string
  input_html: string | null
  output_text: string | null
  output_image_size: number | null
  output_image_path: string | null
  success: boolean
  error: string | null
  duration_ms: number | null
  created_at: number
}

/**
 * Response from getting operations history
 */
export interface OperationHistoryResponse {
  operations: OperationHistoryEntry[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T, requestId?: string): IpcSuccessResponse<T> {
  return {
    ok: true,
    requestId: requestId ?? generateRequestId(),
    data,
  }
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  requestId?: string
): IpcErrorResponse {
  return {
    ok: false,
    requestId: requestId ?? generateRequestId(),
    error: { code, message, details },
  }
}

/**
 * Create an event
 */
export function createEvent<T>(type: EventType, payload?: T, jobId?: string): ClipMorphEvent<T> {
  return {
    type,
    jobId,
    payload,
    timestamp: Date.now(),
  }
}
