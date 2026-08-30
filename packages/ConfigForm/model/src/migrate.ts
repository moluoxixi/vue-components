import type {
  LegacyDesignerDocumentV1,
  LegacyDesignerNodeV1,
  LegacyLowCodeNodeV1,
  LegacyLowCodePageModelV1,
  LegacyWorkspaceApplicationV2,
  LegacyWorkspaceMigrationOptions,
} from './legacy'
import type {
  LayoutNode,
  ModelDiagnostic,
  NodeId,
  PageGraph,
  PageNode,
  ProjectDocument,
  ProjectPage,
  ProjectSnapshot,
  SlotItem,
} from './types'
import { LEGACY_PROJECT_DOCUMENT_VERSION } from './legacy'
import { ComponentContractRegistryError, selectRegistryLockComponents } from './registry'
import { pageGraphSchema, parseProjectDocument, projectPageContentSchema } from './schema'
import { PAGE_GRAPH_VERSION, PROJECT_DOCUMENT_VERSION } from './types'

export interface MigratedLegacyPageContent {
  graph: PageGraph
  flows?: ProjectPage['flows']
}

export type LegacyPageContentMigrationResult
  = | { success: true, data: MigratedLegacyPageContent, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectDocumentMigrationResult
  = | { success: true, data: ProjectDocument, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

function migrationFailure(code: string, message: string, path?: Array<string | number>): ProjectDocumentMigrationResult {
  return { success: false, diagnostics: [{ code, message, ...(path ? { path } : {}) }] }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Repository-ingress migration for persisted canonical project documents. */
export function migrateProjectDocument(input: unknown): ProjectDocumentMigrationResult {
  const source = record(input)
  if (!source) {
    return migrationFailure(
      'PROJECT_DOCUMENT_MIGRATION_INVALID',
      'Project document migration requires an object.',
    )
  }
  if (source.schemaVersion === PROJECT_DOCUMENT_VERSION)
    return parseProjectDocument(source)
  if (source.schemaVersion !== LEGACY_PROJECT_DOCUMENT_VERSION) {
    return migrationFailure(
      'PROJECT_DOCUMENT_VERSION_UNSUPPORTED',
      `Unsupported project document version: ${String(source.schemaVersion)}.`,
      ['schemaVersion'],
    )
  }

  const candidate = structuredClone(source)
  const pagesById = record(candidate.pagesById)
  if (!pagesById) {
    return migrationFailure(
      'PROJECT_DOCUMENT_MIGRATION_INVALID',
      'Legacy project pagesById must be an object.',
      ['pagesById'],
    )
  }
  for (const [pageId, pageValue] of Object.entries(pagesById)) {
    const page = record(pageValue)
    const graph = record(page?.graph)
    if (!page || !graph) {
      return migrationFailure(
        'PROJECT_DOCUMENT_MIGRATION_INVALID',
        `Legacy project page is invalid: ${pageId}.`,
        ['pagesById', pageId],
      )
    }
    if (graph.flows !== undefined && page.flows !== undefined) {
      return migrationFailure(
        'PROJECT_DOCUMENT_FLOW_OWNERSHIP_AMBIGUOUS',
        `Legacy project page stores flows in both page and graph: ${pageId}.`,
        ['pagesById', pageId, 'flows'],
      )
    }
    if (graph.flows !== undefined)
      page.flows = graph.flows
    delete graph.flows
  }
  candidate.schemaVersion = PROJECT_DOCUMENT_VERSION
  return parseProjectDocument(candidate)
}

export function migrateLegacyLowCodePageModel(
  model: LegacyLowCodePageModelV1,
): LegacyPageContentMigrationResult {
  const nodesById: Record<NodeId, PageNode> = Object.create(null)
  const diagnostics: ModelDiagnostic[] = []

  const migrateNode = (node: LegacyLowCodeNodeV1, path: Array<string | number>): SlotItem => {
    const item: SlotItem = {
      nodeId: node.id,
      placement: node.span === undefined ? {} : { span: node.span },
    }
    if (nodesById[node.id]) {
      diagnostics.push({
        code: 'LEGACY_NODE_ID_DUPLICATE',
        message: `Legacy page contains a duplicate node id: ${node.id}`,
        path: [...path, 'id'],
        nodeId: node.id,
      })
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
      if (node.children.length > 0 || Object.values(node.slots).some(children => children.length > 0)) {
        diagnostics.push({
          code: 'LEGACY_FIELD_CHILDREN_INVALID',
          message: `Legacy field node cannot contain children: ${node.id}`,
          path,
          nodeId: node.id,
        })
      }
      nodesById[node.id] = {
        ...common,
        kind: 'field',
        field: node.field ?? node.id,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.defaultValue !== undefined ? { defaultValue: structuredClone(node.defaultValue) } : {}),
        ...(node.validation !== undefined ? { validation: structuredClone(node.validation) } : {}),
        ...(node.validateOn !== undefined ? { validateOn: structuredClone(node.validateOn) } : {}),
      }
      return item
    }

    if (node.slots.default?.length) {
      diagnostics.push({
        code: 'LEGACY_DEFAULT_SLOT_AMBIGUOUS',
        message: `Legacy layout stores default children in both children and slots.default: ${node.id}`,
        path: [...path, 'slots', 'default'],
        nodeId: node.id,
      })
    }

    const layout: LayoutNode = {
      ...common,
      kind: 'layout',
      slots: Object.create(null) as Record<string, SlotItem[]>,
    }
    nodesById[node.id] = layout
    layout.slots.default = node.children.map((child, index) => migrateNode(child, [...path, 'children', index]))
    Object.entries(node.slots).forEach(([slot, children]) => {
      if (slot === 'default')
        return
      layout.slots[slot] = children.map((child, index) => migrateNode(child, [...path, 'slots', slot, index]))
    })
    return item
  }

  const graph: PageGraph = {
    version: PAGE_GRAPH_VERSION,
    props: structuredClone(model.props),
    form: structuredClone(model.form),
    root: model.nodes.map((node, index) => migrateNode(node, ['nodes', index])),
    nodesById,
  }

  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const parsed = projectPageContentSchema.safeParse({
    graph,
    ...(model.flows ? { flows: structuredClone(model.flows) } : {}),
  })
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map(issue => ({
        code: 'LEGACY_PAGE_MIGRATION_INVALID',
        message: issue.message,
        path: issue.path,
      })),
    }
  }
  return { success: true, data: structuredClone(parsed.data), diagnostics: [] }
}

export function migrateLegacyDesignerDocument(
  document: LegacyDesignerDocumentV1,
  options: { id: string, name: string },
): LegacyPageContentMigrationResult {
  const toLegacyNode = (node: LegacyDesignerNodeV1): LegacyLowCodeNodeV1 => ({
    id: node.id,
    component: node.material,
    props: structuredClone(node.props ?? {}),
    events: structuredClone(node.events ?? {}),
    bindings: structuredClone(node.bindings ?? {}),
    children: node.kind === 'container'
      ? (node.slots.default ?? []).map(toLegacyNode)
      : [],
    slots: node.kind === 'container'
      ? Object.fromEntries(Object.entries(node.slots)
          .filter(([slot]) => slot !== 'default')
          .map(([slot, children]) => [slot, children.map(toLegacyNode)]))
      : {},
    kind: node.kind,
    ...(node.extensions ? { extensions: structuredClone(node.extensions) } : {}),
    ...(node.span !== undefined ? { span: node.span } : {}),
    ...(node.conditions ? { conditions: structuredClone(node.conditions) } : {}),
    ...(node.reactions ? { reactions: structuredClone(node.reactions) } : {}),
    ...(node.kind === 'field'
      ? {
          field: node.field,
          ...(node.label !== undefined ? { label: node.label } : {}),
          ...(node.defaultValue !== undefined ? { defaultValue: structuredClone(node.defaultValue) } : {}),
          ...(node.validation !== undefined ? { validation: structuredClone(node.validation) } : {}),
          ...(node.validateOn !== undefined ? { validateOn: structuredClone(node.validateOn) } : {}),
        }
      : {}),
  })

  return migrateLegacyLowCodePageModel({
    id: options.id,
    name: options.name,
    version: 1,
    props: {},
    form: structuredClone(document.form),
    nodes: document.nodes.map(toLegacyNode),
  })
}

export function migrateLegacyWorkspaceApplication(
  application: LegacyWorkspaceApplicationV2,
  options: LegacyWorkspaceMigrationOptions,
): ProjectDocumentMigrationResult {
  const pagesById: ProjectDocument['pagesById'] = Object.create(null)
  const diagnostics: ModelDiagnostic[] = []

  application.pages.forEach((page, index) => {
    const migrated = migrateLegacyLowCodePageModel(page.model)
    if (!migrated.success) {
      diagnostics.push(...migrated.diagnostics.map(diagnostic => ({
        ...diagnostic,
        pageId: page.id,
        path: ['pages', index, 'model', ...(diagnostic.path ?? [])],
      })))
      return
    }
    pagesById[page.id] = {
      id: page.id,
      name: page.name,
      route: page.route,
      graph: migrated.data.graph,
      ...(migrated.data.flows ? { flows: migrated.data.flows } : {}),
    }
  })

  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  let registryLock: ProjectDocument['registryLock']
  try {
    registryLock = selectRegistryLockComponents(
      options.registryLock,
      Object.values(pagesById).flatMap(page => Object.values(page.graph.nodesById).map(node => node.component)),
    )
  }
  catch (error) {
    if (error instanceof ComponentContractRegistryError) {
      return {
        success: false,
        diagnostics: [{ code: error.code, message: error.message, path: ['registryLock'] }],
      }
    }
    throw error
  }

  const document: ProjectDocument = {
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: application.id,
    name: application.name,
    homePageId: application.homePageId,
    pageOrder: application.pages.map(page => page.id),
    pagesById,
    registryLock: structuredClone(registryLock),
    settings: {
      legacyTemplate: {
        id: application.template.id,
        version: application.template.version,
      },
    },
    resources: {},
  }

  const parsed = parseProjectDocument(document)
  return parsed.success
    ? { success: true, data: parsed.data, diagnostics: [] }
    : parsed
}

export function projectPageToLegacyLowCodePageModel(
  page: ProjectPage | ProjectSnapshot['document']['pagesById'][string],
): LegacyLowCodePageModelV1 {
  const graph = pageGraphSchema.parse(page.graph)

  const materializeNode = (item: SlotItem): LegacyLowCodeNodeV1 => {
    const node = graph.nodesById[item.nodeId]
    if (!node)
      throw new TypeError(`PROJECT_NODE_UNKNOWN: Page graph does not contain node ${item.nodeId}.`)
    const span = item.placement.span
    const common = {
      id: node.id,
      component: node.component,
      props: structuredClone(node.props),
      events: structuredClone(node.events),
      bindings: structuredClone(node.bindings),
      ...(node.extensions ? { extensions: structuredClone(node.extensions) } : {}),
      ...(typeof span === 'number' ? { span } : {}),
      ...(node.conditions ? { conditions: structuredClone(node.conditions) } : {}),
      ...(node.reactions ? { reactions: structuredClone(node.reactions) } : {}),
    }
    if (node.kind === 'field') {
      return {
        ...common,
        kind: 'field',
        field: node.field,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.defaultValue !== undefined ? { defaultValue: structuredClone(node.defaultValue) } : {}),
        ...(node.validation !== undefined ? { validation: structuredClone(node.validation) } : {}),
        ...(node.validateOn !== undefined ? { validateOn: structuredClone(node.validateOn) } : {}),
        children: [],
        slots: {},
      }
    }
    return {
      ...common,
      kind: 'container',
      children: (node.slots.default ?? []).map(materializeNode),
      slots: Object.fromEntries(
        Object.entries(node.slots)
          .filter(([slot]) => slot !== 'default')
          .map(([slot, items]) => [slot, items.map(materializeNode)]),
      ),
    }
  }

  return {
    id: page.id,
    name: page.name,
    version: 1,
    props: structuredClone(graph.props),
    form: structuredClone(graph.form),
    nodes: graph.root.map(materializeNode),
    ...(page.flows
      ? { flows: structuredClone(page.flows) as NonNullable<LegacyLowCodePageModelV1['flows']> }
      : {}),
  }
}
