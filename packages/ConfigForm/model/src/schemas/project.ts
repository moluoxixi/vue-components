import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  DatasetViewQuery,
  DeepReadonly,
  FormSettings,
  ModelDiagnostic,
  ProjectCompilationSnapshotParseResult,
  ProjectDataset,
  ProjectDocument,
  ProjectDocumentParseResult,
  ProjectDraftSnapshot,
  ProjectDraftSnapshotParseResult,
  ProjectResource,
  ProjectSnapshot,
  ProjectSnapshotParseResult,
  ProjectSurface,
  ProjectTheme,
  ProjectTransactionSuccess,
  ReadonlyProjectDocument,
  SafeExpression,
  SafeExpressionNode,
  SlotItem,
  SurfaceGraph,
  SurfaceNode,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { ruleSetSchema } from '@moluoxixi/zod3-to-rule'
import { z } from 'zod'
import {
  FORM_GAP_MAX_PX,
  FORM_LABEL_WIDTH_MAX_PX,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '../constants'
import {
  getProjectTransactionSource,
  isValidatedProjectDocument,
  markValidatedProjectDocument,
} from '../services/transactions/services/publication'
import { analyzeSurfaceValueScopes } from '../services/value-scope'
import {
  identifierSchema,
  registryFingerprintSchema,
  registryKeySchema,
  registryVersionSchema,
} from './identity'
import { registryLockFingerprint } from './registry-identity'

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const THEME_COLOR = /^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/
const CONTENT_HASH = /^sha256:[0-9a-f]{64}$/
const FILE_EXTENSION = /\.[A-Z0-9]{1,16}$/i
const HASH = /^fnv1a:[0-9a-f]{8}$/
const MAX_EXPRESSION_DEPTH = 32
const MAX_EXPRESSION_NODES = 256
const deeplyFrozenValues = new WeakSet<object>()
const immutableJsonSerializationCache = new WeakMap<object, string>()
const immutableProjectDocumentHashCache = new WeakMap<object, string>()
const validatedProjectSnapshotMetadata = new WeakMap<object, {
  editVersion: number
  contentHash: string
}>()

interface ProjectIssueDiagnosticMetadata {
  code: string
  surfaceId?: string
  datasetId?: string
  resourceId?: string
  nodeId?: string
  context?: Record<string, unknown>
}

const safeObjectKeySchema = z.string().refine(
  key => !FORBIDDEN_OBJECT_KEYS.has(key),
  'Object key is not allowed',
)
const displayNameSchema = z.string().trim().min(1).max(160)
const safePathSchema = z.array(z.string().min(1).max(128).refine(
  value => !FORBIDDEN_OBJECT_KEYS.has(value),
  'Path segment is not allowed',
)).max(32)

export const modelJsonValueSchema: z.ZodType<ConfigFormJsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string(),
  z.array(modelJsonValueSchema),
  z.record(safeObjectKeySchema, modelJsonValueSchema),
]))

export const modelJsonObjectSchema: z.ZodType<ConfigFormJsonObject> = z.record(
  safeObjectKeySchema,
  modelJsonValueSchema,
)

export const configFormValueScopeSchema = z.union([
  z.object({
    kind: z.literal('object'),
    field: identifierSchema,
  }).strict(),
  z.object({
    kind: z.literal('array'),
    field: identifierSchema,
    itemKey: identifierSchema.optional(),
    minItems: z.number().int().min(0).max(10_000).optional(),
    maxItems: z.number().int().min(0).max(10_000).optional(),
  }).strict(),
]).superRefine((scope, context) => {
  if (scope.kind === 'array' && scope.minItems !== undefined && scope.maxItems !== undefined
    && scope.minItems > scope.maxItems) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Value scope minItems cannot exceed maxItems.',
      path: ['minItems'],
    })
  }
}) as z.ZodType<Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>>

const formGapSchema = z.string()
  .regex(/^(?:0|[1-9]\d*)px$/, 'Form gap must be a non-negative integer followed by px')
  .refine(value => Number.parseInt(value, 10) <= FORM_GAP_MAX_PX, `Form gap must not exceed ${FORM_GAP_MAX_PX}px`)

export const formSettingsSchema: z.ZodType<FormSettings> = z.object({
  readonly: z.boolean().optional(),
  inline: z.boolean().optional(),
  columns: z.number().int().min(1).max(24).optional(),
  gap: formGapSchema.optional(),
  fieldSpan: z.number().int().min(1).max(24).optional(),
  labelPosition: z.enum(['left', 'top']).optional(),
  labelWidth: z.number().int().min(0).max(FORM_LABEL_WIDTH_MAX_PX).optional(),
  responsive: z.object({
    tablet: z.object({
      columns: z.number().int().min(1).max(24).optional(),
      fieldSpan: z.number().int().min(1).max(24).optional(),
      labelWidth: z.number().int().min(0).max(FORM_LABEL_WIDTH_MAX_PX).optional(),
    }).strict().optional(),
    mobile: z.object({
      columns: z.number().int().min(1).max(24).optional(),
      fieldSpan: z.number().int().min(1).max(24).optional(),
      labelWidth: z.number().int().min(0).max(FORM_LABEL_WIDTH_MAX_PX).optional(),
    }).strict().optional(),
  }).strict().optional(),
}).strict()

const safeExpressionNodeSchema = z.unknown()
  .superRefine(validateSafeExpressionNode)
  .transform(value => value as SafeExpressionNode) as z.ZodType<SafeExpressionNode>

export const safeExpressionSchema: z.ZodType<SafeExpression> = z.object({
  version: z.literal(1),
  ast: safeExpressionNodeSchema,
}).strict()

const datasetProjectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('options'),
    labelPath: safePathSchema,
    valuePath: safePathSchema,
    disabledPath: safePathSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal('table'),
    rowKeyPath: safePathSchema,
    columns: z.array(z.object({ key: identifierSchema, valuePath: safePathSchema }).strict()),
  }).strict(),
  z.object({
    kind: z.literal('list'),
    itemKeyPath: safePathSchema,
    titlePath: safePathSchema.optional(),
    descriptionPath: safePathSchema.optional(),
  }).strict(),
])

const datasetViewQuerySchema: z.ZodType<DatasetViewQuery> = z.object({
  filter: z.lazy(() => safeExpressionSchema).optional(),
  sort: z.array(z.object({ path: safePathSchema, direction: z.enum(['asc', 'desc']) }).strict()).optional(),
  page: z.object({ index: z.number().int().min(0), size: z.number().int().positive() }).strict().optional(),
}).strict()

const datasetReferenceSchema = z.object({
  datasetId: identifierSchema,
  projection: datasetProjectionSchema,
  query: datasetViewQuerySchema.optional(),
}).strict()

const resourceReferenceSchema = z.object({ resourceId: identifierSchema }).strict()

const nodeBaseShape = {
  id: identifierSchema,
  component: registryKeySchema,
  props: modelJsonObjectSchema,
  extensions: modelJsonObjectSchema.optional(),
  datasetBindings: z.record(safeObjectKeySchema, datasetReferenceSchema).optional(),
  resourceBindings: z.record(safeObjectKeySchema, resourceReferenceSchema).optional(),
}

const fieldNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('field'),
  field: identifierSchema,
  label: z.string().optional(),
  defaultValue: modelJsonValueSchema.optional(),
  required: z.boolean().optional(),
  requiredMessage: z.string().optional(),
  validation: ruleSetSchema.optional(),
  validateOn: z.union([
    z.enum(['submit', 'blur', 'change']),
    z.array(z.enum(['submit', 'blur', 'change'])).min(1),
  ]).optional(),
}).strict()

export const slotItemSchema: z.ZodType<SlotItem> = z.object({
  nodeId: identifierSchema,
  placement: modelJsonObjectSchema,
}).strict()

const layoutNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('layout'),
  slots: z.record(safeObjectKeySchema, z.array(slotItemSchema)),
  valueScope: configFormValueScopeSchema.optional(),
}).strict()

const elementNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('element'),
}).strict()

export const surfaceNodeSchema: z.ZodType<SurfaceNode> = z.discriminatedUnion('kind', [
  fieldNodeSchema,
  layoutNodeSchema,
  elementNodeSchema,
]) as z.ZodType<SurfaceNode>

const surfaceGraphBaseSchema = z.object({
  version: z.literal(SURFACE_GRAPH_VERSION),
  props: modelJsonObjectSchema,
  form: formSettingsSchema,
  root: z.array(slotItemSchema),
  nodesById: z.record(identifierSchema, surfaceNodeSchema),
}).strict()

export const surfaceGraphSchema: z.ZodType<SurfaceGraph> = surfaceGraphBaseSchema
  .superRefine(validateSurfaceGraph) as z.ZodType<SurfaceGraph>

export const nodeSubgraphSchema: z.ZodType<SurfaceGraph> = surfaceGraphBaseSchema
  .superRefine((graph, context) => validateSurfaceGraph(graph, context, false)) as z.ZodType<SurfaceGraph>

const stateProjectionTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('state'),
    nodeId: identifierSchema,
    key: z.enum(['visible', 'disabled', 'readonly', 'required']),
  }).strict(),
  z.object({ kind: z.literal('property'), nodeId: identifierSchema, path: safePathSchema.min(1) }).strict(),
])

const valueActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('set'), targetFieldId: identifierSchema, value: safeExpressionSchema }).strict(),
  z.object({ kind: z.literal('copy'), sourceFieldId: identifierSchema, targetFieldId: identifierSchema }).strict(),
  z.object({ kind: z.literal('clear'), targetFieldId: identifierSchema }).strict(),
])

const parameterBindingSchema = z.object({ name: identifierSchema, value: safeExpressionSchema }).strict()
const resultAssignmentSchema = z.object({ targetFieldId: identifierSchema, value: safeExpressionSchema }).strict()
const namedResultBindingSchema = z.object({
  resultName: identifierSchema,
  assignments: z.array(resultAssignmentSchema),
}).strict()

const primaryUiActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('navigate'), targetSurfaceId: identifierSchema, parameters: z.array(parameterBindingSchema) }).strict(),
  z.object({ kind: z.literal('back') }).strict(),
  z.object({
    kind: z.literal('open'),
    targetSurfaceId: identifierSchema,
    parameters: z.array(parameterBindingSchema),
    onResults: z.array(namedResultBindingSchema).optional(),
  }).strict(),
  z.object({
    kind: z.literal('closeCurrent'),
    result: z.object({ name: identifierSchema, value: safeExpressionSchema }).strict().optional(),
  }).strict(),
  z.object({ kind: z.literal('closeAll') }).strict(),
])

const prototypeInteractionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stateProjection'),
    id: identifierSchema,
    target: stateProjectionTargetSchema,
    value: safeExpressionSchema,
  }).strict(),
  z.object({
    kind: z.literal('valueChange'),
    id: identifierSchema,
    dependencies: z.array(identifierSchema).min(1),
    when: safeExpressionSchema.optional(),
    action: valueActionSchema,
  }).strict(),
  z.object({
    kind: z.literal('primaryUiAction'),
    id: identifierSchema,
    nodeId: identifierSchema,
    trigger: z.enum(['activate', 'submit', 'rowActivate', 'itemActivate']),
    validate: z.discriminatedUnion('scope', [
      z.object({ scope: z.literal('surface') }).strict(),
      z.object({ scope: z.literal('fields'), fieldIds: z.array(identifierSchema).min(1) }).strict(),
    ]).optional(),
    action: primaryUiActionSchema,
  }).strict(),
])

const parameterDefinitionSchema = z.object({
  name: identifierSchema,
  required: z.boolean(),
  defaultValue: modelJsonValueSchema.optional(),
}).strict()
const outputDefinitionSchema = z.object({ name: identifierSchema }).strict()

const positiveFinite = z.number().finite().positive()
const controlledLengthSchema = z.object({
  value: positiveFinite,
  unit: z.enum(['px', '%', 'rem', 'vw', 'vh']),
}).strict().superRefine((length, context) => {
  if (['%', 'vw', 'vh'].includes(length.unit) && length.value > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `${length.unit} length cannot exceed 100.`, path: ['value'] })
  }
})
export const responsiveLengthSchema = z.object({
  desktop: controlledLengthSchema,
  tablet: controlledLengthSchema.optional(),
  mobile: controlledLengthSchema.optional(),
}).strict()

const closePolicySchema = z.object({
  escape: z.boolean(),
  mask: z.boolean(),
  button: z.boolean(),
}).strict()

const surfaceBaseShape = {
  id: identifierSchema,
  name: displayNameSchema,
  graph: surfaceGraphSchema,
  parameters: z.array(parameterDefinitionSchema),
  outputs: z.array(outputDefinitionSchema),
  interactions: z.array(prototypeInteractionSchema),
}

const pageSurfaceSchema = z.object({
  ...surfaceBaseShape,
  kind: z.literal('page'),
  route: z.string().min(1).max(300).refine(isValidPageRoute, 'Page route must be an absolute path without query or fragment.'),
}).strict()
const dialogSurfaceSchema = z.object({
  ...surfaceBaseShape,
  kind: z.literal('dialog'),
  presentation: z.object({
    kind: z.literal('dialog'),
    title: z.string(),
    width: responsiveLengthSchema,
    mask: z.boolean(),
    close: closePolicySchema,
  }).strict().superRefine(validateMaskPolicy),
}).strict()
const drawerSurfaceSchema = z.object({
  ...surfaceBaseShape,
  kind: z.literal('drawer'),
  presentation: z.object({
    kind: z.literal('drawer'),
    title: z.string(),
    placement: z.enum(['left', 'right', 'top', 'bottom']),
    size: responsiveLengthSchema,
    mask: z.boolean(),
    close: closePolicySchema,
  }).strict().superRefine(validateMaskPolicy),
}).strict()

export const projectSurfaceSchema: z.ZodType<ProjectSurface> = z.discriminatedUnion('kind', [
  pageSurfaceSchema,
  dialogSurfaceSchema,
  drawerSurfaceSchema,
]).superRefine(validateSurfaceLocalInvariants) as z.ZodType<ProjectSurface>

export const projectDatasetSchema: z.ZodType<ProjectDataset> = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  description: z.string().max(2_000).optional(),
  rows: z.array(modelJsonObjectSchema),
  defaultProjection: datasetProjectionSchema.optional(),
}).strict().superRefine((dataset, context) => {
  if (dataset.defaultProjection?.kind === 'table') {
    reportDuplicateValues(dataset.defaultProjection.columns, column => column.key, context, ['defaultProjection', 'columns'], 'table column key')
  }
}) as z.ZodType<ProjectDataset>

const embeddedResourceSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  kind: z.literal('embedded'),
  fileName: z.string().refine(isValidResourceFileName, 'Embedded resource fileName is invalid.'),
  mediaType: z.string().trim().min(1).max(255),
  byteLength: z.number().int().nonnegative(),
  contentHash: z.string().regex(CONTENT_HASH),
}).strict()
const urlResourceSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  kind: z.literal('url'),
  url: z.string().refine(isValidStaticResourceUrl, 'Resource URL must be HTTPS or project-root-relative.'),
  mediaType: z.string().trim().min(1).max(255).optional(),
  integrity: z.string().trim().min(1).max(1_024).optional(),
}).strict()
export const projectResourceSchema: z.ZodType<ProjectResource> = z.discriminatedUnion('kind', [
  embeddedResourceSchema,
  urlResourceSchema,
])

const themeColorSchema = z.string().regex(THEME_COLOR)
const nonNegativeFinite = z.number().finite().nonnegative()
const themeShadowSchema = z.object({
  x: nonNegativeFinite,
  y: nonNegativeFinite,
  blur: nonNegativeFinite,
  spread: nonNegativeFinite,
  color: themeColorSchema,
}).strict()

export const projectThemeSchema: z.ZodType<ProjectTheme> = z.object({
  version: z.literal(PROJECT_THEME_VERSION),
  colors: z.object({
    primary: themeColorSchema.optional(),
    success: themeColorSchema.optional(),
    warning: themeColorSchema.optional(),
    danger: themeColorSchema.optional(),
    text: themeColorSchema.optional(),
    textMuted: themeColorSchema.optional(),
    canvas: themeColorSchema.optional(),
    surface: themeColorSchema.optional(),
    surfaceRaised: themeColorSchema.optional(),
    border: themeColorSchema.optional(),
  }).strict().optional(),
  typography: z.object({
    family: z.enum(['system', 'sans-serif', 'serif', 'monospace']).optional(),
    baseSize: nonNegativeFinite.optional(),
    lineHeight: nonNegativeFinite.optional(),
    bodyWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
    headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  }).strict().optional(),
  spacing: z.object({
    xs: nonNegativeFinite.optional(),
    sm: nonNegativeFinite.optional(),
    md: nonNegativeFinite.optional(),
    lg: nonNegativeFinite.optional(),
    xl: nonNegativeFinite.optional(),
  }).strict().optional(),
  border: z.object({ width: nonNegativeFinite.optional(), style: z.enum(['solid', 'dashed']).optional() }).strict().optional(),
  radius: z.object({ sm: nonNegativeFinite.optional(), md: nonNegativeFinite.optional(), lg: nonNegativeFinite.optional() }).strict().optional(),
  shadows: z.object({ sm: themeShadowSchema.optional(), md: themeShadowSchema.optional(), lg: themeShadowSchema.optional() }).strict().optional(),
}).strict()

export const registryLockSchema = z.object({
  adapter: registryKeySchema,
  version: registryVersionSchema,
  fingerprint: registryFingerprintSchema,
  components: z.record(registryKeySchema, z.object({
    contractVersion: registryVersionSchema,
    fingerprint: registryFingerprintSchema,
  }).strict()),
}).strict().superRefine((lock, context) => {
  if (lock.fingerprint !== registryLockFingerprint(lock.components)) {
    issue(
      context,
      'Registry fingerprint does not match its component contracts.',
      ['fingerprint'],
    )
  }
})

export const projectDocumentSchema: z.ZodType<ProjectDocument> = z.object({
  version: z.literal(PROJECT_DOCUMENT_VERSION),
  id: identifierSchema,
  name: displayNameSchema,
  homeSurfaceId: identifierSchema,
  surfaceOrder: z.array(identifierSchema).min(1),
  surfacesById: z.record(identifierSchema, projectSurfaceSchema),
  datasetOrder: z.array(identifierSchema),
  datasetsById: z.record(identifierSchema, projectDatasetSchema),
  resources: z.record(identifierSchema, projectResourceSchema),
  theme: projectThemeSchema,
  registryLock: registryLockSchema,
  settings: modelJsonObjectSchema,
}).strict().superRefine(validateProjectDocumentInvariants)

export const projectSnapshotSchema: z.ZodType<ProjectSnapshot> = z.object({
  document: projectDocumentSchema,
  editVersion: z.number().int().nonnegative(),
  contentHash: z.string().regex(HASH),
}).strict().superRefine((snapshot, context) => {
  const expected = getProjectDocumentContentHash(snapshot.document)
  if (snapshot.contentHash !== expected) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Project snapshot content hash mismatch: expected ${expected}.`, path: ['contentHash'] })
  }
}).transform(snapshot => freezeProjectSnapshot(snapshot.document, snapshot.editVersion))

export const projectDraftSnapshotSchema: z.ZodType<ProjectDraftSnapshot> = z.object({
  kind: z.literal('draft'),
  draftId: identifierSchema,
  document: projectDocumentSchema,
  base: z.object({
    projectId: identifierSchema,
    editVersion: z.number().int().nonnegative(),
    contentHash: z.string().regex(HASH),
  }).strict(),
  draftHash: z.string().regex(HASH),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.document.id !== snapshot.base.projectId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Project draft identity mismatch.', path: ['document', 'id'] })
  }
  const expected = getProjectDocumentContentHash(snapshot.document)
  if (snapshot.draftHash !== expected) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `Project draft content hash mismatch: expected ${expected}.`, path: ['draftHash'] })
  }
}).transform(snapshot => freezeProjectDraftSnapshot(snapshot.base, snapshot.document, snapshot.draftId))

export function parseProjectDocument(input: unknown): ProjectDocumentParseResult {
  let cyclePath: Array<string | number> | undefined
  try {
    cyclePath = findReferenceCycle(input)
  }
  catch {
    return { success: false, diagnostics: [{ code: 'project_structure_invalid', message: 'Project document structure cannot be inspected safely.', path: [] }] }
  }
  if (cyclePath) {
    return { success: false, diagnostics: [{ code: 'project_structure_invalid', message: 'Project documents cannot contain circular references.', path: cyclePath }] }
  }
  let versionDiagnostic: ModelDiagnostic | undefined
  try {
    versionDiagnostic = readVersionDiagnostic(input, 'ProjectDocument', PROJECT_DOCUMENT_VERSION)
  }
  catch {
    return { success: false, diagnostics: [{ code: 'project_structure_invalid', message: 'Project document structure cannot be inspected safely.', path: [] }] }
  }
  if (versionDiagnostic)
    return { success: false, diagnostics: [versionDiagnostic] }
  let result: ReturnType<typeof projectDocumentSchema.safeParse>
  try {
    result = projectDocumentSchema.safeParse(input)
  }
  catch {
    return { success: false, diagnostics: [{ code: 'project_structure_invalid', message: 'Project document exceeds supported nesting.', path: [] }] }
  }
  if (!result.success) {
    return {
      success: false,
      diagnostics: result.error.issues.map(issue => projectIssueToDiagnostic(issue, input)),
    }
  }
  return { success: true, data: structuredClone(result.data), diagnostics: [] }
}

export function assertProjectDocument(input: unknown): ProjectDocument {
  const result = parseProjectDocument(input)
  if (result.success)
    return result.data
  const first = result.diagnostics[0]
  throw new TypeError(`${first?.code ?? 'project_structure_invalid'}: ${first?.message ?? 'Invalid project document'}`)
}

export function getProjectDocumentContentHash(document: ProjectDocument | ReadonlyProjectDocument): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(document)}`
}

export function createProjectSnapshot(
  document: ProjectDocument | ReadonlyProjectDocument,
  editVersion = 0,
): ProjectSnapshot {
  if (!Number.isInteger(editVersion) || editVersion < 0)
    throw new RangeError('Project snapshot editVersion must be a non-negative integer.')
  return freezeProjectSnapshot(assertProjectDocument(document), editVersion)
}

export function createProjectDraftSnapshot(
  base: ProjectSnapshot,
  document: ProjectDocument | ReadonlyProjectDocument,
  draftId: string,
): ProjectDraftSnapshot {
  const committed = assertProjectSnapshot(base)
  const id = identifierSchema.parse(draftId)
  const candidate = assertProjectDocument(document)
  if (candidate.id !== committed.document.id)
    throw new TypeError('Project draft snapshots cannot change project identity.')
  return freezeProjectDraftSnapshot({
    projectId: committed.document.id,
    editVersion: committed.editVersion,
    contentHash: committed.contentHash,
  }, candidate, id)
}

export function createProjectDraftSnapshotFromTransaction(
  base: ProjectSnapshot,
  result: ProjectTransactionSuccess,
  draftId: string,
): ProjectDraftSnapshot {
  const id = identifierSchema.parse(draftId)
  const source = getProjectTransactionSource(result)
  if (!source || !result.changed)
    throw new TypeError('Project draft snapshots require an authenticated changed transaction result.')
  const baseMetadata = validatedProjectSnapshotMetadata.get(source)
  if (source !== base.document
    || !isValidatedProjectDocument(source)
    || !baseMetadata
    || base.editVersion !== baseMetadata.editVersion
    || base.contentHash !== baseMetadata.contentHash) {
    throw new TypeError('Project draft snapshots require a transaction from the validated base document.')
  }
  if (result.document.id !== base.document.id)
    throw new TypeError('Project draft snapshots cannot change project identity.')
  return freezeProjectDraftSnapshot({
    projectId: base.document.id,
    editVersion: base.editVersion,
    contentHash: base.contentHash,
  }, result.document, id)
}

export function parseProjectSnapshot(input: unknown): ProjectSnapshotParseResult {
  let result: ReturnType<typeof projectSnapshotSchema.safeParse>
  try {
    result = projectSnapshotSchema.safeParse(input)
  }
  catch {
    return {
      success: false,
      diagnostics: [{
        code: 'PROJECT_SNAPSHOT_INVALID',
        message: 'Project snapshot structure cannot be inspected safely.',
        path: [],
      }],
    }
  }
  if (!result.success) {
    return { success: false, diagnostics: result.error.issues.map(issue => ({ code: 'PROJECT_SNAPSHOT_INVALID', message: issue.message, path: issue.path })) }
  }
  return { success: true, data: result.data, diagnostics: [] }
}

export function assertProjectSnapshot(input: unknown): ProjectSnapshot {
  const result = parseProjectSnapshot(input)
  if (result.success)
    return result.data
  const first = result.diagnostics[0]
  throw new TypeError(`${first?.code ?? 'PROJECT_SNAPSHOT_INVALID'}: ${first?.message ?? 'Invalid project snapshot'}`)
}

export function parseProjectDraftSnapshot(input: unknown): ProjectDraftSnapshotParseResult {
  let result: ReturnType<typeof projectDraftSnapshotSchema.safeParse>
  try {
    result = projectDraftSnapshotSchema.safeParse(input)
  }
  catch {
    return {
      success: false,
      diagnostics: [{
        code: 'PROJECT_DRAFT_SNAPSHOT_INVALID',
        message: 'Project draft snapshot structure cannot be inspected safely.',
        path: [],
      }],
    }
  }
  if (!result.success) {
    return { success: false, diagnostics: result.error.issues.map(issue => ({ code: 'PROJECT_DRAFT_SNAPSHOT_INVALID', message: issue.message, path: issue.path })) }
  }
  return { success: true, data: result.data, diagnostics: [] }
}

export function parseProjectCompilationSnapshot(input: unknown): ProjectCompilationSnapshotParseResult {
  return isRecord(input) && input.kind === 'draft'
    ? parseProjectDraftSnapshot(input)
    : parseProjectSnapshot(input)
}

function validateSurfaceGraph(
  graph: SurfaceGraph,
  context: z.RefinementCtx,
  requireAllReachable = true,
): void {
  const locations = new Map<string, Array<Array<string | number>>>()
  const addLocation = (nodeId: string, path: Array<string | number>): void => {
    locations.set(nodeId, [...(locations.get(nodeId) ?? []), path])
  }
  graph.root.forEach((item, index) => addLocation(item.nodeId, ['root', index, 'nodeId']))
  Object.entries(graph.nodesById).forEach(([key, node]) => {
    if (key !== node.id)
      issue(context, `Node map key must equal node id: ${key} != ${node.id}`, ['nodesById', key, 'id'])
    if (node.kind === 'layout') {
      Object.entries(node.slots).forEach(([slot, items]) => {
        items.forEach((item, index) => addLocation(item.nodeId, ['nodesById', key, 'slots', slot, index, 'nodeId']))
      })
    }
  })
  locations.forEach((paths, nodeId) => {
    if (!Object.hasOwn(graph.nodesById, nodeId))
      issue(context, `Unknown node reference: ${nodeId}`, paths[0] ?? ['nodesById'])
    if (paths.length > 1)
      issue(context, `Node must have exactly one parent location: ${nodeId}`, paths[1]!)
  })
  if (requireAllReachable) {
    Object.keys(graph.nodesById).forEach((nodeId) => {
      if (!locations.has(nodeId))
        issue(context, `Node is unreachable: ${nodeId}`, ['nodesById', nodeId])
    })
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (nodeId: string, path: Array<string | number>): void => {
    if (visiting.has(nodeId)) {
      issue(context, `Node graph contains a cycle at ${nodeId}.`, path)
      return
    }
    if (visited.has(nodeId))
      return
    visiting.add(nodeId)
    const node = graph.nodesById[nodeId]
    if (node?.kind === 'layout') {
      Object.entries(node.slots).forEach(([slot, items]) => {
        items.forEach((item, index) => visit(item.nodeId, ['nodesById', nodeId, 'slots', slot, index, 'nodeId']))
      })
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }
  graph.root.forEach((item, index) => visit(item.nodeId, ['root', index, 'nodeId']))

  const scopeAnalysis = analyzeSurfaceValueScopes(graph)
  scopeAnalysis.issues.forEach(problem => issue(context, problem.message, problem.path))
}

function validateSafeExpressionNode(input: unknown, context: z.RefinementCtx): void {
  interface PendingNode {
    value: unknown
    depth: number
    path: Array<string | number>
  }

  const pending: PendingNode[] = [{ value: input, depth: 1, path: [] }]
  let scheduledNodes = 1
  let reportedNodeBudget = false
  const schedule = (children: PendingNode[]): void => {
    if (scheduledNodes + children.length > MAX_EXPRESSION_NODES) {
      if (!reportedNodeBudget) {
        expressionIssue(context, `Safe Expression cannot exceed ${MAX_EXPRESSION_NODES} nodes.`, [])
        reportedNodeBudget = true
      }
      return
    }
    scheduledNodes += children.length
    for (let index = children.length - 1; index >= 0; index -= 1)
      pending.push(children[index]!)
  }

  while (pending.length > 0) {
    const current = pending.pop()!
    if (current.depth > MAX_EXPRESSION_DEPTH) {
      expressionIssue(context, `Safe Expression depth cannot exceed ${MAX_EXPRESSION_DEPTH}.`, current.path)
      continue
    }
    if (!isRecord(current.value)) {
      expressionIssue(context, 'Safe Expression nodes must be objects.', current.path)
      continue
    }
    const node = current.value
    const child = (key: string): PendingNode => ({
      value: node[key],
      depth: current.depth + 1,
      path: [...current.path, key],
    })

    switch (node.kind) {
      case 'literal': {
        validateExpressionKeys(node, ['kind', 'value'], context, current.path)
        try {
          const literal = modelJsonValueSchema.safeParse(node.value)
          if (!literal.success) {
            literal.error.issues.forEach(problem => expressionIssue(
              context,
              `Safe Expression literal is not JSON-safe: ${problem.message}`,
              [...current.path, 'value', ...problem.path],
            ))
          }
        }
        catch {
          expressionIssue(context, 'Safe Expression literal exceeds supported nesting.', [...current.path, 'value'])
        }
        break
      }
      case 'reference': {
        const valuesScope = node.scope === 'values'
        validateExpressionKeys(
          node,
          valuesScope ? ['kind', 'scope', 'selector', 'path'] : ['kind', 'scope', 'path'],
          context,
          current.path,
        )
        if (valuesScope) {
          if (node.selector !== undefined && !['current', 'parent', 'root'].includes(String(node.selector))) {
            expressionIssue(context, 'Safe Expression values selector is invalid.', [...current.path, 'selector'])
          }
        }
        else if (!['parameters', 'result', 'item'].includes(String(node.scope))) {
          expressionIssue(context, 'Safe Expression reference scope is invalid.', [...current.path, 'scope'])
        }
        validateSafeExpressionPath(node.path, context, [...current.path, 'path'])
        break
      }
      case 'array': {
        validateExpressionKeys(node, ['kind', 'items'], context, current.path)
        if (!Array.isArray(node.items)) {
          expressionIssue(context, 'Safe Expression array items must be an array.', [...current.path, 'items'])
          break
        }
        schedule(node.items.map((value, index) => ({
          value,
          depth: current.depth + 1,
          path: [...current.path, 'items', index],
        })))
        break
      }
      case 'unary':
        validateExpressionKeys(node, ['kind', 'operator', 'operand'], context, current.path)
        if (!['!', '-', '+'].includes(String(node.operator)))
          expressionIssue(context, 'Safe Expression unary operator is invalid.', [...current.path, 'operator'])
        schedule([child('operand')])
        break
      case 'binary':
        validateExpressionKeys(node, ['kind', 'operator', 'left', 'right'], context, current.path)
        if (!['+', '-', '*', '/', '%', '==', '!=', '>', '>=', '<', '<=', '&&', '||'].includes(String(node.operator)))
          expressionIssue(context, 'Safe Expression binary operator is invalid.', [...current.path, 'operator'])
        schedule([child('left'), child('right')])
        break
      case 'conditional':
        validateExpressionKeys(node, ['kind', 'test', 'consequent', 'alternate'], context, current.path)
        schedule([child('test'), child('consequent'), child('alternate')])
        break
      case 'call': {
        validateExpressionKeys(node, ['kind', 'callee', 'args'], context, current.path)
        const callee = String(node.callee)
        if (!['coalesce', 'length', 'trim', 'lower', 'upper', 'includes', 'startsWith', 'endsWith'].includes(callee))
          expressionIssue(context, 'Safe Expression function is invalid.', [...current.path, 'callee'])
        if (!Array.isArray(node.args)) {
          expressionIssue(context, 'Safe Expression function arguments must be an array.', [...current.path, 'args'])
          break
        }
        const validArity = callee === 'coalesce'
          ? node.args.length > 0
          : ['length', 'trim', 'lower', 'upper'].includes(callee)
              ? node.args.length === 1
              : node.args.length === 2
        if (!validArity)
          expressionIssue(context, `Safe Expression function ${callee} received an invalid number of arguments.`, [...current.path, 'args'])
        schedule(node.args.map((value, index) => ({
          value,
          depth: current.depth + 1,
          path: [...current.path, 'args', index],
        })))
        break
      }
      default:
        expressionIssue(context, 'Safe Expression node kind is invalid.', [...current.path, 'kind'])
    }
  }
}

function validateExpressionKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  const allowed = new Set(allowedKeys)
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key))
      expressionIssue(context, `Safe Expression node contains an unknown key: ${key}.`, [...path, key])
  })
  allowedKeys.filter(key => key !== 'selector').forEach((key) => {
    if (!Object.hasOwn(value, key))
      expressionIssue(context, `Safe Expression node is missing ${key}.`, [...path, key])
  })
}

function validateSafeExpressionPath(
  value: unknown,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  if (!Array.isArray(value)) {
    expressionIssue(context, 'Safe Expression reference path must be an array.', path)
    return
  }
  if (value.length > 32)
    expressionIssue(context, 'Safe Expression reference path cannot exceed 32 segments.', path)
  value.forEach((segment, index) => {
    if (typeof segment !== 'string' || segment.length === 0 || segment.length > 128 || FORBIDDEN_OBJECT_KEYS.has(segment))
      expressionIssue(context, 'Safe Expression reference path segment is invalid.', [...path, index])
  })
}

function expressionIssue(
  context: z.RefinementCtx,
  message: string,
  path: Array<string | number>,
): void {
  issue(context, message, path)
}

function validateMaskPolicy(
  presentation: { mask: boolean, close: { mask: boolean } },
  context: z.RefinementCtx,
): void {
  if (!presentation.mask && presentation.close.mask)
    issue(context, 'Mask close cannot be enabled when the mask is disabled.', ['close', 'mask'])
}

function validateSurfaceLocalInvariants(surface: ProjectSurface, context: z.RefinementCtx): void {
  reportDuplicateValues(surface.parameters, parameter => parameter.name, context, ['parameters'], 'parameter name')
  reportDuplicateValues(surface.outputs, output => output.name, context, ['outputs'], 'output name')
  reportDuplicateValues(surface.interactions, interaction => interaction.id, context, ['interactions'], 'interaction id')
  const stateTargets = new Map<string, number>()
  const primaryTargets = new Map<string, number>()
  const nodes = surface.graph.nodesById
  const requireNode = (nodeId: string, path: Array<string | number>, kind?: 'field'): void => {
    const node = nodes[nodeId]
    if (!node)
      issue(context, `Interaction references an unknown node: ${nodeId}.`, path)
    else if (kind && node.kind !== kind)
      issue(context, `Interaction requires a ${kind} node: ${nodeId}.`, path)
  }

  surface.interactions.forEach((interaction, index) => {
    const base = ['interactions', index]
    if (interaction.kind === 'stateProjection') {
      requireNode(interaction.target.nodeId, [...base, 'target', 'nodeId'])
      const key = interaction.target.kind === 'state'
        ? `${interaction.target.nodeId}:state:${interaction.target.key}`
        : `${interaction.target.nodeId}:property:${interaction.target.path.join('.')}`
      if (stateTargets.has(key)) {
        issue(
          context,
          `State projection target is duplicated: ${key}.`,
          [...base, 'target'],
          {
            code: 'interaction_target_conflict',
            surfaceId: surface.id,
            nodeId: interaction.target.nodeId,
            context: {
              surfaceId: surface.id,
              target: key,
              ruleIds: [
                surface.interactions[stateTargets.get(key)!]!.id,
                interaction.id,
              ],
            },
          },
        )
      }
      else {
        stateTargets.set(key, index)
      }
      validateExpressionScopes(
        interaction.value,
        new Set(['values', 'parameters']),
        context,
        [...base, 'value'],
        surface.id,
        interaction.id,
      )
      return
    }
    if (interaction.kind === 'valueChange') {
      interaction.dependencies.forEach((nodeId, dependencyIndex) => requireNode(nodeId, [...base, 'dependencies', dependencyIndex], 'field'))
      if (interaction.when)
        validateExpressionScopes(interaction.when, new Set(['values', 'parameters']), context, [...base, 'when'], surface.id, interaction.id)
      if (interaction.action.kind === 'copy')
        requireNode(interaction.action.sourceFieldId, [...base, 'action', 'sourceFieldId'], 'field')
      requireNode(interaction.action.targetFieldId, [...base, 'action', 'targetFieldId'], 'field')
      if (interaction.action.kind === 'set')
        validateExpressionScopes(interaction.action.value, new Set(['values', 'parameters']), context, [...base, 'action', 'value'], surface.id, interaction.id)
      return
    }
    requireNode(interaction.nodeId, [...base, 'nodeId'])
    const triggerKey = `${interaction.nodeId}:${interaction.trigger}`
    if (primaryTargets.has(triggerKey)) {
      issue(
        context,
        `Primary action target is duplicated: ${triggerKey}.`,
        base,
        {
          code: 'interaction_trigger_invalid',
          surfaceId: surface.id,
          nodeId: interaction.nodeId,
          context: {
            surfaceId: surface.id,
            nodeId: interaction.nodeId,
            trigger: interaction.trigger,
          },
        },
      )
    }
    else {
      primaryTargets.set(triggerKey, index)
    }
    interaction.validate?.fieldIds?.forEach((nodeId, fieldIndex) => requireNode(nodeId, [...base, 'validate', 'fieldIds', fieldIndex], 'field'))
    if (interaction.action.kind === 'navigate' || interaction.action.kind === 'open') {
      interaction.action.parameters.forEach((binding, bindingIndex) => {
        validateExpressionScopes(
          binding.value,
          new Set(interaction.trigger === 'rowActivate' || interaction.trigger === 'itemActivate'
            ? ['values', 'parameters', 'item']
            : ['values', 'parameters']),
          context,
          [...base, 'action', 'parameters', bindingIndex, 'value'],
          surface.id,
          interaction.id,
        )
      })
      reportDuplicateValues(interaction.action.parameters, binding => binding.name, context, [...base, 'action', 'parameters'], 'parameter binding')
    }
    if (interaction.action.kind === 'open') {
      reportDuplicateValues(interaction.action.onResults ?? [], binding => binding.resultName, context, [...base, 'action', 'onResults'], 'result binding')
      interaction.action.onResults?.forEach((binding, resultIndex) => {
        binding.assignments.forEach((assignment, assignmentIndex) => {
          requireNode(assignment.targetFieldId, [...base, 'action', 'onResults', resultIndex, 'assignments', assignmentIndex, 'targetFieldId'], 'field')
          validateExpressionScopes(
            assignment.value,
            new Set(['values', 'parameters', 'result']),
            context,
            [...base, 'action', 'onResults', resultIndex, 'assignments', assignmentIndex, 'value'],
            surface.id,
            interaction.id,
          )
        })
      })
    }
    if (interaction.action.kind === 'closeCurrent' && interaction.action.result) {
      const result = interaction.action.result
      validateExpressionScopes(result.value, new Set(['values', 'parameters']), context, [...base, 'action', 'result', 'value'], surface.id, interaction.id)
      if (!surface.outputs.some(output => output.name === result.name))
        issue(context, `Surface output is not declared: ${result.name}.`, [...base, 'action', 'result', 'name'])
    }
  })
}

function validateProjectDocumentInvariants(document: ProjectDocument, context: z.RefinementCtx): void {
  validateOrderMapBijection(document.surfaceOrder, document.surfacesById, context, 'surfaceOrder', 'surfacesById', true)
  validateOrderMapBijection(document.datasetOrder, document.datasetsById, context, 'datasetOrder', 'datasetsById', false)
  Object.entries(document.resources).forEach(([key, resource]) => {
    if (key !== resource.id)
      issue(context, `Resource map key must equal resource id: ${key} != ${resource.id}.`, ['resources', key, 'id'])
  })
  const home = document.surfacesById[document.homeSurfaceId]
  if (!home) {
    issue(context, `Home Surface does not exist: ${document.homeSurfaceId}.`, ['homeSurfaceId'])
  }
  else if (home.kind !== 'page') {
    issue(context, 'Home Surface must be a Page.', ['homeSurfaceId'], {
      code: 'invalid_surface_kind',
      surfaceId: home.id,
      context: { surfaceId: home.id, expectedKinds: ['page'], receivedKind: home.kind },
    })
  }

  const pageCount = document.surfaceOrder.filter(id => document.surfacesById[id]?.kind === 'page').length
  if (pageCount === 0)
    issue(context, 'Project must contain at least one Page Surface.', ['surfaceOrder'])
  const routes = new Set<string>()
  document.surfaceOrder.forEach((surfaceId) => {
    const surface = document.surfacesById[surfaceId]
    if (!surface)
      return
    if (surface.kind === 'page') {
      if (routes.has(surface.route))
        issue(context, `Page route must be unique: ${surface.route}.`, ['surfacesById', surfaceId, 'route'])
      routes.add(surface.route)
    }
    validateSurfaceProjectReferences(document, surface, context)
  })
}

function validateSurfaceProjectReferences(
  document: ProjectDocument,
  surface: ProjectSurface,
  context: z.RefinementCtx,
): void {
  Object.entries(surface.graph.nodesById).forEach(([nodeId, node]) => {
    if (!Object.hasOwn(document.registryLock.components, node.component)) {
      issue(
        context,
        `Registry lock does not contain node component: ${node.component}.`,
        ['surfacesById', surface.id, 'graph', 'nodesById', nodeId, 'component'],
        {
          code: 'surface_graph_invalid',
          surfaceId: surface.id,
          nodeId,
          context: {
            surfaceId: surface.id,
            nodeId,
            component: node.component,
          },
        },
      )
    }
    Object.entries(node.datasetBindings ?? {}).forEach(([key, reference]) => {
      if (!Object.hasOwn(document.datasetsById, reference.datasetId)) {
        issue(
          context,
          `Dataset reference does not exist: ${reference.datasetId}.`,
          ['surfacesById', surface.id, 'graph', 'nodesById', nodeId, 'datasetBindings', key, 'datasetId'],
          {
            code: 'dataset_reference_invalid',
            surfaceId: surface.id,
            datasetId: reference.datasetId,
            nodeId,
            context: { datasetId: reference.datasetId, surfaceId: surface.id, nodeId },
          },
        )
      }
    })
    Object.entries(node.resourceBindings ?? {}).forEach(([key, reference]) => {
      if (!Object.hasOwn(document.resources, reference.resourceId)) {
        issue(
          context,
          `Resource reference does not exist: ${reference.resourceId}.`,
          ['surfacesById', surface.id, 'graph', 'nodesById', nodeId, 'resourceBindings', key, 'resourceId'],
          {
            code: 'resource_reference_invalid',
            surfaceId: surface.id,
            resourceId: reference.resourceId,
            nodeId,
            context: { resourceId: reference.resourceId, surfaceId: surface.id, nodeId },
          },
        )
      }
    })
  })

  surface.interactions.forEach((interaction, index) => {
    if (interaction.kind !== 'primaryUiAction')
      return
    const action = interaction.action
    if (action.kind !== 'navigate' && action.kind !== 'open')
      return
    const target = document.surfacesById[action.targetSurfaceId]
    const base = ['surfacesById', surface.id, 'interactions', index, 'action']
    if (!target) {
      issue(context, `Target Surface does not exist: ${action.targetSurfaceId}.`, [...base, 'targetSurfaceId'], {
        code: 'invalid_surface_reference',
        surfaceId: surface.id,
        nodeId: interaction.nodeId,
        context: {
          sourceSurfaceId: surface.id,
          nodeId: interaction.nodeId,
          targetSurfaceId: action.targetSurfaceId,
        },
      })
      return
    }
    if (action.kind === 'navigate' && target.kind !== 'page') {
      issue(context, 'navigate must target a Page Surface.', [...base, 'targetSurfaceId'], {
        code: 'invalid_surface_kind',
        surfaceId: target.id,
        nodeId: interaction.nodeId,
        context: { surfaceId: target.id, expectedKinds: ['page'], receivedKind: target.kind },
      })
    }
    if (action.kind === 'open' && target.kind === 'page') {
      issue(context, 'open must target a Dialog or Drawer Surface.', [...base, 'targetSurfaceId'], {
        code: 'invalid_surface_kind',
        surfaceId: target.id,
        nodeId: interaction.nodeId,
        context: { surfaceId: target.id, expectedKinds: ['dialog', 'drawer'], receivedKind: target.kind },
      })
    }
    const definitions = new Map(target.parameters.map(parameter => [parameter.name, parameter]))
    action.parameters.forEach((binding, bindingIndex) => {
      if (!definitions.has(binding.name))
        issue(context, `Target parameter is not declared: ${binding.name}.`, [...base, 'parameters', bindingIndex, 'name'])
    })
    definitions.forEach((definition, name) => {
      if (definition.required && definition.defaultValue === undefined && !action.parameters.some(binding => binding.name === name))
        issue(context, `Required target parameter is not bound: ${name}.`, [...base, 'parameters'])
    })
    if (action.kind === 'open') {
      const outputs = new Set(target.outputs.map(output => output.name))
      action.onResults?.forEach((binding, resultIndex) => {
        if (!outputs.has(binding.resultName))
          issue(context, `Target result is not declared: ${binding.resultName}.`, [...base, 'onResults', resultIndex, 'resultName'])
      })
    }
  })
}

function validateExpressionScopes(
  expression: SafeExpression,
  allowed: ReadonlySet<string>,
  context: z.RefinementCtx,
  path: Array<string | number>,
  surfaceId: string,
  ruleId: string,
): void {
  const visit = (node: SafeExpressionNode, nodePath: Array<string | number>): void => {
    if (node.kind === 'reference') {
      if (!allowed.has(node.scope)) {
        issue(
          context,
          `Expression scope is not available here: ${node.scope}.`,
          [...nodePath, 'scope'],
          {
            code: 'interaction_expression_invalid',
            surfaceId,
            context: { surfaceId, ruleId, location: nodePath },
          },
        )
      }
      return
    }
    if (node.kind === 'array') {
      node.items.forEach((item, index) => visit(item, [...nodePath, 'items', index]))
    }
    else if (node.kind === 'unary') {
      visit(node.operand, [...nodePath, 'operand'])
    }
    else if (node.kind === 'binary') {
      visit(node.left, [...nodePath, 'left'])
      visit(node.right, [...nodePath, 'right'])
    }
    else if (node.kind === 'conditional') {
      visit(node.test, [...nodePath, 'test'])
      visit(node.consequent, [...nodePath, 'consequent'])
      visit(node.alternate, [...nodePath, 'alternate'])
    }
    else if (node.kind === 'call') {
      node.args.forEach((argument, index) => visit(argument, [...nodePath, 'args', index]))
    }
  }
  visit(expression.ast, [...path, 'ast'])
}

function validateOrderMapBijection<T extends { id: string }>(
  order: readonly string[],
  map: Readonly<Record<string, T>>,
  context: z.RefinementCtx,
  orderKey: string,
  mapKey: string,
  requireNonEmpty: boolean,
): void {
  if (requireNonEmpty && order.length === 0)
    issue(context, `${orderKey} cannot be empty.`, [orderKey])
  const seen = new Set<string>()
  order.forEach((id, index) => {
    if (seen.has(id))
      issue(context, `Duplicate ${orderKey} entry: ${id}.`, [orderKey, index])
    seen.add(id)
    if (!Object.hasOwn(map, id))
      issue(context, `Unknown ${orderKey} entry: ${id}.`, [orderKey, index])
  })
  Object.entries(map).forEach(([key, value]) => {
    if (key !== value.id)
      issue(context, `${mapKey} key must equal asset id: ${key} != ${value.id}.`, [mapKey, key, 'id'])
    if (!seen.has(key))
      issue(context, `Asset is missing from ${orderKey}: ${key}.`, [mapKey, key])
  })
}

function reportDuplicateValues<T>(
  values: readonly T[],
  getIdentity: (value: T) => string,
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string,
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    const identity = getIdentity(value)
    if (seen.has(identity))
      issue(context, `Duplicate ${label}: ${identity}.`, [...path, index])
    seen.add(identity)
  })
}

function freezeProjectSnapshot(
  document: ProjectDocument | ReadonlyProjectDocument,
  editVersion: number,
): ProjectSnapshot {
  const immutableDocument = deepFreeze(document)
  markValidatedProjectDocument(immutableDocument)
  const contentHash = getFrozenProjectDocumentContentHash(immutableDocument)
  const snapshot = Object.freeze({
    document: immutableDocument,
    editVersion,
    contentHash,
  })
  validatedProjectSnapshotMetadata.set(immutableDocument, { editVersion, contentHash })
  return snapshot
}

function freezeProjectDraftSnapshot(
  base: ProjectDraftSnapshot['base'],
  document: ProjectDocument | ReadonlyProjectDocument,
  draftId: string,
): ProjectDraftSnapshot {
  const immutableDocument = deepFreeze(document)
  markValidatedProjectDocument(immutableDocument)
  return Object.freeze({
    kind: 'draft',
    draftId,
    document: immutableDocument,
    base: Object.freeze({ ...base }),
    draftHash: getFrozenProjectDocumentContentHash(immutableDocument),
  })
}

function getFrozenProjectDocumentContentHash(document: ProjectDocument | ReadonlyProjectDocument): string {
  const cached = immutableProjectDocumentHashCache.get(document)
  if (cached !== undefined)
    return cached
  const transient = new Set<object>([
    document,
    document.surfacesById,
    document.datasetsById,
    document.resources,
  ])
  Object.values(document.surfacesById).forEach((surface) => {
    transient.add(surface)
    transient.add(surface.graph)
    transient.add(surface.graph.root)
  })
  const serialized = stableImmutableJsonStringify(document, transient)
  let hash = 0x811C9DC5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  const result = `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
  immutableProjectDocumentHashCache.set(document, result)
  return result
}

function stableImmutableJsonStringify(value: unknown, transient: ReadonlySet<object>): string {
  if (value && typeof value === 'object' && deeplyFrozenValues.has(value) && !transient.has(value)) {
    const cached = immutableJsonSerializationCache.get(value)
    if (cached !== undefined)
      return cached
  }
  let serialized: string
  if (Array.isArray(value)) {
    serialized = `[${value.map(item => stableImmutableJsonStringify(item, transient)).join(',')}]`
  }
  else if (value && typeof value === 'object') {
    const object = value as Readonly<Record<string, unknown>>
    serialized = `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableImmutableJsonStringify(object[key], transient)}`).join(',')}}`
  }
  else {
    serialized = JSON.stringify(value) as string
  }
  if (value && typeof value === 'object' && deeplyFrozenValues.has(value) && !transient.has(value))
    immutableJsonSerializationCache.set(value, serialized)
  return serialized
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== 'object' || value === null || deeplyFrozenValues.has(value))
    return value as DeepReadonly<T>
  Object.values(value).forEach(child => deepFreeze(child))
  const immutable = Object.isFrozen(value) ? value : Object.freeze(value)
  deeplyFrozenValues.add(immutable)
  return immutable as DeepReadonly<T>
}

function projectIssueToDiagnostic(
  issueValue: z.ZodIssue,
  input: unknown,
): ModelDiagnostic {
  const metadata = issueValue.code === z.ZodIssueCode.custom
    ? issueValue.params?.modelDiagnostic as ProjectIssueDiagnosticMetadata | undefined
    : undefined
  const first = issueValue.path[0]
  const second = issueValue.path[1]
  const projectId = isRecord(input) && typeof input.id === 'string' ? input.id : undefined
  let code = 'project_structure_invalid'
  if (first === 'theme') {
    code = 'project_theme_invalid'
  }
  else if (first === 'surfacesById' && issueValue.path.includes('presentation')) {
    code = 'surface_presentation_invalid'
  }
  else if (first === 'surfacesById' && issueValue.path.includes('graph')) {
    code = 'surface_graph_invalid'
  }
  else if (first === 'surfacesById' && issueValue.path.includes('interactions')) {
    code = issueValue.message.startsWith('Safe Expression') || issueValue.message.includes('Expression scope')
      ? 'interaction_expression_invalid'
      : 'invalid_surface_reference'
  }
  else if (first === 'datasetsById') {
    code = 'dataset_rows_invalid'
  }
  else if (first === 'resources') {
    code = 'resource_content_invalid'
  }
  return {
    code: metadata?.code ?? code,
    message: issueValue.message,
    path: issueValue.path,
    ...(projectId ? { projectId } : {}),
    ...(metadata?.surfaceId
      ? { surfaceId: metadata.surfaceId }
      : first === 'surfacesById' && typeof second === 'string'
        ? { surfaceId: second }
        : {}),
    ...(metadata?.datasetId ? { datasetId: metadata.datasetId } : {}),
    ...(metadata?.resourceId ? { resourceId: metadata.resourceId } : {}),
    ...(metadata?.nodeId ? { nodeId: metadata.nodeId } : {}),
    context: {
      ...(projectId ? { projectId } : {}),
      path: [...issueValue.path],
      reason: issueValue.message,
      ...metadata?.context,
    },
  }
}

function readVersionDiagnostic(
  input: unknown,
  contract: string,
  expected: number,
): ModelDiagnostic | undefined {
  const received = isRecord(input) ? input.version : undefined
  if (received === expected)
    return undefined
  return {
    code: 'unsupported_contract_version',
    message: `${contract} version ${String(received)} is unsupported; expected ${expected}.`,
    path: ['version'],
    context: { contract, expected, received: received ?? null },
  }
}

function isValidPageRoute(route: string): boolean {
  return route.startsWith('/') && !route.includes('?') && !route.includes('#') && !route.includes('\\')
}

function isValidResourceFileName(fileName: string): boolean {
  if (fileName !== fileName.normalize('NFC') || fileName === '.' || fileName === '..' || !FILE_EXTENSION.test(fileName))
    return false
  if (fileName.includes('\\') || fileName.includes('/') || hasControlCharacter(fileName))
    return false
  return new TextEncoder().encode(fileName).byteLength <= 255
}

function isValidStaticResourceUrl(value: string): boolean {
  if (!value || value !== value.trim() || hasControlCharacter(value) || value.includes('\\'))
    return false
  if (value.startsWith('/')) {
    if (value.startsWith('//'))
      return false
    const path = value.split(/[?#]/, 1)[0]!
    return isSafeStaticUrlPath(path)
  }
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password)
      return false
    const authorityStart = value.indexOf('://') + 3
    const pathStart = value.indexOf('/', authorityStart)
    const queryStart = value.search(/[?#]/)
    const rawPath = pathStart < 0 || (queryStart >= 0 && pathStart > queryStart)
      ? ''
      : value.slice(pathStart).split(/[?#]/, 1)[0]!
    return isSafeStaticUrlPath(rawPath)
  }
  catch {
    return false
  }
}

function isSafeStaticUrlPath(path: string): boolean {
  try {
    const decodedPath = decodeURIComponent(path)
    if (hasControlCharacter(decodedPath) || decodedPath.includes('\\'))
      return false
    return !decodedPath.split('/').includes('..')
  }
  catch {
    return false
  }
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1F || code === 0x7F
  })
}

function issue(
  context: z.RefinementCtx,
  message: string,
  path: Array<string | number>,
  modelDiagnostic?: ProjectIssueDiagnosticMetadata,
): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path,
    ...(modelDiagnostic ? { params: { modelDiagnostic } } : {}),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findReferenceCycle(value: unknown): Array<string | number> | undefined {
  interface VisitFrame {
    value: object
    entries: ReadonlyArray<readonly [string | number, unknown]>
    index: number
    pathLength: number
  }

  if (typeof value !== 'object' || value === null)
    return undefined

  const ancestors = new WeakSet<object>()
  const completed = new WeakSet<object>()
  const path: Array<string | number> = []
  const entriesOf = (candidate: object): ReadonlyArray<readonly [string | number, unknown]> => (
    Array.isArray(candidate)
      ? candidate.map((item, index) => [index, item] as const)
      : Object.entries(candidate)
  )
  const pending: VisitFrame[] = [{ value, entries: entriesOf(value), index: 0, pathLength: 0 }]
  ancestors.add(value)

  while (pending.length > 0) {
    const current = pending.at(-1)!
    if (current.index >= current.entries.length) {
      ancestors.delete(current.value)
      completed.add(current.value)
      pending.pop()
      path.length = current.pathLength
      continue
    }

    const [key, child] = current.entries[current.index++]!
    path.length = current.pathLength
    path.push(key)
    if (typeof child !== 'object' || child === null || completed.has(child))
      continue
    if (ancestors.has(child))
      return [...path]
    ancestors.add(child)
    pending.push({
      value: child,
      entries: entriesOf(child),
      index: 0,
      pathLength: path.length,
    })
  }
}
