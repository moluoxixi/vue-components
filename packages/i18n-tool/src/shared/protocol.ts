import type { AiProviderId } from '@moluoxixi/ai-provider/shared'
import type { ChangeOperation, I18nDiagnostic, TranslationCandidate, TranslationUnit } from '../core'
import { z } from 'zod'
import { I18N_DIAGNOSTIC_CODES } from '../core/types'

export const I18N_TOOL_API_PREFIX = '/__i18n-tool/api'
export const I18N_TOOL_PRIVATE_HEADER = 'x-i18n-tool-request'

export const I18N_TOOL_ERROR_CODES = [
  'AI_NOT_CONFIGURED',
  'CANCELLED',
  'INTERNAL_ERROR',
  'INVALID_CONFIG',
  'INVALID_REQUEST',
  'LIMIT_EXCEEDED',
  'MODEL_OUTPUT_INVALID',
  'PATH_OUTSIDE_ROOT',
  'PAYLOAD_TOO_LARGE',
  'PREVIEW_REQUIRED',
  'PREVIEW_STALE',
  'RESOURCE_NOT_FOUND',
  'SCAN_FAILED',
  'SYMLINK_ESCAPE',
  'UNSUPPORTED_ADAPTER',
  'WRITE_CONFLICT',
  'WRITE_FAILED',
] as const

export type I18nToolErrorCode = typeof I18N_TOOL_ERROR_CODES[number]

export interface ErrorResponse {
  error: I18nToolErrorCode
  message: string
}

export interface SanitizedConfigResponse {
  ai: {
    baseUrl?: string
    model: string
    provider: AiProviderId
    status: 'configured' | 'missing'
  }
  projectName: string
  resources: {
    adapter: string
    exclude: readonly string[]
    include: readonly string[]
    keyStyle: string
    layout: string
    localePattern: string
    namespace?: string
    sourceLocale: string
    targetLocales: readonly string[]
  }
}

export interface ScanResourceWire {
  adapter: string
  diagnostics: readonly I18nDiagnostic[]
  hash: string
  keyCount: number
  locale?: string
  namespace?: string
  relativePath: string
  resourceId: string
}

export interface ScanResponse {
  diagnostics: readonly I18nDiagnostic[]
  gaps: Readonly<Record<string, { empty: number, existing: number, missing: number }>>
  resources: readonly ScanResourceWire[]
  scanId: string
  unitGaps: readonly ScanUnitGapWire[]
  units: readonly TranslationUnit[]
}

export interface ScanUnitGapWire {
  sourceUnitId: string
  status: 'empty' | 'existing' | 'missing'
  targetLocale: string
  targetUnitId?: string
}

export const translateRequestSchema = z.object({
  scanId: z.string().uuid(),
  targetLocale: z.string().min(1),
  unitIds: z.array(z.string().min(1)).min(1),
}).strict()
export type TranslateRequest = z.infer<typeof translateRequestSchema>

export type TranslateSseEvent
  = | { type: 'candidate', candidate: TranslationCandidate }
    | { type: 'diagnostic', diagnostic: I18nDiagnostic }
    | { type: 'done' }
    | { type: 'error', error: I18nToolErrorCode, message: string }
    | { type: 'progress', completed: number, total: number }

export const previewRequestSchema = z.object({
  allowOverwriteUnitIds: z.array(z.string().min(1)).default([]),
  candidates: z.array(z.object({
    sourceUnitId: z.string().min(1),
    targetLocale: z.string().min(1),
    value: z.string(),
  }).strict()).min(1),
  scanId: z.string().uuid(),
  targetLocale: z.string().min(1),
}).strict()
export type PreviewRequest = z.infer<typeof previewRequestSchema>

export interface PreviewFileWire {
  after: string
  before: string
  diff: string
  operations: readonly ChangeOperation[]
  relativePath: string
  resourceId: string
  type: 'create' | 'update'
}

export interface PreviewResponse {
  diagnostics: readonly I18nDiagnostic[]
  files: readonly PreviewFileWire[]
  previewToken?: string
}

export const applyRequestSchema = z.object({ previewToken: z.string().uuid() }).strict()
export type ApplyRequest = z.infer<typeof applyRequestSchema>

export interface ApplyResponse {
  filesWritten: number
  scan: ScanResponse
}

const diagnosticSchema = z.object({
  code: z.enum(I18N_DIAGNOSTIC_CODES),
  message: z.string(),
  path: z.array(z.string()).optional(),
  resourceId: z.string().optional(),
  severity: z.enum(['error', 'warning']),
  unitIds: z.array(z.string()).optional(),
}).strict()

const semanticsSchema = z.object({
  adapter: z.enum(['generic-json', 'i18next-json', 'vue-i18n-json']),
  context: z.string().optional(),
  family: z.string().optional(),
  keyStyle: z.enum(['flat', 'nested']),
  layout: z.enum(['locale-first', 'locale-per-file']),
  pluralForm: z.string().optional(),
  pluralGroup: z.string().optional(),
}).strict()

const unitSchema = z.object({
  id: z.string(),
  locale: z.string(),
  namespace: z.string().optional(),
  origin: z.object({
    jsonPointer: z.string(),
    relativePath: z.string(),
    resourceId: z.string(),
  }).strict(),
  path: z.array(z.string()),
  semantics: semanticsSchema,
  sourceKey: z.string(),
  value: z.string(),
}).strict()

const operationSchema = z.object({
  after: z.string(),
  before: z.string().optional(),
  jsonPointer: z.string(),
  namespace: z.string().optional(),
  overwriteRequired: z.boolean(),
  path: z.array(z.string()),
  resourceId: z.string(),
  semantics: semanticsSchema,
  sourceKey: z.string(),
  sourceUnitId: z.string(),
  targetLocale: z.string(),
  targetUnitId: z.string(),
  type: z.enum(['create', 'update']),
}).strict()

export const sanitizedConfigResponseSchema: z.ZodType<SanitizedConfigResponse> = z.object({
  ai: z.object({
    baseUrl: z.string().optional(),
    model: z.string(),
    provider: z.enum(['openai', 'anthropic', 'google', 'openai-compatible']),
    status: z.enum(['configured', 'missing']),
  }).strict().superRefine((ai, context) => {
    if (ai.provider === 'openai-compatible' && ai.baseUrl === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OpenAI-compatible sanitized config requires baseUrl.',
        path: ['baseUrl'],
      })
    }
    if (ai.provider !== 'openai-compatible' && ai.baseUrl !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only OpenAI-compatible sanitized config may expose baseUrl.',
        path: ['baseUrl'],
      })
    }
  }),
  projectName: z.string(),
  resources: z.object({
    adapter: z.string(),
    exclude: z.array(z.string()),
    include: z.array(z.string()),
    keyStyle: z.string(),
    layout: z.string(),
    localePattern: z.string(),
    namespace: z.string().optional(),
    sourceLocale: z.string(),
    targetLocales: z.array(z.string()),
  }).strict(),
}).strict()

export const scanResponseSchema: z.ZodType<ScanResponse> = z.object({
  diagnostics: z.array(diagnosticSchema),
  gaps: z.record(z.object({
    empty: z.number().int().nonnegative(),
    existing: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
  }).strict()),
  resources: z.array(z.object({
    adapter: z.string(),
    diagnostics: z.array(diagnosticSchema),
    hash: z.string(),
    keyCount: z.number().int().nonnegative(),
    locale: z.string().optional(),
    namespace: z.string().optional(),
    relativePath: z.string(),
    resourceId: z.string(),
  }).strict()),
  scanId: z.string().uuid(),
  unitGaps: z.array(z.object({
    sourceUnitId: z.string(),
    status: z.enum(['empty', 'existing', 'missing']),
    targetLocale: z.string(),
    targetUnitId: z.string().optional(),
  }).strict()),
  units: z.array(unitSchema),
}).strict()

export const previewResponseSchema: z.ZodType<PreviewResponse> = z.object({
  diagnostics: z.array(diagnosticSchema),
  files: z.array(z.object({
    after: z.string(),
    before: z.string(),
    diff: z.string(),
    operations: z.array(operationSchema),
    relativePath: z.string(),
    resourceId: z.string(),
    type: z.enum(['create', 'update']),
  }).strict()),
  previewToken: z.string().uuid().optional(),
}).strict()

export const applyResponseSchema: z.ZodType<ApplyResponse> = z.object({
  filesWritten: z.number().int().nonnegative(),
  scan: scanResponseSchema,
}).strict()

export const errorResponseSchema: z.ZodType<ErrorResponse> = z.object({
  error: z.enum(I18N_TOOL_ERROR_CODES),
  message: z.string(),
}).strict()

export const translateSseEventSchema: z.ZodType<TranslateSseEvent> = z.discriminatedUnion('type', [
  z.object({ candidate: z.object({
    sourceUnitId: z.string(),
    targetLocale: z.string(),
    value: z.string(),
  }).strict(), type: z.literal('candidate') }).strict(),
  z.object({ diagnostic: diagnosticSchema, type: z.literal('diagnostic') }).strict(),
  z.object({ type: z.literal('done') }).strict(),
  z.object({ error: z.enum(I18N_TOOL_ERROR_CODES), message: z.string(), type: z.literal('error') }).strict(),
  z.object({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), type: z.literal('progress') }).strict(),
])

export function decodeApplyResponse(value: unknown): ApplyResponse {
  return applyResponseSchema.parse(value)
}

export function decodeConfigResponse(value: unknown): SanitizedConfigResponse {
  return sanitizedConfigResponseSchema.parse(value)
}

export function decodeErrorResponse(value: unknown): ErrorResponse {
  return errorResponseSchema.parse(value)
}

export function decodePreviewResponse(value: unknown): PreviewResponse {
  return previewResponseSchema.parse(value)
}

export function decodeScanResponse(value: unknown): ScanResponse {
  return scanResponseSchema.parse(value)
}

export function decodeTranslateSseEvent(value: unknown): TranslateSseEvent {
  return translateSseEventSchema.parse(value)
}
