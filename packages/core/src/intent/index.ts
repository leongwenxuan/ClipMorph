/**
 * Intent Module
 */

export {
  classifyIntent,
  isTransformIntent,
  isSpecialIntent,
  isAutomationIntent,
  isCodeIntent,
  isSubagentIntent,
  isWorkflowIntent,
  isFileIntent,
  getSubagentIdFromIntent,
  matchSubagentTrigger,
  getSupportedIntents,
} from './classify-intent'

export { parseChain, hasChainKeywords } from './chain-parser'

export type {
  Intent,
  TransformIntent,
  SpecialIntent,
  AutomationIntent,
  CodeIntent,
  SubagentIntent,
  WorkflowIntent,
  FileIntent,
  IntentClassification,
  IntentPattern,
  SubagentClassification,
} from './intent-types'

export type { ChainedIntent } from './chain-parser'
