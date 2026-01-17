/**
 * Intent Types
 *
 * Defines supported intents and their mappings to capabilities.
 */

// Supported transform types (deterministic)
export type TransformIntent =
  | 'url:clean'
  | 'url:markdown'
  | 'json:pretty'
  | 'json:minify'
  | 'json:to-yaml'
  | 'yaml:to-json'
  | 'extract:emails'
  | 'extract:links'
  | 'redact:secrets'

// Special intents
export type SpecialIntent = 'cancel' | 'undo'

// Automation intents
export type AutomationIntent = 'automation:portal'

// Code intents (OpenCode CLI)
export type CodeIntent =
  | 'code:generate'
  | 'code:refactor'
  | 'code:fix'
  | 'code:explain'
  | 'code:improve'
  | 'code:convert'

// Subagent intent (dynamic - matched against custom triggers)
export type SubagentIntent = `subagent:${string}`

// Workflow intents (multi-stage agentic workflows)
export type WorkflowIntent =
  | 'workflow:plan-code'       // plan → code
  | 'workflow:plan-code-review' // plan → code → review (full)
  | 'workflow:plan-only'       // just planning

// File operation intents
export type FileIntent =
  | 'file:organize'   // organize/sort files
  | 'file:rename'     // rename files
  | 'file:move'       // move files
  | 'file:delete'     // delete files
  | 'file:find'       // find/search files
  | 'file:copy'       // copy files

// All intent types
export type Intent = TransformIntent | SpecialIntent | AutomationIntent | CodeIntent | SubagentIntent | WorkflowIntent | FileIntent | 'unsupported'

// Intent classification result
export interface IntentClassification {
  intent: Intent
  confidence: number // 0-1, higher is more confident
  rawTranscript: string
  normalizedTranscript: string
  matchedPatterns?: string[]
}

// Intent pattern for matching
export interface IntentPattern {
  intent: Intent
  patterns: RegExp[]
  keywords: string[]
  priority: number // Higher priority wins on ties
}

// Subagent classification result (extends IntentClassification)
export interface SubagentClassification extends IntentClassification {
  intent: SubagentIntent
  subagentId: string
  matchedTrigger: string
}
