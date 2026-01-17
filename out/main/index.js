"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const OpenAI = require("openai");
const keytar = require("keytar");
const child_process = require("child_process");
const events = require("events");
const crypto = require("crypto");
const util = require("util");
const pty = require("node-pty");
const promises = require("fs/promises");
const os = require("os");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const playwright = require("playwright");
const WebSocket = require("ws");
const Groq = require("groq-sdk");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const pty__namespace = /* @__PURE__ */ _interopNamespaceDefault(pty);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
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
  SKILL_IMPORT: "clipmorph:skill:import",
  // Operations history domain
  HISTORY_GET: "clipmorph:history:get",
  HISTORY_CLEAR: "clipmorph:history:clear",
  HISTORY_COPY_IMAGE: "clipmorph:history:copy-image",
  HISTORY_GET_IMAGE: "clipmorph:history:get-image"
};
const ErrorCodes = {
  // General errors
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  HANDLER_NOT_FOUND: "HANDLER_NOT_FOUND",
  // Clipboard errors
  CLIPBOARD_READ_FAILED: "CLIPBOARD_READ_FAILED",
  CLIPBOARD_WRITE_FAILED: "CLIPBOARD_WRITE_FAILED",
  CLIPBOARD_SNAPSHOT_MISMATCH: "CLIPBOARD_SNAPSHOT_MISMATCH",
  CLIPBOARD_UNDO_EMPTY: "CLIPBOARD_UNDO_EMPTY",
  // Job errors
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  JOB_ALREADY_COMPLETED: "JOB_ALREADY_COMPLETED",
  JOB_CANCEL_FAILED: "JOB_CANCEL_FAILED",
  // Voice errors
  VOICE_NOT_AVAILABLE: "VOICE_NOT_AVAILABLE",
  VOICE_ALREADY_LISTENING: "VOICE_ALREADY_LISTENING",
  VOICE_TRANSCRIPTION_FAILED: "VOICE_TRANSCRIPTION_FAILED",
  // Transform errors
  TRANSFORM_NOT_FOUND: "TRANSFORM_NOT_FOUND",
  TRANSFORM_INVALID_INPUT: "TRANSFORM_INVALID_INPUT",
  TRANSFORM_EXECUTION_FAILED: "TRANSFORM_EXECUTION_FAILED",
  // Permission errors
  PERMISSION_DENIED: "PERMISSION_DENIED",
  PERMISSION_NOT_GRANTED: "PERMISSION_NOT_GRANTED",
  // Automation errors
  AUTOMATION_NEEDS_INPUT: "AUTOMATION_NEEDS_INPUT",
  AUTOMATION_BROWSER_ERROR: "AUTOMATION_BROWSER_ERROR",
  // OpenCode errors
  OPENCODE_NOT_INSTALLED: "OPENCODE_NOT_INSTALLED",
  OPENCODE_TASK_FAILED: "OPENCODE_TASK_FAILED",
  OPENCODE_TASK_TIMEOUT: "OPENCODE_TASK_TIMEOUT",
  OPENCODE_BUSY: "OPENCODE_BUSY"
};
const EventTypes = {
  STATUS_CHANGED: "status-changed",
  JOB_CREATED: "job-created",
  JOB_UPDATED: "job-updated",
  JOB_COMPLETED: "job-completed",
  JOB_FAILED: "job-failed",
  JOB_CANCELLED: "job-cancelled",
  JOB_NEEDS_INPUT: "job-needs-input",
  CLIPBOARD_CHANGED: "clipboard-changed",
  VOICE_STARTED: "voice-started",
  VOICE_STOPPED: "voice-stopped",
  VOICE_TRANSCRIPT: "voice-transcript",
  TRANSFORM_STARTED: "transform-started",
  TRANSFORM_COMPLETED: "transform-completed",
  TRANSFORM_FAILED: "transform-failed",
  PERMISSION_CHANGED: "permission-changed",
  SETTINGS_CHANGED: "settings-changed",
  AUTOMATION_STARTED: "automation-started",
  AUTOMATION_STEP: "automation-step",
  AUTOMATION_COMPLETED: "automation-completed",
  AUTOMATION_FAILED: "automation-failed",
  AUTOMATION_NEEDS_INPUT: "automation-needs-input",
  AUTOMATION_CANCELLED: "automation-cancelled",
  OPENCODE_STARTED: "opencode-started",
  OPENCODE_OUTPUT: "opencode-output",
  OPENCODE_PERMISSION_REQUEST: "opencode-permission-request",
  OPENCODE_COMPLETED: "opencode-completed",
  OPENCODE_FAILED: "opencode-failed",
  OPENCODE_CANCELLED: "opencode-cancelled",
  // Workflow events
  WORKFLOW_STARTED: "workflow-started",
  WORKFLOW_STAGE_STARTED: "workflow-stage-started",
  WORKFLOW_CHECKPOINT: "workflow-checkpoint",
  WORKFLOW_STAGE_COMPLETED: "workflow-stage-completed",
  WORKFLOW_STAGE_FAILED: "workflow-stage-failed",
  WORKFLOW_COMPLETED: "workflow-completed",
  WORKFLOW_CANCELLED: "workflow-cancelled",
  // File operation events
  FILE_OP_PREVIEW_READY: "fileop-preview-ready",
  FILE_OP_STARTED: "fileop-started",
  FILE_OP_COMPLETED: "fileop-completed",
  FILE_OP_FAILED: "fileop-failed",
  FILE_OP_UNDONE: "fileop-undone",
  // Skill events
  SKILL_DISCOVERED: "skill-discovered",
  SKILL_APPLIED: "skill-applied",
  SKILL_IMPORTED: "skill-imported",
  SKILL_EXPORTED: "skill-exported",
  // Window events
  APP_BLUR: "app-blur",
  APP_FOCUS: "app-focus"
};
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
function createSuccessResponse(data, requestId) {
  return {
    ok: true,
    requestId: requestId ?? generateRequestId(),
    data
  };
}
function createErrorResponse(code, message, details, requestId) {
  return {
    ok: false,
    requestId: requestId ?? generateRequestId(),
    error: { code, message, details }
  };
}
function createEvent(type, payload, jobId) {
  return {
    type,
    jobId,
    payload,
    timestamp: Date.now()
  };
}
function checkMicrophonePermission() {
  if (process.platform !== "darwin") {
    return { type: "microphone", status: "granted", canRequest: false };
  }
  const status = electron.systemPreferences.getMediaAccessStatus("microphone");
  switch (status) {
    case "granted":
      return { type: "microphone", status: "granted", canRequest: false };
    case "denied":
      return { type: "microphone", status: "denied", canRequest: false };
    case "not-determined":
      return { type: "microphone", status: "not-determined", canRequest: true };
    case "restricted":
      return { type: "microphone", status: "restricted", canRequest: false };
    default:
      return { type: "microphone", status: "unknown", canRequest: false };
  }
}
function checkAccessibilityPermission() {
  if (process.platform !== "darwin") {
    return { type: "accessibility", status: "granted", canRequest: false };
  }
  const isTrusted = electron.systemPreferences.isTrustedAccessibilityClient(false);
  return {
    type: "accessibility",
    status: isTrusted ? "granted" : "denied",
    canRequest: !isTrusted
  };
}
async function requestMicrophonePermission() {
  if (process.platform !== "darwin") {
    return true;
  }
  const currentStatus = checkMicrophonePermission();
  if (currentStatus.status === "granted") {
    return true;
  }
  if (currentStatus.status === "not-determined") {
    const granted = await electron.systemPreferences.askForMediaAccess("microphone");
    return granted;
  }
  return false;
}
function requestAccessibilityPermission() {
  if (process.platform !== "darwin") {
    return true;
  }
  const isTrusted = electron.systemPreferences.isTrustedAccessibilityClient(false);
  if (!isTrusted) {
    electron.shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
  }
  return isTrusted;
}
function getAllPermissions() {
  const mic = checkMicrophonePermission();
  const accessibility = checkAccessibilityPermission();
  return {
    microphone: mic.status,
    accessibility: accessibility.status
  };
}
function canEnableVoice() {
  const mic = checkMicrophonePermission();
  return mic.status === "granted";
}
function canEnableHotkeys() {
  const accessibility = checkAccessibilityPermission();
  return accessibility.status === "granted";
}
const VALID_TRANSITIONS = {
  pending: ["running", "cancelled"],
  running: ["needs_input", "completed", "failed", "cancelled"],
  needs_input: ["running", "completed", "failed", "cancelled"],
  completed: [],
  // Terminal state
  failed: [],
  // Terminal state
  cancelled: []
  // Terminal state
};
class JobManager {
  jobs = /* @__PURE__ */ new Map();
  jobCounter = 0;
  eventEmitter = null;
  /**
   * Set the event emitter for broadcasting job events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Generate a unique job ID
   */
  generateJobId() {
    this.jobCounter++;
    return `job-${Date.now()}-${this.jobCounter}`;
  }
  /**
   * Emit a job event
   */
  emitJobEvent(type, job) {
    if (this.eventEmitter) {
      this.eventEmitter(createEvent(type, { job }, job.id));
    }
  }
  /**
   * Create a new job
   */
  createJob(type, input) {
    const now = Date.now();
    const job = {
      id: this.generateJobId(),
      type,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      input
    };
    this.jobs.set(job.id, job);
    this.emitJobEvent(EventTypes.JOB_CREATED, job);
    return job;
  }
  /**
   * Get a job by ID
   */
  getJob(id) {
    return this.jobs.get(id);
  }
  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }
  /**
   * Get jobs by status
   */
  getJobsByStatus(status) {
    return Array.from(this.jobs.values()).filter((job) => job.status === status);
  }
  /**
   * Check if a status transition is valid
   */
  isValidTransition(from, to) {
    return VALID_TRANSITIONS[from].includes(to);
  }
  /**
   * Transition a job to a new status
   * Returns true if transition was successful, false if invalid
   */
  transitionJob(id, newStatus, options) {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }
    if (!this.isValidTransition(job.status, newStatus)) {
      console.warn(
        `Invalid job transition: ${job.status} → ${newStatus} for job ${id}`
      );
      return false;
    }
    job.status;
    job.status = newStatus;
    job.updatedAt = Date.now();
    if (options?.output !== void 0) {
      job.output = options.output;
    }
    if (options?.error !== void 0) {
      job.error = options.error;
    }
    switch (newStatus) {
      case "completed":
        this.emitJobEvent(EventTypes.JOB_COMPLETED, job);
        break;
      case "failed":
        this.emitJobEvent(EventTypes.JOB_FAILED, job);
        break;
      case "cancelled":
        this.emitJobEvent(EventTypes.JOB_CANCELLED, job);
        break;
      case "needs_input":
        this.emitJobEvent(EventTypes.JOB_NEEDS_INPUT, job);
        break;
      default:
        this.emitJobEvent(EventTypes.JOB_UPDATED, job);
    }
    return true;
  }
  /**
   * Start a job (pending → running)
   */
  startJob(id) {
    return this.transitionJob(id, "running");
  }
  /**
   * Complete a job (running → completed)
   */
  completeJob(id, output) {
    return this.transitionJob(id, "completed", { output });
  }
  /**
   * Fail a job (running → failed)
   */
  failJob(id, error) {
    return this.transitionJob(id, "failed", { error });
  }
  /**
   * Cancel a job (pending | running | needs_input → cancelled)
   */
  cancelJob(id) {
    return this.transitionJob(id, "cancelled");
  }
  /**
   * Mark job as needing input (running → needs_input)
   */
  needsInputJob(id) {
    return this.transitionJob(id, "needs_input");
  }
  /**
   * Resume a job from needs_input (needs_input → running)
   */
  resumeJob(id) {
    return this.transitionJob(id, "running");
  }
  /**
   * Check if a job is in a terminal state
   */
  isTerminal(id) {
    const job = this.jobs.get(id);
    if (!job) return true;
    return ["completed", "failed", "cancelled"].includes(job.status);
  }
  /**
   * Clean up old completed/failed/cancelled jobs
   * Keeps jobs for at least `maxAgeMs` milliseconds
   */
  cleanup(maxAgeMs = 5 * 60 * 1e3) {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (this.isTerminal(id) && now - job.updatedAt > maxAgeMs) {
        this.jobs.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
  /**
   * Clear all jobs (for testing)
   */
  clear() {
    this.jobs.clear();
    this.jobCounter = 0;
  }
}
const jobManager = new JobManager();
const SHADOW_HISTORY_DEPTH = 2;
function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
function generateSnapshotId$1() {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}
class ClipboardService {
  eventEmitter = null;
  currentSnapshot = null;
  watchInterval = null;
  isWatching = false;
  pollIntervalMs = 500;
  // Self-trigger immunity: track hashes of content we've written
  selfWrittenHashes = /* @__PURE__ */ new Set();
  selfWriteExpiryMs = 2e3;
  // Ignore self-writes for 2 seconds
  // Shadow clipboard history (2-deep for undo)
  shadowHistory = [];
  /**
   * Set the event emitter for broadcasting clipboard events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Create a snapshot from the current clipboard content
   */
  createSnapshot(text) {
    let html;
    let rtf;
    let contentType = "text";
    try {
      const htmlContent = electron.clipboard.readHTML();
      if (htmlContent && htmlContent.trim()) {
        html = htmlContent;
        contentType = "html";
      }
    } catch {
    }
    try {
      const rtfContent = electron.clipboard.readRTF();
      if (rtfContent && rtfContent.trim()) {
        rtf = rtfContent;
        if (contentType === "text") {
          contentType = "rtf";
        }
      }
    } catch {
    }
    return {
      id: generateSnapshotId$1(),
      text,
      html,
      rtf,
      contentType,
      timestamp: Date.now(),
      hash: hashContent(text)
    };
  }
  /**
   * Emit a clipboard changed event
   */
  emitClipboardChanged(snapshot, previousSnapshot) {
    if (this.eventEmitter) {
      this.eventEmitter(
        createEvent(EventTypes.CLIPBOARD_CHANGED, {
          snapshot,
          previousSnapshot
        })
      );
    }
  }
  /**
   * Check if a hash was written by us recently (self-trigger immunity)
   */
  isSelfWrite(hash) {
    return this.selfWrittenHashes.has(hash);
  }
  /**
   * Mark a hash as self-written (for immunity)
   */
  markAsSelfWrite(hash) {
    this.selfWrittenHashes.add(hash);
    setTimeout(() => {
      this.selfWrittenHashes.delete(hash);
    }, this.selfWriteExpiryMs);
  }
  /**
   * Push current snapshot to shadow history before overwriting
   */
  pushToShadowHistory(snapshot) {
    this.shadowHistory.unshift(snapshot);
    if (this.shadowHistory.length > SHADOW_HISTORY_DEPTH) {
      this.shadowHistory.pop();
    }
  }
  /**
   * Poll the clipboard and check for changes
   */
  pollClipboard() {
    try {
      const currentText = electron.clipboard.readText();
      const currentHash = hashContent(currentText);
      if (!this.currentSnapshot || this.currentSnapshot.hash !== currentHash) {
        if (this.isSelfWrite(currentHash)) {
          this.currentSnapshot = this.createSnapshot(currentText);
          return;
        }
        const previousSnapshot = this.currentSnapshot || void 0;
        this.currentSnapshot = this.createSnapshot(currentText);
        this.emitClipboardChanged(this.currentSnapshot, previousSnapshot);
      }
    } catch (error) {
      console.error("Error polling clipboard:", error);
    }
  }
  /**
   * Start watching the clipboard for changes
   */
  startWatching() {
    if (this.isWatching) return;
    this.isWatching = true;
    const initialText = electron.clipboard.readText();
    this.currentSnapshot = this.createSnapshot(initialText);
    this.watchInterval = setInterval(() => {
      this.pollClipboard();
    }, this.pollIntervalMs);
  }
  /**
   * Stop watching the clipboard
   */
  stopWatching() {
    if (!this.isWatching) return;
    this.isWatching = false;
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }
  /**
   * Get the current clipboard snapshot
   */
  getCurrentSnapshot() {
    return this.currentSnapshot;
  }
  /**
   * Read the current clipboard text
   */
  readClipboard() {
    return electron.clipboard.readText();
  }
  /**
   * Read file paths from clipboard (when files are copied in Finder)
   * Returns array of file paths, or empty array if no files
   */
  readFilePaths() {
    const formats = this.getAvailableFormats();
    try {
      const buffer = electron.clipboard.readBuffer("NSFilenamesPboardType");
      if (buffer && buffer.length > 0) {
        const plistStr = buffer.toString("utf8");
        const stringMatches = plistStr.match(/<string>([^<]+)<\/string>/g);
        if (stringMatches && stringMatches.length > 0) {
          const paths = stringMatches.map((match) => {
            const innerMatch = match.match(/<string>([^<]+)<\/string>/);
            return innerMatch ? innerMatch[1] : null;
          }).filter((p) => p !== null && p.startsWith("/"));
          if (paths.length > 0) {
            return paths;
          }
        }
      }
    } catch (err) {
      console.log("[Clipboard] NSFilenamesPboardType parse failed:", err);
    }
    try {
      if (formats.includes("public.file-url")) {
        const fileUrl = electron.clipboard.read("public.file-url");
        if (fileUrl && fileUrl.startsWith("file://")) {
          const path2 = decodeURIComponent(fileUrl.replace("file://", ""));
          return [path2];
        }
      }
    } catch {
    }
    try {
      if (formats.includes("text/uri-list")) {
        const uriList = electron.clipboard.read("text/uri-list");
        if (uriList) {
          const paths = uriList.split("\n").filter((line) => line.trim() && line.startsWith("file://")).map((uri) => decodeURIComponent(uri.replace("file://", "").trim()));
          if (paths.length > 0) {
            return paths;
          }
        }
      }
    } catch {
    }
    try {
      const text = electron.clipboard.readText();
      if (text && (text.startsWith("/") || text.startsWith("~"))) {
        const lines = text.split("\n").filter((line) => line.trim());
        const filePaths = lines.filter(
          (line) => (line.startsWith("/") || line.startsWith("~")) && line.length < 1e3
        );
        if (filePaths.length > 0) {
          return filePaths;
        }
      }
    } catch {
    }
    return [];
  }
  /**
   * Get available clipboard formats
   */
  getAvailableFormats() {
    try {
      return electron.clipboard.availableFormats();
    } catch {
      return [];
    }
  }
  /**
   * Write text to the clipboard (with self-trigger immunity)
   * Optionally saves to shadow history for undo
   */
  writeClipboard(text, saveToHistory = false) {
    if (saveToHistory && this.currentSnapshot) {
      this.pushToShadowHistory(this.currentSnapshot);
    }
    const hash = hashContent(text);
    this.markAsSelfWrite(hash);
    electron.clipboard.writeText(text);
    this.currentSnapshot = this.createSnapshot(text);
  }
  /**
   * Write with full content restoration (preserves HTML/RTF if available)
   */
  writeClipboardWithSnapshot(snapshot, saveToHistory = false) {
    if (saveToHistory && this.currentSnapshot) {
      this.pushToShadowHistory(this.currentSnapshot);
    }
    const hash = hashContent(snapshot.text);
    this.markAsSelfWrite(hash);
    if (snapshot.html && snapshot.contentType === "html") {
      electron.clipboard.write({
        text: snapshot.text,
        html: snapshot.html,
        rtf: snapshot.rtf
      });
    } else if (snapshot.rtf && snapshot.contentType === "rtf") {
      electron.clipboard.write({
        text: snapshot.text,
        rtf: snapshot.rtf
      });
    } else {
      electron.clipboard.writeText(snapshot.text);
    }
    this.currentSnapshot = this.createSnapshot(snapshot.text);
  }
  /**
   * Validate that a snapshot is still current (for gating)
   * Returns true if the provided snapshot matches current clipboard
   */
  validateSnapshot(snapshotId) {
    if (!this.currentSnapshot) return false;
    return this.currentSnapshot.id === snapshotId;
  }
  /**
   * Attempt to write clipboard only if snapshot is still valid (snapshot gating)
   * Saves to shadow history for undo capability
   * Returns error if snapshot mismatch
   */
  writeClipboardGated(text, expectedSnapshotId) {
    if (!this.validateSnapshot(expectedSnapshotId)) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH,
          message: "Clipboard has changed since job started. Result not applied.",
          details: {
            expectedSnapshotId,
            currentSnapshotId: this.currentSnapshot?.id
          }
        }
      };
    }
    this.writeClipboard(text, true);
    return { success: true };
  }
  /**
   * Undo the last clipboard write by ClipMorph
   * Restores from shadow history
   */
  undo() {
    if (this.shadowHistory.length === 0) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CLIPBOARD_UNDO_EMPTY,
          message: "No clipboard history to undo"
        }
      };
    }
    const previousSnapshot = this.shadowHistory.shift();
    this.writeClipboardWithSnapshot(previousSnapshot, false);
    return { success: true, snapshot: previousSnapshot };
  }
  /**
   * Get the shadow history (for UI display)
   */
  getShadowHistory() {
    return [...this.shadowHistory];
  }
  /**
   * Get the number of undo levels available
   */
  getUndoCount() {
    return this.shadowHistory.length;
  }
  /**
   * Check if undo is available
   */
  canUndo() {
    return this.shadowHistory.length > 0;
  }
  /**
   * Check if currently watching
   */
  isCurrentlyWatching() {
    return this.isWatching;
  }
  /**
   * Set poll interval (for testing)
   */
  setPollInterval(ms) {
    this.pollIntervalMs = ms;
    if (this.isWatching) {
      this.stopWatching();
      this.startWatching();
    }
  }
  /**
   * Write an image to the clipboard
   * Used for chart rendering and other image outputs
   */
  writeImage(imageBuffer, saveToHistory = true) {
    if (saveToHistory && this.currentSnapshot) {
      this.pushToShadowHistory(this.currentSnapshot);
    }
    const image = electron.nativeImage.createFromBuffer(imageBuffer);
    if (image.isEmpty()) {
      console.error("[ClipboardService] Failed to create image from buffer");
      return;
    }
    electron.clipboard.writeImage(image);
    console.log("[ClipboardService] Image written to clipboard");
  }
  /**
   * Write an image to clipboard with snapshot gating
   */
  writeImageGated(imageBuffer, expectedSnapshotId) {
    if (!this.validateSnapshot(expectedSnapshotId)) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CLIPBOARD_SNAPSHOT_MISMATCH,
          message: "Clipboard has changed since job started. Result not applied.",
          details: {
            expectedSnapshotId,
            currentSnapshotId: this.currentSnapshot?.id
          }
        }
      };
    }
    this.writeImage(imageBuffer, true);
    return { success: true };
  }
  /**
   * Clear state (for testing)
   */
  clear() {
    this.stopWatching();
    this.currentSnapshot = null;
    this.selfWrittenHashes.clear();
    this.shadowHistory = [];
  }
}
const clipboardService = new ClipboardService();
const DEFAULT_SETTINGS = {
  "hotkey.pushToTalk": "Control+Shift+Space",
  "transforms.urlClean.enabled": "true",
  "transforms.urlMarkdown.enabled": "true",
  "transforms.jsonPretty.enabled": "true",
  "transforms.jsonMinify.enabled": "true",
  "transforms.jsonToYaml.enabled": "true",
  "transforms.yamlToJson.enabled": "true",
  "transforms.extractEmails.enabled": "true",
  "transforms.extractLinks.enabled": "true",
  "transforms.redactSecrets.enabled": "true",
  "ui.theme": "system",
  "audio.minCaptureDuration": "200",
  "audio.inputDevice": "",
  // Empty = system default (macOS uses CoreAudio default)
  "cerebras.model": "qwen-3-32b",
  // Cerebras model for browser agent
  "opencode.provider": "anthropic",
  // OpenCode LLM provider
  "opencode.model": "claude-3-5-sonnet-20241022",
  // OpenCode model for selected provider
  "ui.autoCompactOnBlur": "true",
  // Auto-compact when app loses focus
  "voice.sttProvider": "auto",
  // STT provider: 'auto' | 'elevenlabs' | 'groq' | 'openai'
  "voice.noiseSuppression": "false"
  // Filter background noise (ElevenLabs only)
};
class StoreService {
  db = null;
  dbPath = null;
  getDbPath() {
    if (!this.dbPath) {
      const userDataPath = electron.app.getPath("userData");
      this.dbPath = path.join(userDataPath, "clipmorph.db");
    }
    return this.dbPath;
  }
  /**
   * Initialize the database
   */
  initialize() {
    if (this.db) return;
    const dbPath = this.getDbPath();
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.createTables();
    this.initializeDefaults();
    console.log(`[StoreService] Database initialized at ${dbPath}`);
  }
  /**
   * Create database tables
   */
  createTables() {
    if (!this.db) throw new Error("Database not initialized");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC)
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operations_history (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        job_type TEXT NOT NULL,
        input_text TEXT NOT NULL,
        input_html TEXT,
        output_text TEXT,
        output_image_size INTEGER,
        output_image_path TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);
    try {
      this.db.exec(`ALTER TABLE operations_history ADD COLUMN output_image_path TEXT`);
    } catch {
    }
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations_history(created_at DESC)
    `);
  }
  /**
   * Initialize default settings if not present
   */
  initializeDefaults() {
    if (!this.db) throw new Error("Database not initialized");
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    const now = Date.now();
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insertStmt.run(key, value, now);
    }
  }
  /**
   * Get a setting value
   */
  getSetting(key) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
    const row = stmt.get(key);
    return row?.value ?? null;
  }
  /**
   * Get a setting with default fallback
   */
  getSettingOrDefault(key) {
    const value = this.getSetting(key);
    return value ?? DEFAULT_SETTINGS[key];
  }
  /**
   * Set a setting value
   */
  setSetting(key, value) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, Date.now());
  }
  /**
   * Get all settings
   */
  getAllSettings() {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("SELECT key, value FROM settings");
    const rows = stmt.all();
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }
  /**
   * Delete a setting
   */
  deleteSetting(key) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM settings WHERE key = ?");
    stmt.run(key);
  }
  /**
   * Add a transcript (maintains last 20)
   */
  addTranscript(id, text, durationMs) {
    if (!this.db) throw new Error("Database not initialized");
    const insertStmt = this.db.prepare(`
      INSERT INTO transcripts (id, text, duration_ms, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insertStmt.run(id, text, durationMs ?? null, Date.now());
    const deleteStmt = this.db.prepare(`
      DELETE FROM transcripts WHERE id NOT IN (
        SELECT id FROM transcripts ORDER BY created_at DESC LIMIT 20
      )
    `);
    deleteStmt.run();
  }
  /**
   * Get transcripts (last 20, newest first)
   */
  getTranscripts(limit = 20) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(`
      SELECT id, text, duration_ms, created_at
      FROM transcripts
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
  /**
   * Get last transcript
   */
  getLastTranscript() {
    const transcripts = this.getTranscripts(1);
    return transcripts[0] ?? null;
  }
  /**
   * Clear all transcripts
   */
  clearTranscripts() {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM transcripts");
    stmt.run();
  }
  // ============================================================================
  // Operations History
  // ============================================================================
  /**
   * Add an operation to history (maintains last 100)
   */
  addOperation(operation) {
    if (!this.db) throw new Error("Database not initialized");
    const insertStmt = this.db.prepare(`
      INSERT INTO operations_history (
        id, command, job_type, input_text, input_html, 
        output_text, output_image_size, output_image_path, success, error, duration_ms, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      operation.id,
      operation.command,
      operation.jobType,
      operation.inputText,
      operation.inputHtml ?? null,
      operation.outputText ?? null,
      operation.outputImageSize ?? null,
      operation.outputImagePath ?? null,
      operation.success ? 1 : 0,
      operation.error ?? null,
      operation.durationMs ?? null,
      Date.now()
    );
    console.log(`[StoreService] Added operation: "${operation.command}" (${operation.jobType}) - ${operation.success ? "success" : "failed"}`);
    const deleteStmt = this.db.prepare(`
      DELETE FROM operations_history WHERE id NOT IN (
        SELECT id FROM operations_history ORDER BY created_at DESC LIMIT 100
      )
    `);
    deleteStmt.run();
  }
  /**
   * Get operations history (newest first)
   */
  getOperations(limit = 50) {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare(`
      SELECT 
        id, command, job_type, input_text, input_html,
        output_text, output_image_size, output_image_path, success, error, duration_ms, created_at
      FROM operations_history
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    return rows.map((row) => ({
      ...row,
      success: row.success === 1
    }));
  }
  /**
   * Get last operation
   */
  getLastOperation() {
    const operations = this.getOperations(1);
    return operations[0] ?? null;
  }
  /**
   * Clear all operations history
   */
  clearOperations() {
    if (!this.db) throw new Error("Database not initialized");
    const stmt = this.db.prepare("DELETE FROM operations_history");
    stmt.run();
  }
  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("[StoreService] Database closed");
    }
  }
}
const storeService = new StoreService();
const INTENT_PATTERNS = [
  // Special intents (highest priority)
  {
    intent: "cancel",
    patterns: [/\bcancel\b/i, /\bstop\b/i, /\babort\b/i, /\bnevermind\b/i],
    keywords: ["cancel", "stop", "abort", "nevermind", "never mind"],
    priority: 100
  },
  {
    intent: "undo",
    patterns: [/\bundo\b/i, /\brevert\b/i, /\brestore\b/i],
    keywords: ["undo", "revert", "restore", "go back"],
    priority: 99
  },
  // URL transforms
  {
    intent: "url:clean",
    patterns: [
      /clean\s*(the\s*)?(url|link)/i,
      /remove\s*(tracking|utm|query)/i,
      /strip\s*(tracking|utm|query)/i,
      /sanitize\s*(the\s*)?(url|link)/i
    ],
    keywords: ["clean url", "clean link", "remove tracking", "strip utm", "sanitize url"],
    priority: 50
  },
  {
    intent: "url:markdown",
    patterns: [
      /markdown\s*(link|url)/i,
      /(url|link)\s*to\s*markdown/i,
      /make\s*(it\s*)?(a\s*)?markdown\s*(link)?/i,
      /convert\s*(to\s*)?markdown/i
    ],
    keywords: ["markdown link", "markdown url", "to markdown", "make markdown"],
    priority: 50
  },
  // JSON transforms
  {
    intent: "json:pretty",
    patterns: [
      /pretty\s*(print)?\s*(json)?/i,
      /format\s*(the\s*)?(json)?/i,
      /beautify\s*(json)?/i,
      /indent\s*(json)?/i
    ],
    keywords: ["pretty", "pretty print", "format json", "beautify", "indent"],
    priority: 50
  },
  {
    intent: "json:minify",
    patterns: [
      /minify\s*(json)?/i,
      /compress\s*(json)?/i,
      /compact\s*(json)?/i,
      /one\s*line\s*(json)?/i
    ],
    keywords: ["minify", "compress", "compact", "one line"],
    priority: 50
  },
  {
    intent: "json:to-yaml",
    patterns: [
      /json\s*to\s*yaml/i,
      /convert\s*(to\s*)?yaml/i,
      /make\s*(it\s*)?yaml/i
    ],
    keywords: ["json to yaml", "to yaml", "convert yaml", "make yaml"],
    priority: 50
  },
  {
    intent: "yaml:to-json",
    patterns: [
      /yaml\s*to\s*json/i,
      /convert\s*(to\s*)?json/i,
      /make\s*(it\s*)?json/i
    ],
    keywords: ["yaml to json", "to json", "convert json", "make json"],
    priority: 50
  },
  // Extract transforms
  {
    intent: "extract:emails",
    patterns: [
      /extract\s*(all\s*)?(the\s*)?emails?/i,
      /get\s*(all\s*)?(the\s*)?emails?/i,
      /find\s*(all\s*)?(the\s*)?emails?/i,
      /pull\s*(out\s*)?(the\s*)?emails?/i
    ],
    keywords: ["extract email", "get email", "find email", "pull email"],
    priority: 50
  },
  {
    intent: "extract:links",
    patterns: [
      /extract\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /get\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /find\s*(all\s*)?(the\s*)?(links?|urls?)/i,
      /pull\s*(out\s*)?(the\s*)?(links?|urls?)/i
    ],
    keywords: ["extract link", "extract url", "get link", "find link"],
    priority: 50
  },
  // Redact transform
  {
    intent: "redact:secrets",
    patterns: [
      /redact\s*(secrets?|keys?|tokens?|passwords?)?/i,
      /hide\s*(secrets?|keys?|tokens?|passwords?)/i,
      /mask\s*(secrets?|keys?|tokens?|passwords?)/i,
      /remove\s*(secrets?|keys?|tokens?|passwords?)/i
    ],
    keywords: ["redact", "hide secret", "mask key", "remove password"],
    priority: 50
  },
  // Automation intents
  {
    intent: "automation:portal",
    patterns: [
      /apply\s*(to\s*)?(this\s*)?(job|portal|site)/i,
      /fill\s*(out\s*)?(this\s*)?(form|application)/i,
      /start\s*automation/i
    ],
    keywords: ["apply", "fill form", "fill application", "automation"],
    priority: 30
  },
  // Code intents (OpenCode CLI) - only for actual code/programming tasks
  {
    intent: "code:generate",
    patterns: [
      /generate\s*(a\s*)?([\w\s]*\s*)?(code|function|component|class|module|script|api|endpoint|hook|service|util)/i,
      /create\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module|script|api|endpoint|hook|service|util)/i,
      /write\s*(a\s*)?([\w\s]*\s*)?(code|function|component|class|module|script)/i,
      /make\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module)/i,
      /build\s*(a\s*)?([\w\s]*\s*)?(function|component|class|module|api)/i,
      /implement\s*(a\s*)?([\w\s]*\s*)?(function|feature|component|class)/i,
      /code\s*(a\s*)?([\w\s]*\s*)?(function|feature|component)/i
    ],
    keywords: ["create function", "write code", "make component", "build class", "generate code", "implement function"],
    priority: 40
  },
  {
    intent: "code:refactor",
    patterns: [
      /refactor\s*(this|the)?\s*(code|function|component)?/i,
      /restructure\s*(this|the)?\s*(code|function)?/i,
      /rewrite\s*(this|the)?\s*(code|function)?/i,
      /clean\s*up\s*(this|the)?\s*(code|function)?/i
    ],
    keywords: ["refactor", "restructure", "rewrite", "clean up code"],
    priority: 40
  },
  {
    intent: "code:fix",
    patterns: [
      /fix\s*(this|the)?\s*(bug|error|issue|code|function)?/i,
      /debug\s*(this|the)?\s*(code|function)?/i,
      /repair\s*(this|the)?\s*(code|function)?/i,
      /solve\s*(this|the)?\s*(bug|error|issue)?/i
    ],
    keywords: ["fix", "debug", "repair", "solve bug", "fix error"],
    priority: 40
  },
  {
    intent: "code:explain",
    patterns: [
      /explain\s*(this|the)?\s*(code|function|component)?/i,
      /what\s*does\s*(this|the)?\s*(code|function)?\s*do/i,
      /how\s*does\s*(this|the)?\s*(code|function)?\s*work/i,
      /describe\s*(this|the)?\s*(code|function)?/i
    ],
    keywords: ["explain", "what does", "how does", "describe code"],
    priority: 40
  },
  {
    intent: "code:improve",
    patterns: [
      /improve\s*(this|the)?\s*(code|function|performance)?/i,
      /optimize\s*(this|the)?\s*(code|function)?/i,
      /enhance\s*(this|the)?\s*(code|function)?/i,
      /make\s*(this|the)?\s*(code|function)?\s*(better|faster)/i
    ],
    keywords: ["improve", "optimize", "enhance", "make better", "make faster"],
    priority: 40
  },
  {
    intent: "code:convert",
    patterns: [
      /convert\s*(this|the)?\s*(code|file|to)?\s*(to\s*)?(typescript|ts|javascript|js|python|py|java|go|rust)/i,
      /migrate\s*(this|the)?\s*(code|file)?\s*(to\s*)?(typescript|ts|javascript|js)/i,
      /transform\s*(this|the)?\s*(code)?\s*(to|into)\s*(typescript|ts)/i,
      /change\s*(this|the)?\s*(code)?\s*(to|into)\s*(typescript|ts)/i,
      /port\s*(this|the)?\s*(code)?\s*(to\s*)?(typescript|ts|python|java)/i,
      /add\s*types?\s*(to\s*)?(this|the)?\s*(code|file)?/i,
      /typescript\s*(this|convert)/i
    ],
    keywords: ["convert to typescript", "migrate to ts", "add types", "convert to ts", "port to"],
    priority: 40
  },
  // Direct OpenCode trigger - use "opencode" or "code agent" prefix
  {
    intent: "code:generate",
    patterns: [
      /^opencode\s+/i,
      // "opencode do something"
      /^code\s*agent\s+/i,
      // "code agent do something"  
      /^agent\s+code\s+/i,
      // "agent code something"
      /^use\s*opencode\s+/i
      // "use opencode to..."
    ],
    keywords: ["opencode", "code agent"],
    priority: 60
    // High priority to override other matches
  },
  // Workflow intents (multi-stage)
  {
    intent: "workflow:plan-code-review",
    patterns: [
      /full\s*(review\s*)?(workflow|process)/i,
      /plan\s*(and|then)?\s*(implement|code)\s*(and|then)?\s*review/i,
      /complete\s*(development\s*)?(workflow|cycle)/i,
      /full\s*(dev\s*)?cycle/i
    ],
    keywords: ["full workflow", "full review", "plan implement review", "complete workflow", "full cycle"],
    priority: 45
  },
  {
    intent: "workflow:plan-code",
    patterns: [
      /plan\s*(and|then)?\s*(implement|code|build|create)/i,
      /design\s*(and|then)?\s*(implement|code|build)/i,
      /architect\s*(and|then)?\s*(implement|code|build)/i
    ],
    keywords: ["plan and implement", "plan and code", "design and build", "architect and code"],
    priority: 44
  },
  {
    intent: "workflow:plan-only",
    patterns: [
      /just\s*plan/i,
      /only\s*plan/i,
      /plan\s*first/i,
      /create\s*(a\s*)?plan\s*(for)?/i,
      /design\s*(a\s*)?plan/i
    ],
    keywords: ["just plan", "only plan", "plan first", "create plan", "design plan"],
    priority: 43
  },
  // File operation intents
  {
    intent: "file:organize",
    patterns: [
      /organize\s*(my\s*)?(files?|folders?|downloads?|documents?)/i,
      /sort\s*(my\s*)?(files?|folders?|downloads?)/i,
      /clean\s*up\s*(my\s*)?(files?|folders?|downloads?|desktop)/i,
      /tidy\s*(up\s*)?(my\s*)?(files?|folders?)/i
    ],
    keywords: ["organize files", "organize folder", "sort files", "clean up downloads", "tidy files"],
    priority: 42
  },
  {
    intent: "file:rename",
    patterns: [
      /rename\s*(files?|folders?|all)/i,
      /batch\s*rename/i,
      /change\s*(file\s*)?names?/i
    ],
    keywords: ["rename files", "rename folder", "batch rename", "change names"],
    priority: 42
  },
  {
    intent: "file:move",
    patterns: [
      /move\s*(files?|folders?|all)\s*(to|into)/i,
      /relocate\s*(files?|folders?)/i,
      /transfer\s*(files?|folders?)/i
    ],
    keywords: ["move files", "move folder", "relocate", "transfer files"],
    priority: 42
  },
  {
    intent: "file:delete",
    patterns: [
      /delete\s*(files?|folders?|all)/i,
      /remove\s*(files?|folders?|all)/i,
      /trash\s*(files?|folders?)/i,
      /clean\s*(out|up)\s*(old\s*)?(files?|folders?)/i
    ],
    keywords: ["delete files", "delete folder", "remove files", "trash files"],
    priority: 42
  },
  {
    intent: "file:find",
    patterns: [
      /find\s*(files?|folders?)/i,
      /search\s*(for\s*)?(files?|folders?)/i,
      /locate\s*(files?|folders?)/i,
      /where\s*(is|are)\s*(my\s*)?(files?|folders?)/i
    ],
    keywords: ["find files", "find folder", "search files", "locate files", "where is"],
    priority: 42
  },
  {
    intent: "file:copy",
    patterns: [
      /copy\s*(files?|folders?|all)\s*(to|into)/i,
      /duplicate\s*(files?|folders?)/i,
      /backup\s*(files?|folders?)/i
    ],
    keywords: ["copy files", "copy folder", "duplicate files", "backup files"],
    priority: 42
  }
];
function normalizeTranscript(transcript) {
  return transcript.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}
function calculateMatchScore(normalizedTranscript, pattern) {
  const matchedPatterns = [];
  let score = 0;
  for (const regex of pattern.patterns) {
    if (regex.test(normalizedTranscript)) {
      score += 0.5;
      matchedPatterns.push(regex.source);
    }
  }
  for (const keyword of pattern.keywords) {
    if (normalizedTranscript.includes(keyword.toLowerCase())) {
      score += 0.3;
      matchedPatterns.push(`keyword:${keyword}`);
    }
  }
  if (pattern.keywords.some((k) => normalizedTranscript === k.toLowerCase())) {
    score += 0.5;
  }
  return { score, matchedPatterns };
}
function classifyIntent(transcript) {
  const normalizedTranscript = normalizeTranscript(transcript);
  let bestMatch = null;
  for (const pattern of INTENT_PATTERNS) {
    const { score, matchedPatterns } = calculateMatchScore(normalizedTranscript, pattern);
    if (score > 0) {
      if (!bestMatch || score > bestMatch.score || score === bestMatch.score && pattern.priority > bestMatch.priority) {
        bestMatch = {
          intent: pattern.intent,
          score,
          matchedPatterns,
          priority: pattern.priority
        };
      }
    }
  }
  if (bestMatch && bestMatch.score >= 0.3) {
    return {
      intent: bestMatch.intent,
      confidence: Math.min(bestMatch.score, 1),
      rawTranscript: transcript,
      normalizedTranscript,
      matchedPatterns: bestMatch.matchedPatterns
    };
  }
  return {
    intent: "unsupported",
    confidence: 0,
    rawTranscript: transcript,
    normalizedTranscript,
    matchedPatterns: []
  };
}
function isTransformIntent(intent) {
  return intent.startsWith("url:") || intent.startsWith("json:") || intent.startsWith("yaml:") || intent.startsWith("extract:") || intent.startsWith("redact:");
}
function isSpecialIntent(intent) {
  return intent === "cancel" || intent === "undo";
}
function isAutomationIntent(intent) {
  return intent.startsWith("automation:");
}
function isCodeIntent(intent) {
  return intent.startsWith("code:");
}
function isSubagentIntent(intent) {
  return intent.startsWith("subagent:");
}
function isWorkflowIntent(intent) {
  return intent.startsWith("workflow:");
}
function isFileIntent(intent) {
  return intent.startsWith("file:");
}
function getSubagentIdFromIntent(intent) {
  if (!isSubagentIntent(intent)) return null;
  return intent.replace("subagent:", "");
}
function matchSubagentTrigger(transcript, triggers) {
  const normalizedTranscript = normalizeTranscript(transcript);
  for (const { trigger, subagentId } of triggers) {
    const normalizedTrigger = normalizeTranscript(trigger);
    if (normalizedTranscript === normalizedTrigger) {
      return { subagentId, trigger, confidence: 1 };
    }
    if (normalizedTranscript.startsWith(normalizedTrigger + " ")) {
      return { subagentId, trigger, confidence: 0.9 };
    }
    if (normalizedTranscript.includes(normalizedTrigger)) {
      return { subagentId, trigger, confidence: 0.7 };
    }
  }
  return null;
}
const CHAIN_SEPARATORS = [
  /\s+then\s+/i,
  /\s+and\s+then\s+/i,
  /\s+and\s+/i,
  /\s*,\s+then\s+/i,
  /\s*,\s+/i
];
function parseChain(transcript) {
  const normalized = transcript.toLowerCase().trim();
  let segments = [normalized];
  for (const separator of CHAIN_SEPARATORS) {
    const newSegments = [];
    for (const segment of segments) {
      const parts = segment.split(separator).filter((p) => p.trim());
      newSegments.push(...parts);
    }
    if (newSegments.length > segments.length) {
      segments = newSegments;
    }
  }
  if (segments.length === 1) {
    const classification = classifyIntent(segments[0]);
    if (isTransformIntent(classification.intent)) {
      return {
        intents: [classification.intent],
        isChain: false,
        rawSegments: segments
      };
    }
    return {
      intents: [],
      isChain: false,
      rawSegments: segments
    };
  }
  const intents = [];
  for (const segment of segments) {
    const classification = classifyIntent(segment.trim());
    if (isTransformIntent(classification.intent)) {
      intents.push(classification.intent);
    }
  }
  return {
    intents,
    isChain: intents.length > 1,
    rawSegments: segments
  };
}
const TRACKING_PARAMS = /* @__PURE__ */ new Set([
  // UTM parameters
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_cid",
  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  // Google
  "gclid",
  "gclsrc",
  "dclid",
  // Microsoft/Bing
  "msclkid",
  // Twitter
  "twclid",
  // General tracking
  "ref",
  "ref_",
  "referer",
  "referrer",
  "source",
  "mc_cid",
  "mc_eid",
  "ml_subscriber",
  "ml_subscriber_hash",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
  "vero_id",
  "oly_enc_id",
  "oly_anon_id",
  "__s",
  "share",
  "spm",
  "from",
  // Analytics
  "_ga",
  "_gl",
  "_ke",
  // Session/tracking IDs
  "sid",
  "sessionid",
  "tracking_id",
  "trk",
  "track",
  "clickid",
  "click_id",
  // Affiliate
  "aff",
  "affiliate",
  "affid",
  "affiliate_id",
  "partner",
  "partner_id",
  // Email
  "email",
  "e",
  "em",
  "subscriber",
  // Social
  "igshid",
  "share_token",
  "s"
  // Twitter share param
]);
function isUrl(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return true;
  }
  if (trimmed.startsWith("www.")) {
    return true;
  }
  try {
    new URL(trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed);
    return true;
  } catch {
    return false;
  }
}
function cleanUrl(input) {
  const trimmed = input.trim();
  if (!isUrl(trimmed)) {
    return {
      original: input,
      cleaned: input,
      removedParams: [],
      isUrl: false
    };
  }
  let urlString = trimmed;
  if (urlString.startsWith("www.")) {
    urlString = `https://${urlString}`;
  }
  try {
    const url = new URL(urlString);
    const removedParams = [];
    const params = new URLSearchParams(url.search);
    const newParams = new URLSearchParams();
    for (const [key, value] of params) {
      const lowerKey = key.toLowerCase();
      if (TRACKING_PARAMS.has(lowerKey)) {
        removedParams.push(key);
      } else {
        newParams.set(key, value);
      }
    }
    url.search = newParams.toString();
    if (url.hash && url.hash.includes("=")) {
      const hashContent2 = url.hash.slice(1);
      if (TRACKING_PARAMS.has(hashContent2.split("=")[0].toLowerCase())) {
        url.hash = "";
        removedParams.push(`#${hashContent2.split("=")[0]}`);
      }
    }
    let cleaned = url.toString();
    if (!trimmed.endsWith("/") && cleaned.endsWith("/") && url.pathname === "/") {
      cleaned = cleaned.slice(0, -1);
    }
    return {
      original: input,
      cleaned,
      removedParams,
      isUrl: true
    };
  } catch {
    return {
      original: input,
      cleaned: input,
      removedParams: [],
      isUrl: false
    };
  }
}
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function urlToMarkdown(input) {
  const trimmed = input.trim();
  if (!isUrl(trimmed)) {
    return {
      original: input,
      markdown: input,
      title: "",
      isUrl: false
    };
  }
  let url = trimmed;
  if (url.startsWith("www.")) {
    url = `https://${url}`;
  }
  const title = extractDomain(url);
  const markdown = `[${title}](${url})`;
  return {
    original: input,
    markdown,
    title,
    isUrl: true
  };
}
function jsonPretty(input, indent = 2) {
  const trimmed = input.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed, null, indent);
    return {
      original: input,
      formatted,
      isValidJson: true
    };
  } catch (error) {
    return {
      original: input,
      formatted: input,
      isValidJson: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}
function jsonMinify(input) {
  const trimmed = input.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed);
    return {
      original: input,
      formatted,
      isValidJson: true
    };
  } catch (error) {
    return {
      original: input,
      formatted: input,
      isValidJson: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}
function parseSimpleYaml(yaml) {
  const lines = yaml.split("\n");
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const content = line.trim();
    const colonIndex = content.indexOf(":");
    if (colonIndex === -1) continue;
    const key = content.slice(0, colonIndex).trim();
    const value = content.slice(colonIndex + 1).trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;
    if (value === "" || value === "|" || value === ">") {
      const newObj = {};
      parent[key] = newObj;
      stack.push({ obj: newObj, indent });
    } else {
      parent[key] = parseYamlValue(value);
    }
  }
  return result;
}
function parseYamlValue(value) {
  if (value === "true" || value === "True" || value === "TRUE") return true;
  if (value === "false" || value === "False" || value === "FALSE") return false;
  if (value === "null" || value === "Null" || value === "NULL" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
function toYaml(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  if (obj === null) return "null";
  if (typeof obj === "boolean") return obj.toString();
  if (typeof obj === "number") return obj.toString();
  if (typeof obj === "string") {
    if (obj.includes(":") || obj.includes("#") || obj.includes("\n")) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map((item) => `${spaces}- ${toYaml(item, indent + 1).trim()}`).join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return "{}";
    return entries.map(([key, value]) => {
      const yamlValue = toYaml(value, indent + 1);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:
${yamlValue}`;
      }
      return `${spaces}${key}: ${yamlValue.trim()}`;
    }).join("\n");
  }
  return String(obj);
}
function jsonToYaml(input) {
  const trimmed = input.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const yaml = toYaml(parsed);
    return {
      original: input,
      converted: yaml,
      success: true
    };
  } catch (error) {
    return {
      original: input,
      converted: input,
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}
function yamlToJson(input) {
  const trimmed = input.trim();
  try {
    JSON.parse(trimmed);
    return {
      original: input,
      converted: JSON.stringify(JSON.parse(trimmed), null, 2),
      success: true
    };
  } catch {
  }
  try {
    const parsed = parseSimpleYaml(trimmed);
    const json = JSON.stringify(parsed, null, 2);
    return {
      original: input,
      converted: json,
      success: true
    };
  } catch (error) {
    return {
      original: input,
      converted: input,
      success: false,
      error: error instanceof Error ? error.message : "Invalid YAML"
    };
  }
}
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const WWW_PATTERN = /www\.[^\s<>"{}|\\^`[\]]+/gi;
function extractEmails(input) {
  const matches = input.match(EMAIL_PATTERN) || [];
  const unique = [...new Set(matches)].sort();
  return {
    original: input,
    extracted: unique,
    count: unique.length
  };
}
function extractLinks(input) {
  const httpMatches = input.match(URL_PATTERN) || [];
  const wwwMatches = (input.match(WWW_PATTERN) || []).map((m) => `https://${m}`);
  const all = [...httpMatches, ...wwwMatches];
  const unique = [...new Set(all)].sort();
  return {
    original: input,
    extracted: unique,
    count: unique.length
  };
}
function formatExtracted(result) {
  if (result.count === 0) {
    return "";
  }
  return result.extracted.join("\n");
}
const SECRET_PATTERNS = [
  // API Keys (generic patterns)
  {
    pattern: /\b(api[_-]?key|apikey)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: "API Key",
    replacement: "$1=[REDACTED]"
  },
  {
    pattern: /\b(secret[_-]?key|secretkey)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: "Secret Key",
    replacement: "$1=[REDACTED]"
  },
  {
    pattern: /\b(access[_-]?token|accesstoken)[=:\s]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    type: "Access Token",
    replacement: "$1=[REDACTED]"
  },
  // AWS
  {
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    type: "AWS Access Key",
    replacement: "[AWS_KEY_REDACTED]"
  },
  {
    pattern: /\b(aws[_-]?secret[_-]?access[_-]?key)[=:\s]+['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    type: "AWS Secret",
    replacement: "$1=[REDACTED]"
  },
  // GitHub
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    type: "GitHub PAT",
    replacement: "[GITHUB_TOKEN_REDACTED]"
  },
  {
    pattern: /\b(gho_[a-zA-Z0-9]{36})\b/g,
    type: "GitHub OAuth",
    replacement: "[GITHUB_OAUTH_REDACTED]"
  },
  {
    pattern: /\b(ghu_[a-zA-Z0-9]{36})\b/g,
    type: "GitHub User Token",
    replacement: "[GITHUB_USER_REDACTED]"
  },
  // Stripe
  {
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    type: "Stripe Secret Key",
    replacement: "[STRIPE_SK_REDACTED]"
  },
  {
    pattern: /\b(pk_live_[a-zA-Z0-9]{24,})\b/g,
    type: "Stripe Publishable Key",
    replacement: "[STRIPE_PK_REDACTED]"
  },
  // OpenAI
  {
    pattern: /\b(sk-[a-zA-Z0-9]{48})\b/g,
    type: "OpenAI API Key",
    replacement: "[OPENAI_KEY_REDACTED]"
  },
  // Slack
  {
    pattern: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g,
    type: "Slack Token",
    replacement: "[SLACK_TOKEN_REDACTED]"
  },
  // Generic Bearer tokens
  {
    pattern: /\b(Bearer\s+)([a-zA-Z0-9_\-.]{20,})\b/gi,
    type: "Bearer Token",
    replacement: "$1[REDACTED]"
  },
  // Passwords in common formats
  {
    pattern: /\b(password|passwd|pwd)[=:\s]+['"]?([^\s'"]{8,})['"]?/gi,
    type: "Password",
    replacement: "$1=[REDACTED]"
  },
  // Private keys (PEM format)
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    type: "Private Key",
    replacement: "[PRIVATE_KEY_REDACTED]"
  },
  // JWT tokens
  {
    pattern: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
    type: "JWT Token",
    replacement: "[JWT_REDACTED]"
  },
  // Database connection strings
  {
    pattern: /(mongodb(\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi,
    type: "MongoDB Password",
    replacement: "$1[REDACTED]$4"
  },
  {
    pattern: /(postgres(ql)?:\/\/[^:]+:)([^@]+)(@)/gi,
    type: "PostgreSQL Password",
    replacement: "$1[REDACTED]$4"
  },
  {
    pattern: /(mysql:\/\/[^:]+:)([^@]+)(@)/gi,
    type: "MySQL Password",
    replacement: "$1[REDACTED]$3"
  },
  // Generic high-entropy strings that look like secrets (32+ chars, mixed case/numbers)
  {
    pattern: /\b([a-zA-Z0-9]{32,64})\b/g,
    type: "Potential Secret",
    replacement: (match) => {
      const hasUpper = /[A-Z]/.test(match);
      const hasLower = /[a-z]/.test(match);
      const hasNumber = /[0-9]/.test(match);
      if (hasUpper && hasLower && hasNumber) {
        return "[POTENTIAL_SECRET_REDACTED]";
      }
      return match;
    }
  }
];
function redactSecrets(input) {
  let redacted = input;
  let redactedCount = 0;
  const detectedTypes = /* @__PURE__ */ new Set();
  for (const { pattern, type, replacement } of SECRET_PATTERNS) {
    const matches = redacted.match(pattern);
    if (matches) {
      if (typeof replacement === "function") {
        redacted = redacted.replace(pattern, replacement);
      } else {
        redacted = redacted.replace(pattern, replacement);
      }
      const newMatches = redacted.match(pattern);
      const replaced = matches.length - (newMatches?.length || 0);
      if (replaced > 0) {
        redactedCount += replaced;
        detectedTypes.add(type);
      }
    }
  }
  return {
    original: input,
    redacted,
    redactedCount,
    detectedTypes: [...detectedTypes]
  };
}
const SERVICE_NAME = "ClipMorph";
class SecretsService {
  /**
   * Store a secret in the Keychain
   */
  async setSecret(key, value) {
    await keytar.setPassword(SERVICE_NAME, key, value);
    console.log(`[SecretsService] Stored secret: ${key}`);
  }
  /**
   * Retrieve a secret from the Keychain
   */
  async getSecret(key) {
    const value = await keytar.getPassword(SERVICE_NAME, key);
    return value;
  }
  /**
   * Delete a secret from the Keychain
   */
  async deleteSecret(key) {
    const result = await keytar.deletePassword(SERVICE_NAME, key);
    if (result) {
      console.log(`[SecretsService] Deleted secret: ${key}`);
    }
    return result;
  }
  /**
   * Check if a secret exists
   */
  async hasSecret(key) {
    const value = await this.getSecret(key);
    return value !== null && value.length > 0;
  }
  /**
   * Get OpenAI API key specifically
   */
  async getOpenAIKey() {
    return this.getSecret("openai-api-key");
  }
  /**
   * Set OpenAI API key specifically
   */
  async setOpenAIKey(apiKey) {
    return this.setSecret("openai-api-key", apiKey);
  }
  /**
   * Check if OpenAI API key is configured
   */
  async hasOpenAIKey() {
    return this.hasSecret("openai-api-key");
  }
  /**
   * Get Cerebras API key specifically
   */
  async getCerebrasKey() {
    return this.getSecret("cerebras-api-key");
  }
  /**
   * Set Cerebras API key specifically
   */
  async setCerebrasKey(apiKey) {
    return this.setSecret("cerebras-api-key", apiKey);
  }
  /**
   * Check if Cerebras API key is configured
   */
  async hasCerebrasKey() {
    return this.hasSecret("cerebras-api-key");
  }
  /**
   * Get Groq API key specifically
   */
  async getGroqKey() {
    return this.getSecret("groq-api-key");
  }
  /**
   * Set Groq API key specifically
   */
  async setGroqKey(apiKey) {
    return this.setSecret("groq-api-key", apiKey);
  }
  /**
   * Check if Groq API key is configured
   */
  async hasGroqKey() {
    return this.hasSecret("groq-api-key");
  }
  /**
   * Get ElevenLabs API key specifically
   */
  async getElevenLabsKey() {
    return this.getSecret("elevenlabs-api-key");
  }
  /**
   * Set ElevenLabs API key specifically
   */
  async setElevenLabsKey(apiKey) {
    return this.setSecret("elevenlabs-api-key", apiKey);
  }
  /**
   * Check if ElevenLabs API key is configured
   */
  async hasElevenLabsKey() {
    return this.hasSecret("elevenlabs-api-key");
  }
}
const secretsService = new SecretsService();
const CEREBRAS_BASE_URL$1 = "https://api.cerebras.ai/v1";
class LLMTransformService {
  cerebrasClient = null;
  openaiClient = null;
  cerebrasKey = null;
  openaiKey = null;
  /**
   * Get best available client (Cerebras preferred for speed)
   */
  async getClient() {
    const cerebrasKey = await secretsService.getCerebrasKey();
    if (cerebrasKey) {
      if (!this.cerebrasClient || this.cerebrasKey !== cerebrasKey) {
        this.cerebrasKey = cerebrasKey;
        this.cerebrasClient = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: CEREBRAS_BASE_URL$1
        });
      }
      return {
        client: this.cerebrasClient,
        model: "gpt-oss-120b",
        // 120B params, ~3000 tok/s
        provider: "cerebras"
      };
    }
    const openaiKey = await secretsService.getOpenAIKey();
    if (openaiKey) {
      if (!this.openaiClient || this.openaiKey !== openaiKey) {
        this.openaiKey = openaiKey;
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
      }
      return {
        client: this.openaiClient,
        model: "gpt-4o-mini",
        provider: "openai"
      };
    }
    throw new Error("No API key configured. Set Cerebras or OpenAI key in Settings.");
  }
  /**
   * Detect if content is tabular (TSV from Excel/Sheets or HTML table)
   */
  isTabularContent(text, html) {
    if (html && /<table[\s>]/i.test(html)) {
      return true;
    }
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      const tabCounts = lines.map((l) => (l.match(/\t/g) || []).length);
      if (tabCounts[0] > 0 && tabCounts.every((c) => c === tabCounts[0])) {
        return true;
      }
    }
    return false;
  }
  /**
   * Execute an LLM-powered transform
   * 
   * @param command - What the user wants to do (e.g., "make this shorter", "translate to Spanish")
   * @param text - The clipboard content to transform
   * @param html - Optional HTML content (for rich formats like Excel tables)
   */
  async transform(command, text, html) {
    console.log(`[LLMTransformService] Transform called with command: "${command}"`);
    console.log(`[LLMTransformService] Input text length: ${text?.length || 0}`);
    if (!text || text.trim().length === 0) {
      console.log("[LLMTransformService] Empty clipboard, returning error");
      return {
        success: false,
        input: text,
        output: "",
        error: "Clipboard is empty"
      };
    }
    try {
      console.log("[LLMTransformService] Getting LLM client...");
      const { client, model, provider } = await this.getClient();
      console.log(`[LLMTransformService] Using ${provider} (${model}), calling API...`);
      const isTabular = this.isTabularContent(text, html);
      let contentToTransform = text;
      let formatHint = "";
      if (isTabular) {
        if (html) {
          contentToTransform = `[HTML Table]:
${html}

[Plain Text (tab-separated)]:
${text}`;
          formatHint = `

IMPORTANT: The input is TABULAR DATA (copied from Excel/Sheets). You MUST output as TAB-SEPARATED VALUES (TSV):
- Each row on its own line
- Columns separated by TAB characters (\\t), NOT spaces or pipes
- NO markdown table syntax (no | or --- )
- NO extra formatting or borders
- This ensures the result can be pasted back into Excel/Sheets correctly.

Example output format:
Header1	Header2	Header3
Value1	Value2	Value3`;
        } else {
          formatHint = `

IMPORTANT: The input is TAB-SEPARATED tabular data. Preserve the TSV format in your output:
- Each row on its own line
- Columns separated by TAB characters (\\t)
- NO markdown table syntax`;
        }
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15e3);
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: `You are a text transformation assistant. The user will give you a command and some text.
Your job is to transform the text according to the command and return ONLY the transformed result.

Rules:
- Return ONLY the transformed text, no explanations or commentary
- If the command is unclear, make your best interpretation
- If the text cannot be transformed as requested (e.g., "translate" but no target language), make a reasonable assumption
- Preserve formatting when appropriate (e.g., keep code as code)
- For JSON/YAML operations, ensure valid output format${formatHint}

Examples:
- "make shorter" → condense the text while keeping meaning
- "fix grammar" → correct grammatical errors
- "translate to X" → translate to language X
- "summarize" → create a brief summary
- "bullet points" → convert to bullet list
- "pretty json" → format JSON with indentation
- "extract emails" → pull out email addresses
- "clean url" → remove tracking parameters from URLs`
            },
            {
              role: "user",
              content: `Command: ${command}

Text to transform:
${contentToTransform}`
            }
          ],
          temperature: 0.3,
          // Lower temperature for more consistent results
          max_tokens: 4096
        }, { signal: controller.signal });
        clearTimeout(timeoutId);
        const output = response.choices[0]?.message?.content?.trim();
        console.log(`[LLMTransformService] API response received, output length: ${output?.length || 0}`);
        if (!output) {
          console.log("[LLMTransformService] Empty response from LLM");
          return {
            success: false,
            input: text,
            output: "",
            error: "LLM returned empty response"
          };
        }
        console.log(`[LLMTransformService] Transform successful, output preview: "${output.substring(0, 100)}..."`);
        return {
          success: true,
          input: text,
          output
        };
      } catch (apiError) {
        clearTimeout(timeoutId);
        if (apiError instanceof Error && apiError.name === "AbortError") {
          console.error("[LLMTransformService] API call timed out after 15s");
          return {
            success: false,
            input: text,
            output: "",
            error: "API call timed out"
          };
        }
        throw apiError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[LLMTransformService] Transform failed:", errorMessage);
      console.error("[LLMTransformService] Full error:", error);
      return {
        success: false,
        input: text,
        output: "",
        error: errorMessage
      };
    }
  }
  /**
   * Check if the service is available (has API key)
   */
  async isAvailable() {
    const cerebrasKey = await secretsService.getCerebrasKey();
    const openaiKey = await secretsService.getOpenAIKey();
    return !!(cerebrasKey || openaiKey);
  }
}
const llmTransformService = new LLMTransformService();
class BrowserAgentService {
  cerebrasClient = null;
  openaiClient = null;
  apiKey = null;
  cerebrasKey = null;
  eventEmitter = null;
  activeJobId = null;
  cancelled = false;
  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Get or create Cerebras client (preferred for browser agent - much faster inference)
   * Falls back to OpenAI if Cerebras key not configured
   */
  async getLLMClient() {
    const cerebrasKey = await secretsService.getCerebrasKey();
    if (cerebrasKey) {
      if (!this.cerebrasClient || this.cerebrasKey !== cerebrasKey) {
        this.cerebrasKey = cerebrasKey;
        this.cerebrasClient = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: "https://api.cerebras.ai/v1"
        });
      }
      const model = storeService.getSetting("cerebras.model") || "qwen-3-32b";
      return { client: this.cerebrasClient, model };
    }
    const openaiKey = await secretsService.getOpenAIKey();
    if (!openaiKey) {
      throw new Error("No API key configured. Set Cerebras or OpenAI key in Settings.");
    }
    if (!this.openaiClient || this.apiKey !== openaiKey) {
      this.apiKey = openaiKey;
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
    }
    return { client: this.openaiClient, model: "gpt-4o" };
  }
  /**
   * Execute an agent-browser CLI command
   * When shell: false, arguments are passed directly without escaping
   */
  async execAgentBrowser(args) {
    return new Promise((resolve, reject) => {
      const cmd = "npx";
      const fullArgs = ["agent-browser", ...args];
      console.log(`[BrowserAgent] Executing: ${cmd} ${fullArgs.join(" ")}`);
      const proc = child_process.spawn(cmd, fullArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Ensure PATH includes common node locations
          PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`
        },
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (data) => {
        const str = data.toString();
        stdout += str;
        console.log(`[BrowserAgent stdout] ${str.trim()}`);
      });
      proc.stderr?.on("data", (data) => {
        const str = data.toString();
        stderr += str;
        console.log(`[BrowserAgent stderr] ${str.trim()}`);
      });
      proc.on("close", (code) => {
        console.log(`[BrowserAgent] Command exited with code ${code}`);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `agent-browser exited with code ${code}`));
        }
      });
      proc.on("error", (err) => {
        console.error(`[BrowserAgent] Spawn error:`, err);
        reject(err);
      });
    });
  }
  /**
   * Open a URL in the browser (launches browser if not already open)
   * The 'open' command in agent-browser handles launching automatically
   */
  async open(url) {
    console.log(`[BrowserAgent] Opening: ${url}`);
    await this.execAgentBrowser(["open", url, "--headed"]);
  }
  /**
   * Get a snapshot of the current page
   */
  async snapshot() {
    console.log("[BrowserAgent] Taking snapshot...");
    const output = await this.execAgentBrowser(["snapshot", "-i", "--json"]);
    try {
      return JSON.parse(output);
    } catch {
      return { success: false, error: "Failed to parse snapshot" };
    }
  }
  /**
   * Click an element by ref
   */
  async click(ref) {
    console.log(`[BrowserAgent] Clicking: ${ref}`);
    try {
      await this.execAgentBrowser(["click", ref]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Fill a text field by ref
   */
  async fill(ref, value) {
    console.log(`[BrowserAgent] Filling ${ref}: "${value.substring(0, 50)}..."`);
    try {
      await this.execAgentBrowser(["fill", ref, value]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Select an option by ref
   * agent-browser expects: select <ref> <value>
   */
  async select(ref, value) {
    console.log(`[BrowserAgent] Selecting ${ref}: "${value}"`);
    try {
      await this.execAgentBrowser(["select", ref, value]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Hover over an element by ref
   */
  async hover(ref) {
    console.log(`[BrowserAgent] Hovering: ${ref}`);
    try {
      await this.execAgentBrowser(["hover", ref]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Scroll the page
   */
  async scroll(direction) {
    try {
      await this.execAgentBrowser(["scroll", direction]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Close the browser
   */
  async close() {
    console.log("[BrowserAgent] Closing browser");
    try {
      await this.execAgentBrowser(["close"]);
    } catch {
    }
  }
  /**
   * Ask the LLM what to do next
   */
  async decideNextActions(snapshot, task, context, actionHistory) {
    const { client, model } = await this.getLLMClient();
    const systemPrompt = `You are a browser automation agent. You control a web browser to complete tasks for the user.

You receive:
1. A TASK describing what the user wants to accomplish
2. A PAGE SNAPSHOT showing the current page state with element refs (like @e1, @e2)
3. CONTEXT with additional information (e.g., resume text, user info)
4. ACTION HISTORY showing what you've already done

Your job is to decide what actions to take next.

AVAILABLE ACTIONS:
- click: Click an element (buttons, links, radio buttons, checkboxes). { "type": "click", "ref": "@e5" }
- fill: Fill a text field/textbox. { "type": "fill", "ref": "@e3", "value": "John Doe" }
- select: Select from a dropdown/listbox. { "type": "select", "ref": "@e7", "value": "California" }
- hover: Hover over an element. { "type": "hover", "ref": "@e2" }
- scroll: Scroll the page. { "type": "scroll", "direction": "down" }
- wait: Wait for a moment. { "type": "wait", "seconds": 2 }
- navigate: Go to a URL. { "type": "navigate", "url": "https://..." }
- upload: Upload the user's document to a file input. { "type": "upload", "ref": "@e8" }

ELEMENT TYPES:
- textbox: Use "fill" action
- listbox/combobox: For Google Forms and similar, click the OPTION element directly (e.g., click @e6 for "Software Engineering" option). Do NOT use "select" action on Google Forms.
- radio: Use "click" action to select the radio option
- checkbox: Use "click" action to toggle the checkbox
- button/link: Use "click" action
- option: Use "click" action to select the option in a dropdown

RESPONSE FORMAT (JSON only):
1. To execute actions:
   { "type": "actions", "actions": [{ "type": "click", "ref": "@e5" }, { "type": "fill", "ref": "@e3", "value": "John" }] }

2. When task is complete:
   { "type": "completed", "reason": "Successfully submitted the form" }

3. When user input is needed (login, captcha, ambiguity):
   { "type": "needs_input", "reason": "login", "message": "Please log in to continue" }

4. When task cannot be completed:
   { "type": "failed", "reason": "Cannot find the submit button on this page" }

IMPORTANT RULES:
- Only use refs that exist in the current snapshot
- Fill forms with information from the CONTEXT when available
- A "Sign in" link on a page does NOT mean login is required - many forms work without login
- Only return needs_input for login if the page BLOCKS you from proceeding (e.g., "You must sign in to continue")
- If you see a CAPTCHA that blocks progress, return needs_input

FORM FILLING RULES (CRITICAL):
- When you see a form, you MUST fill ALL visible input fields before clicking submit
- Fill textboxes, select dropdowns, check checkboxes, and select radio buttons
- Do NOT click submit until you have filled every field on the form
- For each iteration, fill 3-5 fields at a time, then get a new snapshot to see remaining fields
- If you don't have specific info for a field, generate reasonable placeholder values (e.g., "Software Engineer" for job title, "5 years" for experience)
- For date fields, use today's date or a reasonable date
- For rating/scale questions (1-5), pick a reasonable middle value like 3 or 4
- Only click Submit/Next AFTER all visible fields are filled
- AFTER selecting radio buttons (especially for work location like On-site/Hybrid/Remote), NEW FIELDS may appear. Always scroll down and check for new fields before submitting.
- If a required field asks for information not in your context (like office location), use a reasonable placeholder like "San Francisco, CA" or "Remote"

DETECTING STUCK LOOPS:
- If you click Submit and the page snapshot looks THE SAME (same fields, same refs), the form has validation errors
- Look for any unfilled required fields and fill them
- Scroll down to check for fields you might have missed
- If stuck after 3 submit attempts, return { "type": "needs_input", "reason": "validation", "message": "Form has required fields I cannot fill - please review" }

- Respond with ONLY valid JSON, no explanations`;
    let contextStr = "No additional context provided.";
    if (context.resumeText) {
      contextStr = `RESUME/USER INFO:
${context.resumeText}`;
      if (context.additionalInfo) {
        contextStr += "\n\n" + Object.entries(context.additionalInfo).map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    }
    if (context.documentFilePath) {
      contextStr += `

DOCUMENT FILE AVAILABLE: ${context.documentFilePath}
You can use the "upload" action to upload this file to file input fields.`;
    }
    const historyStr = actionHistory.length > 0 ? `PREVIOUS ACTIONS:
${actionHistory.slice(-10).join("\n")}` : "No actions taken yet.";
    const userPrompt = `TASK: ${task}

PAGE SNAPSHOT:
${snapshot.data?.snapshot || "Failed to get snapshot"}

CONTEXT:
${contextStr}

${historyStr}

What should I do next? Respond with JSON only.`;
    try {
      console.log(`[BrowserAgent] Using model: ${model}`);
      const isOpenAI = model.startsWith("gpt-");
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2048,
        // Only add response_format for OpenAI (Cerebras models may not support it)
        ...isOpenAI ? { response_format: { type: "json_object" } } : {}
      });
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { type: "failed", reason: "LLM returned empty response" };
      }
      let jsonStr = content.trim();
      const thinkEndIndex = jsonStr.indexOf("</think>");
      if (thinkEndIndex !== -1) {
        jsonStr = jsonStr.slice(thinkEndIndex + 8).trim();
      }
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      let decision;
      try {
        decision = JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn("[BrowserAgent] JSON parse failed, attempting repair...");
        let repairedJson = jsonStr;
        const openBraces = (repairedJson.match(/{/g) || []).length;
        const closeBraces = (repairedJson.match(/}/g) || []).length;
        const openBrackets = (repairedJson.match(/\[/g) || []).length;
        const closeBrackets = (repairedJson.match(/]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          repairedJson += "]";
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          repairedJson += "}";
        }
        try {
          decision = JSON.parse(repairedJson);
          console.log("[BrowserAgent] JSON repair successful");
        } catch {
          throw parseError;
        }
      }
      console.log("[BrowserAgent] LLM decision:", JSON.stringify(decision, null, 2));
      if (!decision.type && Object.keys(decision).length === 0) {
        return { type: "failed", reason: "LLM returned empty JSON object - retrying" };
      }
      return decision;
    } catch (error) {
      console.error("[BrowserAgent] LLM error:", error);
      return { type: "failed", reason: `LLM error: ${error.message}` };
    }
  }
  /**
   * Execute a single action
   */
  async executeAction(action, context) {
    switch (action.type) {
      case "click":
        return this.click(action.ref);
      case "fill":
        return this.fill(action.ref, action.value);
      case "select":
        return this.select(action.ref, action.value);
      case "hover":
        return this.hover(action.ref);
      case "scroll":
        try {
          await this.execAgentBrowser(["press", action.direction === "down" ? "PageDown" : "PageUp"]);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      case "wait":
        await new Promise((resolve) => setTimeout(resolve, action.seconds * 1e3));
        return { success: true };
      case "navigate":
        try {
          await this.open(action.url);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      case "upload":
        return this.upload(action.ref, context?.documentFilePath);
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  }
  /**
   * Upload a file to a file input element
   */
  async upload(ref, filePath) {
    if (!filePath) {
      return { success: false, error: "No document file available for upload" };
    }
    console.log(`[BrowserAgent] Uploading file to ${ref}: ${filePath}`);
    try {
      const output = await this.execAgentBrowser(["upload", ref, filePath]);
      return { success: true, data: output };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  /**
   * Run a browser automation task
   */
  async runTask(task, context = {}) {
    this.cancelled = false;
    const job = jobManager.createJob("browser-agent", { task, context });
    this.activeJobId = job.id;
    jobManager.startJob(job.id);
    console.log(`[BrowserAgent] Starting task: "${task}"`);
    this.emit(createEvent(EventTypes.AUTOMATION_STARTED, { jobId: job.id, task }));
    const actionHistory = [];
    let actionsExecuted = 0;
    const maxIterations = 30;
    try {
      const urlAfterNavWord = task.match(/(?:go to|navigate to|open|visit|browse to)\s+(https?:\/\/[^\s]+|[^\s]+\.[^\s]+)/i);
      const anyHttpsUrl = task.match(/(https?:\/\/[^\s]+)/i);
      const urlAfterAt = task.match(/\bat\s+(https?:\/\/[^\s]+)/i);
      const extractedUrl = urlAfterNavWord?.[1] || urlAfterAt?.[1] || anyHttpsUrl?.[1] || null;
      let startUrl = context.startUrl;
      if (!startUrl && extractedUrl) {
        startUrl = extractedUrl.startsWith("http") ? extractedUrl : `https://${extractedUrl}`;
      }
      if (!startUrl) {
        startUrl = "https://www.google.com";
      }
      console.log(`[BrowserAgent] Opening browser at: ${startUrl}`);
      await this.open(startUrl);
      await new Promise((resolve) => setTimeout(resolve, 3e3));
      let submitAttempts = 0;
      let previousSnapshotText = "";
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (this.cancelled) {
          jobManager.cancelJob(job.id);
          return {
            success: false,
            state: "cancelled",
            actionsExecuted
          };
        }
        await this.scroll("down");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.scroll("up");
        await new Promise((resolve) => setTimeout(resolve, 500));
        const snapshot = await this.snapshot();
        if (!snapshot.success) {
          jobManager.failJob(job.id, { code: "BROWSER_ERROR", message: snapshot.error || "Snapshot failed" });
          return {
            success: false,
            state: "failed",
            error: snapshot.error || "Failed to get page snapshot",
            actionsExecuted
          };
        }
        const currentSnapshotText = snapshot.data?.snapshot || "";
        if (currentSnapshotText === previousSnapshotText && submitAttempts > 0) {
          submitAttempts++;
          console.log(`[BrowserAgent] Detected same snapshot after submit (attempt ${submitAttempts})`);
          if (submitAttempts >= 3) {
            actionHistory.push("WARNING: Form submission failed 3 times - page unchanged. There are likely unfilled required fields or validation errors. Scroll to find hidden fields.");
          }
        }
        previousSnapshotText = currentSnapshotText;
        const decision = await this.decideNextActions(snapshot, task, context, actionHistory);
        if (decision.type === "completed") {
          jobManager.completeJob(job.id, { reason: decision.reason });
          await this.close();
          return {
            success: true,
            state: "completed",
            reason: decision.reason,
            actionsExecuted
          };
        }
        if (decision.type === "needs_input") {
          jobManager.transitionJob(job.id, "needs_input");
          return {
            success: false,
            state: "needs_input",
            reason: decision.reason,
            message: decision.message,
            actionsExecuted
          };
        }
        if (decision.type === "failed") {
          jobManager.failJob(job.id, { code: "TASK_FAILED", message: decision.reason });
          await this.close();
          return {
            success: false,
            state: "failed",
            error: decision.reason,
            actionsExecuted
          };
        }
        let actionsToExecute = [];
        if (decision.type === "actions" && decision.actions.length > 0) {
          actionsToExecute = decision.actions;
        } else if ("url" in decision || "ref" in decision || "direction" in decision || "seconds" in decision) {
          actionsToExecute = [decision];
        }
        if (actionsToExecute.length > 0) {
          for (const action of actionsToExecute) {
            if (this.cancelled) break;
            const actionStr = JSON.stringify(action);
            console.log(`[BrowserAgent] Executing: ${actionStr}`);
            const result = await this.executeAction(action, context);
            actionsExecuted++;
            actionHistory.push(`${actionStr} → ${result.success ? "OK" : result.error}`);
            if (action.type === "click" && result.success) {
              const refLower = (action.ref || "").toLowerCase();
              if (refLower.includes("submit") || actionStr.toLowerCase().includes("submit")) {
                submitAttempts++;
                console.log(`[BrowserAgent] Submit click detected (attempt ${submitAttempts})`);
              }
            }
            this.emit(
              createEvent(EventTypes.AUTOMATION_STEP, {
                jobId: job.id,
                action: actionStr,
                success: result.success
              })
            );
            if (!result.success) {
              console.warn(`[BrowserAgent] Action failed: ${result.error}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
      jobManager.failJob(job.id, { code: "MAX_ITERATIONS", message: "Max iterations reached" });
      await this.close();
      return {
        success: false,
        state: "failed",
        error: "Max iterations reached without completing task",
        actionsExecuted
      };
    } catch (error) {
      const errorMsg = error.message;
      console.error("[BrowserAgent] Task error:", errorMsg);
      jobManager.failJob(job.id, { code: "BROWSER_ERROR", message: errorMsg });
      await this.close();
      return {
        success: false,
        state: "failed",
        error: errorMsg,
        actionsExecuted
      };
    } finally {
      this.activeJobId = null;
    }
  }
  /**
   * Cancel the current task
   */
  cancel() {
    this.cancelled = true;
    if (this.activeJobId) {
      jobManager.cancelJob(this.activeJobId);
    }
  }
  /**
   * Check if a task is running
   */
  isRunning() {
    return this.activeJobId !== null;
  }
  /**
   * Check if the service is available
   */
  async isAvailable() {
    const cerebrasKey = await secretsService.getCerebrasKey();
    if (cerebrasKey) return true;
    const openaiKey = await secretsService.getOpenAIKey();
    return !!openaiKey;
  }
}
const browserAgentService = new BrowserAgentService();
class SettingsService {
  eventEmitter = null;
  changeListeners = /* @__PURE__ */ new Map();
  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event to the renderer
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Get a setting value
   */
  get(key) {
    return storeService.getSettingOrDefault(key);
  }
  /**
   * Get a boolean setting
   */
  getBoolean(key) {
    const value = this.get(key);
    return value === "true";
  }
  /**
   * Get a number setting
   */
  getNumber(key) {
    const value = this.get(key);
    return parseInt(value, 10);
  }
  /**
   * Set a setting value
   */
  set(key, value) {
    const previousValue = storeService.getSetting(key);
    storeService.setSetting(key, value);
    this.emit(
      createEvent(EventTypes.SETTINGS_CHANGED, {
        key,
        previousValue,
        value
      })
    );
    const listeners = this.changeListeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }
    console.log(`[SettingsService] Setting changed: ${key} = ${value}`);
  }
  /**
   * Set a boolean setting
   */
  setBoolean(key, value) {
    this.set(key, value ? "true" : "false");
  }
  /**
   * Set a number setting
   */
  setNumber(key, value) {
    this.set(key, String(value));
  }
  /**
   * Get all settings as a structured object
   */
  getAll() {
    return {
      hotkey: {
        pushToTalk: this.get("hotkey.pushToTalk")
      },
      transforms: {
        urlClean: { enabled: this.getBoolean("transforms.urlClean.enabled") },
        urlMarkdown: { enabled: this.getBoolean("transforms.urlMarkdown.enabled") },
        jsonPretty: { enabled: this.getBoolean("transforms.jsonPretty.enabled") },
        jsonMinify: { enabled: this.getBoolean("transforms.jsonMinify.enabled") },
        jsonToYaml: { enabled: this.getBoolean("transforms.jsonToYaml.enabled") },
        yamlToJson: { enabled: this.getBoolean("transforms.yamlToJson.enabled") },
        extractEmails: { enabled: this.getBoolean("transforms.extractEmails.enabled") },
        extractLinks: { enabled: this.getBoolean("transforms.extractLinks.enabled") },
        redactSecrets: { enabled: this.getBoolean("transforms.redactSecrets.enabled") }
      },
      ui: {
        theme: this.get("ui.theme")
      },
      audio: {
        minCaptureDuration: this.getNumber("audio.minCaptureDuration"),
        inputDevice: this.get("audio.inputDevice")
      }
    };
  }
  /**
   * Get all settings as flat key-value pairs
   */
  getAllFlat() {
    return storeService.getAllSettings();
  }
  /**
   * Reset a setting to its default value
   */
  reset(key) {
    const defaultValue = DEFAULT_SETTINGS[key];
    this.set(key, defaultValue);
  }
  /**
   * Reset all settings to defaults
   */
  resetAll() {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.set(key, value);
    }
  }
  /**
   * Register a listener for setting changes
   */
  onChange(key, listener) {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, /* @__PURE__ */ new Set());
    }
    this.changeListeners.get(key).add(listener);
    return () => {
      const listeners = this.changeListeners.get(key);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }
  /**
   * Check if a transform is enabled
   */
  isTransformEnabled(transformKey) {
    const key = `transforms.${transformKey}.enabled`;
    return this.getBoolean(key);
  }
}
const settingsService = new SettingsService();
const execAsync = util.promisify(child_process.exec);
function commandExists(command) {
  try {
    const result = child_process.execSync(`which ${command}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}
async function getVersion(binaryPath) {
  try {
    const { stdout } = await execAsync(`"${binaryPath}" --version`, {
      timeout: 5e3
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
async function detectOpenCode() {
  const binaryNames = ["opencode", "oc"];
  for (const name of binaryNames) {
    const path2 = commandExists(name);
    if (path2) {
      const version = await getVersion(path2);
      return {
        installed: true,
        binaryPath: path2,
        version: version ?? void 0
      };
    }
  }
  const commonPaths = [
    "/usr/local/bin/opencode",
    "/opt/homebrew/bin/opencode",
    `${process.env.HOME}/.local/bin/opencode`,
    `${process.env.HOME}/.npm-global/bin/opencode`
  ];
  for (const path2 of commonPaths) {
    try {
      child_process.execSync(`test -x "${path2}"`, { stdio: "pipe" });
      const version = await getVersion(path2);
      return {
        installed: true,
        binaryPath: path2,
        version: version ?? void 0
      };
    } catch {
    }
  }
  return {
    installed: false,
    error: "OpenCode CLI not found. Install it with: npm install -g opencode"
  };
}
function detectOpenCodeSync() {
  const binaryNames = ["opencode", "oc"];
  for (const name of binaryNames) {
    const path2 = commandExists(name);
    if (path2) {
      return { installed: true, binaryPath: path2 };
    }
  }
  return {
    installed: false,
    error: "OpenCode CLI not found. Install it with: npm install -g opencode"
  };
}
function getInstallationInstructions() {
  return `
OpenCode CLI is not installed.

Installation options:

1. Using npm (recommended):
   npm install -g opencode

2. Using Homebrew (macOS):
   brew install opencode

3. Manual installation:
   Visit https://opencode.ai for download links

After installation, restart ClipMorph or run a new voice command.
`.trim();
}
class OpenCodeSidecar extends events.EventEmitter {
  state = "ready";
  ptyProcess = null;
  outputBuffer = "";
  taskTimeout = null;
  binaryPath;
  timeout;
  permissionApproved = false;
  shell;
  constructor(config = {}) {
    super();
    const detection = detectOpenCodeSync();
    this.binaryPath = config.binaryPath || detection.binaryPath || "opencode";
    this.timeout = config.timeout || 12e4;
    this.shell = process.env.SHELL || "/bin/bash";
  }
  getState() {
    return this.state;
  }
  isReady() {
    return this.state === "ready";
  }
  isBusy() {
    return this.state === "busy";
  }
  async runTask(request) {
    if (this.state === "busy") {
      throw new Error("Sidecar is busy with another task");
    }
    const detection = detectOpenCodeSync();
    if (!detection.installed) {
      const error = new Error(getInstallationInstructions());
      error.code = "OPENCODE_NOT_INSTALLED";
      throw error;
    }
    this.state = "busy";
    this.emit("state", this.state);
    this.outputBuffer = "";
    this.permissionApproved = false;
    const startTime = Date.now();
    console.log("[OpenCode Sidecar] runTask called with prompt:", request.prompt.slice(0, 100));
    const selectedProvider = settingsService.get("opencode.provider") || "anthropic";
    console.log("[OpenCode Sidecar] Provider for auth:", selectedProvider);
    const opencodeConfigDir = path__namespace.join(electron.app.getPath("userData"), "opencode-config");
    console.log("[OpenCode Sidecar] Configuring auth in:", opencodeConfigDir);
    try {
      await this.configureOpenCodeAuth(opencodeConfigDir, selectedProvider);
      console.log("[OpenCode Sidecar] Auth configured successfully");
    } catch (authError) {
      console.error("[OpenCode Sidecar] Auth configuration failed:", authError);
    }
    return new Promise((resolve, reject) => {
      this.taskTimeout = setTimeout(() => {
        this.cancelTask();
        reject(new Error(`Task timeout after ${this.timeout}ms`));
      }, this.timeout);
      try {
        const escapedPrompt = request.prompt.replace(/'/g, "'\\''");
        let command = `'${escapedPrompt}'`;
        if (request.context) {
          const escapedContext = request.context.replace(/'/g, "'\\''");
          command += ` --context '${escapedContext}'`;
        }
        const args = ["run", request.prompt];
        const opencodeModel = settingsService.get("opencode.model");
        if (opencodeModel && opencodeModel.startsWith("opencode/")) {
          args.push("--model", opencodeModel);
          console.log("[OpenCode] Using model:", opencodeModel);
        } else {
          console.log("[OpenCode] Using default model (settings model not compatible:", opencodeModel, ")");
        }
        console.log("[OpenCode] ========== SPAWNING OPENCODE ==========");
        console.log("[OpenCode] Binary:", this.binaryPath);
        console.log("[OpenCode] Args:", JSON.stringify(args));
        console.log("[OpenCode] Working directory:", request.cwd || process.cwd());
        console.log("[OpenCode] Config dir:", opencodeConfigDir);
        if (!fs__namespace.existsSync(this.binaryPath)) {
          throw new Error(`OpenCode binary not found at: ${this.binaryPath}`);
        }
        console.log("[OpenCode] Binary exists, spawning PTY...");
        this.ptyProcess = pty__namespace.spawn(this.binaryPath, args, {
          name: "xterm-256color",
          cols: 120,
          rows: 30,
          cwd: request.cwd || process.cwd(),
          env: {
            ...process.env,
            // Don't set CI=true - we want interactive mode for permission handling
            NO_COLOR: "1",
            // Disable ANSI colors for cleaner output
            TERM: "xterm-256color",
            // Override OpenCode's config directory to avoid ~/.config permission issues
            XDG_CONFIG_HOME: opencodeConfigDir,
            OPENCODE_CONFIG_DIR: opencodeConfigDir
          }
        });
        console.log("[OpenCode] PTY process spawned with PID:", this.ptyProcess.pid);
        this.ptyProcess.onData((data) => {
          this.outputBuffer += data;
          const cleanData = data.replace(/\x1b\[[0-9;]*m/g, "").trim();
          if (cleanData) {
            console.log("[OpenCode OUTPUT]", cleanData);
          } else if (data.trim()) {
            console.log("[OpenCode RAW]", JSON.stringify(data.slice(0, 200)));
          }
          if (this.outputBuffer.includes("Permission required:") && this.outputBuffer.includes("Allow once") && !this.outputBuffer.includes("Rejected")) {
            if (!this.permissionApproved) {
              this.permissionApproved = true;
              console.log("[OpenCode] Auto-approving permission prompt...");
              setTimeout(() => {
                if (this.ptyProcess) {
                  this.ptyProcess.write("\r");
                  console.log("[OpenCode] Sent Enter for permission approval");
                }
              }, 100);
            }
          }
          const chunk = {
            type: "stdout",
            // PTY combines stdout/stderr
            data,
            timestamp: Date.now()
          };
          this.emit("output", chunk);
          const accessError = this.detectAccessError(data);
          if (accessError) {
            this.emit("accessError", accessError);
          }
          const permissionRequest = this.detectPermissionPrompt(this.outputBuffer);
          if (permissionRequest) {
            this.emit("permissionRequest", permissionRequest);
          }
        });
        this.ptyProcess.onExit(({ exitCode, signal }) => {
          this.clearTaskTimeout();
          const durationMs = Date.now() - startTime;
          const success = exitCode === 0;
          console.log("[OpenCode] ========== PROCESS EXITED ==========");
          console.log(`[OpenCode] Exit code: ${exitCode}, Signal: ${signal}, Duration: ${durationMs}ms`);
          console.log("[OpenCode] Total output length:", this.outputBuffer.length);
          if (!success && this.outputBuffer) {
            console.log("[OpenCode] Last 500 chars of output:", this.outputBuffer.slice(-500));
          }
          const result = {
            success,
            output: this.outputBuffer,
            exitCode,
            durationMs,
            error: success ? void 0 : `Process exited with code ${exitCode}`
          };
          this.emit("taskCompleted", result);
          this.emit("exit", { code: exitCode, signal });
          this.cleanup();
          this.state = "ready";
          this.emit("state", this.state);
          resolve(result);
        });
        this.emit("taskStarted", request);
      } catch (error) {
        this.clearTaskTimeout();
        this.cleanup();
        this.state = "error";
        this.emit("state", this.state);
        this.emit("error", error);
        reject(error);
      }
    });
  }
  /**
   * Write input to the PTY (for handling interactive prompts)
   */
  write(data) {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }
  /**
   * Resize the PTY terminal
   */
  resize(cols, rows) {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }
  cancelTask() {
    if (this.ptyProcess) {
      this.clearTaskTimeout();
      this.ptyProcess.kill("SIGTERM");
      setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.kill("SIGKILL");
        }
      }, 500);
    }
  }
  async stop() {
    if (this.state === "stopped") return;
    this.cancelTask();
    this.cleanup();
    this.state = "stopped";
    this.emit("state", this.state);
  }
  clearTaskTimeout() {
    if (this.taskTimeout) {
      clearTimeout(this.taskTimeout);
      this.taskTimeout = null;
    }
  }
  cleanup() {
    this.clearTaskTimeout();
    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {
      }
      this.ptyProcess = null;
    }
    this.outputBuffer = "";
    this.lastPermissionPrompt = "";
    this.permissionApproved = false;
  }
  lastPermissionPrompt = "";
  /**
   * Configure OpenCode authentication by writing API key to auth.json
   * Maps provider names to OpenCode's expected format
   */
  async configureOpenCodeAuth(configDir, provider) {
    try {
      const providerMap = {
        "anthropic": "anthropic",
        "openai": "openai",
        "google": "google",
        "xai": "x-ai",
        "zai": "z-ai"
      };
      const opencodeProvider = providerMap[provider] || provider;
      const secretKey = `${provider}-api-key`;
      const apiKey = await secretsService.getSecret(secretKey);
      if (!apiKey) {
        console.warn(`[OpenCode] No API key found for provider: ${provider}`);
        return;
      }
      if (!fs__namespace.existsSync(configDir)) {
        fs__namespace.mkdirSync(configDir, { recursive: true });
      }
      const authFilePath = path__namespace.join(configDir, "auth.json");
      let authData = {};
      if (fs__namespace.existsSync(authFilePath)) {
        try {
          const content = fs__namespace.readFileSync(authFilePath, "utf-8");
          authData = JSON.parse(content);
        } catch (err) {
          console.warn("[OpenCode] Failed to parse existing auth.json, creating new one");
        }
      }
      authData[opencodeProvider] = {
        apiKey
      };
      fs__namespace.writeFileSync(authFilePath, JSON.stringify(authData, null, 2), "utf-8");
      console.log(`[OpenCode] Configured API key for provider: ${opencodeProvider}`);
    } catch (err) {
      console.error("[OpenCode] Failed to configure authentication:", err);
    }
  }
  /**
   * Detect permission prompts in OpenCode output
   * Returns parsed permission request or null if not a permission prompt
   */
  detectPermissionPrompt(output) {
    const patterns = [
      // File operations: "Create file src/utils/helper.ts? [y/n]"
      /(?:Create|Write|Overwrite|Delete|Remove|Modify|Edit|Update)\s+(?:file\s+)?['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Directory operations: "Create directory src/components? [y/n]"
      /(?:Create|Delete|Remove)\s+(?:directory|folder|dir)\s+['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Shell commands: "Run command: npm install? [y/n]"
      /(?:Run|Execute)\s+(?:command|shell)?\s*:?\s*['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // Generic: "Allow X? [y/n]" or "Proceed with X? [y/n]"
      /(?:Allow|Proceed with|Confirm|Approve)\s+['"`]?([^'"`?\n]+)['"`]?\s*\??\s*\[([yYnN]\/[yYnN])\]/i,
      // OpenCode specific: "Tool call: write_file(...)" followed by approval prompt
      /Tool\s+(?:call|request):\s*(\w+)\s*\([^)]*\)[^\[]*\[([yYnN]\/[yYnN])\]/i,
      // Simple y/n at end of line with context
      /([^\n]{10,})\s*\[([yYnN]\/[yYnN])\]\s*$/i
    ];
    const lines = output.split("\n");
    const recentOutput = lines.slice(-10).join("\n");
    if (this.lastPermissionPrompt && recentOutput.includes(this.lastPermissionPrompt)) {
      return null;
    }
    for (const pattern of patterns) {
      const match = recentOutput.match(pattern);
      if (match) {
        const action = match[1]?.trim() || "Unknown action";
        let type = "other";
        const lowerOutput = recentOutput.toLowerCase();
        if (lowerOutput.includes("create") || lowerOutput.includes("write") || lowerOutput.includes("modify")) {
          type = "file_write";
        } else if (lowerOutput.includes("delete") || lowerOutput.includes("remove")) {
          type = "file_delete";
        } else if (lowerOutput.includes("run") || lowerOutput.includes("execute") || lowerOutput.includes("command")) {
          type = "shell_command";
        }
        this.lastPermissionPrompt = action;
        return {
          type,
          action,
          context: recentOutput.trim(),
          timestamp: Date.now()
        };
      }
    }
    return null;
  }
  /**
   * Detect access/permission errors in OpenCode output
   */
  detectAccessError(output) {
    if (output.includes("EACCES") || output.includes("EPERM") || output.includes("permission denied") || output.includes("operation not permitted")) {
      if (output.includes(".config/opencode") || output.includes(".config")) {
        return {
          type: "permission_denied",
          message: "Cannot access ~/.config directory (owned by root)",
          fix: "Open Terminal and run: sudo chown -R $(whoami) ~/.config"
        };
      }
      return {
        type: "permission_denied",
        message: "Permission denied",
        fix: "Check file/directory permissions"
      };
    }
    if (output.includes("API key") || output.includes("ANTHROPIC_API_KEY") || output.includes("OPENAI_API_KEY") || output.includes("unauthorized") || output.includes("401")) {
      return {
        type: "api_key_missing",
        message: "OpenCode API key not configured",
        fix: "Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable, or configure in OpenCode settings"
      };
    }
    if (output.includes("not configured") || output.includes("missing configuration")) {
      return {
        type: "not_configured",
        message: "OpenCode is not configured",
        fix: 'Run "opencode" in terminal to complete setup'
      };
    }
    return null;
  }
}
class OpenCodeService extends events.EventEmitter {
  sidecar;
  activeJob = null;
  recentJobs = [];
  maxRecentJobs = 10;
  constructor() {
    super();
    this.sidecar = new OpenCodeSidecar();
    this.setupSidecarListeners();
  }
  setupSidecarListeners() {
    this.sidecar.on("output", (chunk) => {
      if (this.activeJob) {
        this.activeJob.output += chunk.data;
        this.activeJob.updatedAt = Date.now();
        const payload = {
          jobId: this.activeJob.id,
          chunk: {
            ...chunk,
            jobId: this.activeJob.id
          }
        };
        this.emit("event", createEvent(EventTypes.OPENCODE_OUTPUT, payload, this.activeJob.id));
        console.log("[OpenCodeService] Emitted OPENCODE_OUTPUT event, chunk size:", chunk.data.length);
      }
    });
    this.sidecar.on("permissionRequest", (request) => {
      if (this.activeJob) {
        console.log("[OpenCodeService] Permission request detected:", request);
        const payload = {
          jobId: this.activeJob.id,
          type: request.type,
          action: request.action,
          context: request.context
        };
        this.emit("event", createEvent(EventTypes.OPENCODE_PERMISSION_REQUEST, payload, this.activeJob.id));
      }
    });
    this.sidecar.on("accessError", (error) => {
      console.log("[OpenCodeService] Access error detected:", error);
      if (this.activeJob) {
        const payload = {
          jobId: this.activeJob.id,
          error: `${error.message}${error.fix ? `

Fix: ${error.fix}` : ""}`
        };
        this.emit("event", createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id));
        this.emit("event", createEvent("opencode-access-error", {
          jobId: this.activeJob.id,
          type: error.type,
          message: error.message,
          fix: error.fix
        }, this.activeJob.id));
      }
    });
    this.sidecar.on("taskCompleted", (result) => {
      if (this.activeJob) {
        this.activeJob.result = result;
        this.activeJob.status = result.success ? "completed" : "failed";
        this.activeJob.error = result.error;
        this.activeJob.updatedAt = Date.now();
        if (result.success) {
          const payload = {
            jobId: this.activeJob.id,
            result
          };
          this.emit(
            "event",
            createEvent(EventTypes.OPENCODE_COMPLETED, payload, this.activeJob.id)
          );
        } else {
          const payload = {
            jobId: this.activeJob.id,
            error: result.error || "Task failed"
          };
          this.emit("event", createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id));
        }
        this.archiveJob(this.activeJob);
        this.activeJob = null;
      }
    });
    this.sidecar.on("error", (error) => {
      if (this.activeJob) {
        this.activeJob.status = "failed";
        this.activeJob.error = error.message;
        this.activeJob.updatedAt = Date.now();
        const payload = {
          jobId: this.activeJob.id,
          error: error.message
        };
        this.emit("event", createEvent(EventTypes.OPENCODE_FAILED, payload, this.activeJob.id));
        this.archiveJob(this.activeJob);
        this.activeJob = null;
      }
    });
  }
  archiveJob(job) {
    this.recentJobs.unshift(job);
    if (this.recentJobs.length > this.maxRecentJobs) {
      this.recentJobs.pop();
    }
  }
  async getState() {
    const detection = await detectOpenCode();
    const sidecarState = this.sidecar.getState();
    let state;
    switch (sidecarState) {
      case "stopped":
        state = "stopped";
        break;
      case "ready":
        state = "ready";
        break;
      case "busy":
        state = "busy";
        break;
      case "error":
        state = "error";
        break;
      default:
        state = "stopped";
    }
    return {
      state,
      installed: detection.installed,
      binaryPath: detection.binaryPath,
      version: detection.version,
      activeJobId: this.activeJob?.id,
      installInstructions: detection.installed ? void 0 : getInstallationInstructions()
    };
  }
  async detect() {
    const detection = await detectOpenCode();
    return {
      ...detection,
      installInstructions: getInstallationInstructions()
    };
  }
  async runTask(request) {
    if (this.activeJob) {
      throw new Error("OpenCode is busy with another task");
    }
    const detection = await detectOpenCode();
    if (!detection.installed) {
      const error = new Error(getInstallationInstructions());
      error.code = "OPENCODE_NOT_INSTALLED";
      throw error;
    }
    const job = {
      id: crypto.randomUUID(),
      status: "pending",
      prompt: request.prompt,
      context: request.context,
      cwd: request.cwd,
      output: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.activeJob = job;
    const startPayload = {
      jobId: job.id,
      prompt: request.prompt
    };
    this.emit("event", createEvent(EventTypes.OPENCODE_STARTED, startPayload, job.id));
    job.status = "running";
    job.updatedAt = Date.now();
    const taskRequest = {
      prompt: request.prompt,
      context: request.context,
      cwd: request.cwd
    };
    console.log("[OpenCodeService] Starting sidecar.runTask...");
    this.sidecar.runTask(taskRequest).then((result) => {
      console.log("[OpenCodeService] Sidecar task completed:", result.success ? "success" : "failed");
    }).catch((error) => {
      console.error("[OpenCodeService] Sidecar task error:", error.message);
      if (this.activeJob && this.activeJob.id === job.id) {
        this.activeJob.status = "failed";
        this.activeJob.error = error.message;
        this.activeJob.updatedAt = Date.now();
        const payload = {
          jobId: job.id,
          error: error.message
        };
        this.emit("event", createEvent(EventTypes.OPENCODE_FAILED, payload, job.id));
        this.archiveJob(this.activeJob);
        this.activeJob = null;
      }
    });
    return { jobId: job.id, started: true };
  }
  /**
   * Write input to the active task (for handling permission prompts)
   */
  writeInput(input) {
    this.sidecar.write(input);
  }
  /**
   * Respond to a permission request from OpenCode
   */
  respondToPermission(allow) {
    this.sidecar.write(allow ? "y\n" : "n\n");
  }
  cancel() {
    if (!this.activeJob) {
      return { cancelled: false };
    }
    const jobId = this.activeJob.id;
    this.activeJob.status = "cancelled";
    this.activeJob.updatedAt = Date.now();
    this.sidecar.cancelTask();
    const payload = { jobId };
    this.emit("event", createEvent(EventTypes.OPENCODE_CANCELLED, payload, jobId));
    this.archiveJob(this.activeJob);
    this.activeJob = null;
    return { cancelled: true, jobId };
  }
  getActiveJob() {
    return this.activeJob;
  }
  getRecentJobs() {
    return [...this.recentJobs];
  }
  async dispose() {
    await this.sidecar.stop();
  }
}
let serviceInstance = null;
function getOpenCodeService() {
  if (!serviceInstance) {
    serviceInstance = new OpenCodeService();
  }
  return serviceInstance;
}
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }
  const yaml = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();
  const result = {};
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const modelMatch = yaml.match(/^model:\s*(.+)$/m);
  if (modelMatch) {
    result.model = modelMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const tempMatch = yaml.match(/^temperature:\s*(.+)$/m);
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1].trim());
    if (!isNaN(temp)) {
      result.temperature = temp;
    }
  }
  const triggerMatch = yaml.match(/^triggers:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (triggerMatch) {
    result.triggers = triggerMatch[1].split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter((trigger) => trigger.length > 0);
  }
  return { frontmatter: result, body };
}
class SubagentService extends events.EventEmitter {
  subagents = /* @__PURE__ */ new Map();
  projectRoot = process.cwd();
  lastDiscovery = 0;
  /**
   * Get the config directory path
   */
  getConfigDir() {
    return path.join(this.projectRoot, ".clipmorph", "subagents");
  }
  /**
   * Set the project root directory
   */
  setProjectRoot(root) {
    this.projectRoot = root;
  }
  /**
   * Get directories to scan for subagent definitions
   */
  getSubagentDirectories() {
    return [
      // Project-local subagents (primary)
      this.getConfigDir(),
      // Global subagents
      path.join(os.homedir(), ".clipmorph", "subagents"),
      // Also check .opencode/agent for compatibility
      path.join(this.projectRoot, ".opencode", "agent"),
      path.join(os.homedir(), ".config", "opencode", "agent")
    ];
  }
  /**
   * Parse a subagent file
   */
  async parseSubagentFile(filePath) {
    try {
      const content = await promises.readFile(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      const fileStat = await promises.stat(filePath);
      const id = path.basename(filePath, ".md");
      return {
        id,
        name: frontmatter.name || id,
        description: frontmatter.description || `Custom subagent: ${id}`,
        triggers: frontmatter.triggers || [],
        systemPrompt: body,
        model: frontmatter.model,
        temperature: frontmatter.temperature,
        filePath,
        lastModified: fileStat.mtimeMs
      };
    } catch (err) {
      console.warn(`[SubagentService] Failed to parse subagent file ${filePath}:`, err);
      return null;
    }
  }
  /**
   * Discover all available subagents
   */
  async discover(forceReload = false) {
    const previousSubagents = new Map(this.subagents);
    const errors = [];
    let newCount = 0;
    let updatedCount = 0;
    if (forceReload) {
      this.subagents.clear();
    }
    const directories = this.getSubagentDirectories();
    for (const dirPath of directories) {
      try {
        const dirStat = await promises.stat(dirPath).catch(() => null);
        if (!dirStat?.isDirectory()) {
          continue;
        }
        const files = await promises.readdir(dirPath);
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        for (const file of mdFiles) {
          const filePath = path.join(dirPath, file);
          try {
            const subagent = await this.parseSubagentFile(filePath);
            if (subagent) {
              const existing = previousSubagents.get(subagent.id);
              if (!existing) {
                newCount++;
              } else if (existing.lastModified !== subagent.lastModified) {
                updatedCount++;
              }
              this.subagents.set(subagent.id, subagent);
            }
          } catch (err) {
            errors.push({
              file: filePath,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      } catch {
      }
    }
    this.lastDiscovery = Date.now();
    console.log(
      `[SubagentService] Discovered ${this.subagents.size} subagents (${newCount} new, ${updatedCount} updated)`
    );
    return {
      subagents: Array.from(this.subagents.values()),
      newCount,
      updatedCount,
      errors
    };
  }
  /**
   * List all subagents
   */
  async list() {
    if (this.lastDiscovery === 0) {
      await this.discover();
    }
    const configDir = this.getConfigDir();
    let configDirExists = false;
    try {
      const dirStat = await promises.stat(configDir);
      configDirExists = dirStat.isDirectory();
    } catch {
      configDirExists = false;
    }
    return {
      subagents: Array.from(this.subagents.values()),
      configDir,
      configDirExists
    };
  }
  /**
   * Get a subagent by ID
   */
  get(id) {
    return this.subagents.get(id);
  }
  /**
   * Find a subagent by name (case-insensitive)
   */
  findByName(name) {
    const lowerName = name.toLowerCase();
    return Array.from(this.subagents.values()).find(
      (s) => s.name.toLowerCase() === lowerName || s.id.toLowerCase() === lowerName
    );
  }
  /**
   * Find subagents by trigger phrase
   */
  findByTrigger(phrase) {
    const lowerPhrase = phrase.toLowerCase();
    return Array.from(this.subagents.values()).find(
      (s) => s.triggers.some((t) => lowerPhrase.includes(t.toLowerCase()))
    );
  }
  /**
   * Get all trigger phrases for voice matching
   */
  getAllTriggers() {
    const triggers = [];
    for (const subagent of this.subagents.values()) {
      for (const trigger of subagent.triggers) {
        triggers.push({ trigger, subagentId: subagent.id });
      }
    }
    return triggers;
  }
  /**
   * Check if a subagent exists
   */
  has(id) {
    return this.subagents.has(id);
  }
  /**
   * Get subagent names for voice matching
   */
  getNames() {
    return Array.from(this.subagents.values()).map((s) => s.name);
  }
  /**
   * Create the config directory if it doesn't exist
   */
  async ensureConfigDir() {
    const configDir = this.getConfigDir();
    try {
      await promises.mkdir(configDir, { recursive: true });
    } catch {
    }
    return configDir;
  }
  /**
   * Create a sample subagent file
   */
  async createSampleSubagent() {
    const configDir = await this.ensureConfigDir();
    const samplePath = path.join(configDir, "example-agent.md");
    const sampleContent = `---
name: Example Agent
description: A sample subagent to demonstrate the format
triggers:
  - ask example
  - use example agent
model: claude-3-5-sonnet
temperature: 0.7
---

You are a helpful assistant that demonstrates the subagent format.

When the user asks you something, respond helpfully and concisely.

## Guidelines

- Be concise and helpful
- Use markdown formatting when appropriate
- If you don't know something, say so
`;
    await promises.writeFile(samplePath, sampleContent, "utf-8");
    console.log(`[SubagentService] Created sample subagent at ${samplePath}`);
    await this.discover(true);
    return samplePath;
  }
}
const subagentService = new SubagentService();
const STAGE_PROMPTS = {
  plan: (task) => `
You are a software architect. Create a detailed implementation plan for the following task.

## Task
${task}

## Instructions
1. Break down the task into clear, actionable steps
2. Identify key components, files, and functions needed
3. Note any potential challenges or edge cases
4. Suggest a testing strategy
5. Keep the plan concise but comprehensive

Output a structured plan that a developer can follow to implement this task.
`,
  code: (task, previousOutput) => `
You are a senior software developer. Implement the following task based on the provided plan.

## Original Task
${task}

## Implementation Plan
${previousOutput || "No plan provided - implement based on best practices."}

## Instructions
1. Write clean, well-documented code
2. Follow the plan's structure and recommendations
3. Include error handling and edge cases
4. Add inline comments for complex logic
5. Keep code modular and testable

Implement the code following the plan above.
`,
  review: (task, previousOutput) => `
You are a code reviewer. Review the following implementation for quality, correctness, and best practices.

## Original Task
${task}

## Implementation to Review
${previousOutput || "No implementation provided."}

## Instructions
1. Check for bugs, logic errors, and edge cases
2. Evaluate code quality and readability
3. Verify error handling is adequate
4. Suggest improvements if needed
5. Note any security concerns

Provide a thorough code review with specific feedback and recommendations.
`
};
class WorkflowService extends events.EventEmitter {
  eventEmitter = null;
  activeJob = null;
  recentJobs = [];
  maxRecentJobs = 10;
  /**
   * Set the event emitter for broadcasting events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Start a new workflow
   */
  async startWorkflow(request) {
    if (this.activeJob && !this.isTerminal(this.activeJob)) {
      throw new Error("A workflow is already in progress. Cancel it first.");
    }
    const stages = request.stages || ["plan", "code", "review"];
    const now = Date.now();
    const job = {
      id: crypto.randomUUID(),
      type: "workflow",
      status: "pending",
      createdAt: now,
      updatedAt: now,
      stages,
      currentStage: null,
      currentStageIndex: -1,
      stageResults: [],
      prompt: request.prompt,
      context: request.context,
      atCheckpoint: false
    };
    this.activeJob = job;
    this.emit(
      createEvent(EventTypes.WORKFLOW_STARTED, { job })
    );
    console.log(`[WorkflowService] Started workflow ${job.id} with stages: ${stages.join(" → ")}`);
    await this.runNextStage();
    return { job: this.activeJob };
  }
  /**
   * Run the next stage in the workflow
   */
  async runNextStage() {
    if (!this.activeJob) return;
    const nextIndex = this.activeJob.currentStageIndex + 1;
    if (nextIndex >= this.activeJob.stages.length) {
      await this.completeWorkflow();
      return;
    }
    const stage = this.activeJob.stages[nextIndex];
    this.activeJob.currentStage = stage;
    this.activeJob.currentStageIndex = nextIndex;
    this.activeJob.status = "running";
    this.activeJob.atCheckpoint = false;
    this.activeJob.updatedAt = Date.now();
    this.emit(
      createEvent(EventTypes.WORKFLOW_STAGE_STARTED, {
        jobId: this.activeJob.id,
        stage,
        stageIndex: nextIndex
      })
    );
    console.log(`[WorkflowService] Running stage ${nextIndex + 1}/${this.activeJob.stages.length}: ${stage}`);
    const previousOutput = this.activeJob.stageResults.length > 0 ? this.activeJob.stageResults[this.activeJob.stageResults.length - 1].output : void 0;
    const stagePrompt = STAGE_PROMPTS[stage](this.activeJob.prompt, previousOutput);
    const startTime = Date.now();
    try {
      const openCodeService = getOpenCodeService();
      const result = await openCodeService.runTask({
        prompt: stagePrompt,
        context: this.activeJob.context
      });
      let output = "";
      let completed = false;
      let failed = false;
      let error = "";
      const maxWaitTime = 5 * 60 * 1e3;
      const pollInterval = 500;
      const startPoll = Date.now();
      while (!completed && !failed && Date.now() - startPoll < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        const state = await openCodeService.getState();
        if (state.state === "ready" || state.state === "stopped") {
          completed = true;
          output = `Stage ${stage} completed successfully.`;
        } else if (state.state === "error") {
          failed = true;
          error = "OpenCode task failed";
        }
      }
      if (!completed && !failed) {
        failed = true;
        error = "Stage timed out";
      }
      const endTime = Date.now();
      if (failed) {
        await this.failStage(stage, error, startTime, endTime);
        return;
      }
      const stageResult = {
        stage,
        status: "completed",
        output,
        startedAt: startTime,
        completedAt: endTime
      };
      this.activeJob.stageResults.push(stageResult);
      this.activeJob.updatedAt = Date.now();
      this.emit(
        createEvent(EventTypes.WORKFLOW_STAGE_COMPLETED, {
          jobId: this.activeJob.id,
          stage,
          result: stageResult
        })
      );
      console.log(`[WorkflowService] Stage ${stage} completed in ${endTime - startTime}ms`);
      if (this.activeJob.currentStageIndex >= this.activeJob.stages.length - 1) {
        await this.completeWorkflow();
      } else {
        await this.pauseAtCheckpoint(stageResult);
      }
    } catch (err) {
      const endTime = Date.now();
      await this.failStage(stage, err.message, startTime, endTime);
    }
  }
  /**
   * Pause at a checkpoint for user approval
   */
  async pauseAtCheckpoint(stageResult) {
    if (!this.activeJob) return;
    const nextStage = this.activeJob.stages[this.activeJob.currentStageIndex + 1] || null;
    const message = nextStage ? `Stage "${stageResult.stage}" completed. Approve to proceed to "${nextStage}" stage, or reject to retry/abort.` : `Stage "${stageResult.stage}" completed. This is the final stage.`;
    this.activeJob.status = "needs_input";
    this.activeJob.atCheckpoint = true;
    this.activeJob.checkpointMessage = message;
    this.activeJob.updatedAt = Date.now();
    this.emit(
      createEvent(EventTypes.WORKFLOW_CHECKPOINT, {
        jobId: this.activeJob.id,
        stage: stageResult.stage,
        stageOutput: stageResult.output,
        message,
        nextStage
      })
    );
    console.log(`[WorkflowService] Paused at checkpoint after ${stageResult.stage}`);
  }
  /**
   * Fail a stage
   */
  async failStage(stage, error, startTime, endTime) {
    if (!this.activeJob) return;
    const stageResult = {
      stage,
      status: "failed",
      output: "",
      startedAt: startTime,
      completedAt: endTime,
      error
    };
    this.activeJob.stageResults.push(stageResult);
    this.activeJob.status = "needs_input";
    this.activeJob.atCheckpoint = true;
    this.activeJob.checkpointMessage = `Stage "${stage}" failed: ${error}. Retry or abort?`;
    this.activeJob.updatedAt = Date.now();
    this.emit(
      createEvent(EventTypes.WORKFLOW_STAGE_FAILED, {
        jobId: this.activeJob.id,
        stage,
        error
      })
    );
    console.log(`[WorkflowService] Stage ${stage} failed: ${error}`);
  }
  /**
   * Complete the workflow
   */
  async completeWorkflow() {
    if (!this.activeJob) return;
    this.activeJob.status = "completed";
    this.activeJob.currentStage = null;
    this.activeJob.atCheckpoint = false;
    this.activeJob.updatedAt = Date.now();
    this.addToRecentJobs(this.activeJob);
    this.emit(
      createEvent(EventTypes.WORKFLOW_COMPLETED, {
        job: this.activeJob
      })
    );
    console.log(`[WorkflowService] Workflow ${this.activeJob.id} completed`);
    this.activeJob = null;
  }
  /**
   * Approve the current checkpoint and proceed to next stage
   */
  async approveCheckpoint(request) {
    if (!this.activeJob || this.activeJob.id !== request.jobId) {
      throw new Error(`Workflow not found: ${request.jobId}`);
    }
    if (!this.activeJob.atCheckpoint) {
      throw new Error("Workflow is not at a checkpoint");
    }
    if (request.feedback) {
      this.activeJob.context = (this.activeJob.context || "") + `

User feedback: ${request.feedback}`;
    }
    console.log(`[WorkflowService] Checkpoint approved for ${this.activeJob.id}`);
    await this.runNextStage();
    return { job: this.activeJob };
  }
  /**
   * Reject the current checkpoint
   */
  async rejectCheckpoint(request) {
    if (!this.activeJob || this.activeJob.id !== request.jobId) {
      throw new Error(`Workflow not found: ${request.jobId}`);
    }
    if (!this.activeJob.atCheckpoint) {
      throw new Error("Workflow is not at a checkpoint");
    }
    if (request.action === "abort") {
      return this.cancelWorkflow(request.jobId);
    }
    if (this.activeJob.stageResults.length > 0) {
      this.activeJob.stageResults.pop();
    }
    this.activeJob.currentStageIndex--;
    if (request.feedback) {
      this.activeJob.context = (this.activeJob.context || "") + `

Retry feedback: ${request.feedback}`;
    }
    console.log(`[WorkflowService] Retrying stage for ${this.activeJob.id}`);
    await this.runNextStage();
    return { job: this.activeJob };
  }
  /**
   * Cancel a workflow
   */
  cancelWorkflow(jobId) {
    if (!this.activeJob || this.activeJob.id !== jobId) {
      throw new Error(`Workflow not found: ${jobId}`);
    }
    const cancelledAtStage = this.activeJob.currentStage;
    this.activeJob.status = "cancelled";
    this.activeJob.atCheckpoint = false;
    this.activeJob.updatedAt = Date.now();
    this.addToRecentJobs(this.activeJob);
    this.emit(
      createEvent(EventTypes.WORKFLOW_CANCELLED, {
        jobId,
        cancelledAtStage
      })
    );
    console.log(`[WorkflowService] Workflow ${jobId} cancelled at stage ${cancelledAtStage}`);
    const job = this.activeJob;
    this.activeJob = null;
    return { job };
  }
  /**
   * Get current workflow state
   */
  getState() {
    return {
      activeJob: this.activeJob,
      recentJobs: [...this.recentJobs]
    };
  }
  /**
   * Get a workflow job by ID
   */
  getJob(jobId) {
    if (this.activeJob?.id === jobId) {
      return this.activeJob;
    }
    return this.recentJobs.find((j) => j.id === jobId) || null;
  }
  /**
   * Check if a job is in a terminal state
   */
  isTerminal(job) {
    return ["completed", "failed", "cancelled"].includes(job.status);
  }
  /**
   * Add a job to recent jobs
   */
  addToRecentJobs(job) {
    this.recentJobs.unshift(job);
    if (this.recentJobs.length > this.maxRecentJobs) {
      this.recentJobs.pop();
    }
  }
}
const workflowService = new WorkflowService();
const PREVIEW_EXPIRY_MS = 5 * 60 * 1e3;
const UNDO_EXPIRY_MS = 5 * 60 * 1e3;
const MAX_HISTORY = 20;
const FILE_OP_PROMPTS = {
  // Preview only - just analyze and return JSON
  preview: (prompt, targetDir) => `
You are a file management assistant. Analyze the following request and generate a preview of file operations.

## Request
${prompt}

${targetDir ? `## Target Directory
${targetDir}` : ""}

## Instructions
1. Parse the user's intent (organize, rename, move, delete, copy, find)
2. List the specific files/folders that would be affected
3. For each operation, specify:
   - type: rename | move | delete | copy | organize
   - source: full path
   - destination: full path (for rename/move/copy)
   - destructive: true/false

## Output Format
Return a JSON object with:
{
  "operations": [
    { "type": "rename", "source": "/path/to/file", "destination": "/path/to/newfile", "destructive": false },
    ...
  ],
  "summary": "Human-readable summary of what will happen"
}

IMPORTANT: Only list actual files that exist. Be conservative - when in doubt, ask for clarification.
`,
  // Execute directly - perform the operations and return results
  executeDirectly: (prompt, targetDir) => `
You are a file management assistant. Execute the following file operation request.

## Request
${prompt}

${targetDir ? `## Target Directory
${targetDir}` : ""}

## Instructions
1. Parse the user's intent (organize, rename, move, delete, copy, find)
2. EXECUTE the operations immediately using shell commands (mv, cp, rm, mkdir, etc.)
3. Report what you did

## IMPORTANT
- Actually PERFORM the file operations, don't just list them
- Use 'mv' for rename/move operations
- Use 'cp' for copy operations  
- Use 'rm' for delete operations
- After completing, output a JSON summary

## Output Format (after executing)
Return a JSON object with:
{
  "executed": true,
  "operations": [
    { "type": "rename", "source": "/path/from", "destination": "/path/to", "success": true },
    ...
  ],
  "summary": "Human-readable summary of what was done"
}
`,
  execute: (operations) => `
Execute the following file operations. Be careful and report any errors.

## Operations
${operations}

## Instructions
1. Execute each operation in order using shell commands (mv, cp, rm)
2. Stop immediately if any operation fails
3. Report success/failure for each operation
4. Do NOT proceed if you encounter permission errors

## Output Format
Return a JSON object with:
{
  "results": [
    { "success": true, "operation": { ... } },
    { "success": false, "operation": { ... }, "error": "reason" }
  ]
}
`
};
class FileOperationService extends events.EventEmitter {
  eventEmitter = null;
  previews = /* @__PURE__ */ new Map();
  history = [];
  activeJob = null;
  /**
   * Set the event emitter for broadcasting events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Generate a preview of file operations
   */
  async generatePreview(request) {
    const openCodeService = getOpenCodeService();
    const prompt = FILE_OP_PROMPTS.preview(request.prompt, request.targetDir);
    console.log(`[FileOperationService] Generating preview for: "${request.prompt}"`);
    try {
      const result = await openCodeService.runTask({
        prompt,
        cwd: request.targetDir
      });
      let operations = [];
      let summary = "";
      if (result.output) {
        const jsonMatch = result.output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || result.output.match(/(\{[\s\S]*"operations"[\s\S]*\})/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.operations && Array.isArray(parsed.operations)) {
              operations = parsed.operations.map((op) => ({
                type: op.type,
                source: op.source,
                destination: op.destination,
                destructive: Boolean(op.destructive)
              }));
              summary = parsed.summary || `${operations.length} file operations`;
              console.log(`[FileOperationService] Parsed ${operations.length} operations from OpenCode output`);
            }
          } catch (parseError) {
            console.error("[FileOperationService] Failed to parse JSON from OpenCode:", parseError);
          }
        }
      }
      const now = Date.now();
      const previewId = crypto.randomUUID();
      const hasDestructive = operations.some((op) => op.destructive || op.type === "delete");
      const preview = {
        id: previewId,
        operations,
        fileCount: operations.length,
        folderCount: 0,
        hasDestructive,
        summary: summary || `${operations.length} file operations`,
        prompt: request.prompt,
        createdAt: now,
        expiresAt: now + PREVIEW_EXPIRY_MS
      };
      this.previews.set(previewId, preview);
      this.cleanupExpiredPreviews();
      this.emit(
        createEvent(EventTypes.FILE_OP_PREVIEW_READY, { preview })
      );
      console.log(`[FileOperationService] Preview ${previewId} generated with ${operations.length} operations`);
      return { preview };
    } catch (error) {
      throw new Error(`Failed to generate preview: ${error.message}`);
    }
  }
  /**
   * Execute file operations directly (single OpenCode call - no separate preview)
   * This is the recommended method for non-destructive operations
   */
  async executeDirectly(request) {
    const openCodeService = getOpenCodeService();
    const prompt = FILE_OP_PROMPTS.executeDirectly(request.prompt, request.targetDir);
    console.log(`[FileOperationService] Executing directly: "${request.prompt}"`);
    const now = Date.now();
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      type: "file-operation",
      status: "running",
      createdAt: now,
      updatedAt: now,
      operationType: "rename",
      // Will be updated from result
      previewId: "",
      operations: [],
      successCount: 0,
      failureCount: 0,
      prompt: request.prompt,
      requiredApproval: false
    };
    this.activeJob = job;
    this.emit(
      createEvent(EventTypes.FILE_OP_STARTED, { job })
    );
    try {
      const result = await openCodeService.runTask({
        prompt,
        cwd: request.targetDir,
        autoApprove: true
      });
      let operations = [];
      let summary = "";
      if (result.output) {
        const jsonMatch = result.output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || result.output.match(/(\{[\s\S]*"operations"[\s\S]*\})/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.operations && Array.isArray(parsed.operations)) {
              operations = parsed.operations.map((op) => ({
                type: op.type,
                source: op.source,
                destination: op.destination,
                destructive: Boolean(op.destructive)
              }));
              summary = parsed.summary || `${operations.length} file operations executed`;
              for (const op of parsed.operations) {
                if (op.success !== false) {
                  job.successCount++;
                } else {
                  job.failureCount++;
                }
              }
            }
          } catch (parseError) {
            console.error("[FileOperationService] Failed to parse JSON from OpenCode:", parseError);
          }
        }
      }
      job.operations = operations;
      job.operationType = this.determineOperationType(operations);
      job.status = "completed";
      job.updatedAt = Date.now();
      this.addToHistory(job);
      this.emit(
        createEvent(EventTypes.FILE_OP_COMPLETED, { job })
      );
      console.log(`[FileOperationService] Direct execution completed: ${job.successCount} success, ${job.failureCount} failed`);
      this.activeJob = null;
      return { job };
    } catch (error) {
      job.status = "failed";
      job.error = { code: "FILE_OP_FAILED", message: error.message };
      job.updatedAt = Date.now();
      this.emit(
        createEvent(EventTypes.FILE_OP_FAILED, {
          jobId: job.id,
          error: error.message
        })
      );
      console.error(`[FileOperationService] Direct execution failed:`, error);
      this.activeJob = null;
      throw error;
    }
  }
  /**
   * Execute file operations from a preview
   */
  async execute(request) {
    const preview = this.previews.get(request.previewId);
    if (!preview) {
      throw new Error(`Preview not found: ${request.previewId}`);
    }
    if (Date.now() > preview.expiresAt) {
      this.previews.delete(request.previewId);
      throw new Error("Preview has expired. Please generate a new preview.");
    }
    if (preview.hasDestructive && !request.approved) {
      throw new Error("Destructive operations require explicit approval.");
    }
    const now = Date.now();
    const job = {
      id: crypto.randomUUID(),
      type: "file-operation",
      status: "running",
      createdAt: now,
      updatedAt: now,
      operationType: this.determineOperationType(preview.operations),
      previewId: preview.id,
      operations: preview.operations,
      successCount: 0,
      failureCount: 0,
      prompt: preview.prompt,
      requiredApproval: preview.hasDestructive
    };
    this.activeJob = job;
    this.emit(
      createEvent(EventTypes.FILE_OP_STARTED, { job })
    );
    console.log(`[FileOperationService] Executing job ${job.id} with ${preview.operations.length} operations`);
    try {
      const fs2 = await import("fs/promises");
      const path2 = await import("path");
      for (const op of preview.operations) {
        try {
          switch (op.type) {
            case "rename":
            case "move":
              if (op.destination) {
                const destDir = path2.dirname(op.destination);
                await fs2.mkdir(destDir, { recursive: true });
                await fs2.rename(op.source, op.destination);
                console.log(`[FileOperationService] Renamed: ${op.source} -> ${op.destination}`);
                job.successCount++;
              }
              break;
            case "copy":
              if (op.destination) {
                const destDir = path2.dirname(op.destination);
                await fs2.mkdir(destDir, { recursive: true });
                await fs2.copyFile(op.source, op.destination);
                console.log(`[FileOperationService] Copied: ${op.source} -> ${op.destination}`);
                job.successCount++;
              }
              break;
            case "delete":
              await fs2.unlink(op.source);
              console.log(`[FileOperationService] Deleted: ${op.source}`);
              job.successCount++;
              break;
            default:
              console.warn(`[FileOperationService] Unknown operation type: ${op.type}`);
              job.failureCount++;
          }
        } catch (opError) {
          console.error(`[FileOperationService] Operation failed:`, opError);
          job.failureCount++;
        }
      }
      job.status = job.failureCount === 0 ? "completed" : "completed";
      job.updatedAt = Date.now();
      this.addToHistory(job);
      this.previews.delete(request.previewId);
      this.emit(
        createEvent(EventTypes.FILE_OP_COMPLETED, { job })
      );
      console.log(`[FileOperationService] Job ${job.id} completed: ${job.successCount} success, ${job.failureCount} failed`);
      this.activeJob = null;
      return { job };
    } catch (error) {
      job.status = "failed";
      job.error = { code: "FILE_OP_FAILED", message: error.message };
      job.updatedAt = Date.now();
      this.emit(
        createEvent(EventTypes.FILE_OP_FAILED, {
          jobId: job.id,
          error: error.message
        })
      );
      console.error(`[FileOperationService] Job ${job.id} failed:`, error);
      this.activeJob = null;
      throw error;
    }
  }
  /**
   * Undo a recent file operation
   */
  async undo(request) {
    const entry = this.history.find((h) => h.jobId === request.jobId);
    if (!entry) {
      return { success: false, undoneCount: 0, error: "Operation not found in history" };
    }
    if (!entry.canUndo) {
      return { success: false, undoneCount: 0, error: "Operation cannot be undone" };
    }
    if (Date.now() > entry.undoExpiresAt) {
      entry.canUndo = false;
      return { success: false, undoneCount: 0, error: "Undo window has expired" };
    }
    console.log(`[FileOperationService] Undoing job ${request.jobId}`);
    try {
      const reverseOps = this.generateReverseOperations(entry.operations);
      const openCodeService = getOpenCodeService();
      const undoPrompt = FILE_OP_PROMPTS.execute(JSON.stringify(reverseOps, null, 2));
      await openCodeService.runTask({ prompt: undoPrompt });
      entry.canUndo = false;
      this.emit(
        createEvent(EventTypes.FILE_OP_UNDONE, {
          jobId: request.jobId,
          undoneCount: entry.operations.length
        })
      );
      console.log(`[FileOperationService] Job ${request.jobId} undone`);
      return { success: true, undoneCount: entry.operations.length };
    } catch (error) {
      return { success: false, undoneCount: 0, error: error.message };
    }
  }
  /**
   * Get operation history
   */
  getHistory() {
    const now = Date.now();
    this.history = this.history.map((entry) => ({
      ...entry,
      canUndo: entry.canUndo && now < entry.undoExpiresAt
    }));
    return { history: [...this.history] };
  }
  /**
   * Get a preview by ID
   */
  getPreview(previewId) {
    const preview = this.previews.get(previewId);
    if (preview && Date.now() > preview.expiresAt) {
      this.previews.delete(previewId);
      return null;
    }
    return preview || null;
  }
  /**
   * Get the active job
   */
  getActiveJob() {
    return this.activeJob;
  }
  // ============================================================================
  // Private Helpers
  // ============================================================================
  determineOperationType(operations) {
    if (operations.length === 0) return "organize";
    const counts = /* @__PURE__ */ new Map();
    for (const op of operations) {
      counts.set(op.type, (counts.get(op.type) || 0) + 1);
    }
    let maxType = "organize";
    let maxCount = 0;
    for (const [type, count] of counts) {
      if (count > maxCount) {
        maxType = type;
        maxCount = count;
      }
    }
    return maxType;
  }
  addToHistory(job) {
    const entry = {
      jobId: job.id,
      operations: job.operations,
      executedAt: Date.now(),
      canUndo: true,
      undoExpiresAt: Date.now() + UNDO_EXPIRY_MS
    };
    this.history.unshift(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history.pop();
    }
  }
  generateReverseOperations(operations) {
    return operations.map((op) => {
      switch (op.type) {
        case "rename":
        case "move":
          return {
            type: op.type,
            source: op.destination,
            destination: op.source,
            destructive: false
          };
        case "copy":
          return {
            type: "delete",
            source: op.destination,
            destructive: true
          };
        case "delete":
          return {
            type: "copy",
            source: op.source,
            // This won't work - just a placeholder
            destination: op.source,
            destructive: false
          };
        default:
          return op;
      }
    }).reverse();
  }
  cleanupExpiredPreviews() {
    const now = Date.now();
    for (const [id, preview] of this.previews) {
      if (now > preview.expiresAt) {
        this.previews.delete(id);
      }
    }
  }
}
const fileOperationService = new FileOperationService();
function parseSkillFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }
  const yaml = frontmatterMatch[1];
  const body = frontmatterMatch[2].trim();
  const result = {};
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const descMatch = yaml.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const versionMatch = yaml.match(/^version:\s*(.+)$/m);
  if (versionMatch) {
    result.version = versionMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  const triggerMatch = yaml.match(/^triggers:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (triggerMatch) {
    result.triggers = triggerMatch[1].split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter((t) => t.length > 0);
  }
  const requiresMatch = yaml.match(/^requires:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (requiresMatch) {
    result.requires = requiresMatch[1].split("\n").map((line) => line.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, "")).filter((r) => r.length > 0);
  }
  return { frontmatter: result, body };
}
class SkillService extends events.EventEmitter {
  eventEmitter = null;
  skills = /* @__PURE__ */ new Map();
  projectRoot = process.cwd();
  lastDiscovery = 0;
  /**
   * Set the event emitter for broadcasting events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Set the project root directory
   */
  setProjectRoot(root) {
    this.projectRoot = root;
  }
  /**
   * Get the project skills directory
   */
  getProjectDir() {
    return path.join(this.projectRoot, ".clipmorph", "skills");
  }
  /**
   * Get the global skills directory
   */
  getGlobalDir() {
    return path.join(os.homedir(), ".clipmorph", "skills");
  }
  /**
   * Parse a SKILL.md file
   */
  async parseSkillFile(skillDir, scope) {
    const skillFile = path.join(skillDir, "SKILL.md");
    try {
      const content = await promises.readFile(skillFile, "utf-8");
      const { frontmatter, body } = parseSkillFrontmatter(content);
      const fileStat = await promises.stat(skillFile);
      const id = path.basename(skillDir);
      return {
        id,
        name: frontmatter.name || id,
        description: frontmatter.description || `Skill: ${id}`,
        version: frontmatter.version || "1.0.0",
        triggers: frontmatter.triggers || [],
        requires: frontmatter.requires || [],
        instructions: body,
        filePath: skillFile,
        scope,
        lastModified: fileStat.mtimeMs
      };
    } catch (err) {
      console.warn(`[SkillService] Failed to parse skill at ${skillDir}:`, err);
      return null;
    }
  }
  /**
   * Discover skills from a directory
   */
  async discoverFromDir(dir, scope) {
    const skills = [];
    const errors = [];
    try {
      const dirStat = await promises.stat(dir).catch(() => null);
      if (!dirStat?.isDirectory()) {
        return { skills, errors };
      }
      const entries = await promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillDir = path.join(dir, entry.name);
        try {
          const skill = await this.parseSkillFile(skillDir, scope);
          if (skill) {
            skills.push(skill);
          }
        } catch (err) {
          errors.push({
            path: skillDir,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    } catch {
    }
    return { skills, errors };
  }
  /**
   * Discover all skills
   */
  async discover(forceReload = false) {
    const previousSkills = new Map(this.skills);
    let newCount = 0;
    let updatedCount = 0;
    const allErrors = [];
    if (forceReload) {
      this.skills.clear();
    }
    const globalResult = await this.discoverFromDir(this.getGlobalDir(), "global");
    allErrors.push(...globalResult.errors);
    const projectResult = await this.discoverFromDir(this.getProjectDir(), "project");
    allErrors.push(...projectResult.errors);
    const allSkills = [...globalResult.skills, ...projectResult.skills];
    for (const skill of allSkills) {
      const existing = previousSkills.get(skill.id);
      if (!existing) {
        newCount++;
      } else if (existing.lastModified !== skill.lastModified) {
        updatedCount++;
      }
      this.skills.set(skill.id, skill);
    }
    this.lastDiscovery = Date.now();
    console.log(
      `[SkillService] Discovered ${this.skills.size} skills (${newCount} new, ${updatedCount} updated)`
    );
    if (newCount > 0 || updatedCount > 0) {
      this.emit(
        createEvent(EventTypes.SKILL_DISCOVERED, {
          skills: Array.from(this.skills.values()),
          newCount
        })
      );
    }
    return {
      skills: Array.from(this.skills.values()),
      newCount,
      updatedCount,
      errors: allErrors
    };
  }
  /**
   * List all skills
   */
  async list() {
    if (this.lastDiscovery === 0) {
      await this.discover();
    }
    const projectDir = this.getProjectDir();
    const globalDir = this.getGlobalDir();
    let projectDirExists = false;
    try {
      const dirStat = await promises.stat(projectDir);
      projectDirExists = dirStat.isDirectory();
    } catch {
      projectDirExists = false;
    }
    return {
      skills: Array.from(this.skills.values()),
      projectDir,
      globalDir,
      projectDirExists
    };
  }
  /**
   * Get a skill by ID
   */
  get(skillId) {
    return {
      skill: this.skills.get(skillId) || null
    };
  }
  /**
   * Find skills by trigger keyword
   */
  findByTrigger(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return Array.from(this.skills.values()).filter(
      (skill) => skill.triggers.some((t) => lowerKeyword.includes(t.toLowerCase()))
    );
  }
  /**
   * Match skills to a task prompt
   */
  matchSkillsForTask(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const matched = [];
    for (const skill of this.skills.values()) {
      const hasMatch = skill.triggers.some(
        (trigger) => lowerPrompt.includes(trigger.toLowerCase())
      );
      if (hasMatch) {
        matched.push(skill);
      }
    }
    return matched;
  }
  /**
   * Build augmented prompt with skill instructions
   */
  buildAugmentedPrompt(prompt, skills) {
    if (skills.length === 0) {
      return prompt;
    }
    const skillInstructions = skills.map((s) => `## Skill: ${s.name}

${s.instructions}`).join("\n\n---\n\n");
    for (const skill of skills) {
      this.emit(
        createEvent(EventTypes.SKILL_APPLIED, {
          skillId: skill.id,
          skillName: skill.name,
          taskPrompt: prompt
        })
      );
    }
    return `# Applied Skills

${skillInstructions}

---

# Task

${prompt}`;
  }
  /**
   * Export a skill to a file
   */
  async export(skillId, outputPath) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { success: false, error: `Skill not found: ${skillId}` };
    }
    try {
      const downloadsDir = path.join(os.homedir(), "Downloads");
      const exportDir = outputPath || downloadsDir;
      const exportFile = path.join(exportDir, `${skill.id}.skill.md`);
      const content = await promises.readFile(skill.filePath, "utf-8");
      await promises.writeFile(exportFile, content, "utf-8");
      this.emit(
        createEvent(EventTypes.SKILL_EXPORTED, {
          skillId: skill.id,
          exportPath: exportFile
        })
      );
      console.log(`[SkillService] Exported skill ${skillId} to ${exportFile}`);
      return { success: true, exportPath: exportFile };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  /**
   * Import a skill from a file
   */
  async import(source, global = false) {
    try {
      const content = await promises.readFile(source, "utf-8");
      const { frontmatter } = parseSkillFrontmatter(content);
      const skillId = frontmatter.name?.toLowerCase().replace(/\s+/g, "-") || path.basename(source, ".skill.md").replace(".md", "");
      const targetBase = global ? this.getGlobalDir() : this.getProjectDir();
      const targetDir = path.join(targetBase, skillId);
      const targetFile = path.join(targetDir, "SKILL.md");
      await promises.mkdir(targetDir, { recursive: true });
      await promises.writeFile(targetFile, content, "utf-8");
      await this.discover(true);
      const skill = this.skills.get(skillId);
      if (!skill) {
        return { success: false, error: "Failed to import skill" };
      }
      this.emit(
        createEvent(EventTypes.SKILL_IMPORTED, {
          skill,
          source
        })
      );
      console.log(`[SkillService] Imported skill ${skillId} from ${source}`);
      return { success: true, skill };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  /**
   * Create the skills directory with a sample skill
   */
  async createSampleSkill() {
    const skillsDir = this.getProjectDir();
    const sampleDir = path.join(skillsDir, "example-style");
    const sampleFile = path.join(sampleDir, "SKILL.md");
    await promises.mkdir(sampleDir, { recursive: true });
    const sampleContent = `---
name: Example Style Guide
description: A sample skill demonstrating the format
version: 1.0.0
triggers:
  - style
  - format
  - clean
requires: []
---

# Example Style Guide

This is a sample skill that demonstrates the SKILL.md format.

## Guidelines

- Use consistent naming conventions
- Follow the project's established patterns
- Write clear, self-documenting code
- Add comments for complex logic

## Code Style

- Use 2-space indentation
- Keep lines under 100 characters
- Use meaningful variable names
`;
    await promises.writeFile(sampleFile, sampleContent, "utf-8");
    console.log(`[SkillService] Created sample skill at ${sampleFile}`);
    await this.discover(true);
    return sampleFile;
  }
  /**
   * Get all trigger keywords for voice matching
   */
  getAllTriggers() {
    const triggers = [];
    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        triggers.push({ trigger, skillId: skill.id });
      }
    }
    return triggers;
  }
}
const skillService = new SkillService();
class DocumentExtractorService {
  /**
   * Check if a string looks like a file path
   */
  isFilePath(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) {
      return fs__namespace.existsSync(trimmed);
    }
    if (/^[A-Za-z]:\\/.test(trimmed)) {
      return fs__namespace.existsSync(trimmed);
    }
    if (trimmed.startsWith("~")) {
      const expanded = trimmed.replace("~", process.env.HOME || "");
      return fs__namespace.existsSync(expanded);
    }
    return false;
  }
  /**
   * Check if a file path is a supported document type
   */
  isSupportedDocument(filePath) {
    const ext = path__namespace.extname(filePath).toLowerCase();
    return [".pdf", ".docx", ".doc", ".txt"].includes(ext);
  }
  /**
   * Get the file type from extension
   */
  getFileType(filePath) {
    const ext = path__namespace.extname(filePath).toLowerCase();
    switch (ext) {
      case ".pdf":
        return "pdf";
      case ".docx":
        return "docx";
      case ".doc":
        return "doc";
      case ".txt":
        return "txt";
      default:
        return "unknown";
    }
  }
  /**
   * Expand home directory in path
   */
  expandPath(filePath) {
    if (filePath.startsWith("~")) {
      return filePath.replace("~", process.env.HOME || "");
    }
    return filePath;
  }
  /**
   * Extract text from a PDF file using pdf-parse v2
   */
  async extractFromPdf(filePath) {
    const dataBuffer = fs__namespace.readFileSync(filePath);
    const parser = new pdfParse.PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    return result.text;
  }
  /**
   * Extract text from a Word document (.docx)
   */
  async extractFromDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  /**
   * Extract text from a plain text file
   */
  extractFromTxt(filePath) {
    return fs__namespace.readFileSync(filePath, "utf-8");
  }
  /**
   * Extract text from a document file
   */
  async extract(filePath) {
    const expandedPath = this.expandPath(filePath.trim());
    const fileType = this.getFileType(expandedPath);
    if (!fs__namespace.existsSync(expandedPath)) {
      return {
        success: false,
        text: "",
        filePath: expandedPath,
        fileType,
        error: `File not found: ${expandedPath}`
      };
    }
    try {
      let text = "";
      switch (fileType) {
        case "pdf":
          text = await this.extractFromPdf(expandedPath);
          break;
        case "docx":
          text = await this.extractFromDocx(expandedPath);
          break;
        case "doc":
          try {
            text = await this.extractFromDocx(expandedPath);
          } catch {
            return {
              success: false,
              text: "",
              filePath: expandedPath,
              fileType,
              error: "Old .doc format not supported. Please save as .docx"
            };
          }
          break;
        case "txt":
          text = this.extractFromTxt(expandedPath);
          break;
        default:
          return {
            success: false,
            text: "",
            filePath: expandedPath,
            fileType,
            error: `Unsupported file type: ${path__namespace.extname(expandedPath)}`
          };
      }
      text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      console.log(`[DocumentExtractor] Extracted ${text.length} chars from ${fileType}: ${expandedPath}`);
      return {
        success: true,
        text,
        filePath: expandedPath,
        fileType
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[DocumentExtractor] Failed to extract from ${expandedPath}:`, errorMsg);
      return {
        success: false,
        text: "",
        filePath: expandedPath,
        fileType,
        error: errorMsg
      };
    }
  }
  /**
   * Try to extract document content from clipboard text
   * Returns the extracted text if clipboard contains a file path to a document,
   * otherwise returns the original clipboard text
   */
  async extractFromClipboard(clipboardText) {
    if (!clipboardText) {
      return { text: "", isDocument: false };
    }
    const trimmed = clipboardText.trim();
    if (!this.isFilePath(trimmed)) {
      return { text: clipboardText, isDocument: false };
    }
    if (!this.isSupportedDocument(trimmed)) {
      return { text: clipboardText, isDocument: false };
    }
    const result = await this.extract(trimmed);
    if (result.success) {
      return {
        text: result.text,
        isDocument: true,
        filePath: result.filePath,
        fileType: result.fileType
      };
    }
    console.warn(`[DocumentExtractor] Failed to extract: ${result.error}`);
    return { text: clipboardText, isDocument: false };
  }
}
const documentExtractorService = new DocumentExtractorService();
class ChartRendererService {
  browser = null;
  openaiClient = null;
  apiKey = null;
  /**
   * Get or create OpenAI client
   */
  async getOpenAIClient() {
    const currentKey = await secretsService.getOpenAIKey();
    if (!currentKey) {
      throw new Error("OpenAI API key not configured");
    }
    if (!this.openaiClient || this.apiKey !== currentKey) {
      this.apiKey = currentKey;
      this.openaiClient = new OpenAI({ apiKey: currentKey });
    }
    return this.openaiClient;
  }
  /**
   * Get or launch browser instance
   */
  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log("[ChartRenderer] Launching headless browser...");
      this.browser = await playwright.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
    }
    return this.browser;
  }
  /**
   * Detect if command is a chart request
   */
  isChartRequest(command) {
    const chartKeywords = [
      /\bchart\b/i,
      /\bgraph\b/i,
      /\bplot\b/i,
      /\bvisualize\b/i,
      /\bvisualise\b/i,
      /\bbar\s*(chart|graph)?\b/i,
      /\bline\s*(chart|graph)?\b/i,
      /\bpie\s*(chart|graph)?\b/i,
      /\bdoughnut\b/i,
      /\bhistogram\b/i,
      /\bscatter\b/i
    ];
    return chartKeywords.some((pattern) => pattern.test(command));
  }
  /**
   * Parse table data and generate Chart.js config using LLM
   */
  async generateChartConfig(command, tableData, html) {
    try {
      const client = await this.getOpenAIClient();
      const dataContext = html ? `[HTML Table]:
${html}

[Plain Text]:
${tableData}` : tableData;
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a data visualization expert. Convert tabular data into Chart.js configuration.

RULES:
1. Return ONLY valid JSON - no markdown, no explanation, no code blocks
2. Analyze the data to determine the best chart type if not specified
3. Use appropriate colors (use hex codes)
4. Keep labels concise
5. Handle numeric data properly (parse strings to numbers)

OUTPUT FORMAT (strict JSON):
{
  "type": "bar|line|pie|doughnut|scatter",
  "data": {
    "labels": ["Label1", "Label2", ...],
    "datasets": [{
      "label": "Series Name",
      "data": [10, 20, 30, ...],
      "backgroundColor": ["#4F46E5", "#10B981", "#F59E0B", ...],
      "borderColor": "#4F46E5",
      "borderWidth": 1
    }]
  },
  "options": {
    "responsive": false,
    "plugins": {
      "title": { "display": true, "text": "Chart Title" },
      "legend": { "position": "bottom" }
    }
  }
}

COLOR PALETTE to use:
- Primary: #4F46E5 (indigo)
- Success: #10B981 (emerald)
- Warning: #F59E0B (amber)
- Danger: #EF4444 (red)
- Info: #3B82F6 (blue)
- Purple: #8B5CF6
- Pink: #EC4899
- Cyan: #06B6D4

For pie/doughnut charts, use an array of colors for backgroundColor.
For bar/line charts, use single colors per dataset.`
          },
          {
            role: "user",
            content: `Command: ${command}

Data:
${dataContext}

Generate the Chart.js config JSON:`
          }
        ],
        temperature: 0.2,
        max_tokens: 2048
      });
      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return { success: false, error: "LLM returned empty response" };
      }
      let jsonStr = content;
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      try {
        const config = JSON.parse(jsonStr);
        return { success: true, config };
      } catch (parseError) {
        console.error("[ChartRenderer] Failed to parse chart config:", jsonStr);
        return { success: false, error: `Invalid JSON from LLM: ${parseError}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[ChartRenderer] Failed to generate config:", errorMsg);
      return { success: false, error: errorMsg };
    }
  }
  /**
   * Render Chart.js config to PNG buffer
   */
  async renderChartToImage(config, width = 800, height = 600) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width, height });
      const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: white; 
      display: flex; 
      justify-content: center; 
      align-items: center;
      width: ${width}px;
      height: ${height}px;
    }
    #chart-container {
      width: ${width - 40}px;
      height: ${height - 40}px;
    }
  </style>
</head>
<body>
  <div id="chart-container">
    <canvas id="chart"></canvas>
  </div>
  <script>
    const config = ${JSON.stringify(config)};
    
    // Ensure responsive is false for consistent rendering
    config.options = config.options || {};
    config.options.responsive = true;
    config.options.maintainAspectRatio = false;
    config.options.animation = false;
    
    const ctx = document.getElementById('chart').getContext('2d');
    new Chart(ctx, config);
  <\/script>
</body>
</html>`;
      await page.setContent(html);
      await page.waitForTimeout(500);
      const screenshot = await page.screenshot({
        type: "png",
        omitBackground: false
      });
      return screenshot;
    } finally {
      await page.close();
    }
  }
  /**
   * Full pipeline: table data → chart config → PNG image
   */
  async createChartFromTable(command, tableData, html) {
    console.log("[ChartRenderer] Creating chart from table data...");
    const configResult = await this.generateChartConfig(command, tableData, html);
    if (!configResult.success || !configResult.config) {
      return { success: false, error: configResult.error };
    }
    console.log("[ChartRenderer] Generated chart config:", configResult.config.type);
    try {
      const imageBuffer = await this.renderChartToImage(configResult.config);
      console.log("[ChartRenderer] Chart rendered successfully, size:", imageBuffer.length, "bytes");
      return {
        success: true,
        imageBuffer,
        chartConfig: configResult.config
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[ChartRenderer] Failed to render chart:", errorMsg);
      return { success: false, error: errorMsg };
    }
  }
  /**
   * Cleanup browser instance
   */
  async dispose() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
const chartRendererService = new ChartRendererService();
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
class LLMIntentService {
  client = null;
  apiKey = null;
  /**
   * Get Cerebras client (falls back to OpenAI if no Cerebras key)
   */
  async getClient() {
    const cerebrasKey = await secretsService.getCerebrasKey();
    if (cerebrasKey) {
      if (!this.client || this.apiKey !== cerebrasKey) {
        this.apiKey = cerebrasKey;
        this.client = new OpenAI({
          apiKey: cerebrasKey,
          baseURL: CEREBRAS_BASE_URL
        });
      }
      return { client: this.client, model: "llama-3.3-70b" };
    }
    const openaiKey = await secretsService.getOpenAIKey();
    if (openaiKey) {
      if (!this.client || this.apiKey !== openaiKey) {
        this.apiKey = openaiKey;
        this.client = new OpenAI({ apiKey: openaiKey });
      }
      return { client: this.client, model: "gpt-4o-mini" };
    }
    throw new Error("No API key configured (Cerebras or OpenAI)");
  }
  /**
   * Classify intent using LLM
   */
  async classifyIntent(transcript) {
    const { client, model } = await this.getClient();
    const systemPrompt = `You are an intent classifier for a voice-controlled clipboard assistant called ClipMorph.

Given a user's voice command, classify it into ONE of these intents:

CODE INTENTS (for modifying SOURCE CODE FILES in a project/codebase):
- code:generate - Create new source code files, functions, classes, components in a codebase
- code:refactor - Refactor actual source code files
- code:fix - Fix bugs in source code files
- code:explain - Explain source code
- code:improve - Optimize source code files
- code:convert - Convert source code to another programming language

TRANSFORM INTENTS (for transforming CLIPBOARD DATA - text, tables, numbers):
- Use "transform" for ALL of these:
  * Calculations on data (calculate ratios, sum, average, etc.)
  * Data analysis (analyze, compare, find trends)
  * Table/spreadsheet operations (format for Excel, create table, add columns)
  * Text transformations (summarize, translate, reformat, clean up)
  * Data extraction (extract emails, links, names, etc.)
  * Number crunching or financial calculations
  * Converting data formats (CSV to JSON, etc.)

BROWSER INTENTS (automate web browser):
- automation:portal - Fill forms, click buttons, navigate websites, sign up, log in

FILE INTENTS (file system operations):
- file:organize - Organize/sort files
- file:rename - Rename files
- file:move - Move files
- file:delete - Delete files
- file:copy - Copy files

SPECIAL INTENTS:
- cancel - Cancel current operation
- undo - Undo last action

CRITICAL DISTINCTION:
- CODE intents are ONLY for modifying actual source code files (.js, .py, .ts, etc.) in a programming project
- TRANSFORM is for processing/analyzing DATA that is on the clipboard (text, tables, numbers, spreadsheet data)
- "Calculate X from data" → TRANSFORM (processing data)
- "Write a function to calculate X" → code:generate (creating source code)
- "Put data in Excel table format" → TRANSFORM (formatting data)
- "Create an Excel macro" → code:generate (creating source code)

When in doubt, use "transform". Most voice commands about data manipulation should be "transform".

Respond with JSON only: {"intent": "<intent>", "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}`;
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classify this command: "${transcript}"` }
      ],
      temperature: 0.1,
      max_tokens: 150
    });
    const content = response.choices[0]?.message?.content || "";
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        let intent = parsed.intent;
        if (intent === "transform" || !this.isValidIntent(intent)) {
          intent = "unsupported";
        }
        return {
          intent,
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
          reasoning: parsed.reasoning
        };
      }
    } catch (e) {
      console.error("[LLMIntentService] Failed to parse response:", content, e);
    }
    return {
      intent: "unsupported",
      confidence: 0.5,
      reasoning: "Failed to parse LLM response"
    };
  }
  /**
   * Check if intent is valid
   */
  isValidIntent(intent) {
    const validIntents = [
      "code:generate",
      "code:refactor",
      "code:fix",
      "code:explain",
      "code:improve",
      "code:convert",
      "automation:portal",
      "file:organize",
      "file:rename",
      "file:move",
      "file:delete",
      "file:copy",
      "file:find",
      "cancel",
      "undo",
      "url:clean",
      "url:markdown",
      "json:pretty",
      "json:minify",
      "json:to-yaml",
      "yaml:to-json",
      "extract:emails",
      "extract:links",
      "redact:secrets",
      "unsupported"
    ];
    return validIntents.includes(intent);
  }
  /**
   * Check if LLM classification is available
   */
  async isAvailable() {
    try {
      const cerebrasKey = await secretsService.getCerebrasKey();
      const openaiKey = await secretsService.getOpenAIKey();
      return !!(cerebrasKey || openaiKey);
    } catch {
      return false;
    }
  }
}
const llmIntentService = new LLMIntentService();
class IntentService {
  eventEmitter = null;
  lastAction = null;
  chartImagesDir = null;
  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Get the directory for storing chart images
   */
  getChartImagesDir() {
    if (!this.chartImagesDir) {
      this.chartImagesDir = path.join(electron.app.getPath("userData"), "chart-images");
      if (!fs.existsSync(this.chartImagesDir)) {
        fs.mkdirSync(this.chartImagesDir, { recursive: true });
      }
    }
    return this.chartImagesDir;
  }
  /**
   * Save a chart image and return the path
   */
  saveChartImage(imageBuffer, jobId) {
    const dir = this.getChartImagesDir();
    const filename = `chart-${jobId}.png`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    return filepath;
  }
  /**
   * Emit an event to the renderer
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Check if a transcript is a browser automation task
   */
  isBrowserTask(transcript) {
    const normalized = transcript.toLowerCase();
    const browserKeywords = [
      "click",
      "fill out",
      "fill in",
      "fill the",
      "submit",
      "go to",
      "navigate to",
      "open",
      "browse to",
      "visit",
      "scroll",
      "download",
      "upload",
      "sign up",
      "sign in",
      "log in",
      "login",
      "register",
      "book",
      "reserve",
      "add to cart",
      "checkout",
      "buy",
      "purchase",
      "search for",
      "find the",
      "select",
      "choose",
      "pick"
    ];
    for (const keyword of browserKeywords) {
      if (normalized.includes(keyword)) {
        return true;
      }
    }
    if (/https?:\/\/|www\.|\.com|\.org|\.io|\.net/.test(normalized)) {
      return true;
    }
    const formPhrases = [
      "form",
      "application",
      "apply",
      "this page",
      "this site",
      "this website",
      "on the page",
      "on this page",
      "the button",
      "the link",
      "the field",
      "the input"
    ];
    for (const phrase of formPhrases) {
      if (normalized.includes(phrase)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Route a transcript to the appropriate capability
   */
  async routeTranscript(transcript) {
    const subagentMatch = matchSubagentTrigger(
      transcript,
      subagentService.getAllTriggers()
    );
    if (subagentMatch && subagentMatch.confidence >= 0.5) {
      const subagentIntent = `subagent:${subagentMatch.subagentId}`;
      const classification2 = {
        intent: subagentIntent,
        confidence: subagentMatch.confidence,
        rawTranscript: transcript,
        normalizedTranscript: transcript.toLowerCase().trim(),
        matchedPatterns: [`trigger:${subagentMatch.trigger}`]
      };
      console.log(
        `[IntentService] Matched subagent "${subagentMatch.subagentId}" with trigger "${subagentMatch.trigger}" (confidence: ${subagentMatch.confidence})`
      );
      return this.handleSubagentIntent(classification2, subagentMatch.subagentId);
    }
    const useLLMOnly = storeService.getSetting("intent_mode") === "llm";
    let classification;
    let intent;
    if (useLLMOnly) {
      console.log(`[IntentService] Using LLM-only classification for "${transcript}"`);
      try {
        const llmResult = await llmIntentService.classifyIntent(transcript);
        console.log(
          `[IntentService] LLM classified "${transcript}" as ${llmResult.intent} (confidence: ${llmResult.confidence}, reason: ${llmResult.reasoning})`
        );
        classification = {
          intent: llmResult.intent,
          confidence: llmResult.confidence,
          rawTranscript: transcript,
          normalizedTranscript: transcript.toLowerCase().trim(),
          matchedPatterns: [`llm:${llmResult.reasoning || "classified"}`]
        };
        intent = llmResult.intent;
      } catch (err) {
        console.error(`[IntentService] LLM classification failed, falling back to regex:`, err);
        classification = classifyIntent(transcript);
        intent = classification.intent;
      }
    } else {
      classification = classifyIntent(transcript);
      intent = classification.intent;
      console.log(
        `[IntentService] Regex classified "${transcript}" as ${intent} (confidence: ${classification.confidence})`
      );
      const useLLMFallback = storeService.getSetting("use_llm_intent") !== "false";
      if (useLLMFallback && classification.confidence < 0.5 && intent === "unsupported") {
        try {
          console.log(`[IntentService] Low confidence, trying LLM classification...`);
          const llmResult = await llmIntentService.classifyIntent(transcript);
          console.log(
            `[IntentService] LLM classified "${transcript}" as ${llmResult.intent} (confidence: ${llmResult.confidence}, reason: ${llmResult.reasoning})`
          );
          if (llmResult.confidence > classification.confidence) {
            classification = {
              ...classification,
              intent: llmResult.intent,
              confidence: llmResult.confidence,
              matchedPatterns: [`llm:${llmResult.reasoning || "classified"}`]
            };
            intent = llmResult.intent;
          }
        } catch (err) {
          console.error(`[IntentService] LLM classification failed:`, err);
        }
      }
    }
    if (isSpecialIntent(intent)) {
      return this.handleSpecialIntent(classification);
    }
    if (isCodeIntent(intent)) {
      return this.handleCodeIntent(classification);
    }
    if (isAutomationIntent(intent) || this.isBrowserTask(transcript)) {
      return this.handleBrowserIntent(classification);
    }
    if (isSubagentIntent(intent)) {
      const subagentId = getSubagentIdFromIntent(intent);
      if (subagentId) {
        return this.handleSubagentIntent(classification, subagentId);
      }
    }
    if (isWorkflowIntent(intent)) {
      return this.handleWorkflowIntent(classification);
    }
    if (isFileIntent(intent)) {
      return this.handleFileIntent(classification);
    }
    return this.handleLLMTransform(classification);
  }
  /**
   * Handle LLM-powered transforms
   * Routes any command through the LLM to transform clipboard content
   * Also handles chart generation requests
   */
  async handleLLMTransform(classification) {
    const { intent } = classification;
    const command = classification.rawTranscript;
    const isChartRequest = chartRendererService.isChartRequest(command);
    const jobType = isChartRequest ? "chart-render" : "llm-transform";
    const job = jobManager.createJob(jobType, {
      command,
      intent
    });
    console.log(`[IntentService] Created ${jobType} job ${job.id} for command: "${command}"`);
    const isAvailable = await llmTransformService.isAvailable();
    if (!isAvailable) {
      const error = "OpenAI API key not configured. Set it in Settings.";
      jobManager.failJob(job.id, { code: "TRANSFORM_NOT_AVAILABLE", message: error });
      this.updateLastAction(command, jobType, false, job.id, error);
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error
      };
    }
    jobManager.startJob(job.id);
    const clipboardText = clipboardService.readClipboard();
    const snapshot = clipboardService.getCurrentSnapshot();
    if (!clipboardText || !snapshot) {
      const error = "Clipboard is empty";
      jobManager.failJob(job.id, { code: "TRANSFORM_INVALID_INPUT", message: error });
      this.updateLastAction(command, jobType, false, job.id, error);
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error
      };
    }
    if (isChartRequest) {
      return this.handleChartRequest(command, clipboardText, snapshot, job.id, intent, classification);
    }
    const startTime = Date.now();
    const result = await llmTransformService.transform(command, clipboardText, snapshot.html);
    if (!result.success) {
      jobManager.failJob(job.id, { code: "TRANSFORM_EXECUTION_FAILED", message: result.error || "Transform failed" });
      this.updateLastAction(command, "llm-transform", false, job.id, result.error);
      storeService.addOperation({
        id: job.id,
        command,
        jobType: "llm-transform",
        inputText: clipboardText,
        inputHtml: snapshot.html,
        success: false,
        error: result.error,
        durationMs: Date.now() - startTime
      });
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error: result.error
      };
    }
    console.log(`[IntentService] Writing result to clipboard (${result.output.length} chars)`);
    const writeResult = clipboardService.writeClipboardGated(result.output, snapshot.id);
    console.log(`[IntentService] Write result: success=${writeResult.success}`);
    if (!writeResult.success) {
      console.log(`[IntentService] Clipboard write failed: ${writeResult.error?.message}`);
      jobManager.failJob(job.id, {
        code: writeResult.error.code,
        message: writeResult.error.message
      });
      this.updateLastAction(command, "llm-transform", false, job.id, writeResult.error.message);
      storeService.addOperation({
        id: job.id,
        command,
        jobType: "llm-transform",
        inputText: clipboardText,
        inputHtml: snapshot.html,
        outputText: result.output,
        success: false,
        error: writeResult.error.message,
        durationMs: Date.now() - startTime
      });
      return {
        intent,
        classification,
        handled: false,
        jobId: job.id,
        error: writeResult.error.message
      };
    }
    jobManager.completeJob(job.id, { output: result.output });
    this.updateLastAction(command, "llm-transform", true, job.id);
    storeService.addOperation({
      id: job.id,
      command,
      jobType: "llm-transform",
      inputText: clipboardText,
      inputHtml: snapshot.html,
      outputText: result.output,
      success: true,
      durationMs: Date.now() - startTime
    });
    console.log(`[IntentService] LLM transform completed for job ${job.id}`);
    return {
      intent,
      classification,
      handled: true,
      jobId: job.id
    };
  }
  /**
   * Handle chart generation requests
   * Renders table data to a chart image and copies to clipboard
   */
  async handleChartRequest(command, clipboardText, snapshot, jobId, intent, classification) {
    console.log(`[IntentService] Processing chart request: "${command}"`);
    const startTime = Date.now();
    try {
      const chartResult = await chartRendererService.createChartFromTable(
        command,
        clipboardText,
        snapshot.html
      );
      if (!chartResult.success || !chartResult.imageBuffer) {
        const error = chartResult.error || "Failed to generate chart";
        jobManager.failJob(jobId, { code: "CHART_RENDER_FAILED", message: error });
        this.updateLastAction(command, "chart-render", false, jobId, error);
        storeService.addOperation({
          id: jobId,
          command,
          jobType: "chart-render",
          inputText: clipboardText,
          inputHtml: snapshot.html,
          success: false,
          error,
          durationMs: Date.now() - startTime
        });
        return {
          intent,
          classification,
          handled: false,
          jobId,
          error
        };
      }
      const imagePath = this.saveChartImage(chartResult.imageBuffer, jobId);
      console.log(`[IntentService] Chart image saved to ${imagePath}`);
      const writeResult = clipboardService.writeImageGated(chartResult.imageBuffer, snapshot.id);
      if (!writeResult.success) {
        jobManager.failJob(jobId, {
          code: writeResult.error.code,
          message: writeResult.error.message
        });
        this.updateLastAction(command, "chart-render", false, jobId, writeResult.error.message);
        storeService.addOperation({
          id: jobId,
          command,
          jobType: "chart-render",
          inputText: clipboardText,
          inputHtml: snapshot.html,
          outputImageSize: chartResult.imageBuffer.length,
          outputImagePath: imagePath,
          success: false,
          error: writeResult.error.message,
          durationMs: Date.now() - startTime
        });
        return {
          intent,
          classification,
          handled: false,
          jobId,
          error: writeResult.error.message
        };
      }
      jobManager.completeJob(jobId, {
        chartType: chartResult.chartConfig?.type,
        imageSize: chartResult.imageBuffer.length
      });
      this.updateLastAction(command, "chart-render", true, jobId);
      storeService.addOperation({
        id: jobId,
        command,
        jobType: "chart-render",
        inputText: clipboardText,
        inputHtml: snapshot.html,
        outputImageSize: chartResult.imageBuffer.length,
        outputImagePath: imagePath,
        success: true,
        durationMs: Date.now() - startTime
      });
      console.log(`[IntentService] Chart rendered and copied to clipboard (${chartResult.chartConfig?.type}, ${chartResult.imageBuffer.length} bytes)`);
      return {
        intent,
        classification,
        handled: true,
        jobId
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      jobManager.failJob(jobId, { code: "CHART_RENDER_FAILED", message: errorMsg });
      this.updateLastAction(command, "chart-render", false, jobId, errorMsg);
      return {
        intent,
        classification,
        handled: false,
        jobId,
        error: errorMsg
      };
    }
  }
  /**
   * Handle special intents (cancel, undo)
   */
  async handleSpecialIntent(classification) {
    const { intent } = classification;
    if (intent === "cancel") {
      return this.handleCancel(classification);
    }
    if (intent === "undo") {
      return this.handleUndo(classification);
    }
    return this.handleUnsupported(classification);
  }
  /**
   * Handle cancel command
   */
  handleCancel(classification) {
    const runningJobs = jobManager.getJobsByStatus("running");
    const pendingJobs = jobManager.getJobsByStatus("pending");
    const allJobs = [...runningJobs, ...pendingJobs];
    let cancelledCount = 0;
    for (const job of allJobs) {
      if (jobManager.cancelJob(job.id)) {
        cancelledCount++;
      }
    }
    const message = cancelledCount > 0 ? `Cancelled ${cancelledCount} job(s)` : "No active jobs to cancel";
    console.log(`[IntentService] Cancel: ${message}`);
    this.updateLastAction(classification.rawTranscript, "cancel", true);
    return {
      intent: "cancel",
      classification,
      handled: true
    };
  }
  /**
   * Handle undo command
   */
  handleUndo(classification) {
    const result = clipboardService.undo();
    if (result.success) {
      console.log("[IntentService] Undo successful");
      this.updateLastAction(classification.rawTranscript, "undo", true);
      return {
        intent: "undo",
        classification,
        handled: true
      };
    }
    const errorMsg = result.error?.message || "Nothing to undo";
    console.log("[IntentService] Undo failed:", errorMsg);
    this.updateLastAction(classification.rawTranscript, "undo", false, void 0, errorMsg);
    return {
      intent: "undo",
      classification,
      handled: false,
      error: errorMsg
    };
  }
  /**
   * Handle automation/browser intents using the Browser Agent
   */
  async handleBrowserIntent(classification) {
    const { intent } = classification;
    const task = classification.rawTranscript;
    const clipboardText = clipboardService.readClipboard();
    let resumeText = clipboardText || void 0;
    let documentFilePath;
    const copiedFilePaths = clipboardService.readFilePaths();
    if (copiedFilePaths.length > 0) {
      for (const filePath of copiedFilePaths) {
        const extraction = await documentExtractorService.extractFromClipboard(filePath);
        if (extraction.isDocument) {
          console.log(`[IntentService] Found copied document file: ${extraction.filePath}`);
          resumeText = extraction.text;
          documentFilePath = extraction.filePath;
          break;
        }
      }
    }
    if (!documentFilePath && clipboardText) {
      const extraction = await documentExtractorService.extractFromClipboard(clipboardText);
      if (extraction.isDocument) {
        console.log(`[IntentService] Extracted ${extraction.text.length} chars from ${extraction.fileType}: ${extraction.filePath}`);
        resumeText = extraction.text;
        documentFilePath = extraction.filePath;
      }
    }
    const urlMatch = clipboardText?.match(/https?:\/\/[^\s]+/);
    const startUrl = urlMatch ? urlMatch[0] : void 0;
    console.log(`[IntentService] Starting browser agent for task: "${task}"`);
    if (startUrl) {
      console.log(`[IntentService] Using start URL from clipboard: ${startUrl}`);
    }
    if (documentFilePath) {
      console.log(`[IntentService] Using document file for uploads: ${documentFilePath}`);
    }
    const isAvailable = await browserAgentService.isAvailable();
    if (!isAvailable) {
      const error = "OpenAI API key not configured. Set it in Settings.";
      this.updateLastAction(task, "browser-agent", false, void 0, error);
      return {
        intent,
        classification,
        handled: false,
        error
      };
    }
    browserAgentService.runTask(task, {
      resumeText,
      startUrl,
      documentFilePath
    }).then((result) => {
      console.log(`[IntentService] Browser agent completed:`, result);
      this.updateLastAction(
        task,
        "browser-agent",
        result.success,
        void 0,
        result.error || result.reason
      );
    }).catch((error) => {
      console.error(`[IntentService] Browser agent error:`, error);
      this.updateLastAction(task, "browser-agent", false, void 0, error.message);
    });
    this.updateLastAction(task, "browser-agent", true);
    return {
      intent,
      classification,
      handled: true
    };
  }
  /**
   * Check if text looks like a file path
   */
  isFilePath(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.startsWith("/") || // Unix absolute path
    trimmed.startsWith("~/") || // Home directory
    trimmed.startsWith("./") || // Relative path
    trimmed.startsWith("../") || // Parent relative path
    /^[a-zA-Z]:\\/.test(trimmed) || // Windows path
    /^\w+\.(js|ts|tsx|jsx|py|java|go|rs|rb|php|css|html|json|yaml|yml|md|txt)$/.test(trimmed);
  }
  /**
   * Handle code intents (OpenCode CLI)
   */
  async handleCodeIntent(classification) {
    const { intent } = classification;
    const openCodeService = getOpenCodeService();
    const clipboardText = clipboardService.readClipboard();
    let prompt = classification.rawTranscript;
    let context = clipboardText || void 0;
    if (clipboardText && this.isFilePath(clipboardText)) {
      const filePath = clipboardText.trim();
      prompt = `${classification.rawTranscript}

Target file: ${filePath}`;
      context = void 0;
      console.log(`[IntentService] Detected file path in clipboard: ${filePath}`);
    } else if (clipboardText && clipboardText.length > 0) {
      prompt = `${classification.rawTranscript}

Here is the code from clipboard to work with:
\`\`\`
${clipboardText}
\`\`\``;
      context = void 0;
    }
    const matchedSkills = skillService.matchSkillsForTask(prompt);
    if (matchedSkills.length > 0) {
      prompt = skillService.buildAugmentedPrompt(prompt, matchedSkills);
      console.log(`[IntentService] Applied ${matchedSkills.length} skill(s): ${matchedSkills.map((s) => s.name).join(", ")}`);
    }
    const opencodeCwd = storeService.getSetting("opencode_cwd") || process.env.HOME || process.cwd();
    console.log(`[IntentService] Starting OpenCode task for intent ${intent}: "${classification.rawTranscript}"`);
    console.log(`[IntentService] Working directory: ${opencodeCwd}`);
    const startTime = Date.now();
    try {
      const result = await openCodeService.runTask({
        prompt,
        context,
        cwd: opencodeCwd
      });
      console.log(`[IntentService] Started OpenCode job ${result.jobId}`);
      this.updateLastAction(classification.rawTranscript, intent, true, result.jobId);
      storeService.addOperation({
        id: result.jobId,
        command: classification.rawTranscript,
        jobType: intent,
        inputText: context || clipboardText,
        success: true,
        durationMs: Date.now() - startTime
      });
      return {
        intent,
        classification,
        handled: true,
        jobId: result.jobId
      };
    } catch (error) {
      const errorMsg = error.message;
      console.error(`[IntentService] OpenCode task failed:`, errorMsg);
      this.updateLastAction(classification.rawTranscript, intent, false, void 0, errorMsg);
      storeService.addOperation({
        id: `opencode-failed-${Date.now()}`,
        command: classification.rawTranscript,
        jobType: intent,
        inputText: context || clipboardText,
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime
      });
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg
      };
    }
  }
  /**
   * Handle subagent intents (custom OpenCode subagents)
   */
  async handleSubagentIntent(classification, subagentId) {
    const { intent } = classification;
    const openCodeService = getOpenCodeService();
    const subagent = subagentService.get(subagentId);
    if (!subagent) {
      const errorMsg = `Subagent not found: ${subagentId}`;
      console.error(`[IntentService] ${errorMsg}`);
      this.updateLastAction(classification.rawTranscript, intent, false, void 0, errorMsg);
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg
      };
    }
    const clipboardText = clipboardService.readClipboard();
    const userPrompt = classification.rawTranscript;
    const fullPrompt = `${subagent.systemPrompt}

---
User request: ${userPrompt}`;
    console.log(`[IntentService] Running subagent "${subagent.name}" (${subagentId})`);
    try {
      const result = await openCodeService.runTask({
        prompt: fullPrompt,
        context: clipboardText || void 0
      });
      console.log(`[IntentService] Started subagent job ${result.jobId}`);
      this.updateLastAction(classification.rawTranscript, `subagent:${subagent.name}`, true, result.jobId);
      return {
        intent,
        classification,
        handled: true,
        jobId: result.jobId
      };
    } catch (error) {
      const errorMsg = error.message;
      console.error(`[IntentService] Subagent task failed:`, errorMsg);
      this.updateLastAction(classification.rawTranscript, `subagent:${subagent.name}`, false, void 0, errorMsg);
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg
      };
    }
  }
  /**
   * Handle workflow intents (multi-stage agentic workflows)
   */
  async handleWorkflowIntent(classification) {
    const { intent } = classification;
    const clipboardText = clipboardService.readClipboard();
    let stages;
    switch (intent) {
      case "workflow:plan-code-review":
        stages = ["plan", "code", "review"];
        break;
      case "workflow:plan-code":
        stages = ["plan", "code"];
        break;
      case "workflow:plan-only":
        stages = ["plan"];
        break;
      default:
        stages = ["plan", "code", "review"];
    }
    console.log(`[IntentService] Starting workflow with stages: ${stages.join(" → ")}`);
    try {
      const result = await workflowService.startWorkflow({
        prompt: classification.rawTranscript,
        stages,
        context: clipboardText || void 0
      });
      console.log(`[IntentService] Started workflow job ${result.job.id}`);
      this.updateLastAction(classification.rawTranscript, intent, true, result.job.id);
      return {
        intent,
        classification,
        handled: true,
        jobId: result.job.id
      };
    } catch (error) {
      const errorMsg = error.message;
      console.error(`[IntentService] Workflow failed to start:`, errorMsg);
      this.updateLastAction(classification.rawTranscript, intent, false, void 0, errorMsg);
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg
      };
    }
  }
  /**
   * Handle file operation intents
   */
  async handleFileIntent(classification) {
    const { intent } = classification;
    console.log(`[IntentService] Executing file operation: "${classification.rawTranscript}"`);
    try {
      const copiedFilePaths = clipboardService.readFilePaths();
      let prompt = classification.rawTranscript;
      if (copiedFilePaths.length > 0) {
        console.log(`[IntentService] Found ${copiedFilePaths.length} files in clipboard for file operation`);
        const fileList = copiedFilePaths.map((p) => `  - ${p}`).join("\n");
        prompt = `${classification.rawTranscript}

## Files to operate on (from clipboard):
${fileList}`;
      }
      const result = await fileOperationService.executeDirectly({
        prompt
      });
      console.log(`[IntentService] File operations executed: ${result.job.successCount} success, ${result.job.failureCount} failed`);
      this.updateLastAction(
        classification.rawTranscript,
        intent,
        true,
        result.job.id
      );
      storeService.addOperation(
        classification.rawTranscript,
        "file-operation",
        true,
        `Completed ${result.job.successCount} file operations`,
        result.job.id
      );
      return {
        intent,
        classification,
        handled: true,
        jobId: result.job.id
      };
    } catch (error) {
      const errorMsg = error.message;
      console.error(`[IntentService] File operation preview failed:`, errorMsg);
      this.updateLastAction(classification.rawTranscript, intent, false, void 0, errorMsg);
      return {
        intent,
        classification,
        handled: false,
        error: errorMsg
      };
    }
  }
  /**
   * Get classification for a transcript without routing
   */
  classify(transcript) {
    return classifyIntent(transcript);
  }
  /**
   * Update last action summary
   */
  updateLastAction(transcript, capability, success, jobId, error) {
    this.lastAction = {
      timestamp: Date.now(),
      transcript,
      capability,
      success,
      jobId,
      error
    };
  }
  /**
   * Get last action summary
   */
  getLastAction() {
    return this.lastAction;
  }
}
const intentService = new IntentService();
class OpenAISttService {
  ws = null;
  apiKey = null;
  isConnected = false;
  transcriptCallback = null;
  currentTranscript = "";
  allTranscripts = [];
  // Accumulate all transcripts for the session
  pendingAudioChunks = [];
  /**
   * Set the OpenAI API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
  /**
   * Check if API key is configured
   */
  hasApiKey() {
    return !!this.apiKey;
  }
  /**
   * Connect to OpenAI Realtime API
   * @param forceReconnect If true, disconnect existing connection and create new one
   */
  async connect(forceReconnect = false) {
    if (!this.apiKey) {
      console.error("[OpenAI-STT] No API key configured");
      return false;
    }
    if (!forceReconnect && this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return true;
    }
    if (forceReconnect && this.ws) {
      console.log("[OpenAI-STT] Force reconnecting...");
      this.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(
          "wss://api.openai.com/v1/realtime?intent=transcription",
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "OpenAI-Beta": "realtime=v1"
            }
          }
        );
        this.ws.on("open", () => {
          console.log("[OpenAI-STT] WebSocket connected");
          this.isConnected = true;
          this.sendSessionConfig();
          for (const chunk of this.pendingAudioChunks) {
            this.sendAudioChunk(chunk);
          }
          this.pendingAudioChunks = [];
          resolve(true);
        });
        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });
        this.ws.on("error", (error) => {
          console.error("[OpenAI-STT] WebSocket error:", error);
          this.isConnected = false;
          this.pendingAudioChunks = [];
          resolve(false);
        });
        this.ws.on("close", (code, reason) => {
          console.log(`[OpenAI-STT] WebSocket closed (code: ${code}, reason: ${reason})`);
          this.isConnected = false;
          this.pendingAudioChunks = [];
        });
      } catch (error) {
        console.error("[OpenAI-STT] Failed to connect:", error);
        resolve(false);
      }
    });
  }
  /**
   * Send session configuration
   */
  sendSessionConfig() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const config = {
      type: "transcription_session.update",
      session: {
        input_audio_format: "pcm16",
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1500
          // 1.5s silence before segment ends
        },
        input_audio_noise_reduction: {
          type: "near_field"
        }
      }
    };
    this.ws.send(JSON.stringify(config));
    console.log("[OpenAI-STT] Session config sent");
  }
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case "transcription_session.created":
          console.log("[OpenAI-STT] Session created:", message.session?.id);
          break;
        case "transcription_session.updated":
          console.log("[OpenAI-STT] Session updated");
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (message.delta) {
            this.currentTranscript += message.delta;
            const fullText = this.allTranscripts.length > 0 ? this.allTranscripts.join(" ") + " " + this.currentTranscript : this.currentTranscript;
            console.log("[OpenAI-STT] Live transcript:", fullText);
            if (this.transcriptCallback) {
              console.log("[OpenAI-STT] Calling transcript callback...");
              this.transcriptCallback({ text: fullText, isFinal: false });
            } else {
              console.log("[OpenAI-STT] WARNING: No transcript callback set!");
            }
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          const finalText = message.transcript || this.currentTranscript;
          console.log("[OpenAI-STT] Transcription segment completed:", finalText);
          if (finalText.trim()) {
            this.allTranscripts.push(finalText.trim());
            console.log("[OpenAI-STT] Accumulated transcripts:", this.allTranscripts.length, "segments, total:", this.allTranscripts.join(" "));
          }
          this.transcriptCallback?.({
            text: this.allTranscripts.join(" "),
            isFinal: true
          });
          this.currentTranscript = "";
          break;
        case "input_audio_buffer.speech_started":
          console.log("[OpenAI-STT] Speech started (VAD detected voice)");
          break;
        case "input_audio_buffer.speech_stopped":
          console.log("[OpenAI-STT] Speech stopped (VAD detected silence)");
          break;
        case "input_audio_buffer.committed":
          break;
        case "error":
          console.error("[OpenAI-STT] API error:", message.error);
          break;
        default:
          console.log("[OpenAI-STT] Unknown event type:", message.type);
          break;
      }
    } catch (error) {
      console.error("[OpenAI-STT] Failed to parse message:", error);
    }
  }
  /**
   * Send audio chunk to the API
   * Audio should be PCM16 @ 16kHz mono
   */
  sendAudioChunk(base64Audio) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.pendingAudioChunks.length < 100) {
        this.pendingAudioChunks.push(base64Audio);
      }
      return;
    }
    const message = {
      type: "input_audio_buffer.append",
      audio: base64Audio
    };
    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[OpenAI-STT] Failed to send audio chunk:", error);
    }
  }
  /**
   * Send raw PCM buffer (will be base64 encoded)
   */
  sendAudioBuffer(buffer) {
    const base64 = buffer.toString("base64");
    this.sendAudioChunk(base64);
  }
  /**
   * Set callback for transcription results
   */
  onTranscript(callback) {
    this.transcriptCallback = callback;
  }
  /**
   * Commit the audio buffer (signal end of input)
   */
  commitAudio() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = {
      type: "input_audio_buffer.commit"
    };
    this.ws.send(JSON.stringify(message));
    console.log("[OpenAI-STT] Audio buffer committed");
  }
  /**
   * Clear the audio buffer and reset transcripts
   */
  clearAudio() {
    this.currentTranscript = "";
    this.allTranscripts = [];
    this.pendingAudioChunks = [];
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const message = {
      type: "input_audio_buffer.clear"
    };
    this.ws.send(JSON.stringify(message));
    console.log("[OpenAI-STT] Audio buffer cleared, transcripts reset");
  }
  /**
   * Get the full accumulated transcript
   */
  getFullTranscript() {
    return this.allTranscripts.join(" ");
  }
  /**
   * Disconnect from the API
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.currentTranscript = "";
    this.allTranscripts = [];
    this.pendingAudioChunks = [];
  }
  /**
   * Check if connected
   */
  isReady() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
const openaiSttService = new OpenAISttService();
class GroqSttService {
  client = null;
  apiKey = null;
  /**
   * Get or create Groq client
   */
  async getClient() {
    const apiKey = await secretsService.getGroqKey();
    if (!apiKey) {
      throw new Error("No Groq API key configured. Add it in Settings.");
    }
    if (!this.client || this.apiKey !== apiKey) {
      this.apiKey = apiKey;
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }
  /**
   * Check if Groq API key is configured
   */
  async hasApiKey() {
    const key = await secretsService.getGroqKey();
    return !!key;
  }
  /**
   * Transcribe audio buffer using Groq Whisper
   * @param audioBuffer - Raw PCM16 audio at 16kHz mono
   * @param durationMs - Recording duration in milliseconds
   */
  async transcribe(audioBuffer, durationMs) {
    const client = await this.getClient();
    console.log(`[GroqSTT] Transcribing ${audioBuffer.length} bytes (${durationMs}ms)...`);
    const wavBuffer = this.pcmToWav(audioBuffer, 16e3, 1, 16);
    const tempPath = path__namespace.join(os__namespace.tmpdir(), `clipmorph-audio-${Date.now()}.wav`);
    fs__namespace.writeFileSync(tempPath, wavBuffer);
    try {
      const startTime = Date.now();
      const transcription = await client.audio.transcriptions.create({
        file: fs__namespace.createReadStream(tempPath),
        model: "whisper-large-v3-turbo",
        // Fast and accurate
        language: "en",
        response_format: "json"
      });
      const elapsed = Date.now() - startTime;
      console.log(`[GroqSTT] Transcription completed in ${elapsed}ms: "${transcription.text}"`);
      return {
        text: transcription.text,
        duration: elapsed
      };
    } finally {
      try {
        fs__namespace.unlinkSync(tempPath);
      } catch {
      }
    }
  }
  /**
   * Convert raw PCM16 audio to WAV format
   */
  pcmToWav(pcmBuffer, sampleRate, channels, bitsPerSample) {
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize - 8;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const header = Buffer.alloc(headerSize);
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcmBuffer]);
  }
}
const groqSttService = new GroqSttService();
const SILENCE_TIMEOUT_MS = 1100;
class ElevenLabsSttService {
  ws = null;
  apiKey = null;
  isConnected = false;
  transcriptCallback = null;
  executeCallback = null;
  currentTranscript = "";
  committedTranscripts = [];
  isListening = false;
  reconnectTimeout = null;
  keepAliveInterval = null;
  silenceTimeout = null;
  lastAudioTime = 0;
  hasExecuted = false;
  // Prevent double execution
  // Audio settings
  suppressNonSpeech = false;
  // Track last transcript to detect actual changes
  lastTranscriptText = "";
  // Track last EXECUTED transcript to prevent re-execution loops
  lastExecutedTranscript = "";
  /**
   * Set the API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }
  /**
   * Enable/disable noise suppression (filters background noise, music, etc.)
   */
  setNoiseSuppression(enabled) {
    this.suppressNonSpeech = enabled;
    console.log(`[ElevenLabs-STT] Noise suppression: ${enabled ? "ON" : "OFF"}`);
  }
  /**
   * Get current noise suppression setting
   */
  getNoiseSuppression() {
    return this.suppressNonSpeech;
  }
  /**
   * Check if API key is configured
   */
  async hasApiKey() {
    const key = await secretsService.getElevenLabsKey();
    return !!key;
  }
  /**
   * Connect to ElevenLabs Realtime STT
   */
  async connect() {
    const apiKey = this.apiKey || await secretsService.getElevenLabsKey();
    if (!apiKey) {
      console.error("[ElevenLabs-STT] No API key configured");
      return false;
    }
    this.apiKey = apiKey;
    if (this.ws) {
      this.disconnect();
    }
    return new Promise((resolve) => {
      try {
        const params = new URLSearchParams({
          model_id: "scribe_v2_realtime",
          language_code: "en",
          sample_rate: "16000",
          enable_logging: "false"
        });
        if (this.suppressNonSpeech) {
          params.set("suppress_non_speech", "true");
          console.log("[ElevenLabs-STT] Noise suppression enabled");
        }
        const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
        console.log("[ElevenLabs-STT] Connecting to:", url);
        this.ws = new WebSocket(url, {
          headers: {
            "xi-api-key": apiKey
          }
        });
        this.ws.on("open", () => {
          console.log("[ElevenLabs-STT] WebSocket connected");
          this.isConnected = true;
          this.startKeepAlive();
          resolve(true);
        });
        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });
        this.ws.on("close", (code, reason) => {
          console.log(`[ElevenLabs-STT] WebSocket closed (code: ${code}, reason: ${reason})`);
          this.isConnected = false;
          this.stopKeepAlive();
          if (this.isListening && !this.reconnectTimeout) {
            console.log("[ElevenLabs-STT] Will attempt reconnect in 2s...");
            this.reconnectTimeout = setTimeout(() => {
              this.reconnectTimeout = null;
              if (this.isListening) {
                this.connect();
              }
            }, 2e3);
          }
        });
        this.ws.on("error", (error) => {
          console.error("[ElevenLabs-STT] WebSocket error:", error);
          resolve(false);
        });
      } catch (error) {
        console.error("[ElevenLabs-STT] Failed to connect:", error);
        resolve(false);
      }
    });
  }
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const messageType = message.message_type;
      if (messageType !== "audio_acknowledgement") {
        console.log("[ElevenLabs-STT] Message:", messageType, JSON.stringify(message).substring(0, 300));
      }
      switch (messageType) {
        case "session_started":
          console.log("[ElevenLabs-STT] Session started, id:", message.session_id);
          break;
        case "partial_transcript":
          if (message.text) {
            this.currentTranscript = message.text;
            const fullText = this.getFullTranscript();
            const textChanged = fullText !== this.lastTranscriptText;
            if (textChanged) {
              console.log("[ElevenLabs-STT] Live:", fullText);
              this.lastTranscriptText = fullText;
              if (this.hasExecuted && this.lastExecutedTranscript) {
                if (!fullText.startsWith(this.lastExecutedTranscript) && !this.lastExecutedTranscript.startsWith(fullText)) {
                  console.log("[ElevenLabs-STT] New command detected, enabling execution");
                  this.hasExecuted = false;
                }
              }
              this.resetSilenceTimer();
              this.startSilenceTimer();
              this.transcriptCallback?.({
                text: fullText,
                isFinal: false,
                isPartial: true
              });
            }
          }
          break;
        case "final_transcript":
        case "committed_transcript":
          if (message.text && message.text.trim()) {
            console.log("[ElevenLabs-STT] Final:", message.text);
            this.committedTranscripts.push(message.text.trim());
            this.currentTranscript = "";
            const fullText = this.getFullTranscript();
            this.transcriptCallback?.({
              text: fullText,
              isFinal: true,
              isPartial: false
            });
            this.startSilenceTimer();
          }
          break;
        case "audio_acknowledgement":
          break;
        case "resource_exhausted":
          console.warn("[ElevenLabs-STT] Rate limit hit - service at capacity");
          this.transcriptCallback?.({
            text: "⚠️ Voice service temporarily unavailable (rate limit)",
            isFinal: false,
            isPartial: false
          });
          break;
        case "input_error":
        case "error":
          if (message.error === "Message must be a valid protocol message") {
            break;
          }
          console.error("[ElevenLabs-STT] API error:", message.error || message);
          break;
        default:
          if (messageType) {
            console.log("[ElevenLabs-STT] Unhandled message_type:", messageType);
          }
          break;
      }
    } catch (error) {
      console.error("[ElevenLabs-STT] Failed to parse message:", error, data);
    }
  }
  /**
   * Start silence timer - auto-execute after SILENCE_TIMEOUT_MS of no new speech
   */
  startSilenceTimer() {
    this.resetSilenceTimer();
    this.silenceTimeout = setTimeout(async () => {
      if (this.isListening && !this.hasExecuted) {
        const transcript = this.getFullTranscript();
        if (transcript && transcript.length > 15) {
          if (transcript === this.lastExecutedTranscript) {
            console.log(`[ElevenLabs-STT] Ignoring duplicate transcript: "${transcript.substring(0, 50)}..."`);
            return;
          }
          let textToExecute = transcript;
          if (this.lastExecutedTranscript && transcript.startsWith(this.lastExecutedTranscript)) {
            const newPart = transcript.slice(this.lastExecutedTranscript.length).trim();
            if (newPart.length < 15) {
              console.log(`[ElevenLabs-STT] New addition too short to execute: "${newPart}"`);
              return;
            }
            textToExecute = transcript;
            console.log(`[ElevenLabs-STT] Continuation detected, new part: "${newPart.substring(0, 50)}..."`);
          }
          console.log(`[ElevenLabs-STT] Silence timeout (${SILENCE_TIMEOUT_MS}ms), auto-executing!`);
          this.hasExecuted = true;
          this.lastExecutedTranscript = transcript;
          try {
            await this.executeCallback?.(textToExecute, "silence");
          } catch (error) {
            console.error("[ElevenLabs-STT] Execute callback error:", error);
          }
        } else if (transcript) {
          console.log(`[ElevenLabs-STT] Transcript too short to execute: "${transcript}" (${transcript.length} chars)`);
        }
      }
    }, SILENCE_TIMEOUT_MS);
  }
  /**
   * Reset silence timer (called when new speech detected)
   */
  resetSilenceTimer() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    this.lastAudioTime = Date.now();
  }
  /**
   * Set callback for auto-execution (pattern or silence triggered)
   */
  onExecute(callback) {
    this.executeCallback = callback;
  }
  /**
   * Send audio chunk to the API
   * @param buffer Raw PCM16 audio at 16kHz mono
   */
  sendAudioChunk(buffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const message = {
        message_type: "input_audio_chunk",
        audio_base_64: buffer.toString("base64"),
        sample_rate: 16e3
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[ElevenLabs-STT] Failed to send audio chunk:", error);
    }
  }
  /**
   * Set callback for transcription results
   */
  onTranscript(callback) {
    this.transcriptCallback = callback;
  }
  /**
   * Get the full accumulated transcript
   */
  getFullTranscript() {
    const committed = this.committedTranscripts.join(" ");
    if (this.currentTranscript) {
      return committed ? `${committed} ${this.currentTranscript}` : this.currentTranscript;
    }
    return committed;
  }
  /**
   * Clear transcripts and reset state for next command
   * This is called after each command execution to prepare for the next one
   */
  clearTranscripts() {
    this.currentTranscript = "";
    this.committedTranscripts = [];
    this.lastTranscriptText = "";
    this.hasExecuted = false;
    this.resetSilenceTimer();
  }
  /**
   * Start continuous listening mode
   */
  async startListening() {
    this.isListening = true;
    this.hasExecuted = false;
    this.lastExecutedTranscript = "";
    this.clearTranscripts();
    if (!this.isConnected) {
      return await this.connect();
    }
    return true;
  }
  /**
   * Stop continuous listening mode
   */
  stopListening() {
    this.isListening = false;
    let finalTranscript = this.getFullTranscript();
    if (!finalTranscript && this.currentTranscript) {
      finalTranscript = this.currentTranscript;
    }
    console.log("[ElevenLabs-STT] Stop listening, transcript:", finalTranscript);
    return finalTranscript;
  }
  /**
   * Start keep-alive pings
   */
  startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 15e3);
  }
  /**
   * Stop keep-alive pings
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
  /**
   * Disconnect from the API
   */
  disconnect() {
    this.isListening = false;
    this.stopKeepAlive();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.clearTranscripts();
  }
  /**
   * Check if connected and ready
   */
  isReady() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
const elevenLabsSttService = new ElevenLabsSttService();
const record = require("node-record-lpcm16");
const DEFAULT_PTT_HOTKEY = "CommandOrControl+Shift+V";
const VALID_MODIFIERS = ["Command", "Cmd", "Control", "Ctrl", "CommandOrControl", "CmdOrCtrl", "Alt", "Option", "AltGr", "Shift", "Super", "Meta"];
const VALID_KEYS = [
  // Letters
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  // Numbers
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  // Function keys
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "F13",
  "F14",
  "F15",
  "F16",
  "F17",
  "F18",
  "F19",
  "F20",
  "F21",
  "F22",
  "F23",
  "F24",
  // Special keys
  "Space",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Return",
  "Enter",
  "Escape",
  "Esc",
  "Up",
  "Down",
  "Left",
  "Right",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  // Punctuation
  "Plus",
  "Minus",
  "Period",
  "Comma",
  "Slash",
  "Backslash",
  "Semicolon",
  "Quote",
  "BracketLeft",
  "BracketRight",
  "Backquote"
];
function validateHotkey(hotkey) {
  if (!hotkey || typeof hotkey !== "string") {
    return { valid: false, error: "Hotkey must be a non-empty string" };
  }
  const parts = hotkey.split("+").map((p) => p.trim());
  if (parts.length < 2) {
    return { valid: false, error: 'Hotkey must include at least one modifier and a key (e.g., "Ctrl+Shift+V")' };
  }
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  for (const mod of modifiers) {
    if (!VALID_MODIFIERS.includes(mod)) {
      return { valid: false, error: `Invalid modifier: "${mod}". Valid modifiers: ${VALID_MODIFIERS.slice(0, 6).join(", ")}...` };
    }
  }
  if (!VALID_KEYS.includes(key)) {
    return { valid: false, error: `Invalid key: "${key}". Use a letter, number, function key, or special key like "Space"` };
  }
  if (modifiers.length === 0) {
    return { valid: false, error: "At least one modifier key is required (e.g., Ctrl, Cmd, Alt, Shift)" };
  }
  return { valid: true };
}
const MAX_TRANSCRIPTS = 20;
class VoiceService {
  eventEmitter = null;
  pttHotkey = DEFAULT_PTT_HOTKEY;
  isHotkeyRegistered = false;
  isHotkeyPressed = false;
  captureState = {
    isCapturing: false,
    startTime: null,
    recording: null,
    pendingTranscript: "",
    audioChunks: []
  };
  // Status callback for app status updates
  statusCallback = null;
  // Transcript history (in-memory, persisted to SQLite)
  transcripts = [];
  lastTranscript = null;
  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Set callback for app status changes
   */
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }
  /**
   * Emit an event to the renderer
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Update app status
   */
  setAppStatus(status) {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }
  /**
   * Check if voice capture can be enabled
   */
  canEnable() {
    const micPermission = checkMicrophonePermission();
    return micPermission.status === "granted";
  }
  /**
   * Set the OpenAI API key
   */
  setApiKey(apiKey) {
    openaiSttService.setApiKey(apiKey);
  }
  /**
   * Check if OpenAI API key is configured
   */
  hasApiKey() {
    return openaiSttService.hasApiKey();
  }
  /**
   * Initialize OpenAI STT connection
   * @param forceReconnect If true, disconnect and create fresh connection
   */
  async initStt(forceReconnect = false) {
    if (!this.hasApiKey()) {
      console.log("[VoiceService] No OpenAI API key configured");
      return false;
    }
    openaiSttService.onTranscript((result) => {
      this.captureState.pendingTranscript = result.text;
      console.log(`[VoiceService] Emitting transcript to UI: "${result.text}" (isFinal: ${result.isFinal})`);
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: result.text,
          isFinal: result.isFinal
        })
      );
    });
    const connected = await openaiSttService.connect(forceReconnect);
    if (connected) {
      console.log("[VoiceService] OpenAI STT connected");
    }
    return connected;
  }
  /**
   * Check if STT is ready
   */
  isSttReady() {
    return openaiSttService.isReady();
  }
  /**
   * Register the push-to-talk global hotkey
   * Toggle mode: press once to start, press again to stop
   */
  registerHotkey(hotkey) {
    if (this.isHotkeyRegistered) {
      this.unregisterHotkey();
    }
    const hotkeyToRegister = hotkey || this.pttHotkey;
    const registered = electron.globalShortcut.register(hotkeyToRegister, () => {
      if (this.captureState.isCapturing) {
        this.handleHotkeyUp();
      } else {
        this.handleHotkeyDown();
      }
    });
    if (registered) {
      this.pttHotkey = hotkeyToRegister;
      this.isHotkeyRegistered = true;
    }
    return registered;
  }
  /**
   * Unregister the push-to-talk hotkey
   */
  unregisterHotkey() {
    if (this.isHotkeyRegistered) {
      electron.globalShortcut.unregister(this.pttHotkey);
      this.isHotkeyRegistered = false;
    }
  }
  /**
   * Handle hotkey press (start listening)
   */
  handleHotkeyDown() {
    if (!this.canEnable()) {
      console.log("[VoiceService] Cannot start capture - microphone permission not granted");
      return;
    }
    this.isHotkeyPressed = true;
    this.startCapture();
  }
  /**
   * Handle hotkey release (stop listening, start transcription)
   */
  handleHotkeyUp() {
    if (this.isHotkeyPressed) {
      this.isHotkeyPressed = false;
      this.stopCapture();
    }
  }
  /**
   * Start audio capture and streaming to OpenAI
   */
  async startCapture() {
    if (this.captureState.isCapturing) return;
    if (!this.hasApiKey()) {
      console.log("[VoiceService] No OpenAI API key - set OPENAI_API_KEY env var");
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: "[No OpenAI API key configured]",
          isFinal: true
        })
      );
      return;
    }
    console.log("[VoiceService] Connecting to OpenAI STT (fresh session)...");
    const connected = await this.initStt(true);
    if (!connected) {
      console.error("[VoiceService] Failed to connect to OpenAI STT");
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: "[Failed to connect to OpenAI]",
          isFinal: true
        })
      );
      return;
    }
    this.captureState = {
      isCapturing: true,
      startTime: Date.now(),
      recording: null,
      pendingTranscript: "",
      audioChunks: []
      // Reset audio buffer for Groq
    };
    this.setAppStatus("listening");
    this.emit(createEvent(EventTypes.VOICE_STARTED));
    console.log("[VoiceService] Audio capture started");
    const sttProvider = await this.getSttProvider();
    console.log(`[VoiceService] Using ${sttProvider} for transcription`);
    if (sttProvider === "elevenlabs") {
      await this.setupElevenLabsStreaming();
    } else {
      openaiSttService.clearAudio();
    }
    try {
      const inputDevice = settingsService.get("audio.inputDevice");
      const recordOptions = {
        sampleRate: 16e3,
        channels: 1,
        audioType: "raw",
        // raw PCM, no WAV header
        recorder: "sox",
        verbose: true
        // Enable verbose logging
      };
      if (inputDevice) {
        recordOptions.device = inputDevice;
        console.log(`[VoiceService] Using audio device: ${inputDevice}`);
      }
      console.log("[VoiceService] Starting sox recording with options:", JSON.stringify(recordOptions));
      const recording = record.record(recordOptions);
      this.captureState.recording = recording;
      let chunkCount = 0;
      let totalBytes = 0;
      recording.stream().on("data", (chunk) => {
        if (this.captureState.isCapturing) {
          chunkCount++;
          totalBytes += chunk.length;
          this.captureState.audioChunks.push(chunk);
          if (chunkCount === 1) {
            console.log(`[VoiceService] First audio chunk received: ${chunk.length} bytes`);
          } else if (chunkCount % 50 === 0) {
            console.log(`[VoiceService] Audio chunk #${chunkCount}, total: ${totalBytes} bytes`);
          }
          if (sttProvider === "elevenlabs") {
            elevenLabsSttService.sendAudioChunk(chunk);
          } else if (sttProvider === "openai") {
            openaiSttService.sendAudioBuffer(chunk);
          }
        }
      });
      recording.stream().on("error", (err) => {
        console.error("[VoiceService] Recording stream error:", err);
      });
      recording.stream().on("end", () => {
        console.log(`[VoiceService] Recording stream ended. Total chunks: ${chunkCount}, total bytes: ${totalBytes}`);
      });
    } catch (err) {
      console.error("[VoiceService] Failed to start recording:", err);
    }
  }
  /**
   * Determine which STT provider to use
   */
  async getSttProvider() {
    const preferredProvider = settingsService.get("voice.sttProvider");
    if (preferredProvider === "elevenlabs" && await elevenLabsSttService.hasApiKey()) {
      return "elevenlabs";
    }
    if (preferredProvider === "groq" && await groqSttService.hasApiKey()) {
      return "groq";
    }
    if (await elevenLabsSttService.hasApiKey()) {
      return "elevenlabs";
    }
    if (await groqSttService.hasApiKey()) {
      return "groq";
    }
    return "openai";
  }
  /**
   * Set up ElevenLabs streaming with live transcript updates and auto-execute
   */
  async setupElevenLabsStreaming() {
    elevenLabsSttService.onTranscript((result) => {
      this.captureState.pendingTranscript = result.text;
      console.log(`[VoiceService] ElevenLabs transcript: "${result.text}" (final: ${result.isFinal})`);
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: result.text,
          isFinal: result.isFinal
        })
      );
    });
    elevenLabsSttService.onExecute(async (transcript, reason) => {
      console.log(`[VoiceService] Auto-execute triggered by ${reason}: "${transcript}"`);
      this.setAppStatus("processing");
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: transcript,
          isFinal: false,
          isExecuting: true
          // New flag to indicate execution in progress
        })
      );
      const startTime = this.captureState.startTime;
      const duration = startTime ? Date.now() - startTime : 0;
      this.storeTranscript(transcript, startTime, duration);
      const routingResult = await intentService.routeTranscript(transcript);
      console.log(`[VoiceService] Auto-execute intent result:`, routingResult);
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: "✓ Done! Ready for next command...",
          isFinal: false,
          isDone: true
          // New flag for done state
        })
      );
      elevenLabsSttService.clearTranscripts();
      setTimeout(() => {
        if (this.captureState.isCapturing) {
          this.setAppStatus("listening");
          this.emit(
            createEvent(EventTypes.VOICE_TRANSCRIPT, {
              text: "",
              isFinal: false
            })
          );
        }
      }, 1500);
    });
    const noiseSuppression = await storeService.getSetting("voice.noiseSuppression");
    elevenLabsSttService.setNoiseSuppression(noiseSuppression === "true");
    const connected = await elevenLabsSttService.startListening();
    if (!connected) {
      console.error("[VoiceService] Failed to connect to ElevenLabs STT");
    }
  }
  /**
   * Stop audio capture and finalize transcription
   */
  async stopCapture() {
    if (!this.captureState.isCapturing) return;
    const duration = this.captureState.startTime ? Date.now() - this.captureState.startTime : 0;
    const startTime = this.captureState.startTime;
    const audioChunks = this.captureState.audioChunks;
    if (this.captureState.recording) {
      this.captureState.recording.stop();
    }
    this.captureState.isCapturing = false;
    this.emit(createEvent(EventTypes.VOICE_STOPPED));
    console.log(`[VoiceService] Audio capture stopped (duration: ${duration}ms)`);
    if (duration < 300) {
      console.log("[VoiceService] Capture too short, ignoring");
      this.resetCaptureState();
      this.setAppStatus("idle");
      return;
    }
    this.setAppStatus("processing");
    this.emit(
      createEvent(EventTypes.VOICE_TRANSCRIPT, {
        text: "⏳ Transcribing...",
        isFinal: false
      })
    );
    let transcriptText = null;
    const sttProvider = await this.getSttProvider();
    if (sttProvider === "elevenlabs") {
      transcriptText = elevenLabsSttService.stopListening();
      console.log(`[VoiceService] ElevenLabs final transcript: "${transcriptText}"`);
    } else if (sttProvider === "groq" && audioChunks.length > 0) {
      try {
        const audioBuffer = Buffer.concat(audioChunks);
        console.log(`[VoiceService] Sending ${audioBuffer.length} bytes to Groq Whisper...`);
        const result = await groqSttService.transcribe(audioBuffer, duration);
        transcriptText = result.text;
        console.log(`[VoiceService] Groq transcript: "${transcriptText}"`);
      } catch (err) {
        console.error("[VoiceService] Groq transcription failed, falling back to OpenAI:", err);
      }
    }
    if (!transcriptText) {
      openaiSttService.commitAudio();
      const waitTime = Math.min(5e3, Math.max(2e3, duration / 5));
      console.log(`[VoiceService] Waiting ${waitTime}ms for OpenAI transcription...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      transcriptText = openaiSttService.getFullTranscript() || this.captureState.pendingTranscript;
    }
    if (transcriptText && transcriptText.trim().length > 0) {
      console.log(`[VoiceService] Final transcript: "${transcriptText}"`);
      this.storeTranscript(transcriptText, startTime, duration);
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: transcriptText,
          isFinal: true
        })
      );
      const routingResult = await intentService.routeTranscript(transcriptText);
      console.log(`[VoiceService] Intent routing result:`, routingResult);
    } else {
      console.log(`[VoiceService] No transcription received`);
      this.emit(
        createEvent(EventTypes.VOICE_TRANSCRIPT, {
          text: "[No speech detected]",
          isFinal: true
        })
      );
    }
    this.resetCaptureState();
    this.setAppStatus("idle");
  }
  /**
   * Store a transcript in history (persisted to SQLite)
   */
  storeTranscript(text, startTime, durationMs) {
    const record2 = {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: startTime || Date.now(),
      durationMs
    };
    try {
      storeService.addTranscript(record2.id, text, durationMs);
    } catch (error) {
      console.error("[VoiceService] Failed to persist transcript:", error);
    }
    this.transcripts.unshift(record2);
    if (this.transcripts.length > MAX_TRANSCRIPTS) {
      this.transcripts = this.transcripts.slice(0, MAX_TRANSCRIPTS);
    }
    this.lastTranscript = record2;
    return record2;
  }
  /**
   * Get the last transcript
   */
  getLastTranscript() {
    return this.lastTranscript;
  }
  /**
   * Get all transcripts (most recent first)
   * Loads from SQLite if memory cache is empty
   */
  getTranscripts() {
    if (this.transcripts.length === 0) {
      try {
        const rows = storeService.getTranscripts(MAX_TRANSCRIPTS);
        this.transcripts = rows.map((row) => ({
          id: row.id,
          text: row.text,
          timestamp: row.created_at,
          durationMs: row.duration_ms ?? void 0
        }));
        if (this.transcripts.length > 0) {
          this.lastTranscript = this.transcripts[0];
        }
      } catch (error) {
        console.error("[VoiceService] Failed to load transcripts from SQLite:", error);
      }
    }
    return [...this.transcripts];
  }
  /**
   * Clear transcript history (both memory and SQLite)
   */
  clearTranscripts() {
    this.transcripts = [];
    this.lastTranscript = null;
    try {
      storeService.clearTranscripts();
    } catch (error) {
      console.error("[VoiceService] Failed to clear transcripts from SQLite:", error);
    }
  }
  /**
   * Reset capture state
   */
  resetCaptureState() {
    if (this.captureState.recording) {
      try {
        this.captureState.recording.stop();
      } catch {
      }
    }
    this.captureState = {
      isCapturing: false,
      startTime: null,
      recording: null,
      pendingTranscript: "",
      audioChunks: []
    };
  }
  /**
   * Get current voice state
   */
  getState() {
    return {
      isCapturing: this.captureState.isCapturing,
      isHotkeyRegistered: this.isHotkeyRegistered,
      hotkey: this.pttHotkey,
      canEnable: this.canEnable()
    };
  }
  /**
   * Manually trigger start (for testing or alternative activation)
   */
  start() {
    if (!this.canEnable()) {
      return false;
    }
    this.handleHotkeyDown();
    return true;
  }
  /**
   * Manually trigger stop (for testing or alternative activation)
   */
  stop() {
    this.handleHotkeyUp();
  }
  /**
   * Check if currently capturing
   */
  isCapturing() {
    return this.captureState.isCapturing;
  }
  /**
   * Get the current hotkey
   */
  getHotkey() {
    return this.pttHotkey;
  }
  /**
   * Get the current audio input device setting
   */
  getInputDevice() {
    return settingsService.get("audio.inputDevice");
  }
  /**
   * Set the audio input device
   * Pass empty string to use system default
   */
  setInputDevice(device) {
    settingsService.set("audio.inputDevice", device);
    console.log(`[VoiceService] Audio input device set to: ${device || "(system default)"}`);
  }
  /**
   * List available audio input devices (macOS)
   * Returns device names that can be passed to setInputDevice()
   */
  async listInputDevices() {
    return new Promise((resolve) => {
      const { exec } = require("child_process");
      exec("system_profiler SPAudioDataType -json", (error, stdout) => {
        if (error) {
          console.error("[VoiceService] Failed to list audio devices:", error);
          resolve([]);
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const devices = [];
          const audioData = data.SPAudioDataType || [];
          for (const item of audioData) {
            if (item._items) {
              for (const device of item._items) {
                if (device.coreaudio_input_source) {
                  devices.push(device._name);
                }
              }
            }
            if (item.coreaudio_input_source) {
              devices.push(item._name);
            }
          }
          resolve(devices);
        } catch (parseError) {
          console.error("[VoiceService] Failed to parse audio devices:", parseError);
          resolve([]);
        }
      });
    });
  }
  /**
   * Change the push-to-talk hotkey
   * Returns success status and any error message
   */
  setHotkey(newHotkey) {
    const validation = validateHotkey(newHotkey);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    const wasRegistered = this.isHotkeyRegistered;
    if (wasRegistered) {
      this.unregisterHotkey();
    }
    const registered = this.registerHotkey(newHotkey);
    if (!registered) {
      if (wasRegistered) {
        this.registerHotkey(this.pttHotkey);
      }
      return {
        success: false,
        error: `Failed to register hotkey "${newHotkey}". It may be in use by another application.`
      };
    }
    return { success: true };
  }
  /**
   * Cleanup on app quit
   */
  async cleanup() {
    this.unregisterHotkey();
    if (this.captureState.isCapturing) {
      this.resetCaptureState();
    }
    openaiSttService.disconnect();
  }
}
const voiceService = new VoiceService();
class TransformService {
  eventEmitter = null;
  /**
   * Set the event emitter for sending events to the renderer
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an event to the renderer
   */
  emit(event) {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }
  /**
   * Execute a transform job
   */
  async executeTransform(jobId) {
    const job = jobManager.getJob(jobId);
    if (!job) {
      return { success: false, input: "", output: "", error: "Job not found" };
    }
    const jobInput = job.input;
    const intent = jobInput?.intent;
    const transcript = jobInput?.transcript;
    if (!intent) {
      jobManager.failJob(jobId, { code: "TRANSFORM_INVALID_INPUT", message: "No intent specified" });
      return { success: false, input: "", output: "", error: "No intent specified" };
    }
    jobManager.startJob(jobId);
    this.emit(createEvent(EventTypes.TRANSFORM_STARTED, { jobId, intent }));
    const clipboardText = clipboardService.readClipboard();
    const snapshot = clipboardService.getCurrentSnapshot();
    if (!clipboardText || !snapshot) {
      const error = "Clipboard is empty";
      jobManager.failJob(jobId, { code: "TRANSFORM_INVALID_INPUT", message: error });
      this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error }));
      return { success: false, input: "", output: "", error };
    }
    try {
      const chain = transcript ? parseChain(transcript) : null;
      let result;
      if (chain && chain.isChain && chain.intents.length > 1) {
        result = await this.executeChain(chain.intents, clipboardText);
      } else {
        result = await this.applyTransform(intent, clipboardText);
      }
      if (!result.success) {
        jobManager.failJob(jobId, { code: "TRANSFORM_EXECUTION_FAILED", message: result.error || "Transform failed" });
        this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: result.error }));
        return result;
      }
      const writeResult = clipboardService.writeClipboardGated(result.output, snapshot.id);
      if (!writeResult.success) {
        jobManager.failJob(jobId, {
          code: writeResult.error.code,
          message: writeResult.error.message
        });
        this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: writeResult.error.message }));
        return { success: false, input: clipboardText, output: result.output, error: writeResult.error.message };
      }
      jobManager.completeJob(jobId, { output: result.output });
      this.emit(createEvent(EventTypes.TRANSFORM_COMPLETED, { jobId, output: result.output }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      jobManager.failJob(jobId, { code: "TRANSFORM_EXECUTION_FAILED", message: errorMessage });
      this.emit(createEvent(EventTypes.TRANSFORM_FAILED, { jobId, error: errorMessage }));
      return { success: false, input: clipboardText, output: "", error: errorMessage };
    }
  }
  /**
   * Execute a chain of transforms
   */
  async executeChain(intents, input) {
    let currentOutput = input;
    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      const result = await this.applyTransform(intent, currentOutput);
      if (!result.success) {
        return {
          success: false,
          input,
          output: currentOutput,
          error: `Step ${i + 1} (${intent}) failed: ${result.error}`
        };
      }
      currentOutput = result.output;
    }
    return {
      success: true,
      input,
      output: currentOutput
    };
  }
  /**
   * Apply a transform to text based on intent
   */
  async applyTransform(intent, text) {
    switch (intent) {
      case "url:clean":
        return this.transformUrlClean(text);
      case "url:markdown":
        return this.transformUrlMarkdown(text);
      case "json:pretty":
        return this.transformJsonPretty(text);
      case "json:minify":
        return this.transformJsonMinify(text);
      case "json:to-yaml":
        return this.transformJsonToYaml(text);
      case "yaml:to-json":
        return this.transformYamlToJson(text);
      case "extract:emails":
        return this.transformExtractEmails(text);
      case "extract:links":
        return this.transformExtractLinks(text);
      case "redact:secrets":
        return this.transformRedactSecrets(text);
      default:
        return {
          success: false,
          input: text,
          output: "",
          error: `Unknown transform intent: ${intent}`
        };
    }
  }
  /**
   * URL Clean transform
   */
  transformUrlClean(text) {
    const result = cleanUrl(text);
    if (!result.isUrl) {
      return {
        success: false,
        input: text,
        output: text,
        error: "Clipboard does not contain a valid URL"
      };
    }
    return {
      success: true,
      input: text,
      output: result.cleaned
    };
  }
  /**
   * URL to Markdown transform
   */
  transformUrlMarkdown(text) {
    const result = urlToMarkdown(text);
    if (!result.isUrl) {
      return {
        success: false,
        input: text,
        output: text,
        error: "Clipboard does not contain a valid URL"
      };
    }
    return {
      success: true,
      input: text,
      output: result.markdown
    };
  }
  /**
   * JSON Pretty transform
   */
  transformJsonPretty(text) {
    const result = jsonPretty(text);
    if (!result.isValidJson) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || "Clipboard does not contain valid JSON"
      };
    }
    return {
      success: true,
      input: text,
      output: result.formatted
    };
  }
  /**
   * JSON Minify transform
   */
  transformJsonMinify(text) {
    const result = jsonMinify(text);
    if (!result.isValidJson) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || "Clipboard does not contain valid JSON"
      };
    }
    return {
      success: true,
      input: text,
      output: result.formatted
    };
  }
  /**
   * JSON to YAML transform
   */
  transformJsonToYaml(text) {
    const result = jsonToYaml(text);
    if (!result.success) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || "Clipboard does not contain valid JSON"
      };
    }
    return {
      success: true,
      input: text,
      output: result.converted
    };
  }
  /**
   * YAML to JSON transform
   */
  transformYamlToJson(text) {
    const result = yamlToJson(text);
    if (!result.success) {
      return {
        success: false,
        input: text,
        output: text,
        error: result.error || "Clipboard does not contain valid YAML"
      };
    }
    return {
      success: true,
      input: text,
      output: result.converted
    };
  }
  /**
   * Extract Emails transform
   */
  transformExtractEmails(text) {
    const result = extractEmails(text);
    if (result.count === 0) {
      return {
        success: false,
        input: text,
        output: text,
        error: "No email addresses found in clipboard"
      };
    }
    return {
      success: true,
      input: text,
      output: formatExtracted(result)
    };
  }
  /**
   * Extract Links transform
   */
  transformExtractLinks(text) {
    const result = extractLinks(text);
    if (result.count === 0) {
      return {
        success: false,
        input: text,
        output: text,
        error: "No links found in clipboard"
      };
    }
    return {
      success: true,
      input: text,
      output: formatExtracted(result)
    };
  }
  /**
   * Redact Secrets transform
   */
  transformRedactSecrets(text) {
    const result = redactSecrets(text);
    return {
      success: true,
      input: text,
      output: result.redacted
    };
  }
}
const transformService = new TransformService();
function generateSnapshotId() {
  return `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
function generateRef(index) {
  return `e${index}`;
}
async function takeSnapshot(page) {
  const snapshotId = generateSnapshotId();
  const url = page.url();
  const title = await page.title();
  const elements = await page.evaluate(() => {
    const results = [];
    const selectors = [
      "a",
      "button",
      "input",
      "select",
      "textarea",
      '[role="button"]',
      '[role="link"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="menuitem"]',
      '[role="tab"]',
      "[onclick]",
      "[tabindex]"
    ];
    const allElements = document.querySelectorAll(selectors.join(","));
    allElements.forEach((el) => {
      const htmlEl = el;
      const rect = htmlEl.getBoundingClientRect();
      const style = window.getComputedStyle(htmlEl);
      const isVisible = style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && rect.width > 0 && rect.height > 0;
      if (!isVisible) return;
      let role = htmlEl.getAttribute("role") || "";
      if (!role) {
        const tagName = htmlEl.tagName.toLowerCase();
        if (tagName === "a") role = "link";
        else if (tagName === "button") role = "button";
        else if (tagName === "input") {
          const type = htmlEl.type;
          if (type === "submit" || type === "button") role = "button";
          else if (type === "checkbox") role = "checkbox";
          else if (type === "radio") role = "radio";
          else role = "textbox";
        } else if (tagName === "select") role = "combobox";
        else if (tagName === "textarea") role = "textbox";
        else role = "generic";
      }
      const name = htmlEl.getAttribute("aria-label") || htmlEl.getAttribute("title") || htmlEl.placeholder || "";
      const text = (htmlEl.textContent || "").trim().substring(0, 100);
      const value = htmlEl.value || "";
      const href = htmlEl.href || "";
      const placeholder = htmlEl.placeholder || "";
      const isEditable = htmlEl.tagName.toLowerCase() === "input" || htmlEl.tagName.toLowerCase() === "textarea" || htmlEl.tagName.toLowerCase() === "select" || htmlEl.isContentEditable;
      const isClickable = htmlEl.tagName.toLowerCase() === "a" || htmlEl.tagName.toLowerCase() === "button" || role === "button" || role === "link" || !!htmlEl.onclick || style.cursor === "pointer";
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
        rect: isVisible ? rect : null
      });
    });
    return results;
  });
  const elementRefs = elements.map((el, index) => ({
    ref: generateRef(index),
    role: el.role,
    name: el.name || void 0,
    tagName: el.tagName,
    text: el.text || void 0,
    value: el.value || void 0,
    href: el.href || void 0,
    placeholder: el.placeholder || void 0,
    isEditable: el.isEditable,
    isClickable: el.isClickable,
    isVisible: el.isVisible,
    boundingBox: el.rect ? {
      x: el.rect.x,
      y: el.rect.y,
      width: el.rect.width,
      height: el.rect.height
    } : void 0
  }));
  const formFields = elementRefs.filter((e) => e.isEditable);
  const buttons = elementRefs.filter((e) => e.role === "button" || e.tagName === "button");
  const links = elementRefs.filter((e) => e.role === "link" || e.tagName === "a");
  return {
    id: snapshotId,
    url,
    title,
    timestamp: Date.now(),
    elements: elementRefs,
    formFields,
    buttons,
    links
  };
}
const ACTION_SCHEMAS = {
  click: { requiredFields: ["ref"], optionalFields: ["description"] },
  fill: { requiredFields: ["ref", "value"], optionalFields: ["description"] },
  select: { requiredFields: ["ref", "value"], optionalFields: ["description"] },
  press: { requiredFields: ["key"], optionalFields: ["ref", "description"] },
  scroll: { requiredFields: [], optionalFields: ["ref", "description"] },
  navigate: { requiredFields: ["url"], optionalFields: ["description"] },
  wait: { requiredFields: ["duration"], optionalFields: ["description"] }
};
function validateAction(action) {
  const schema = ACTION_SCHEMAS[action.type];
  if (!schema) {
    return { valid: false, error: `Unknown action type: ${action.type}` };
  }
  for (const field of schema.requiredFields) {
    if (!(field in action) || action[field] === void 0) {
      return { valid: false, error: `Missing required field: ${field} for action ${action.type}` };
    }
  }
  return { valid: true };
}
function validateActions(actions) {
  const errors = [];
  for (let i = 0; i < actions.length; i++) {
    const result = validateAction(actions[i]);
    if (!result.valid) {
      errors.push(`Action ${i}: ${result.error}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
async function getLocatorForRef(page, snapshot, ref) {
  const element = snapshot.elements.find((e) => e.ref === ref);
  if (!element) {
    return { locator: null, element: null };
  }
  let locator = null;
  if (element.role && element.name) {
    locator = page.getByRole(element.role, {
      name: element.name
    });
  } else if (element.placeholder) {
    locator = page.getByPlaceholder(element.placeholder);
  } else if (element.text) {
    locator = page.getByText(element.text.substring(0, 50));
  } else if (element.href && element.tagName === "a") {
    locator = page.locator(`a[href="${element.href}"]`);
  }
  if (!locator && element.boundingBox) {
    return { locator: null, element };
  }
  return { locator, element };
}
async function executeAction(page, snapshot, action) {
  const timestamp = Date.now();
  const validation = validateAction(action);
  if (!validation.valid) {
    return {
      success: false,
      action,
      error: validation.error,
      timestamp
    };
  }
  try {
    switch (action.type) {
      case "click": {
        const { locator, element } = await getLocatorForRef(page, snapshot, action.ref);
        if (locator) {
          await locator.click({ timeout: 5e3 });
        } else if (element?.boundingBox) {
          const { x, y, width, height } = element.boundingBox;
          await page.mouse.click(x + width / 2, y + height / 2);
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp
          };
        }
        break;
      }
      case "fill": {
        const { locator, element } = await getLocatorForRef(page, snapshot, action.ref);
        if (locator) {
          await locator.fill(action.value, { timeout: 5e3 });
        } else if (element?.boundingBox) {
          const { x, y, width, height } = element.boundingBox;
          await page.mouse.click(x + width / 2, y + height / 2);
          await page.keyboard.type(action.value);
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp
          };
        }
        break;
      }
      case "select": {
        const { locator } = await getLocatorForRef(page, snapshot, action.ref);
        if (locator) {
          await locator.selectOption(action.value, { timeout: 5e3 });
        } else {
          return {
            success: false,
            action,
            error: `Element not found: ${action.ref}`,
            timestamp
          };
        }
        break;
      }
      case "press": {
        if (action.ref) {
          const { locator } = await getLocatorForRef(page, snapshot, action.ref);
          if (locator) {
            await locator.press(action.key, { timeout: 5e3 });
          } else {
            return {
              success: false,
              action,
              error: `Element not found: ${action.ref}`,
              timestamp
            };
          }
        } else {
          await page.keyboard.press(action.key);
        }
        break;
      }
      case "scroll": {
        if (action.ref) {
          const { locator } = await getLocatorForRef(page, snapshot, action.ref);
          if (locator) {
            await locator.scrollIntoViewIfNeeded({ timeout: 5e3 });
          }
        } else {
          await page.evaluate(() => window.scrollBy(0, 300));
        }
        break;
      }
      case "navigate": {
        await page.goto(action.url, { timeout: 3e4, waitUntil: "domcontentloaded" });
        break;
      }
      case "wait": {
        await page.waitForTimeout(action.duration);
        break;
      }
      default:
        return {
          success: false,
          action,
          error: `Unknown action type: ${action.type}`,
          timestamp
        };
    }
    return { success: true, action, timestamp };
  } catch (error) {
    return {
      success: false,
      action,
      error: error instanceof Error ? error.message : String(error),
      timestamp
    };
  }
}
async function executeActions(page, snapshot, actions) {
  const results = [];
  for (const action of actions) {
    const result = await executeAction(page, snapshot, action);
    results.push(result);
    if (!result.success) {
      break;
    }
    await page.waitForTimeout(100);
  }
  return results;
}
const DEFAULT_CONFIG = {
  maxIterations: 50,
  timeout: 12e4,
  // 2 minutes
  headless: false,
  // Show browser for debugging
  userDataDir: ""
};
function detectNeedsInput(snapshot) {
  const url = snapshot.url.toLowerCase();
  const title = snapshot.title.toLowerCase();
  const loginIndicators = ["login", "sign in", "signin", "log in", "authenticate"];
  const hasLoginIndicator = loginIndicators.some((i) => url.includes(i) || title.includes(i)) || snapshot.formFields.some(
    (f) => f.name?.toLowerCase().includes("password") || f.placeholder?.toLowerCase().includes("password")
  );
  if (hasLoginIndicator) {
    return {
      needsInput: true,
      reason: "login",
      message: "Login required. Please log in and then continue."
    };
  }
  const captchaIndicators = ["captcha", "recaptcha", "hcaptcha", "verify you are human"];
  const hasCaptcha = captchaIndicators.some((i) => title.includes(i)) || snapshot.elements.some((e) => e.text?.toLowerCase().includes("captcha"));
  if (hasCaptcha) {
    return {
      needsInput: true,
      reason: "captcha",
      message: "CAPTCHA detected. Please solve it and then continue."
    };
  }
  return { needsInput: false };
}
class AutomationLoop {
  constructor(config = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.state = "running";
    this.iteration = 0;
    this.lastSnapshot = null;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  /**
   * Initialize the browser
   */
  async initialize() {
    this.browser = await playwright.chromium.launch({
      headless: this.config.headless
    });
    const contextOptions = {
      viewport: { width: 1280, height: 800 }
    };
    if (this.config.userDataDir) {
      this.context = await playwright.chromium.launchPersistentContext(this.config.userDataDir, {
        headless: this.config.headless,
        viewport: { width: 1280, height: 800 }
      });
      this.page = this.context.pages()[0] || await this.context.newPage();
    } else {
      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();
    }
  }
  /**
   * Navigate to a URL
   */
  async navigateTo(url) {
    if (!this.page) throw new Error("Browser not initialized");
    await this.page.goto(url, {
      timeout: 3e4,
      waitUntil: "domcontentloaded"
    });
    await this.page.waitForLoadState("networkidle", { timeout: 1e4 }).catch(() => {
    });
    this.lastSnapshot = await takeSnapshot(this.page);
    return this.lastSnapshot;
  }
  /**
   * Get the current page snapshot
   */
  async getSnapshot() {
    if (!this.page) throw new Error("Browser not initialized");
    this.lastSnapshot = await takeSnapshot(this.page);
    return this.lastSnapshot;
  }
  /**
   * Run a single iteration of the loop
   */
  async runIteration(decider) {
    if (!this.page) throw new Error("Browser not initialized");
    this.iteration++;
    const snapshot = await this.getSnapshot();
    const needsInputCheck = detectNeedsInput(snapshot);
    if (needsInputCheck.needsInput) {
      this.state = "needs_input";
      return {
        state: "needs_input",
        snapshot,
        actionsExecuted: [],
        needsInputReason: needsInputCheck.reason,
        needsInputMessage: needsInputCheck.message
      };
    }
    const decision = await decider(snapshot, this.iteration);
    if ("state" in decision) {
      if (decision.state === "completed") {
        this.state = "completed";
        return {
          state: "completed",
          snapshot,
          actionsExecuted: []
        };
      }
      if (decision.state === "needs_input") {
        this.state = "needs_input";
        return {
          state: "needs_input",
          snapshot,
          actionsExecuted: [],
          needsInputReason: decision.reason,
          needsInputMessage: decision.message
        };
      }
      if (decision.state === "failed") {
        this.state = "failed";
        return {
          state: "failed",
          snapshot,
          actionsExecuted: [],
          error: decision.error
        };
      }
    }
    const actions = decision.actions;
    const validation = validateActions(actions);
    if (!validation.valid) {
      return {
        state: "running",
        snapshot,
        actionsExecuted: [],
        error: `Invalid actions: ${validation.errors.join(", ")}`
      };
    }
    const results = await executeActions(this.page, snapshot, actions);
    const failedAction = results.find((r) => !r.success);
    if (failedAction) {
      return {
        state: "running",
        snapshot,
        actionsExecuted: results,
        error: failedAction.error
      };
    }
    return {
      state: "running",
      snapshot,
      actionsExecuted: results
    };
  }
  /**
   * Run the full automation loop until completion or terminal state
   */
  async run(startUrl, decider, onIteration) {
    await this.initialize();
    await this.navigateTo(startUrl);
    const startTime = Date.now();
    while (this.state === "running" && this.iteration < this.config.maxIterations && Date.now() - startTime < this.config.timeout) {
      const result = await this.runIteration(decider);
      if (onIteration) {
        onIteration(result);
      }
      if (result.state !== "running") {
        return result;
      }
      await this.page?.waitForTimeout(500);
    }
    if (this.iteration >= this.config.maxIterations) {
      this.state = "failed";
      return {
        state: "failed",
        snapshot: this.lastSnapshot,
        actionsExecuted: [],
        error: `Max iterations (${this.config.maxIterations}) reached`
      };
    }
    if (Date.now() - startTime >= this.config.timeout) {
      this.state = "failed";
      return {
        state: "failed",
        snapshot: this.lastSnapshot,
        actionsExecuted: [],
        error: `Timeout (${this.config.timeout}ms) reached`
      };
    }
    return {
      state: this.state,
      snapshot: this.lastSnapshot,
      actionsExecuted: []
    };
  }
  /**
   * Resume from needs_input state
   */
  async resume() {
    if (this.state !== "needs_input") {
      throw new Error("Cannot resume: not in needs_input state");
    }
    this.state = "running";
  }
  /**
   * Cancel the automation
   */
  cancel() {
    this.state = "cancelled";
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get current iteration count
   */
  getIteration() {
    return this.iteration;
  }
  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.page) {
      await this.page.close().catch(() => {
      });
    }
    if (this.context) {
      await this.context.close().catch(() => {
      });
    }
    if (this.browser) {
      await this.browser.close().catch(() => {
      });
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
const MAX_RECENT_JOBS = 10;
class AutomationService {
  activeJob = null;
  recentJobs = [];
  eventEmitter = null;
  jobCounter = 0;
  activeLoop = null;
  /**
   * Set the event emitter for broadcasting automation events
   */
  setEventEmitter(emitter) {
    this.eventEmitter = emitter;
  }
  /**
   * Emit an automation event
   */
  emitEvent(type, job, previousStatus) {
    if (this.eventEmitter) {
      this.eventEmitter(
        createEvent(type, { job, previousStatus }, job.id)
      );
    }
  }
  /**
   * Generate a unique automation job ID
   */
  generateJobId() {
    this.jobCounter++;
    return `auto-${Date.now()}-${this.jobCounter}`;
  }
  /**
   * Create and start a new automation job
   */
  startJob(request) {
    if (this.activeJob && !this.isTerminal(this.activeJob.status)) {
      this.cancelJob(this.activeJob.id);
    }
    const now = Date.now();
    const job = {
      id: this.generateJobId(),
      type: request.type,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      targetUrl: request.targetUrl,
      input: request.context,
      stepCount: 0
    };
    this.activeJob = job;
    const baseJob = jobManager.createJob(request.type, request.context);
    job.id = baseJob.id;
    this.emitEvent(EventTypes.AUTOMATION_STARTED, job);
    this.transitionJob(job.id, "running");
    return job;
  }
  /**
   * Get the current automation state
   */
  getState() {
    return {
      activeJob: this.activeJob,
      recentJobs: [...this.recentJobs]
    };
  }
  /**
   * Get a job by ID
   */
  getJob(id) {
    if (this.activeJob?.id === id) {
      return this.activeJob;
    }
    return this.recentJobs.find((j) => j.id === id) ?? null;
  }
  /**
   * Check if a status is terminal
   */
  isTerminal(status) {
    return ["completed", "failed", "cancelled"].includes(status);
  }
  /**
   * Transition a job to a new status
   */
  transitionJob(id, newStatus, options) {
    const job = this.getJob(id);
    if (!job) return false;
    const success = jobManager.transitionJob(id, newStatus, {
      output: options?.output,
      error: options?.error
    });
    if (!success) return false;
    const previousStatus = job.status;
    job.status = newStatus;
    job.updatedAt = Date.now();
    if (options?.output !== void 0) {
      job.output = options.output;
    }
    if (options?.error !== void 0) {
      job.error = options.error;
    }
    if (options?.currentStep !== void 0) {
      job.currentStep = options.currentStep;
      job.stepCount = (job.stepCount ?? 0) + 1;
    }
    if (options?.needsInputReason !== void 0) {
      job.needsInputReason = options.needsInputReason;
    }
    if (options?.needsInputMessage !== void 0) {
      job.needsInputMessage = options.needsInputMessage;
    }
    switch (newStatus) {
      case "running":
        if (options?.currentStep) {
          this.emitEvent(EventTypes.AUTOMATION_STEP, job, previousStatus);
        }
        break;
      case "completed":
        this.emitEvent(EventTypes.AUTOMATION_COMPLETED, job, previousStatus);
        this.moveToRecent(job);
        break;
      case "failed":
        this.emitEvent(EventTypes.AUTOMATION_FAILED, job, previousStatus);
        this.moveToRecent(job);
        break;
      case "cancelled":
        this.emitEvent(EventTypes.AUTOMATION_CANCELLED, job, previousStatus);
        this.moveToRecent(job);
        break;
      case "needs_input":
        this.emitEvent(EventTypes.AUTOMATION_NEEDS_INPUT, job, previousStatus);
        break;
    }
    return true;
  }
  /**
   * Move a job from active to recent
   */
  moveToRecent(job) {
    if (this.activeJob?.id === job.id) {
      this.activeJob = null;
    }
    this.recentJobs.unshift(job);
    if (this.recentJobs.length > MAX_RECENT_JOBS) {
      this.recentJobs.pop();
    }
  }
  /**
   * Update the current step of a running job
   */
  updateStep(id, step) {
    const job = this.getJob(id);
    if (!job || job.status !== "running") return false;
    job.currentStep = step;
    job.stepCount = (job.stepCount ?? 0) + 1;
    job.updatedAt = Date.now();
    this.emitEvent(EventTypes.AUTOMATION_STEP, job);
    return true;
  }
  /**
   * Mark a job as needing user input
   */
  needsInput(id, reason, message) {
    return this.transitionJob(id, "needs_input", {
      needsInputReason: reason,
      needsInputMessage: message
    });
  }
  /**
   * Resume a job from needs_input state
   */
  resumeJob(id, input) {
    const job = this.getJob(id);
    if (!job || job.status !== "needs_input") return false;
    job.needsInputReason = void 0;
    job.needsInputMessage = void 0;
    if (input !== void 0) {
      job.input = { ...job.input, userInput: input };
    }
    return this.transitionJob(id, "running");
  }
  /**
   * Complete a job successfully
   */
  completeJob(id, output) {
    return this.transitionJob(id, "completed", { output });
  }
  /**
   * Fail a job with an error
   */
  failJob(id, error) {
    return this.transitionJob(id, "failed", { error });
  }
  /**
   * Cancel a job
   */
  cancelJob(id) {
    const job = this.getJob(id);
    if (!job || this.isTerminal(job.status)) return false;
    return this.transitionJob(id, "cancelled");
  }
  /**
   * Get the active job (if any)
   */
  getActiveJob() {
    return this.activeJob;
  }
  /**
   * Check if there's an active (non-terminal) job
   */
  hasActiveJob() {
    return this.activeJob !== null && !this.isTerminal(this.activeJob.status);
  }
  /**
   * Clear all jobs (for testing)
   */
  clear() {
    this.activeJob = null;
    this.recentJobs = [];
    this.jobCounter = 0;
    this.activeLoop = null;
  }
  /**
   * Run the automation loop for a job
   * This is the core snapshot → decide → execute → resnapshot loop
   */
  async runAutomationLoop(jobId, startUrl, decider) {
    const job = this.getJob(jobId);
    if (!job || job.status !== "running") {
      console.error(`[AutomationService] Cannot run loop: job ${jobId} not in running state`);
      return;
    }
    this.activeLoop = new AutomationLoop({
      maxIterations: 50,
      timeout: 12e4,
      // 2 minutes (NFR3 target)
      headless: false
      // Show browser for MVP
    });
    try {
      const result = await this.activeLoop.run(
        startUrl,
        decider,
        (iterationResult) => {
          if (iterationResult.actionsExecuted.length > 0) {
            const lastAction = iterationResult.actionsExecuted[iterationResult.actionsExecuted.length - 1];
            this.updateStep(jobId, lastAction.action.description || lastAction.action.type);
          }
          if (iterationResult.state === "needs_input") {
            this.needsInput(
              jobId,
              iterationResult.needsInputReason || "other",
              iterationResult.needsInputMessage
            );
          }
        }
      );
      if (result.state === "completed") {
        this.completeJob(jobId, { url: result.snapshot.url });
      } else if (result.state === "failed") {
        this.failJob(jobId, {
          code: "AUTOMATION_BROWSER_ERROR",
          message: result.error || "Automation failed"
        });
      } else if (result.state === "cancelled") {
      }
    } catch (error) {
      this.failJob(jobId, {
        code: "AUTOMATION_BROWSER_ERROR",
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await this.activeLoop.cleanup();
      this.activeLoop = null;
    }
  }
  /**
   * Get the active automation loop (for testing)
   */
  getActiveLoop() {
    return this.activeLoop;
  }
}
const automationService = new AutomationService();
let mainWindow = null;
let tray = null;
exports.appStatus = "idle";
function emitEvent(event) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (event.type === "VOICE_TRANSCRIPT") {
      const payload = event.payload;
      console.log(`[Main] Emitting VOICE_TRANSCRIPT: isExecuting=${payload?.isExecuting}, isDone=${payload?.isDone}, text="${payload?.text?.slice(0, 30)}..."`);
    }
    mainWindow.webContents.send(IpcChannels.EVENTS, event);
  }
}
function setAppStatus(newStatus) {
  const previousStatus = exports.appStatus;
  if (previousStatus === newStatus) return;
  exports.appStatus = newStatus;
  emitEvent(
    createEvent(EventTypes.STATUS_CHANGED, {
      status: newStatus,
      previousStatus
    })
  );
  if (tray) {
    tray.setToolTip(`ClipMorph - ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`);
  }
}
const COMPACT_SIZE = { width: 700, height: 52 };
const COMPACT_WIDE_SIZE = { width: 700, height: 600 };
const EXPANDED_SIZE = { width: 700, height: 600 };
let windowMode = "compact";
let isExpanded = false;
function createWindow() {
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.size;
  const x = Math.round((screenWidth - COMPACT_SIZE.width) / 2);
  mainWindow = new electron.BrowserWindow({
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    x,
    y: 0,
    // Start at absolute top
    show: false,
    // Don't show until positioned
    frame: false,
    transparent: true,
    // Critical for notch area
    hasShadow: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    type: "panel",
    // Panel type can go above menu bar on macOS
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setAlwaysOnTop(true, "status", 1);
  mainWindow.on("ready-to-show", () => {
    const display = electron.screen.getPrimaryDisplay();
    const x2 = Math.round((display.bounds.width - COMPACT_SIZE.width) / 2);
    const y = display.workArea.y;
    mainWindow?.setPosition(x2, y);
    mainWindow?.show();
    mainWindow?.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  });
  mainWindow.on("close", (event) => {
    if (!electron.app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("blur", () => {
    console.log("[ClipMorph] Window blur event");
    if (mainWindow && !mainWindow.isDestroyed()) {
      const autoCompact = settingsService.getBoolean("ui.autoCompactOnBlur");
      console.log("[ClipMorph] Auto-compact setting:", autoCompact);
      if (autoCompact) {
        console.log("[ClipMorph] Sending APP_BLUR event to renderer");
        mainWindow.webContents.send(IpcChannels.EVENTS, createEvent(EventTypes.APP_BLUR, {}));
      }
    }
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function createTray() {
  const iconPath = path.join(__dirname, "../../resources/tray-icon.png");
  let icon;
  try {
    icon = electron.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createFallbackIcon();
    }
  } catch {
    icon = createFallbackIcon();
  }
  icon.setTemplateImage(true);
  tray = new electron.Tray(icon);
  tray.setToolTip("ClipMorph - Idle");
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "ClipMorph", enabled: false },
    { type: "separator" },
    { label: "Status: Idle", enabled: false },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        electron.app.isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    toggleWindow();
  });
}
function createFallbackIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (distance <= radius) {
        canvas[idx] = 255;
        canvas[idx + 1] = 255;
        canvas[idx + 2] = 255;
        canvas[idx + 3] = 255;
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }
  return electron.nativeImage.createFromBuffer(canvas, { width: size, height: size });
}
function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    centerWindowAtTop();
    mainWindow.show();
    mainWindow.focus();
  }
}
function centerWindowAtTop() {
  if (!mainWindow) return;
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const windowBounds = mainWindow.getBounds();
  const x = Math.round((screenWidth - windowBounds.width) / 2);
  const y = 60;
  mainWindow.setPosition(x, y, false);
}
function setWindowMode(mode) {
  if (!mainWindow) return;
  const display = electron.screen.getPrimaryDisplay();
  windowMode = mode;
  isExpanded = mode === "expanded";
  let newSize;
  switch (mode) {
    case "compact":
      newSize = COMPACT_SIZE;
      break;
    case "compact-wide":
      newSize = COMPACT_WIDE_SIZE;
      break;
    case "expanded":
      newSize = EXPANDED_SIZE;
      break;
  }
  const x = Math.round((display.bounds.width - newSize.width) / 2);
  const y = display.workArea.y + (mode === "expanded" ? 10 : 0);
  mainWindow.setBounds({ x, y, width: newSize.width, height: newSize.height }, true);
}
function toggleWindowSize() {
  if (!mainWindow) return;
  const newMode = windowMode === "expanded" ? "compact" : "expanded";
  setWindowMode(newMode);
}
function registerIpcHandlers() {
  electron.ipcMain.handle(IpcChannels.STATUS_GET, () => {
    return createSuccessResponse({ status: exports.appStatus });
  });
  electron.ipcMain.handle("clipmorph:window:toggle", () => {
    toggleWindowSize();
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode });
  });
  electron.ipcMain.handle("clipmorph:window:getState", () => {
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode });
  });
  electron.ipcMain.handle("clipmorph:window:setMode", (_event, args) => {
    setWindowMode(args.mode);
    return createSuccessResponse({ expanded: isExpanded, mode: windowMode });
  });
  electron.ipcMain.handle(IpcChannels.PERMISSION_GET_ALL, () => {
    const permissions = getAllPermissions();
    return createSuccessResponse({
      permissions,
      voiceEnabled: canEnableVoice(),
      hotkeysEnabled: canEnableHotkeys()
    });
  });
  electron.ipcMain.handle(IpcChannels.PERMISSION_CHECK, (_event, args) => {
    const { type } = args;
    if (type === "microphone") {
      return createSuccessResponse(checkMicrophonePermission());
    } else if (type === "accessibility") {
      return createSuccessResponse(checkAccessibilityPermission());
    }
    return createErrorResponse(ErrorCodes.INVALID_REQUEST, `Unknown permission type: ${type}`);
  });
  electron.ipcMain.handle(
    IpcChannels.PERMISSION_REQUEST,
    async (_event, args) => {
      const { type } = args;
      if (type === "microphone") {
        const previousStatus = checkMicrophonePermission().status;
        const granted = await requestMicrophonePermission();
        const newStatus = checkMicrophonePermission().status;
        if (previousStatus !== newStatus) {
          emitEvent(
            createEvent(EventTypes.PERMISSION_CHANGED, {
              type: "microphone",
              previousStatus,
              status: newStatus
            })
          );
        }
        return createSuccessResponse({
          type: "microphone",
          granted,
          status: newStatus
        });
      } else if (type === "accessibility") {
        const previousStatus = checkAccessibilityPermission().status;
        const granted = requestAccessibilityPermission();
        const newStatus = checkAccessibilityPermission().status;
        if (previousStatus !== newStatus) {
          emitEvent(
            createEvent(EventTypes.PERMISSION_CHANGED, {
              type: "accessibility",
              previousStatus,
              status: newStatus
            })
          );
        }
        return createSuccessResponse({
          type: "accessibility",
          granted,
          status: newStatus
        });
      }
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, `Unknown permission type: ${type}`);
    }
  );
  electron.ipcMain.handle(IpcChannels.JOB_CREATE, (_event, args) => {
    const job = jobManager.createJob(args.type, args.input);
    return createSuccessResponse({ job });
  });
  electron.ipcMain.handle(IpcChannels.JOB_GET, (_event, args) => {
    const job = jobManager.getJob(args.id);
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Job not found: ${args.id}`);
    }
    return createSuccessResponse({ job });
  });
  electron.ipcMain.handle(IpcChannels.JOB_CANCEL, (_event, args) => {
    const job = jobManager.getJob(args.id);
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Job not found: ${args.id}`);
    }
    if (jobManager.isTerminal(args.id)) {
      return createErrorResponse(
        ErrorCodes.JOB_ALREADY_COMPLETED,
        `Job is already in terminal state: ${job.status}`
      );
    }
    const success = jobManager.cancelJob(args.id);
    if (!success) {
      return createErrorResponse(ErrorCodes.JOB_CANCEL_FAILED, "Failed to cancel job");
    }
    return createSuccessResponse({ job: jobManager.getJob(args.id) });
  });
  electron.ipcMain.handle(IpcChannels.JOB_LIST, (_event, args) => {
    const jobs = args?.status ? jobManager.getJobsByStatus(args.status) : jobManager.getAllJobs();
    return createSuccessResponse({ jobs });
  });
  electron.ipcMain.handle(IpcChannels.CLIPBOARD_READ, () => {
    const text = clipboardService.readClipboard();
    const snapshot = clipboardService.getCurrentSnapshot();
    const filePaths = clipboardService.readFilePaths();
    const formats = clipboardService.getAvailableFormats();
    return createSuccessResponse({ text, snapshot, filePaths, formats });
  });
  electron.ipcMain.handle(
    IpcChannels.CLIPBOARD_WRITE,
    (_event, args) => {
      if (args.expectedSnapshotId) {
        const result = clipboardService.writeClipboardGated(args.text, args.expectedSnapshotId);
        if (!result.success) {
          return createErrorResponse(
            result.error.code,
            result.error.message,
            result.error.details
          );
        }
      } else {
        clipboardService.writeClipboard(args.text, true);
      }
      return createSuccessResponse({
        success: true,
        snapshot: clipboardService.getCurrentSnapshot()
      });
    }
  );
  electron.ipcMain.handle(IpcChannels.CLIPBOARD_UNDO, () => {
    const result = clipboardService.undo();
    if (!result.success) {
      return createErrorResponse(
        result.error.code,
        result.error.message
      );
    }
    return createSuccessResponse({
      success: true,
      snapshot: result.snapshot,
      undoCount: clipboardService.getUndoCount()
    });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_START, () => {
    const success = voiceService.start();
    if (!success) {
      return createErrorResponse(
        ErrorCodes.VOICE_NOT_AVAILABLE,
        "Cannot start voice capture - microphone permission not granted"
      );
    }
    return createSuccessResponse({ success: true, state: voiceService.getState() });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_STOP, () => {
    voiceService.stop();
    return createSuccessResponse({ success: true, state: voiceService.getState() });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_GET_LAST_TRANSCRIPT, () => {
    const transcript = voiceService.getLastTranscript();
    return createSuccessResponse({ transcript });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_GET_TRANSCRIPTS, () => {
    const transcripts = voiceService.getTranscripts();
    return createSuccessResponse({ transcripts });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_CLEAR_TRANSCRIPTS, () => {
    voiceService.clearTranscripts();
    return createSuccessResponse({ success: true });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_SET_HOTKEY, (_event, args) => {
    const result = voiceService.setHotkey(args.hotkey);
    if (!result.success) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, result.error || "Failed to set hotkey");
    }
    settingsService.set("hotkey.pushToTalk", args.hotkey);
    return createSuccessResponse({
      success: true,
      hotkey: voiceService.getHotkey()
    });
  });
  electron.ipcMain.handle(IpcChannels.VOICE_GET_STATE, () => {
    return createSuccessResponse(voiceService.getState());
  });
  electron.ipcMain.handle(IpcChannels.TEXT_SUBMIT, async (_event, args) => {
    const text = args.text?.trim();
    if (!text) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, "Text cannot be empty");
    }
    console.log(`[ClipMorph] Text command submitted: "${text}"`);
    setAppStatus("processing");
    try {
      const result = await intentService.routeTranscript(text);
      setAppStatus("idle");
      return createSuccessResponse({
        success: result.handled,
        intent: result.intent,
        jobId: result.jobId,
        error: result.error
      });
    } catch (error) {
      setAppStatus("idle");
      return createErrorResponse(ErrorCodes.UNKNOWN_ERROR, error.message);
    }
  });
  electron.ipcMain.handle("voice:listInputDevices", async () => {
    const devices = await voiceService.listInputDevices();
    return createSuccessResponse({ devices });
  });
  electron.ipcMain.handle("voice:getInputDevice", () => {
    const device = voiceService.getInputDevice();
    return createSuccessResponse({ device });
  });
  electron.ipcMain.handle("voice:setInputDevice", (_event, args) => {
    voiceService.setInputDevice(args.device);
    return createSuccessResponse({ success: true, device: args.device });
  });
  electron.ipcMain.handle(IpcChannels.INTENT_CLASSIFY, (_event, args) => {
    const classification = intentService.classify(args.transcript);
    return createSuccessResponse(classification);
  });
  electron.ipcMain.handle(IpcChannels.INTENT_ROUTE, async (_event, args) => {
    const result = await intentService.routeTranscript(args.transcript);
    return createSuccessResponse({
      intent: result.intent,
      handled: result.handled,
      jobId: result.jobId,
      error: result.error
    });
  });
  electron.ipcMain.handle(IpcChannels.ACTION_GET_LAST, () => {
    const action = intentService.getLastAction();
    return createSuccessResponse({ action });
  });
  electron.ipcMain.handle(IpcChannels.SETTINGS_GET, (_event, args) => {
    const value = settingsService.get(args.key);
    return createSuccessResponse({ key: args.key, value });
  });
  electron.ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, args) => {
    settingsService.set(args.key, args.value);
    return createSuccessResponse({ key: args.key, value: args.value });
  });
  electron.ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, () => {
    const settings = settingsService.getAllFlat();
    return createSuccessResponse({ settings });
  });
  electron.ipcMain.handle(IpcChannels.SETTINGS_RESET, (_event, args) => {
    if (args?.key) {
      settingsService.reset(args.key);
    } else {
      settingsService.resetAll();
    }
    return createSuccessResponse({ success: true });
  });
  electron.ipcMain.handle(IpcChannels.AUTOMATION_START, (_event, request) => {
    const job = automationService.startJob(request);
    return createSuccessResponse({ job });
  });
  electron.ipcMain.handle(IpcChannels.AUTOMATION_CANCEL, (_event, args) => {
    const job = automationService.getJob(args.jobId);
    if (!job) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, `Automation job not found: ${args.jobId}`);
    }
    const success = automationService.cancelJob(args.jobId);
    if (!success) {
      return createErrorResponse(ErrorCodes.JOB_CANCEL_FAILED, "Failed to cancel automation job");
    }
    return createSuccessResponse({ job: automationService.getJob(args.jobId) });
  });
  electron.ipcMain.handle(IpcChannels.AUTOMATION_GET_STATE, () => {
    return createSuccessResponse(automationService.getState());
  });
  electron.ipcMain.handle(
    IpcChannels.AUTOMATION_PROVIDE_INPUT,
    (_event, args) => {
      const job = automationService.getJob(args.jobId);
      if (!job) {
        return createErrorResponse(
          ErrorCodes.JOB_NOT_FOUND,
          `Automation job not found: ${args.jobId}`
        );
      }
      if (job.status !== "needs_input") {
        return createErrorResponse(
          ErrorCodes.INVALID_REQUEST,
          `Job is not in needs_input state: ${job.status}`
        );
      }
      if (args.action === "cancel") {
        automationService.cancelJob(args.jobId);
      } else if (args.action === "continue" || args.action === "provide") {
        automationService.resumeJob(args.jobId, args.input);
      }
      return createSuccessResponse({ job: automationService.getJob(args.jobId) });
    }
  );
  electron.ipcMain.handle(IpcChannels.SECRETS_GET, async (_event, args) => {
    const hasValue = await secretsService.hasSecret(args.key);
    let maskedValue;
    if (hasValue) {
      const value = await secretsService.getSecret(args.key);
      if (value) {
        maskedValue = value.length > 10 ? `${value.substring(0, 3)}${"*".repeat(Math.min(20, value.length - 7))}${value.substring(value.length - 4)}` : "*".repeat(value.length);
      }
    }
    return createSuccessResponse({ key: args.key, hasValue, maskedValue });
  });
  electron.ipcMain.handle(IpcChannels.SECRETS_SET, async (_event, args) => {
    await secretsService.setSecret(args.key, args.value);
    if (args.key === "openai-api-key") {
      voiceService.setApiKey(args.value);
    }
    return createSuccessResponse({ key: args.key, success: true });
  });
  electron.ipcMain.handle(IpcChannels.SECRETS_DELETE, async (_event, args) => {
    const success = await secretsService.deleteSecret(args.key);
    return createSuccessResponse({ key: args.key, success });
  });
  electron.ipcMain.handle(IpcChannels.SECRETS_HAS, async (_event, args) => {
    const hasValue = await secretsService.hasSecret(args.key);
    return createSuccessResponse({ key: args.key, hasValue });
  });
  const openCodeService = getOpenCodeService();
  openCodeService.on("event", emitEvent);
  electron.ipcMain.handle(IpcChannels.OPENCODE_RUN_TASK, async (_event, args) => {
    try {
      const result = await openCodeService.runTask(args);
      return createSuccessResponse(result);
    } catch (error) {
      const err = error;
      if (err.code === "OPENCODE_NOT_INSTALLED") {
        return createErrorResponse(ErrorCodes.OPENCODE_NOT_INSTALLED, err.message);
      }
      if (err.message.includes("busy")) {
        return createErrorResponse(ErrorCodes.OPENCODE_BUSY, err.message);
      }
      return createErrorResponse(ErrorCodes.OPENCODE_TASK_FAILED, err.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.OPENCODE_CANCEL, () => {
    const result = openCodeService.cancel();
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.OPENCODE_GET_STATE, async () => {
    const state = await openCodeService.getState();
    return createSuccessResponse(state);
  });
  electron.ipcMain.handle(IpcChannels.OPENCODE_DETECT, async () => {
    const detection = await openCodeService.detect();
    return createSuccessResponse(detection);
  });
  electron.ipcMain.handle(IpcChannels.OPENCODE_WRITE_INPUT, (_event, args) => {
    openCodeService.writeInput(args.input);
    return createSuccessResponse({ success: true });
  });
  electron.ipcMain.handle(IpcChannels.OPENCODE_RESPOND_PERMISSION, (_event, args) => {
    openCodeService.respondToPermission(args.allow);
    return createSuccessResponse({ success: true });
  });
  electron.ipcMain.handle(IpcChannels.SUBAGENT_LIST, async () => {
    const result = await subagentService.list();
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SUBAGENT_DISCOVER, async (_event, args) => {
    const result = await subagentService.discover(args?.forceReload);
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SUBAGENT_RUN, async (_event, args) => {
    const subagent = subagentService.get(args.subagentId);
    if (!subagent) {
      return createErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        `Subagent not found: ${args.subagentId}`
      );
    }
    const fullPrompt = `${subagent.systemPrompt}

---
User request: ${args.prompt}`;
    try {
      const result = await openCodeService.runTask({
        prompt: fullPrompt,
        context: args.context,
        cwd: args.cwd
      });
      return createSuccessResponse({
        ...result,
        subagent
      });
    } catch (error) {
      const err = error;
      if (err.code === "OPENCODE_NOT_INSTALLED") {
        return createErrorResponse(ErrorCodes.OPENCODE_NOT_INSTALLED, err.message);
      }
      if (err.message.includes("busy")) {
        return createErrorResponse(ErrorCodes.OPENCODE_BUSY, err.message);
      }
      return createErrorResponse(ErrorCodes.OPENCODE_TASK_FAILED, err.message);
    }
  });
  workflowService.setEventEmitter(emitEvent);
  electron.ipcMain.handle(IpcChannels.WORKFLOW_START, async (_event, args) => {
    try {
      const result = await workflowService.startWorkflow(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.WORKFLOW_APPROVE, async (_event, args) => {
    try {
      const result = await workflowService.approveCheckpoint(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.WORKFLOW_REJECT, async (_event, args) => {
    try {
      const result = await workflowService.rejectCheckpoint(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.WORKFLOW_CANCEL, (_event, args) => {
    try {
      const result = workflowService.cancelWorkflow(args.jobId);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.JOB_NOT_FOUND, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.WORKFLOW_GET_STATE, () => {
    return createSuccessResponse(workflowService.getState());
  });
  fileOperationService.setEventEmitter(emitEvent);
  electron.ipcMain.handle(IpcChannels.FILE_OP_PREVIEW, async (_event, args) => {
    try {
      const result = await fileOperationService.generatePreview(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.FILE_OP_EXECUTE, async (_event, args) => {
    try {
      const result = await fileOperationService.execute(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.FILE_OP_UNDO, async (_event, args) => {
    try {
      const result = await fileOperationService.undo(args);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, error.message);
    }
  });
  electron.ipcMain.handle(IpcChannels.FILE_OP_HISTORY, () => {
    return createSuccessResponse(fileOperationService.getHistory());
  });
  skillService.setEventEmitter(emitEvent);
  electron.ipcMain.handle(IpcChannels.SKILL_LIST, async () => {
    const result = await skillService.list();
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SKILL_DISCOVER, async (_event, args) => {
    const result = await skillService.discover(args?.forceReload);
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SKILL_GET, (_event, args) => {
    const result = skillService.get(args.skillId);
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SKILL_EXPORT, async (_event, args) => {
    const result = await skillService.export(args.skillId, args.outputPath);
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.SKILL_IMPORT, async (_event, args) => {
    const result = await skillService.import(args.source, args.global);
    return createSuccessResponse(result);
  });
  electron.ipcMain.handle(IpcChannels.HISTORY_GET, (_event, args) => {
    const operations = storeService.getOperations(args?.limit ?? 50);
    return createSuccessResponse({ operations });
  });
  electron.ipcMain.handle(IpcChannels.HISTORY_CLEAR, () => {
    storeService.clearOperations();
    return createSuccessResponse({ cleared: true });
  });
  electron.ipcMain.handle(IpcChannels.HISTORY_COPY_IMAGE, (_event, args) => {
    try {
      if (!args.imagePath || !fs.existsSync(args.imagePath)) {
        return createErrorResponse({
          code: ErrorCodes.INVALID_ARGS,
          message: "Image file not found"
        });
      }
      const imageBuffer = fs.readFileSync(args.imagePath);
      const image = electron.nativeImage.createFromBuffer(imageBuffer);
      electron.clipboard.writeImage(image);
      return createSuccessResponse({ copied: true });
    } catch (error) {
      return createErrorResponse({
        code: ErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Failed to copy image"
      });
    }
  });
  electron.ipcMain.handle(IpcChannels.HISTORY_GET_IMAGE, (_event, args) => {
    try {
      if (!args.imagePath || !fs.existsSync(args.imagePath)) {
        return createErrorResponse({
          code: ErrorCodes.INVALID_ARGS,
          message: "Image file not found"
        });
      }
      const imageBuffer = fs.readFileSync(args.imagePath);
      const base64 = imageBuffer.toString("base64");
      return createSuccessResponse({ base64, mimeType: "image/png" });
    } catch (error) {
      return createErrorResponse({
        code: ErrorCodes.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Failed to read image"
      });
    }
  });
}
electron.app.whenReady().then(() => {
  electron.app.setAppUserModelId("com.clipmorph");
  storeService.initialize();
  registerIpcHandlers();
  jobManager.setEventEmitter(emitEvent);
  clipboardService.setEventEmitter(emitEvent);
  voiceService.setEventEmitter(emitEvent);
  voiceService.setStatusCallback(setAppStatus);
  intentService.setEventEmitter(emitEvent);
  transformService.setEventEmitter(emitEvent);
  settingsService.setEventEmitter(emitEvent);
  automationService.setEventEmitter(emitEvent);
  clipboardService.startWatching();
  const loadApiKey = async () => {
    const keychainKey = await secretsService.getOpenAIKey();
    if (keychainKey) {
      voiceService.setApiKey(keychainKey);
      console.log("[ClipMorph] OpenAI API key loaded from Keychain");
      return;
    }
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      voiceService.setApiKey(envKey);
      console.log("[ClipMorph] OpenAI API key loaded from environment");
      await secretsService.setOpenAIKey(envKey);
      return;
    }
    console.warn("[ClipMorph] No OpenAI API key configured - set via Settings or OPENAI_API_KEY env var");
  };
  loadApiKey();
  if (canEnableHotkeys()) {
    const savedHotkey = settingsService.get("hotkey.pushToTalk");
    const registered = voiceService.registerHotkey(savedHotkey);
    if (registered) {
      console.log("[ClipMorph] Push-to-talk hotkey registered:", voiceService.getHotkey());
    } else {
      console.warn("[ClipMorph] Failed to register push-to-talk hotkey");
    }
  } else {
    console.log("[ClipMorph] Hotkeys disabled - accessibility permission not granted");
  }
  electron.app.on("browser-window-created", (_, window2) => {
    if (!electron.app.isPackaged) {
      window2.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
          window2.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    }
  });
  createTray();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
});
electron.app.on("before-quit", () => {
  electron.app.isQuitting = true;
  voiceService.cleanup();
  storeService.close();
  getOpenCodeService().dispose();
});
exports.emitEvent = emitEvent;
exports.setAppStatus = setAppStatus;
