import type {
  ConfigFormDataSourceDefinition,
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormPageRuntimeConfiguration,
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
  ConfigFormValueInput,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormFieldOptionSource,
  DeepReadonly,
  FieldNode,
  FormSettings,
  LayoutNode,
  PageGraph,
  ProjectCompilationSnapshotParseResult,
  ProjectDocument,
  ProjectDocumentParseResult,
  ProjectDraftSnapshot,
  ProjectDraftSnapshotParseResult,
  ProjectPage,
  ProjectSnapshot,
  ProjectSnapshotParseResult,
  ProjectTransactionSuccess,
  ReadonlyProjectDocument,
  SlotItem,
} from '../types'
import {
  collectConfigFormValueReferences,
  getConfigFormJsonSemanticHash,
} from '@moluoxixi/config-form-core'
import { ruleSetSchema } from '@moluoxixi/zod3-to-rule'
import { z } from 'zod'
import {
  FORM_GAP_MAX_PX,
  FORM_LABEL_WIDTH_MAX_PX,
  PAGE_GRAPH_VERSION,
  PROJECT_DOCUMENT_VERSION,
} from '../constants'
import { collectConfigFormExpressionFieldNames } from '../services/reference-integrity'
import { getProjectTransactionSource } from '../services/transactions/services/publication'
import { analyzeProjectPageValueScopes, isProjectPageFieldReferenceInScope, resolveProjectPageNamedField } from '../services/value-scope'

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const safeObjectKeySchema = z.string().refine(key => !FORBIDDEN_OBJECT_KEYS.has(key), 'Object key is not allowed')
const deeplyFrozenValues = new WeakSet<object>()
const validatedProjectDocuments = new WeakSet<object>()
const immutableJsonSerializationCache = new WeakMap<object, string>()
const immutableProjectDocumentHashCache = new WeakMap<object, string>()
const identifierSchema = z.string().trim().min(1).max(128).refine(key => !FORBIDDEN_OBJECT_KEYS.has(key), 'Identifier is not allowed')

export const modelJsonValueSchema: z.ZodType<ConfigFormJsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string(),
  z.array(modelJsonValueSchema),
  z.record(safeObjectKeySchema, modelJsonValueSchema),
]))

export const modelJsonObjectSchema: z.ZodType<ConfigFormJsonObject> = z.record(safeObjectKeySchema, modelJsonValueSchema)

export const configFormValueInputSchema: z.ZodType<ConfigFormValueInput> = z
  .custom<ConfigFormValueInput>(() => true)
  .superRefine((input, context) => {
    try {
      collectConfigFormValueReferences(input)
    }
    catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: readValueReferenceErrorMessage(error),
        path: readValueReferenceErrorPath(error),
      })
    }
  })

export const configFormVariableDefinitionSchema = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1).max(160),
  initialValue: configFormValueInputSchema,
}).strict()

const configFormDataSourceRequestDefinitionSchema = z.object({
  url: configFormValueInputSchema,
  method: configFormValueInputSchema.optional(),
  headers: configFormValueInputSchema.optional(),
  query: configFormValueInputSchema.optional(),
  body: configFormValueInputSchema.optional(),
  responseType: configFormValueInputSchema.optional(),
}).strict()

export const configFormDataSourceDefinitionSchema: z.ZodType<ConfigFormDataSourceDefinition> = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1).max(160),
  request: configFormDataSourceRequestDefinitionSchema,
  mapping: configFormValueInputSchema.optional(),
  dependencies: z.array(configFormValueInputSchema).optional(),
  auto: z.boolean().optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
  cacheTtlMs: z.number().int().nonnegative().optional(),
}).strict()

export const configFormPageRuntimeConfigurationSchema: z.ZodType<ConfigFormPageRuntimeConfiguration> = z.object({
  variables: z.array(configFormVariableDefinitionSchema),
  dataSources: z.array(configFormDataSourceDefinitionSchema),
}).strict().superRefine((runtime, context) => {
  reportDuplicateIdentity(runtime.variables, 'variable', context, ['variables'])
  reportDuplicateIdentity(runtime.dataSources, 'data source', context, ['dataSources'])
})

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
  if (scope.kind === 'array' && scope.minItems !== undefined && scope.maxItems !== undefined && scope.minItems > scope.maxItems) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Value scope minItems cannot exceed maxItems.',
      path: ['minItems'],
    })
  }
}) as z.ZodType<Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>>

export const configFormFieldOptionSourceSchema: z.ZodType<ConfigFormFieldOptionSource> = z.object({
  kind: z.literal('dataSource'),
  dataSourceId: identifierSchema,
  params: z.record(safeObjectKeySchema, configFormValueInputSchema).optional(),
}).strict()

const formGapSchema = z.string()
  .regex(/^(?:0|[1-9]\d*)px$/, 'Form gap must be a non-negative integer followed by px')
  .refine(value => Number.parseInt(value, 10) <= FORM_GAP_MAX_PX, `Form gap must not exceed ${FORM_GAP_MAX_PX}px`)

const expressionSourceSchema = z.string().min(1).max(10_000)

const reactionOperandSchema: z.ZodType<ConfigFormReactionOperand> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), field: identifierSchema }).strict(),
  z.object({ kind: z.literal('literal'), value: modelJsonValueSchema }).strict(),
  z.object({ kind: z.literal('expression'), expression: expressionSourceSchema }).strict(),
])

const reactionConditionSchema: z.ZodType<ConfigFormReactionCondition> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.boolean() }).strict(),
  z.object({
    kind: z.literal('compare'),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
    left: reactionOperandSchema,
    right: reactionOperandSchema,
  }).strict(),
  z.object({ kind: z.literal('and'), expressions: z.array(reactionConditionSchema) }).strict(),
  z.object({ kind: z.literal('or'), expressions: z.array(reactionConditionSchema) }).strict(),
  z.object({ kind: z.literal('not'), expression: reactionConditionSchema }).strict(),
  z.object({ kind: z.literal('expression'), expression: expressionSourceSchema }).strict(),
]))

const reactionEffectSchema: z.ZodType<ConfigFormReactionEffect> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setValue'), target: identifierSchema, value: reactionOperandSchema }).strict(),
  z.object({ kind: z.literal('clearValue'), target: identifierSchema }).strict(),
  z.object({
    kind: z.literal('setState'),
    target: identifierSchema,
    state: z.object({
      visible: z.boolean().optional(),
      disabled: z.boolean().optional(),
      readonly: z.boolean().optional(),
      required: z.boolean().optional(),
    }).strict(),
  }).strict(),
  z.object({ kind: z.literal('setProps'), target: identifierSchema, props: z.record(reactionOperandSchema) }).strict(),
  z.object({ kind: z.literal('validate'), target: identifierSchema }).strict(),
])

const reactionSchema: z.ZodType<ConfigFormReaction> = z.object({
  id: identifierSchema,
  enabled: z.boolean().optional(),
  when: reactionConditionSchema,
  then: z.array(reactionEffectSchema),
  else: z.array(reactionEffectSchema).optional(),
}).strict()

const registeredBindingSchema = z.object({ source: identifierSchema }).catchall(modelJsonValueSchema).superRefine(validateSafeObjectKeys)

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

const nodeBaseShape = {
  id: identifierSchema,
  component: identifierSchema,
  props: modelJsonObjectSchema,
  bindings: z.record(safeObjectKeySchema, registeredBindingSchema),
  extensions: modelJsonObjectSchema.optional(),
  conditions: z.object({
    visible: reactionConditionSchema.optional(),
    hidden: reactionConditionSchema.optional(),
    required: reactionConditionSchema.optional(),
    disabled: reactionConditionSchema.optional(),
    readonly: reactionConditionSchema.optional(),
  }).strict().optional(),
  reactions: z.array(reactionSchema).optional(),
}

const fieldNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('field'),
  field: identifierSchema,
  label: z.string().optional(),
  defaultValue: modelJsonValueSchema.optional(),
  validation: ruleSetSchema.optional(),
  validateOn: z.union([
    z.enum(['submit', 'blur', 'change']),
    z.array(z.enum(['submit', 'blur', 'change'])).min(1),
  ]).optional(),
  optionSource: configFormFieldOptionSourceSchema.optional(),
}).strict() satisfies z.ZodType<FieldNode>

export const slotItemSchema: z.ZodType<SlotItem> = z.object({
  nodeId: identifierSchema,
  placement: modelJsonObjectSchema,
}).strict()

const layoutNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('layout'),
  slots: z.record(safeObjectKeySchema, z.array(slotItemSchema)),
  valueScope: configFormValueScopeSchema.optional(),
}).strict() satisfies z.ZodType<LayoutNode>

export const pageNodeSchema = z.discriminatedUnion('kind', [fieldNodeSchema, layoutNodeSchema])

const pageGraphBaseSchema = z.object({
  version: z.literal(PAGE_GRAPH_VERSION),
  props: modelJsonObjectSchema,
  form: formSettingsSchema,
  root: z.array(slotItemSchema),
  nodesById: z.record(identifierSchema, pageNodeSchema),
}).strict() satisfies z.ZodType<PageGraph>

export const pageGraphSchema: z.ZodType<PageGraph> = pageGraphBaseSchema.superRefine(validatePageGraph)
export const nodeSubgraphSchema: z.ZodType<PageGraph> = pageGraphBaseSchema.superRefine((graph, context) => {
  validatePageGraph(graph, context, false)
})

const projectPageContentShape = {
  graph: pageGraphSchema,
  runtime: configFormPageRuntimeConfigurationSchema.optional(),
}

export const projectPageContentSchema: z.ZodType<Pick<ProjectPage, 'graph' | 'runtime'>> = z.object({
  ...projectPageContentShape,
}).strict().superRefine(validateProjectPageContent)

export const projectPageSchema: z.ZodType<ProjectPage> = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1).max(160),
  route: z.string().min(1).max(300).refine(route => route.startsWith('/'), 'Route must start with /'),
  ...projectPageContentShape,
}).strict().superRefine(validateProjectPageContent)

const resourceSchema = z.object({
  id: identifierSchema,
  kind: identifierSchema,
  uri: z.string().trim().min(1),
  integrity: z.string().trim().min(1).optional(),
  metadata: modelJsonObjectSchema.optional(),
}).strict()

export const projectDocumentSchema: z.ZodType<ProjectDocument> = z.object({
  version: z.literal(PROJECT_DOCUMENT_VERSION),
  id: identifierSchema,
  name: z.string().trim().min(1).max(160),
  homePageId: identifierSchema,
  pageOrder: z.array(identifierSchema).min(1),
  pagesById: z.record(identifierSchema, projectPageSchema),
  registryLock: z.object({
    adapter: identifierSchema,
    version: z.string().trim().min(1),
    fingerprint: z.string().trim().min(1),
    components: z.record(identifierSchema, z.object({
      contractVersion: z.string().trim().min(1),
      fingerprint: z.string().trim().min(1),
    }).strict()),
  }).strict(),
  settings: modelJsonObjectSchema,
  resources: z.record(identifierSchema, resourceSchema),
}).strict().superRefine((document, context) => {
  validateProjectDocument(document, (message, path) => context.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path,
  }))
})

export const projectSnapshotSchema: z.ZodType<ProjectSnapshot> = z.object({
  document: projectDocumentSchema,
  editVersion: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^fnv1a:[0-9a-f]{8}$/),
}).strict().superRefine((snapshot, context) => {
  const expected = getProjectDocumentContentHash(snapshot.document)
  if (snapshot.contentHash !== expected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Project snapshot content hash mismatch: expected ${expected}.`,
      path: ['contentHash'],
    })
  }
}).transform(snapshot => freezeProjectSnapshot(snapshot.document, snapshot.editVersion))

export const projectDraftSnapshotSchema: z.ZodType<ProjectDraftSnapshot> = z.object({
  kind: z.literal('draft'),
  draftId: identifierSchema,
  document: projectDocumentSchema,
  base: z.object({
    projectId: identifierSchema,
    editVersion: z.number().int().nonnegative(),
    contentHash: z.string().regex(/^fnv1a:[0-9a-f]{8}$/),
  }).strict(),
  draftHash: z.string().regex(/^fnv1a:[0-9a-f]{8}$/),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.document.id !== snapshot.base.projectId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Project draft identity mismatch: expected ${snapshot.base.projectId}.`,
      path: ['document', 'id'],
    })
  }
  const expected = getProjectDocumentContentHash(snapshot.document)
  if (snapshot.draftHash !== expected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Project draft content hash mismatch: expected ${expected}.`,
      path: ['draftHash'],
    })
  }
}).transform(snapshot => freezeProjectDraftSnapshot(
  snapshot.base,
  snapshot.document,
  snapshot.draftId,
))

export function parseProjectDocument(input: unknown): ProjectDocumentParseResult {
  const cyclePath = findReferenceCycle(input)
  if (cyclePath) {
    return {
      success: false,
      diagnostics: [{ code: 'PROJECT_DOCUMENT_CYCLE', message: 'Project documents cannot contain circular references.', path: cyclePath }],
    }
  }
  const result = projectDocumentSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      diagnostics: result.error.issues.map(issue => ({
        code: issue.code === 'custom' ? 'PROJECT_DOCUMENT_INVARIANT' : 'PROJECT_DOCUMENT_INVALID',
        message: issue.message,
        path: issue.path,
      })),
    }
  }
  return { success: true, data: structuredClone(result.data), diagnostics: [] }
}

export function assertProjectDocument(input: unknown): ProjectDocument {
  const result = parseProjectDocument(input)
  if (result.success)
    return result.data
  const first = result.diagnostics[0]
  throw new TypeError(`${first?.code ?? 'PROJECT_DOCUMENT_INVALID'}: ${first?.message ?? 'Invalid project document'}`)
}

export function getProjectDocumentContentHash(
  document: ProjectDocument | ReadonlyProjectDocument,
): string {
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
  const id = draftId.trim()
  if (!id)
    throw new TypeError('Project draft snapshots require a non-empty draft id.')
  const candidate = assertProjectDocument(document)
  if (candidate.id !== committed.document.id)
    throw new TypeError('Project draft snapshots cannot change project identity.')
  return freezeProjectDraftSnapshot({
    projectId: committed.document.id,
    editVersion: committed.editVersion,
    contentHash: committed.contentHash,
  }, candidate, id)
}

/**
 * Accepts only an immutable, validated engine result derived from the exact
 * validated base document. The private provenance check preserves structural
 * sharing without trusting copied results or caller-supplied frozen objects.
 */
export function createProjectDraftSnapshotFromTransaction(
  base: ProjectSnapshot,
  result: ProjectTransactionSuccess,
  draftId: string,
): ProjectDraftSnapshot {
  const id = identifierSchema.parse(draftId)
  const source = getProjectTransactionSource(result)
  if (!source)
    throw new TypeError('Project draft snapshots require an authenticated transaction result.')
  if (!result.changed)
    throw new TypeError('Project draft snapshots require a changed transaction result.')
  const { document, editVersion, contentHash } = base
  if (source !== document || !validatedProjectDocuments.has(source))
    throw new TypeError('Project draft snapshots require a transaction from the validated base document.')
  if (!Number.isInteger(editVersion) || editVersion < 0 || contentHash !== getFrozenProjectDocumentContentHash(document))
    throw new TypeError('Project draft snapshots require a valid base snapshot identity.')
  if (result.document.id !== document.id)
    throw new TypeError('Project draft snapshots cannot change project identity.')
  return freezeProjectDraftSnapshot({
    projectId: document.id,
    editVersion,
    contentHash,
  }, result.document, id)
}

export function parseProjectSnapshot(input: unknown): ProjectSnapshotParseResult {
  const cyclePath = findReferenceCycle(input)
  if (cyclePath) {
    return {
      success: false,
      diagnostics: [{
        code: 'PROJECT_SNAPSHOT_CYCLE',
        message: 'Project snapshots cannot contain circular references.',
        path: cyclePath,
      }],
    }
  }
  const result = projectSnapshotSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      diagnostics: result.error.issues.map(issue => ({
        code: issue.code === 'custom' ? 'PROJECT_SNAPSHOT_INVARIANT' : 'PROJECT_SNAPSHOT_INVALID',
        message: issue.message,
        path: issue.path,
      })),
    }
  }
  return {
    success: true,
    data: result.data,
    diagnostics: [],
  }
}

export function assertProjectSnapshot(input: unknown): ProjectSnapshot {
  const result = parseProjectSnapshot(input)
  if (result.success)
    return result.data
  const first = result.diagnostics[0]
  throw new TypeError(`${first?.code ?? 'PROJECT_SNAPSHOT_INVALID'}: ${first?.message ?? 'Invalid project snapshot'}`)
}

export function parseProjectDraftSnapshot(input: unknown): ProjectDraftSnapshotParseResult {
  const cyclePath = findReferenceCycle(input)
  if (cyclePath) {
    return {
      success: false,
      diagnostics: [{
        code: 'PROJECT_DRAFT_SNAPSHOT_CYCLE',
        message: 'Project draft snapshots cannot contain circular references.',
        path: cyclePath,
      }],
    }
  }
  const result = projectDraftSnapshotSchema.safeParse(input)
  if (!result.success) {
    return {
      success: false,
      diagnostics: result.error.issues.map(issue => ({
        code: issue.code === 'custom' ? 'PROJECT_DRAFT_SNAPSHOT_INVARIANT' : 'PROJECT_DRAFT_SNAPSHOT_INVALID',
        message: issue.message,
        path: issue.path,
      })),
    }
  }
  return { success: true, data: result.data, diagnostics: [] }
}

export function parseProjectCompilationSnapshot(input: unknown): ProjectCompilationSnapshotParseResult {
  const draft = typeof input === 'object'
    && input !== null
    && 'kind' in input
    && input.kind === 'draft'
  return draft ? parseProjectDraftSnapshot(input) : parseProjectSnapshot(input)
}

function freezeProjectSnapshot(
  document: ProjectDocument | ReadonlyProjectDocument,
  editVersion: number,
): ProjectSnapshot {
  const immutableDocument = deepFreeze(document)
  validatedProjectDocuments.add(immutableDocument)
  return Object.freeze({
    document: immutableDocument,
    editVersion,
    contentHash: getFrozenProjectDocumentContentHash(immutableDocument),
  })
}

function freezeProjectDraftSnapshot(
  base: ProjectDraftSnapshot['base'],
  document: ProjectDocument | ReadonlyProjectDocument,
  draftId: string,
): ProjectDraftSnapshot {
  const immutableDocument = deepFreeze(document)
  validatedProjectDocuments.add(immutableDocument)
  return Object.freeze({
    kind: 'draft',
    draftId,
    document: immutableDocument,
    base: Object.freeze({ ...base }),
    draftHash: getFrozenProjectDocumentContentHash(immutableDocument),
  })
}

function getFrozenProjectDocumentContentHash(
  document: ProjectDocument | ReadonlyProjectDocument,
): string {
  const cached = immutableProjectDocumentHashCache.get(document)
  if (cached !== undefined)
    return cached

  // These containers change for nearly every edit; cache their shared children instead.
  const transient = new Set<object>([document, document.pagesById])
  Object.values(document.pagesById).forEach((page) => {
    transient.add(page)
    transient.add(page.graph)
    transient.add(page.graph.root)
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

function validatePageGraph(
  graph: PageGraph,
  context: z.RefinementCtx,
  validateNamedReferences = true,
): void {
  const references = new Map<string, Array<Array<string | number>>>()
  const fieldReferences: NamedFieldReference[] = []
  const reactionIds = new Map<string, Array<string | number>>()
  const scopeAnalysis = analyzeProjectPageValueScopes(graph)
  scopeAnalysis.issues.forEach(issue => context.addIssue({
    code: z.ZodIssueCode.custom,
    message: issue.message,
    path: issue.path,
  }))
  const addReference = (nodeId: string, path: Array<string | number>) => {
    references.set(nodeId, [...(references.get(nodeId) ?? []), path])
  }

  graph.root.forEach((item, index) => addReference(item.nodeId, ['root', index, 'nodeId']))
  Object.entries(graph.nodesById).forEach(([key, node]) => {
    if (key !== node.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node map key must equal node id: ${key} != ${node.id}`,
        path: ['nodesById', key, 'id'],
      })
    }
    if (node.kind === 'layout') {
      Object.entries(node.slots).forEach(([slot, items]) => {
        items.forEach((item, index) => addReference(item.nodeId, ['nodesById', key, 'slots', slot, index, 'nodeId']))
      })
    }
    else {
      node.validation?.rules.forEach((rule, index) => {
        if (rule.kind === 'compare') {
          fieldReferences.push({
            field: rule.field,
            path: ['nodesById', key, 'validation', 'rules', index, 'field'],
            sourceNodeId: node.id,
          })
        }
      })
    }

    Object.entries(node.conditions ?? {}).forEach(([target, condition]) => {
      if (condition) {
        collectConditionFieldReferences(
          condition,
          ['nodesById', key, 'conditions', target],
          fieldReferences,
          node.id,
        )
      }
    })
    node.reactions?.forEach((reaction, index) => {
      const reactionPath = ['nodesById', key, 'reactions', index]
      const previous = reactionIds.get(reaction.id)
      if (previous) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Reaction id must be unique: ${reaction.id}`,
          path: [...reactionPath, 'id'],
        })
      }
      else {
        reactionIds.set(reaction.id, [...reactionPath, 'id'])
      }
      collectConditionFieldReferences(reaction.when, [...reactionPath, 'when'], fieldReferences, node.id)
      collectReactionEffectFieldReferences(reaction.then, [...reactionPath, 'then'], fieldReferences, node.id)
      collectReactionEffectFieldReferences(reaction.else ?? [], [...reactionPath, 'else'], fieldReferences, node.id)
    })
  })

  if (validateNamedReferences) {
    fieldReferences.forEach((reference) => {
      if (!resolveProjectPageNamedField(scopeAnalysis, reference.sourceNodeId, reference.field)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown field reference: ${reference.field}`,
          path: reference.path,
        })
      }
    })
  }

  references.forEach((paths, nodeId) => {
    if (!graph.nodesById[nodeId]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown node reference: ${nodeId}`,
        path: paths[0],
      })
    }
    if (paths.length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node must have exactly one parent location: ${nodeId}`,
        path: paths[1],
      })
    }
  })

  Object.keys(graph.nodesById).forEach((nodeId) => {
    if (!references.has(nodeId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Node is unreachable: ${nodeId}`,
        path: ['nodesById', nodeId],
      })
    }
  })

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (nodeId: string, path: Array<string | number>) => {
    if (visiting.has(nodeId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Node graph contains a cycle at ${nodeId}`, path })
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
  Object.keys(graph.nodesById).forEach(nodeId => visit(nodeId, ['nodesById', nodeId]))
}

interface NamedFieldReference {
  field: string
  path: Array<string | number>
  sourceNodeId?: string
}

function validateProjectPageContent(
  page: Pick<ProjectPage, 'graph' | 'runtime'>,
  context: z.RefinementCtx,
): void {
  const scopeAnalysis = analyzeProjectPageValueScopes(page.graph)
  const variableIds = new Set(page.runtime?.variables.map(variable => variable.id) ?? [])
  const dataSourceIds = new Set(page.runtime?.dataSources.map(source => source.id) ?? [])

  validateRuntimeValueReferences(page, scopeAnalysis, variableIds, context)
  Object.entries(page.graph.nodesById).forEach(([nodeId, node]) => {
    if (node.kind === 'field' && node.optionSource) {
      if (!dataSourceIds.has(node.optionSource.dataSourceId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Option source references an unknown data source: ${node.optionSource.dataSourceId}`,
          path: ['graph', 'nodesById', nodeId, 'optionSource', 'dataSourceId'],
        })
      }
      Object.entries(node.optionSource.params ?? {}).forEach(([key, input]) => validateStableValueReferences(
        input,
        ['graph', 'nodesById', nodeId, 'optionSource', 'params', key],
        page,
        scopeAnalysis,
        variableIds,
        context,
        node.id,
      ))
    }
    Object.entries(node.conditions ?? {}).forEach(([target, condition]) => {
      if (condition) {
        validateConditionValueReferences(
          condition,
          ['graph', 'nodesById', nodeId, 'conditions', target],
          page,
          scopeAnalysis,
          variableIds,
          context,
          node.id,
        )
      }
    })
    node.reactions?.forEach((reaction, reactionIndex) => validateReactionValueReferences(
      reaction,
      ['graph', 'nodesById', nodeId, 'reactions', reactionIndex],
      page,
      scopeAnalysis,
      variableIds,
      context,
      node.id,
    ))
  })
}

function validateRuntimeValueReferences(
  page: Pick<ProjectPage, 'graph' | 'runtime'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
): void {
  const dependencyEdges = new Map<string, Array<{ id: string, path: Array<string | number> }>>()
  page.runtime?.variables.forEach((variable, index) => {
    const path = ['runtime', 'variables', index, 'initialValue']
    validateStableValueReferences(variable.initialValue, path, page, scopeAnalysis, variableIds, context)
    const dependencies = (collectValidValueReferences(variable.initialValue) ?? [])
      .filter(reference => reference.kind === 'variable')
      .map(reference => ({
        id: reference.id,
        path: [...path, ...valueReferenceEntryPath(variable.initialValue, reference.path, reference.kind)],
      }))
    dependencyEdges.set(variable.id, dependencies)
  })
  page.runtime?.dataSources.forEach((source, index) => {
    const base = ['runtime', 'dataSources', index]
    const inputs: Array<[Array<string | number>, ConfigFormValueInput | undefined]> = [
      [[...base, 'request', 'url'], source.request.url],
      [[...base, 'request', 'method'], source.request.method],
      [[...base, 'request', 'headers'], source.request.headers],
      [[...base, 'request', 'query'], source.request.query],
      [[...base, 'request', 'body'], source.request.body],
      [[...base, 'request', 'responseType'], source.request.responseType],
      [[...base, 'mapping'], source.mapping],
    ]
    source.dependencies?.forEach((input, dependencyIndex) => inputs.push([
      [...base, 'dependencies', dependencyIndex],
      input,
    ]))
    inputs.forEach(([path, input]) => {
      if (input !== undefined)
        validateStableValueReferences(input, path, page, scopeAnalysis, variableIds, context)
    })
  })
  reportVariableCycles(dependencyEdges, variableIds, context)
}

function validateStableValueReferences(
  input: ConfigFormValueInput,
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  const references = collectValidValueReferences(input)
  if (!references)
    return
  references.forEach((reference) => {
    const referencePath = [...path, ...valueReferenceEntryPath(input, reference.path, reference.kind)]
    if (reference.kind === 'field') {
      const target = page.graph.nodesById[reference.id]
      if (!target || target.kind !== 'field') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Value reference requires an existing field node: ${reference.id}`,
          path: referencePath,
        })
      }
      else if (sourceNodeId && !isProjectPageFieldReferenceInScope(
        scopeAnalysis,
        sourceNodeId,
        reference.id,
        reference.scope,
      )) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field ${reference.id} is not available from the ${reference.scope} value scope.`,
          path: referencePath,
        })
      }
    }
    else if (reference.kind === 'variable' && !variableIds.has(reference.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Value reference requires an existing variable: ${reference.id}`,
        path: referencePath,
      })
    }
  })
}

function collectValidValueReferences(
  input: ConfigFormValueInput,
): ReturnType<typeof collectConfigFormValueReferences> | undefined {
  try {
    return collectConfigFormValueReferences(input)
  }
  catch {
    return undefined
  }
}

function validateConditionValueReferences(
  condition: ConfigFormReactionCondition,
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  switch (condition.kind) {
    case 'literal':
      return
    case 'compare':
      validateOperandValueReferences(condition.left, [...path, 'left'], page, scopeAnalysis, variableIds, context, sourceNodeId)
      validateOperandValueReferences(condition.right, [...path, 'right'], page, scopeAnalysis, variableIds, context, sourceNodeId)
      return
    case 'and':
    case 'or':
      condition.expressions.forEach((item, index) => validateConditionValueReferences(
        item,
        [...path, 'expressions', index],
        page,
        scopeAnalysis,
        variableIds,
        context,
        sourceNodeId,
      ))
      return
    case 'not':
      validateConditionValueReferences(condition.expression, [...path, 'expression'], page, scopeAnalysis, variableIds, context, sourceNodeId)
      return
    case 'expression':
      validateExpressionValueReferences(condition.expression, [...path, 'expression'], page, scopeAnalysis, variableIds, context, sourceNodeId)
  }
}

function validateReactionValueReferences(
  reaction: ConfigFormReaction,
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  validateConditionValueReferences(reaction.when, [...path, 'when'], page, scopeAnalysis, variableIds, context, sourceNodeId)
  validateEffectValueReferences(reaction.then, [...path, 'then'], page, scopeAnalysis, variableIds, context, sourceNodeId)
  validateEffectValueReferences(reaction.else ?? [], [...path, 'else'], page, scopeAnalysis, variableIds, context, sourceNodeId)
}

function validateEffectValueReferences(
  effects: ConfigFormReactionEffect[],
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  effects.forEach((effect, index) => {
    if (effect.kind === 'setValue')
      validateOperandValueReferences(effect.value, [...path, index, 'value'], page, scopeAnalysis, variableIds, context, sourceNodeId)
    if (effect.kind === 'setProps') {
      Object.entries(effect.props).forEach(([key, operand]) => validateOperandValueReferences(
        operand,
        [...path, index, 'props', key],
        page,
        scopeAnalysis,
        variableIds,
        context,
        sourceNodeId,
      ))
    }
  })
}

function validateOperandValueReferences(
  operand: ConfigFormReactionOperand,
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  if (operand.kind === 'expression')
    validateExpressionValueReferences(operand.expression, [...path, 'expression'], page, scopeAnalysis, variableIds, context, sourceNodeId)
}

function validateExpressionValueReferences(
  source: string,
  path: Array<string | number>,
  page: Pick<ProjectPage, 'graph'>,
  scopeAnalysis: ReturnType<typeof analyzeProjectPageValueScopes>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
  sourceNodeId?: string,
): void {
  validateStableValueReferences(
    { $ref: { kind: 'expression', source } },
    path,
    page,
    scopeAnalysis,
    variableIds,
    context,
    sourceNodeId,
  )
}

function collectConditionFieldReferences(
  condition: ConfigFormReactionCondition,
  path: Array<string | number>,
  target: NamedFieldReference[],
  sourceNodeId?: string,
): void {
  switch (condition.kind) {
    case 'literal': return
    case 'compare':
      collectOperandFieldReferences(condition.left, [...path, 'left'], target, sourceNodeId)
      collectOperandFieldReferences(condition.right, [...path, 'right'], target, sourceNodeId)
      return
    case 'and':
    case 'or':
      condition.expressions.forEach((expression, index) => collectConditionFieldReferences(
        expression,
        [...path, 'expressions', index],
        target,
        sourceNodeId,
      ))
      return
    case 'not':
      collectConditionFieldReferences(condition.expression, [...path, 'expression'], target, sourceNodeId)
      return
    case 'expression':
      collectConfigFormExpressionFieldNames(condition.expression).forEach(field => target.push({
        field,
        path: [...path, 'expression'],
        sourceNodeId,
      }))
  }
}

function collectOperandFieldReferences(
  operand: ConfigFormReactionOperand,
  path: Array<string | number>,
  target: NamedFieldReference[],
  sourceNodeId?: string,
): void {
  if (operand.kind === 'field')
    target.push({ field: operand.field, path: [...path, 'field'], sourceNodeId })
  if (operand.kind === 'expression') {
    collectConfigFormExpressionFieldNames(operand.expression).forEach(field => target.push({
      field,
      path: [...path, 'expression'],
      sourceNodeId,
    }))
  }
}

function collectReactionEffectFieldReferences(
  effects: ConfigFormReactionEffect[],
  path: Array<string | number>,
  target: NamedFieldReference[],
  sourceNodeId?: string,
): void {
  effects.forEach((effect, index) => {
    target.push({ field: effect.target, path: [...path, index, 'target'], sourceNodeId })
    if (effect.kind === 'setValue')
      collectOperandFieldReferences(effect.value, [...path, index, 'value'], target, sourceNodeId)
    if (effect.kind === 'setProps') {
      Object.entries(effect.props).forEach(([key, operand]) => {
        collectOperandFieldReferences(operand, [...path, index, 'props', key], target, sourceNodeId)
      })
    }
  })
}

function reportDuplicateIdentity(
  values: readonly { id: string, name: string }[],
  kind: string,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  const ids = new Map<string, number>()
  const names = new Map<string, number>()
  values.forEach((value, index) => {
    if (ids.has(value.id))
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${kind} id: ${value.id}`, path: [...path, index, 'id'] })
    else
      ids.set(value.id, index)
    if (names.has(value.name))
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${kind} name: ${value.name}`, path: [...path, index, 'name'] })
    else
      names.set(value.name, index)
  })
}
function reportVariableCycles(
  edges: ReadonlyMap<string, readonly { id: string, path: Array<string | number> }[]>,
  variableIds: ReadonlySet<string>,
  context: z.RefinementCtx,
): void {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string, path: Array<string | number>): void => {
    if (visiting.has(id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Variable initialization contains a cycle at ${id}.`, path })
      return
    }
    if (visited.has(id))
      return
    visiting.add(id)
    for (const edge of edges.get(id) ?? []) {
      if (variableIds.has(edge.id))
        visit(edge.id, edge.path)
    }
    visiting.delete(id)
    visited.add(id)
  }
  edges.forEach((_edges, id) => visit(id, ['runtime', 'variables']))
}
function valueReferenceEntryPath(
  _input: ConfigFormValueInput,
  entryPath: string,
  kind: 'field' | 'variable',
): Array<string | number> {
  const property = kind === 'field' ? 'nodeId' : 'variableId'
  return [...parseValuePath(entryPath), '$ref', property]
}
function parseValuePath(path: string): Array<string | number> {
  if (path === '$')
    return []
  const result: Array<string | number> = []
  const pattern = /\.([A-Z_$][\w$]*)|\[(\d+)\]|\["((?:\\.|[^"\\])*)"\]/gi
  let match = pattern.exec(path)
  while (match !== null) {
    if (match[1] !== undefined)
      result.push(match[1])
    else if (match[2] !== undefined)
      result.push(Number(match[2]))
    else if (match[3] !== undefined)
      result.push(match[3])
    match = pattern.exec(path)
  }
  return result
}
function readValueReferenceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Value input is invalid.'
}
function readValueReferenceErrorPath(error: unknown): Array<string | number> {
  if (typeof error === 'object' && error !== null && 'path' in error && typeof error.path === 'string')
    return parseValuePath(error.path)
  return []
}
function validateSafeObjectKeys(
  object: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  Object.keys(object).forEach((key) => {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Object key is not allowed: ${key}`,
        path: [key],
      })
    }
  })
}

function validateProjectDocument(
  document: ProjectDocument,
  issue: (message: string, path: Array<string | number>) => void,
): void {
  const ordered = new Set<string>()
  document.pageOrder.forEach((pageId, index) => {
    if (ordered.has(pageId))
      issue(`Duplicate page order entry: ${pageId}`, ['pageOrder', index])
    ordered.add(pageId)
    if (!document.pagesById[pageId])
      issue(`Unknown page order entry: ${pageId}`, ['pageOrder', index])
  })
  Object.entries(document.pagesById).forEach(([key, page]) => {
    if (key !== page.id)
      issue(`Page map key must equal page id: ${key} != ${page.id}`, ['pagesById', key, 'id'])
    if (!ordered.has(key))
      issue(`Page is missing from pageOrder: ${key}`, ['pagesById', key])
  })
  if (!document.pagesById[document.homePageId])
    issue(`Home page does not exist: ${document.homePageId}`, ['homePageId'])

  const routes = new Map<string, string>()
  Object.values(document.pagesById).forEach((page) => {
    const previous = routes.get(page.route)
    if (previous)
      issue(`Page route must be unique: ${page.route}`, ['pagesById', page.id, 'route'])
    else
      routes.set(page.route, page.id)
  })

  Object.entries(document.resources).forEach(([key, resource]) => {
    if (key !== resource.id)
      issue(`Resource map key must equal resource id: ${key} != ${resource.id}`, ['resources', key, 'id'])
  })
}

function findReferenceCycle(value: unknown): Array<string | number> | undefined {
  const ancestors = new WeakMap<object, Array<string | number>>()
  const visit = (current: unknown, path: Array<string | number>): Array<string | number> | undefined => {
    if (typeof current !== 'object' || current === null)
      return undefined
    const previous = ancestors.get(current)
    if (previous)
      return path
    ancestors.set(current, path)
    const entries = Array.isArray(current)
      ? current.map((item, index) => [index, item] as const)
      : Object.entries(current)
    for (const [key, child] of entries) {
      const cycle = visit(child, [...path, key])
      if (cycle)
        return cycle
    }
    ancestors.delete(current)
    return undefined
  }
  return visit(value, [])
}
