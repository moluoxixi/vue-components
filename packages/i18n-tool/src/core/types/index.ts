export type LocaleAdapterId = 'generic-json' | 'i18next-json' | 'vue-i18n-json'
export type LocaleLayout = 'locale-first' | 'locale-per-file'
export type JsonKeyStyle = 'flat' | 'nested'
export type DiagnosticSeverity = 'error' | 'warning'

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonArray | JsonObject | JsonPrimitive
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject { [key: string]: JsonValue }

export type I18nDiagnosticCode
  = | 'ADAPTER_NOT_FOUND'
    | 'AMBIGUOUS_KEY'
    | 'BATCH_LIMIT_EXCEEDED'
    | 'DUPLICATE_RESULT'
    | 'FAMILY_INCOMPLETE'
    | 'INVALID_JSON'
    | 'LOCALE_REQUIRED'
    | 'MISSING_RESULT'
    | 'MIXED_KEY_STYLE'
    | 'MODEL_OUTPUT_INVALID'
    | 'OVERWRITE_REQUIRED'
    | 'ROOT_NOT_OBJECT'
    | 'ROUND_TRIP_MISMATCH'
    | 'TARGET_PLAN_INVALID'
    | 'TARGET_LOCALE_MISMATCH'
    | 'TOKEN_MISMATCH'
    | 'UNEXPECTED_RESULT'
    | 'UNSUPPORTED_LAYOUT'
    | 'UNSUPPORTED_LEAF'

export interface I18nDiagnostic {
  code: I18nDiagnosticCode
  message: string
  severity: DiagnosticSeverity
  path?: readonly string[]
  resourceId?: string
  unitIds?: readonly string[]
}

export interface JsonFormatMetadata {
  eol: '\n' | '\r\n'
  indent: string
  rootKeyOrder: readonly string[]
  trailingNewline: boolean
}

export interface I18nextSemanticsOptions {
  contexts?: readonly string[]
  pluralForms?: readonly string[]
  separator?: string
}

export interface TranslationUnitSemantics {
  adapter: LocaleAdapterId
  family?: string
  keyStyle: JsonKeyStyle
  layout: LocaleLayout
  context?: string
  pluralForm?: string
  pluralGroup?: string
}

export interface TranslationUnitOrigin {
  jsonPointer: string
  relativePath: string
  resourceId: string
}

export interface TranslationUnit {
  id: string
  locale: string
  namespace?: string
  path: readonly string[]
  semantics: TranslationUnitSemantics
  sourceKey: string
  value: string
  origin: TranslationUnitOrigin
}

export interface ResourceDocument {
  adapter: LocaleAdapterId
  adapterOptions?: I18nextSemanticsOptions
  diagnostics: readonly I18nDiagnostic[]
  format: JsonFormatMetadata
  keyStyle: JsonKeyStyle
  layout: LocaleLayout
  locale?: string
  namespace?: string
  relativePath: string
  resourceId: string
  tree: JsonObject
  units: readonly TranslationUnit[]
}

export interface ParseResourceInput {
  adapterOptions?: I18nextSemanticsOptions
  content: string
  keyStyle?: JsonKeyStyle
  layout: LocaleLayout
  locale?: string
  namespace?: string
  relativePath: string
  resourceId: string
}

export interface ParseResourceResult {
  diagnostics: readonly I18nDiagnostic[]
  document?: ResourceDocument
}

export interface LocaleAdapter {
  id: LocaleAdapterId
  parse: (input: ParseResourceInput) => ParseResourceResult
  planTarget: (
    source: ResourceDocument,
    targetLocale: string,
    target: TargetResourceDescriptor,
  ) => TargetResourcePlan
  targetPath: (
    source: TranslationUnit,
    targetLocale: string,
    document: ResourceDocument,
  ) => readonly string[]
}

export interface TargetResourceDescriptor {
  namespace?: string
  relativePath: string
  resourceId: string
}

export interface TargetResourcePlan {
  diagnostics: readonly I18nDiagnostic[]
  document?: ResourceDocument
}

export interface TranslationGap {
  source: TranslationUnit
  status: 'empty' | 'existing' | 'missing'
  target?: TranslationUnit
  targetLocale: string
  overwriteRequired: boolean
}

export interface ProtectedToken {
  kind: 'escaped-newline' | 'html-tag' | 'i18next' | 'plural-pipe' | 'printf' | 'vue' | 'vue-linked'
  value: string
}

export interface TranslationBatch {
  id: string
  units: readonly TranslationUnit[]
}

export interface TranslationBatchPlan {
  batches: readonly TranslationBatch[]
  diagnostics: readonly I18nDiagnostic[]
}

export interface TranslationCandidate {
  sourceUnitId: string
  targetLocale: string
  value: string
}

export interface TranslationValidationResult {
  candidates: readonly TranslationCandidate[]
  diagnostics: readonly I18nDiagnostic[]
  ok: boolean
}

export interface ChangeOperation {
  after: string
  before?: string
  jsonPointer: string
  namespace?: string
  overwriteRequired: boolean
  path: readonly string[]
  resourceId: string
  semantics: TranslationUnitSemantics
  sourceKey: string
  sourceUnitId: string
  targetLocale: string
  targetUnitId: string
  type: 'create' | 'update'
}

export interface ChangePlan {
  diagnostics: readonly I18nDiagnostic[]
  operations: readonly ChangeOperation[]
}

export interface RoundTripResult {
  content?: string
  diagnostics: readonly I18nDiagnostic[]
  document?: ResourceDocument
}
