import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowNode,
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionEffect,
  ConfigFormReactionOperand,
} from '@moluoxixi/config-form-core'
import type {
  DeepReadonly,
  FieldNode,
  FormSettings,
  LayoutNode,
  ModelDiagnostic,
  PageGraph,
  ProjectCompilationSnapshot,
  ProjectDocument,
  ProjectDraftSnapshot,
  ProjectPage,
  ProjectSnapshot,
  ReadonlyProjectDocument,
  SlotItem,
} from './types'
import {
  analyzeConfigFormFlow,
  CONFIG_FORM_FLOW_VERSION,
  getConfigFormJsonSemanticHash,
} from '@moluoxixi/config-form-core'
import { ruleSetSchema } from '@moluoxixi/zod3-to-rule'
import { z } from 'zod'
import { PAGE_GRAPH_VERSION, PROJECT_DOCUMENT_VERSION } from './types'

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const safeObjectKeySchema = z.string().refine(key => !FORBIDDEN_OBJECT_KEYS.has(key), 'Object key is not allowed')
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

const reactionOperandSchema: z.ZodType<ConfigFormReactionOperand> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), field: identifierSchema }).strict(),
  z.object({ kind: z.literal('literal'), value: modelJsonValueSchema }).strict(),
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

const flowNodeSchema: z.ZodType<ConfigFormFlowNode> = z.object({
  id: identifierSchema,
  type: z.enum(['trigger', 'condition', 'reaction', 'action', 'success', 'failure', 'end']),
  ref: identifierSchema.optional(),
  config: modelJsonObjectSchema.optional(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
}).strict()

const flowEdgeSchema: z.ZodType<ConfigFormFlowEdge> = z.object({
  id: identifierSchema,
  source: identifierSchema,
  target: identifierSchema,
  condition: z.enum(['next', 'true', 'false', 'error']).optional(),
}).strict()

export const flowSchema: z.ZodType<ConfigFormFlow> = z.object({
  version: z.literal(CONFIG_FORM_FLOW_VERSION),
  id: identifierSchema,
  name: z.string().trim().min(1).max(160),
  trigger: z.object({
    kind: z.enum(['page.mount', 'form.submit', 'field.change']),
    field: identifierSchema.optional(),
  }).strict(),
  concurrency: z.enum(['latest', 'queue', 'ignore']).optional(),
  errorPolicy: z.object({
    onError: z.enum(['failure', 'end']),
    timeoutMs: z.number().int().positive().optional(),
  }).strict().optional(),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
}).strict()

const registeredEventActionSchema = z.object({ action: identifierSchema }).catchall(modelJsonValueSchema).superRefine(validateSafeObjectKeys)
const registeredBindingSchema = z.object({ source: identifierSchema }).catchall(modelJsonValueSchema).superRefine(validateSafeObjectKeys)

export const formSettingsSchema: z.ZodType<FormSettings> = z.object({
  readonly: z.boolean().optional(),
  inline: z.boolean().optional(),
  columns: z.number().int().min(1).max(24).optional(),
  gap: z.string().optional(),
  fieldSpan: z.number().int().min(1).max(24).optional(),
  labelPosition: z.enum(['left', 'top']).optional(),
  responsive: z.object({
    tablet: z.object({
      columns: z.number().int().min(1).max(24).optional(),
      fieldSpan: z.number().int().min(1).max(24).optional(),
    }).strict().optional(),
    mobile: z.object({
      columns: z.number().int().min(1).max(24).optional(),
      fieldSpan: z.number().int().min(1).max(24).optional(),
    }).strict().optional(),
  }).strict().optional(),
}).strict()

const nodeBaseShape = {
  id: identifierSchema,
  component: identifierSchema,
  props: modelJsonObjectSchema,
  events: z.record(safeObjectKeySchema, z.array(registeredEventActionSchema)),
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
}).strict() satisfies z.ZodType<FieldNode>

export const slotItemSchema: z.ZodType<SlotItem> = z.object({
  nodeId: identifierSchema,
  placement: modelJsonObjectSchema,
}).strict()

const layoutNodeSchema = z.object({
  ...nodeBaseShape,
  kind: z.literal('layout'),
  slots: z.record(safeObjectKeySchema, z.array(slotItemSchema)),
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

const projectPageContentShape = {
  graph: pageGraphSchema,
  flows: z.array(flowSchema).optional(),
}

export const projectPageContentSchema: z.ZodType<Pick<ProjectPage, 'graph' | 'flows'>> = z.object({
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
  schemaVersion: z.literal(PROJECT_DOCUMENT_VERSION),
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

export type ProjectDocumentParseResult
  = | { success: true, data: ProjectDocument, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectSnapshotParseResult
  = | { success: true, data: ProjectSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectDraftSnapshotParseResult
  = | { success: true, data: ProjectDraftSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectCompilationSnapshotParseResult
  = | { success: true, data: ProjectCompilationSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

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
  return Object.freeze({
    document: immutableDocument,
    editVersion,
    contentHash: getProjectDocumentContentHash(immutableDocument),
  })
}

function freezeProjectDraftSnapshot(
  base: ProjectDraftSnapshot['base'],
  document: ProjectDocument | ReadonlyProjectDocument,
  draftId: string,
): ProjectDraftSnapshot {
  const immutableDocument = deepFreeze(document)
  return Object.freeze({
    kind: 'draft',
    draftId,
    document: immutableDocument,
    base: Object.freeze({ ...base }),
    draftHash: getProjectDocumentContentHash(immutableDocument),
  })
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value))
    return value as DeepReadonly<T>
  Object.values(value).forEach(child => deepFreeze(child))
  return Object.freeze(value) as DeepReadonly<T>
}

function validatePageGraph(graph: PageGraph, context: z.RefinementCtx): void {
  const references = new Map<string, Array<Array<string | number>>>()
  const fields = new Map<string, Array<string | number>>()
  const fieldReferences: Array<{ field: string, path: Array<string | number> }> = []
  const reactionIds = new Map<string, Array<string | number>>()
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
      const fieldPath = ['nodesById', key, 'field']
      const previous = fields.get(node.field)
      if (previous) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field name must be unique: ${node.field}`,
          path: fieldPath,
        })
      }
      else {
        fields.set(node.field, fieldPath)
      }
      node.validation?.rules.forEach((rule, index) => {
        if (rule.kind === 'compare') {
          fieldReferences.push({
            field: rule.field,
            path: ['nodesById', key, 'validation', 'rules', index, 'field'],
          })
        }
      })
    }

    Object.entries(node.conditions ?? {}).forEach(([target, condition]) => {
      if (condition)
        collectConditionFieldReferences(condition, ['nodesById', key, 'conditions', target], fieldReferences)
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
      collectConditionFieldReferences(reaction.when, [...reactionPath, 'when'], fieldReferences)
      collectReactionEffectFieldReferences(reaction.then, [...reactionPath, 'then'], fieldReferences)
      collectReactionEffectFieldReferences(reaction.else ?? [], [...reactionPath, 'else'], fieldReferences)
    })
  })

  fieldReferences.forEach((reference) => {
    if (!fields.has(reference.field)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown field reference: ${reference.field}`,
        path: reference.path,
      })
    }
  })

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

function validateProjectPageContent(
  page: Pick<ProjectPage, 'graph' | 'flows'>,
  context: z.RefinementCtx,
): void {
  const fields = new Set(Object.values(page.graph.nodesById)
    .filter(node => node.kind === 'field')
    .map(node => node.field))
  const flowIds = new Set<string>()
  page.flows?.forEach((flow, index) => {
    if (flowIds.has(flow.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate flow id: ${flow.id}`, path: ['flows', index, 'id'] })
      return
    }
    flowIds.add(flow.id)
    if (flow.trigger.kind === 'field.change' && (!flow.trigger.field || !fields.has(flow.trigger.field))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Flow field.change trigger references an unknown field: ${flow.trigger.field ?? '<missing>'}`,
        path: ['flows', index, 'trigger', 'field'],
      })
    }
    const analysis = analyzeConfigFormFlow(flow)
    analysis.diagnostics.forEach(diagnostic => context.addIssue({
      code: z.ZodIssueCode.custom,
      message: diagnostic.message,
      path: ['flows', index, ...(diagnostic.path ? [diagnostic.path] : [])],
    }))
  })
}

function collectConditionFieldReferences(
  condition: ConfigFormReactionCondition,
  path: Array<string | number>,
  target: Array<{ field: string, path: Array<string | number> }>,
): void {
  switch (condition.kind) {
    case 'literal': return
    case 'compare':
      if (condition.left.kind === 'field')
        target.push({ field: condition.left.field, path: [...path, 'left', 'field'] })
      if (condition.right.kind === 'field')
        target.push({ field: condition.right.field, path: [...path, 'right', 'field'] })
      return
    case 'and':
    case 'or':
      condition.expressions.forEach((expression, index) => collectConditionFieldReferences(
        expression,
        [...path, 'expressions', index],
        target,
      ))
      return
    case 'not':
      collectConditionFieldReferences(condition.expression, [...path, 'expression'], target)
  }
}

function collectReactionEffectFieldReferences(
  effects: ConfigFormReactionEffect[],
  path: Array<string | number>,
  target: Array<{ field: string, path: Array<string | number> }>,
): void {
  effects.forEach((effect, index) => {
    target.push({ field: effect.target, path: [...path, index, 'target'] })
    if (effect.kind === 'setValue' && effect.value.kind === 'field')
      target.push({ field: effect.value.field, path: [...path, index, 'value', 'field'] })
    if (effect.kind === 'setProps') {
      Object.entries(effect.props).forEach(([key, operand]) => {
        if (operand.kind === 'field')
          target.push({ field: operand.field, path: [...path, index, 'props', key, 'field'] })
      })
    }
  })
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
