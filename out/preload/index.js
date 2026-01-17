"use strict";
const electron = require("electron");
const IpcChannels = {
  // Status domain
  STATUS_GET: "clipmorph:status:get",
  // Events bus (single channel for all events)
  EVENTS: "clipmorph:events",
  // Clipboard domain (future stories)
  CLIPBOARD_READ: "clipmorph:clipboard:read",
  CLIPBOARD_WRITE: "clipmorph:clipboard:write",
  CLIPBOARD_UNDO: "clipmorph:clipboard:undo",
  // Job domain (future stories)
  JOB_CREATE: "clipmorph:job:create",
  JOB_GET: "clipmorph:job:get",
  JOB_CANCEL: "clipmorph:job:cancel",
  JOB_LIST: "clipmorph:job:list",
  // Voice domain
  VOICE_START: "clipmorph:voice:start",
  VOICE_STOP: "clipmorph:voice:stop",
  VOICE_GET_LAST_TRANSCRIPT: "clipmorph:voice:lasttranscript",
  VOICE_GET_TRANSCRIPTS: "clipmorph:voice:transcripts",
  VOICE_CLEAR_TRANSCRIPTS: "clipmorph:voice:clear",
  VOICE_SET_HOTKEY: "clipmorph:voice:sethotkey",
  VOICE_GET_STATE: "clipmorph:voice:state",
  // Text input domain (alternative to voice)
  TEXT_SUBMIT: "clipmorph:text:submit",
  // Settings domain
  SETTINGS_GET: "clipmorph:settings:get",
  SETTINGS_SET: "clipmorph:settings:set",
  SETTINGS_GET_ALL: "clipmorph:settings:all",
  SETTINGS_RESET: "clipmorph:settings:reset",
  // Intent domain
  INTENT_CLASSIFY: "clipmorph:intent:classify",
  INTENT_ROUTE: "clipmorph:intent:route",
  // Action summary domain
  ACTION_GET_LAST: "clipmorph:action:last",
  // Permission domain
  PERMISSION_GET_ALL: "clipmorph:permission:getall",
  PERMISSION_CHECK: "clipmorph:permission:check",
  PERMISSION_REQUEST: "clipmorph:permission:request",
  // Automation domain
  AUTOMATION_START: "clipmorph:automation:start",
  AUTOMATION_CANCEL: "clipmorph:automation:cancel",
  AUTOMATION_GET_STATE: "clipmorph:automation:state",
  AUTOMATION_PROVIDE_INPUT: "clipmorph:automation:input",
  // Secrets domain (API keys via Keychain)
  SECRETS_GET: "clipmorph:secrets:get",
  SECRETS_SET: "clipmorph:secrets:set",
  SECRETS_DELETE: "clipmorph:secrets:delete",
  SECRETS_HAS: "clipmorph:secrets:has",
  // OpenCode domain (agentic code tasks)
  OPENCODE_RUN_TASK: "clipmorph:opencode:runtask",
  OPENCODE_CANCEL: "clipmorph:opencode:cancel",
  OPENCODE_GET_STATE: "clipmorph:opencode:state",
  OPENCODE_DETECT: "clipmorph:opencode:detect",
  OPENCODE_WRITE_INPUT: "clipmorph:opencode:input",
  OPENCODE_RESPOND_PERMISSION: "clipmorph:opencode:permission",
  // Subagent domain
  SUBAGENT_LIST: "clipmorph:subagent:list",
  SUBAGENT_DISCOVER: "clipmorph:subagent:discover",
  SUBAGENT_RUN: "clipmorph:subagent:run",
  // Workflow domain (multi-stage agentic workflows)
  WORKFLOW_START: "clipmorph:workflow:start",
  WORKFLOW_APPROVE: "clipmorph:workflow:approve",
  WORKFLOW_REJECT: "clipmorph:workflow:reject",
  WORKFLOW_CANCEL: "clipmorph:workflow:cancel",
  WORKFLOW_GET_STATE: "clipmorph:workflow:state",
  // File operations domain
  FILE_OP_PREVIEW: "clipmorph:fileop:preview",
  FILE_OP_EXECUTE: "clipmorph:fileop:execute",
  FILE_OP_UNDO: "clipmorph:fileop:undo",
  FILE_OP_HISTORY: "clipmorph:fileop:history",
  // Skills domain
  SKILL_LIST: "clipmorph:skill:list",
  SKILL_DISCOVER: "clipmorph:skill:discover",
  SKILL_GET: "clipmorph:skill:get",
  SKILL_EXPORT: "clipmorph:skill:export",
  SKILL_IMPORT: "clipmorph:skill:import"
};
const api = {
  getAppStatus: () => electron.ipcRenderer.invoke(IpcChannels.STATUS_GET),
  onEvent: (callback) => {
    const handler = (_event, data) => {
      callback(data);
    };
    electron.ipcRenderer.on(IpcChannels.EVENTS, handler);
    return () => {
      electron.ipcRenderer.removeListener(IpcChannels.EVENTS, handler);
    };
  },
  getPermissions: () => electron.ipcRenderer.invoke(IpcChannels.PERMISSION_GET_ALL),
  checkPermission: (type) => electron.ipcRenderer.invoke(IpcChannels.PERMISSION_CHECK, { type }),
  requestPermission: (type) => electron.ipcRenderer.invoke(IpcChannels.PERMISSION_REQUEST, { type }),
  createJob: (type, input) => electron.ipcRenderer.invoke(IpcChannels.JOB_CREATE, { type, input }),
  getJob: (id) => electron.ipcRenderer.invoke(IpcChannels.JOB_GET, { id }),
  cancelJob: (id) => electron.ipcRenderer.invoke(IpcChannels.JOB_CANCEL, { id }),
  listJobs: (status) => electron.ipcRenderer.invoke(IpcChannels.JOB_LIST, { status }),
  readClipboard: () => electron.ipcRenderer.invoke(IpcChannels.CLIPBOARD_READ),
  writeClipboard: (text, expectedSnapshotId) => electron.ipcRenderer.invoke(IpcChannels.CLIPBOARD_WRITE, { text, expectedSnapshotId }),
  undoClipboard: () => electron.ipcRenderer.invoke(IpcChannels.CLIPBOARD_UNDO),
  startVoice: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_START),
  stopVoice: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_STOP),
  getLastTranscript: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_GET_LAST_TRANSCRIPT),
  getTranscripts: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_GET_TRANSCRIPTS),
  clearTranscripts: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_CLEAR_TRANSCRIPTS),
  setVoiceHotkey: (hotkey) => electron.ipcRenderer.invoke(IpcChannels.VOICE_SET_HOTKEY, { hotkey }),
  getVoiceState: () => electron.ipcRenderer.invoke(IpcChannels.VOICE_GET_STATE),
  submitText: (text) => electron.ipcRenderer.invoke(IpcChannels.TEXT_SUBMIT, { text }),
  classifyIntent: (transcript) => electron.ipcRenderer.invoke(IpcChannels.INTENT_CLASSIFY, { transcript }),
  routeIntent: (transcript) => electron.ipcRenderer.invoke(IpcChannels.INTENT_ROUTE, { transcript }),
  getLastAction: () => electron.ipcRenderer.invoke(IpcChannels.ACTION_GET_LAST),
  getSetting: (key) => electron.ipcRenderer.invoke(IpcChannels.SETTINGS_GET, { key }),
  setSetting: (key, value) => electron.ipcRenderer.invoke(IpcChannels.SETTINGS_SET, { key, value }),
  getAllSettings: () => electron.ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),
  resetSettings: (key) => electron.ipcRenderer.invoke(IpcChannels.SETTINGS_RESET, { key }),
  startAutomation: (request) => electron.ipcRenderer.invoke(IpcChannels.AUTOMATION_START, request),
  cancelAutomation: (jobId) => electron.ipcRenderer.invoke(IpcChannels.AUTOMATION_CANCEL, { jobId }),
  getAutomationState: () => electron.ipcRenderer.invoke(IpcChannels.AUTOMATION_GET_STATE),
  provideAutomationInput: (jobId, action, input) => electron.ipcRenderer.invoke(IpcChannels.AUTOMATION_PROVIDE_INPUT, { jobId, action, input }),
  // Secrets API
  getSecret: (key) => electron.ipcRenderer.invoke(IpcChannels.SECRETS_GET, { key }),
  setSecret: (key, value) => electron.ipcRenderer.invoke(IpcChannels.SECRETS_SET, { key, value }),
  deleteSecret: (key) => electron.ipcRenderer.invoke(IpcChannels.SECRETS_DELETE, { key }),
  hasSecret: (key) => electron.ipcRenderer.invoke(IpcChannels.SECRETS_HAS, { key }),
  // Window control
  toggleWindow: () => electron.ipcRenderer.invoke("clipmorph:window:toggle"),
  getWindowState: () => electron.ipcRenderer.invoke("clipmorph:window:getState"),
  // OpenCode API
  runOpenCodeTask: (request) => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_RUN_TASK, request),
  cancelOpenCode: () => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_CANCEL),
  getOpenCodeState: () => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_GET_STATE),
  detectOpenCode: () => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_DETECT),
  writeOpenCodeInput: (input) => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_WRITE_INPUT, { input }),
  respondToOpenCodePermission: (allow) => electron.ipcRenderer.invoke(IpcChannels.OPENCODE_RESPOND_PERMISSION, { allow }),
  // Subagent API
  listSubagents: () => electron.ipcRenderer.invoke(IpcChannels.SUBAGENT_LIST),
  discoverSubagents: (forceReload) => electron.ipcRenderer.invoke(IpcChannels.SUBAGENT_DISCOVER, { forceReload }),
  runSubagent: (request) => electron.ipcRenderer.invoke(IpcChannels.SUBAGENT_RUN, request),
  // Workflow API
  startWorkflow: (request) => electron.ipcRenderer.invoke(IpcChannels.WORKFLOW_START, request),
  approveWorkflowCheckpoint: (jobId, feedback) => electron.ipcRenderer.invoke(IpcChannels.WORKFLOW_APPROVE, { jobId, feedback }),
  rejectWorkflowCheckpoint: (jobId, action, feedback) => electron.ipcRenderer.invoke(IpcChannels.WORKFLOW_REJECT, { jobId, action, feedback }),
  cancelWorkflow: (jobId) => electron.ipcRenderer.invoke(IpcChannels.WORKFLOW_CANCEL, { jobId }),
  getWorkflowState: () => electron.ipcRenderer.invoke(IpcChannels.WORKFLOW_GET_STATE),
  // File Operation API
  previewFileOperation: (request) => electron.ipcRenderer.invoke(IpcChannels.FILE_OP_PREVIEW, request),
  executeFileOperation: (previewId, approved) => electron.ipcRenderer.invoke(IpcChannels.FILE_OP_EXECUTE, { previewId, approved }),
  undoFileOperation: (jobId) => electron.ipcRenderer.invoke(IpcChannels.FILE_OP_UNDO, { jobId }),
  getFileOperationHistory: () => electron.ipcRenderer.invoke(IpcChannels.FILE_OP_HISTORY),
  // Skill API
  listSkills: () => electron.ipcRenderer.invoke(IpcChannels.SKILL_LIST),
  discoverSkills: (forceReload) => electron.ipcRenderer.invoke(IpcChannels.SKILL_DISCOVER, { forceReload }),
  getSkill: (skillId) => electron.ipcRenderer.invoke(IpcChannels.SKILL_GET, { skillId }),
  exportSkill: (skillId, outputPath) => electron.ipcRenderer.invoke(IpcChannels.SKILL_EXPORT, { skillId, outputPath }),
  importSkill: (source, global) => electron.ipcRenderer.invoke(IpcChannels.SKILL_IMPORT, { source, global })
};
electron.contextBridge.exposeInMainWorld("clipmorph", api);
