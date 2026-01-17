/**
 * ClipMorph Core Package
 *
 * Contains intent classification and transform implementations.
 */

// Intent classification
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
  parseChain,
  hasChainKeywords,
} from './intent'

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
  ChainedIntent,
} from './intent'

// Transforms
export {
  cleanUrl,
  cleanUrlsInText,
  isUrl,
  urlToMarkdown,
  urlToMarkdownWithTitle,
  jsonPretty,
  jsonMinify,
  isValidJson,
  jsonToYaml,
  yamlToJson,
  extractEmails,
  extractLinks,
  formatExtracted,
  redactSecrets,
} from './transforms'

export type {
  UrlCleanResult,
  UrlMarkdownResult,
  JsonFormatResult,
  ConversionResult,
  ExtractResult,
  RedactResult,
} from './transforms'
