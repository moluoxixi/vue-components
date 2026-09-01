import type {
  FieldNode,
  LayoutNode,
  ModelDiagnostic,
  PageNode,
  ProjectDocument,
  ProjectPage,
  SlotItem,
} from '@moluoxixi/config-form-model'
import type { ConfigImportDiagnostic, ConfigImportMigrationRecord, ConfigImportTarget } from './types'
import { PAGE_GRAPH_VERSION, parseProjectDocument, PROJECT_DOCUMENT_VERSION, projectPageSchema } from '@moluoxixi/config-form-model'
import { z } from 'zod'
import { appendConfigImportPath } from './guard'

const jsonRecordSchema = z.record(z.unknown())
const legacyNodeSchema: z.ZodType<LegacyNode> = z.lazy(() => z.object({
  id: z.string(),
  component: z.string(),
  props: jsonRecordSchema,
  events: jsonRecordSchema,
  bindings: jsonRecordSchema,
  children: z.array(legacyNodeSchema),
  slots: z.record(z.array(legacyNodeSchema)),
  kind: z.enum(['field', 'container']),
  field: z.string().optional(),
  label: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validation: z.unknown().optional(),
  validateOn: z.unknown().optional(),
  extensions: jsonRecordSchema.optional(),
  span: z.number().optional(),
  conditions: jsonRecordSchema.optional(),
  reactions: z.array(z.unknown()).optional(),
}).strict())

const legacyPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.literal(1),
  props: jsonRecordSchema,
  form: jsonRecordSchema,
  nodes: z.array(legacyNodeSchema),
  flows: z.array(z.unknown()).optional(),
}).strict()

const legacyProjectPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  route: z.string(),
  graph: z.object({
    version: z.literal(PAGE_GRAPH_VERSION),
    props: jsonRecordSchema,
    form: jsonRecordSchema,
    root: z.array(z.unknown()),
    nodesById: jsonRecordSchema,
    flows: z.array(z.unknown()).optional(),
  }).strict(),
  flows: z.array(z.unknown()).optional(),
}).strict()

const legacyProjectSchema = z.object({
  schemaVersion: z.literal(3),
  id: z.string(),
  name: z.string(),
  homePageId: z.string(),
  pageOrder: z.array(z.string()),
  pagesById: z.record(legacyProjectPageSchema),
  registryLock: jsonRecordSchema,
  settings: jsonRecordSchema,
  resources: jsonRecordSchema,
}).strict()

interface LegacyNode {
  id: string
  component: string
  props: Record<string, unknown>
  events: Record<string, unknown>
  bindings: Record<string, unknown>
  children: LegacyNode[]
  slots: Record<string, LegacyNode[]>
  kind: 'container' | 'field'
  field?: string
  label?: string
  defaultValue?: unknown
  validation?: unknown
  validateOn?: unknown
  extensions?: Record<string, unknown>
  span?: number
  conditions?: Record<string, unknown>
  reactions?: unknown[]
}

export type CanonicalImportPayload
  = | { target: 'page', page: ProjectPage, migrations: ConfigImportMigrationRecord[] }
    | { target: 'project', document: ProjectDocument, migrations: ConfigImportMigrationRecord[] }

function pathFromModel(path: ModelDiagnostic['path']): string {
  return (path ?? []).reduce<string>(
    (result, segment) => appendConfigImportPath(result, segment),
    '$',
  )
}

function invalid(
  code: ConfigImportDiagnostic['code'],
  message: string,
  path = '$',
): { success: false, diagnostics: ConfigImportDiagnostic[] } {
  return { success: false, diagnostics: [{ code, message, path }] }
}

function zodInvalid(
  code: 'IMPORT_PAGE_INVALID' | 'IMPORT_PROJECT_INVALID',
  issues: z.ZodIssue[],
): { success: false, diagnostics: ConfigImportDiagnostic[] } {
  return {
    success: false,
    diagnostics: issues.map(issue => ({
      code,
      message: issue.message,
      path: pathFromModel(issue.path),
    })),
  }
}

function currentProject(input: unknown): ReturnType<typeof migrateConfigImportPayload> {
  const parsed = parseProjectDocument(input)
  return parsed.success
    ? { success: true, payload: { target: 'project', document: parsed.data, migrations: [] } }
    : {
        success: false,
        diagnostics: parsed.diagnostics.map(item => ({
          code: 'IMPORT_PROJECT_INVALID',
          message: item.message,
          path: pathFromModel(item.path),
        })),
      }
}

function legacyProject(input: unknown): ReturnType<typeof migrateConfigImportPayload> {
  const parsed = legacyProjectSchema.safeParse(input)
  if (!parsed.success)
    return zodInvalid('IMPORT_PROJECT_INVALID', parsed.error.issues)
  const candidate = structuredClone(parsed.data) as Record<string, unknown>
  const pages = candidate.pagesById as Record<string, Record<string, unknown>>
  for (const [pageId, page] of Object.entries(pages)) {
    const graph = page.graph as Record<string, unknown>
    if (graph.flows !== undefined && page.flows !== undefined) {
      return invalid(
        'IMPORT_FLOW_OWNERSHIP_AMBIGUOUS',
        `Page ${pageId} stores Flow data in both graph.flows and page.flows.`,
        `${appendConfigImportPath('$.pagesById', pageId)}.flows`,
      )
    }
    if (graph.flows !== undefined)
      page.flows = graph.flows
    delete graph.flows
  }
  candidate.schemaVersion = PROJECT_DOCUMENT_VERSION
  const migrated = parseProjectDocument(candidate)
  if (!migrated.success) {
    return {
      success: false,
      diagnostics: migrated.diagnostics.map(item => ({
        code: 'IMPORT_PROJECT_INVALID',
        message: item.message,
        path: pathFromModel(item.path),
      })),
    }
  }
  return {
    success: true,
    payload: {
      target: 'project',
      document: migrated.data,
      migrations: [{
        code: 'IMPORT_PROJECT_V3_TO_V4',
        fromVersion: 'Project v3',
        message: 'Moved page Flow ownership from PageGraph to ProjectPage.',
        path: '$.pagesById',
        toVersion: 'Project v4',
      }],
    },
  }
}

function legacyPage(input: unknown): ReturnType<typeof migrateConfigImportPayload> {
  const parsed = legacyPageSchema.safeParse(input)
  if (!parsed.success)
    return zodInvalid('IMPORT_PAGE_INVALID', parsed.error.issues)
  const nodesById: Record<string, PageNode> = Object.create(null)
  const failures: ConfigImportDiagnostic[] = []

  const migrateNode = (node: LegacyNode, path: string): SlotItem => {
    const item: SlotItem = {
      nodeId: node.id,
      placement: node.span === undefined ? {} : { span: node.span },
    }
    if (nodesById[node.id]) {
      failures.push({ code: 'IMPORT_PAGE_INVALID', message: `Duplicate legacy node id: ${node.id}.`, path: `${path}.id` })
      return item
    }
    const common = {
      id: node.id,
      component: node.component,
      props: structuredClone(node.props),
      events: structuredClone(node.events),
      bindings: structuredClone(node.bindings),
      ...(node.extensions ? { extensions: structuredClone(node.extensions) } : {}),
      ...(node.conditions ? { conditions: structuredClone(node.conditions) } : {}),
      ...(node.reactions ? { reactions: structuredClone(node.reactions) } : {}),
    }
    if (node.kind === 'field') {
      if (node.children.length > 0 || Object.values(node.slots).some(items => items.length > 0)) {
        failures.push({ code: 'IMPORT_PAGE_INVALID', message: `Field node ${node.id} cannot own children.`, path })
      }
      nodesById[node.id] = {
        ...common,
        kind: 'field',
        field: node.field ?? node.id,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.defaultValue !== undefined ? { defaultValue: structuredClone(node.defaultValue) } : {}),
        ...(node.validation !== undefined ? { validation: structuredClone(node.validation) } : {}),
        ...(node.validateOn !== undefined ? { validateOn: structuredClone(node.validateOn) } : {}),
      } as FieldNode
      return item
    }
    const defaultSlotChildren = node.slots.default ?? []
    if (node.children.length > 0 && defaultSlotChildren.length > 0) {
      failures.push({
        code: 'IMPORT_PAGE_INVALID',
        message: `Layout node ${node.id} stores children in both children and slots.default.`,
        path: `${path}.slots.default`,
      })
    }
    const layout = { ...common, kind: 'layout', slots: Object.create(null) } as LayoutNode
    nodesById[node.id] = layout
    const defaultChildren = node.children.length > 0 ? node.children : defaultSlotChildren
    const defaultPath = node.children.length > 0 ? `${path}.children` : `${path}.slots.default`
    layout.slots.default = defaultChildren.map((child, index) => migrateNode(child, `${defaultPath}[${index}]`))
    Object.entries(node.slots).forEach(([slot, children]) => {
      if (slot !== 'default') {
        layout.slots[slot] = children.map((child, index) => migrateNode(
          child,
          `${appendConfigImportPath(`${path}.slots`, slot)}[${index}]`,
        ))
      }
    })
    return item
  }

  const pageCandidate = {
    id: parsed.data.id,
    name: parsed.data.name,
    route: '/',
    graph: {
      version: PAGE_GRAPH_VERSION,
      props: parsed.data.props,
      form: parsed.data.form,
      root: parsed.data.nodes.map((node, index) => migrateNode(node, `$.nodes[${index}]`)),
      nodesById,
    },
    ...(parsed.data.flows ? { flows: parsed.data.flows } : {}),
  }
  if (failures.length > 0)
    return { success: false, diagnostics: failures }
  const page = projectPageSchema.safeParse(pageCandidate)
  if (!page.success)
    return zodInvalid('IMPORT_PAGE_INVALID', page.error.issues)
  return {
    success: true,
    payload: {
      target: 'page',
      page: structuredClone(page.data),
      migrations: [{
        code: 'IMPORT_PAGE_V1_TO_V2',
        fromVersion: 'Page Model v1',
        message: 'Flattened the legacy page tree into PageGraph v2.',
        path: '$',
        toVersion: 'PageGraph v2',
      }],
    },
  }
}

export function migrateConfigImportPayload(
  input: unknown,
  target: ConfigImportTarget,
):
  | { success: true, payload: CanonicalImportPayload }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return invalid('IMPORT_FORMAT_UNSUPPORTED', 'Config Model JSON must be an object.')
  const record = input as Record<string, unknown>
  let result: ReturnType<typeof migrateConfigImportPayload>
  if ('schemaVersion' in record) {
    if (record.schemaVersion === PROJECT_DOCUMENT_VERSION)
      result = currentProject(input)
    else if (record.schemaVersion === 3)
      result = legacyProject(input)
    else
      return invalid('IMPORT_VERSION_UNSUPPORTED', `Unsupported Project schema version: ${String(record.schemaVersion)}.`, '$.schemaVersion')
  }
  else if ('graph' in record) {
    const page = projectPageSchema.safeParse(input)
    result = page.success
      ? { success: true, payload: { target: 'page', page: structuredClone(page.data), migrations: [] } }
      : zodInvalid('IMPORT_PAGE_INVALID', page.error.issues)
  }
  else if ('version' in record) {
    result = record.version === 1
      ? legacyPage(input)
      : invalid('IMPORT_VERSION_UNSUPPORTED', `Unsupported Page Model version: ${String(record.version)}.`, '$.version')
  }
  else {
    return invalid('IMPORT_FORMAT_UNSUPPORTED', 'The JSON is not a supported Config Project or Page document.')
  }
  if (!result.success)
    return result
  if (result.payload.target !== target) {
    return invalid(
      'IMPORT_TARGET_MISMATCH',
      target === 'project' ? 'Project creation accepts Project JSON only.' : 'Page creation accepts Page JSON only.',
    )
  }
  return result
}
