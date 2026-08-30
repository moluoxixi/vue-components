import type { ModelOperation } from '@moluoxixi/config-form-designer'
import type {
  NodeSubgraph,
  ProjectCommandAction,
  ProjectDocument,
  ProjectNodePatch,
  ProjectNodePatchKey,
  ProjectOperation,
  ProjectPage,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'
import type { WorkspaceApplicationOperation, WorkspacePage } from './application'
import { migrateLegacyLowCodePageModel } from '@moluoxixi/config-form-model'

function migrationError(label: string, diagnostics: readonly { message: string }[]): never {
  throw new TypeError(`${label}: ${diagnostics[0]?.message ?? 'Legacy page migration failed.'}`)
}

function migratePageContent(page: WorkspacePage) {
  const result = migrateLegacyLowCodePageModel(page.model)
  if (!result.success)
    migrationError(`Unable to migrate page ${page.id}`, result.diagnostics)
  return result.data
}

function migrateNodeSubgraph(operation: Extract<ModelOperation, { type: 'insert' }>): NodeSubgraph {
  const result = migrateLegacyLowCodePageModel({
    id: '__candidate__',
    name: 'Candidate',
    version: 1,
    props: {},
    form: {},
    nodes: [operation.node],
  })
  if (!result.success)
    migrationError(`Unable to migrate candidate node ${operation.node.id}`, result.diagnostics)
  return { root: result.data.graph.root, nodesById: result.data.graph.nodesById }
}

function serializeLegacyNodePatch(
  patch: Extract<ModelOperation, { type: 'updateNode' }>['patch'],
): ProjectNodePatch {
  const set: Record<string, unknown> = Object.create(null)
  const unset: ProjectNodePatchKey[] = []
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined)
      unset.push(key as ProjectNodePatchKey)
    else
      set[key] = structuredClone(value)
  })
  return {
    ...(Object.keys(set).length > 0 ? { set: set as ProjectNodePatch['set'] } : {}),
    ...(unset.length > 0 ? { unset } : {}),
  }
}

export function legacyModelOperationToProjectActions(
  pageId: string,
  operation: ModelOperation,
): ProjectCommandAction[] {
  switch (operation.type) {
    case 'insert':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'node.insert',
          pageId,
          subgraph: migrateNodeSubgraph(operation),
          target: structuredClone(operation.target),
        }],
      }]
    case 'move':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'node.move',
          pageId,
          nodeId: operation.nodeId,
          target: structuredClone(operation.target),
        }],
      }]
    case 'updatePage':
      return [{
        type: 'operation.apply',
        operations: [
          { type: 'page.props', pageId, props: structuredClone(operation.props) },
          { type: 'page.form', pageId, form: structuredClone(operation.form) },
        ],
      }]
    case 'addFlow':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'flow.add',
          pageId,
          flow: structuredClone(operation.flow),
          ...(operation.index === undefined ? {} : { index: operation.index }),
        }],
      }]
    case 'updateFlowSettings':
      return [{
        type: 'flow.settings',
        pageId,
        flowId: operation.flowId,
        settings: structuredClone(operation.settings),
      }]
    case 'updateFlowNode':
      return [{
        type: 'flow.node',
        pageId,
        flowId: operation.flowId,
        nodeId: operation.nodeId,
        node: structuredClone(operation.node),
      }]
    case 'updateFlowEdges':
      return [{
        type: 'flow.edges',
        pageId,
        flowId: operation.flowId,
        edges: structuredClone(operation.edges),
      }]
    case 'updateFlowGraph':
      return [{
        type: 'flow.graph',
        pageId,
        flowId: operation.flowId,
        nodes: structuredClone(operation.nodes),
        edges: structuredClone(operation.edges),
      }]
    case 'updateFlow':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'flow.update',
          pageId,
          flowId: operation.flowId,
          flow: structuredClone(operation.flow),
        }],
      }]
    case 'removeFlow':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'flow.remove', pageId, flowId: operation.flowId }],
      }]
    case 'updateFlows':
      return [{
        type: 'flow.replaceAll',
        pageId,
        ...(operation.flows === undefined ? {} : { flows: structuredClone(operation.flows) }),
      }]
    case 'updateProps':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'node.props',
          pageId,
          nodeId: operation.nodeId,
          props: structuredClone(operation.props),
        }],
      }]
    case 'updateEvents':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'node.events',
          pageId,
          nodeId: operation.nodeId,
          events: structuredClone(operation.events),
        }],
      }]
    case 'updateBindings':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'node.bindings',
          pageId,
          nodeId: operation.nodeId,
          bindings: structuredClone(operation.bindings),
        }],
      }]
    case 'updateNode':
      return [{
        type: 'node.patch',
        pageId,
        nodeId: operation.nodeId,
        patch: serializeLegacyNodePatch(operation.patch),
      }]
    case 'resize':
      return [{
        type: 'node.resize',
        pageId,
        nodeId: operation.nodeId,
        span: operation.span,
      }]
    case 'duplicate':
      return [{
        type: 'node.duplicate',
        pageId,
        nodeId: operation.nodeId,
        target: structuredClone(operation.target),
        idMap: structuredClone(operation.idMap),
        ...(operation.fieldMap ? { fieldMap: structuredClone(operation.fieldMap) } : {}),
      }]
    case 'remove':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'node.remove', pageId, nodeId: operation.nodeId }],
      }]
    case 'batch':
      return operation.operations.flatMap(child => legacyModelOperationToProjectActions(pageId, child))
  }
}

function projectPage(page: WorkspacePage): ProjectPage {
  const content = migratePageContent(page)
  return {
    id: page.id,
    name: page.name,
    route: page.route,
    graph: content.graph,
    ...(content.flows ? { flows: content.flows } : {}),
  }
}

function replacePageOperations(
  document: ProjectDocument | ReadonlyProjectDocument,
  page: WorkspacePage,
): ProjectCommandAction[] {
  const current = document.pagesById[page.id]
  if (!current)
    throw new TypeError(`Page does not exist: ${page.id}`)
  const content = migratePageContent(page)
  const { graph } = content
  const operations: ProjectOperation[] = [
    ...[...current.graph.root].reverse().map(item => ({
      type: 'node.remove' as const,
      pageId: page.id,
      nodeId: item.nodeId,
    })),
    { type: 'page.props', pageId: page.id, props: structuredClone(graph.props) },
    { type: 'page.form', pageId: page.id, form: structuredClone(graph.form) },
  ]
  if (graph.root.length > 0) {
    operations.push({
      type: 'node.insert',
      pageId: page.id,
      target: { parentId: null },
      subgraph: {
        root: graph.root,
        nodesById: graph.nodesById,
      },
    })
  }
  return [
    { type: 'operation.apply', operations },
    {
      type: 'flow.replaceAll',
      pageId: page.id,
      ...(content.flows ? { flows: structuredClone(content.flows) } : {}),
    },
  ]
}

export function legacyApplicationOperationToProjectActions(
  document: ProjectDocument | ReadonlyProjectDocument,
  operation: WorkspaceApplicationOperation,
): ProjectCommandAction[] {
  switch (operation.type) {
    case 'add-page':
    case 'duplicate-page':
      return [{
        type: 'operation.apply',
        operations: [{
          type: 'page.add',
          page: projectPage(operation.page),
          ...(operation.index === undefined ? {} : { index: operation.index }),
        }],
      }]
    case 'move-page':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'page.move', pageId: operation.pageId, index: operation.index }],
      }]
    case 'remove-page':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'page.remove', pageId: operation.pageId }],
      }]
    case 'rename-page':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'page.rename', pageId: operation.pageId, name: operation.name }],
      }]
    case 'set-home-page':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'project.home', pageId: operation.pageId }],
      }]
    case 'set-page-route':
      return [{
        type: 'operation.apply',
        operations: [{ type: 'page.route', pageId: operation.pageId, route: operation.route }],
      }]
    case 'update-page-model':
      return replacePageOperations(document, {
        id: operation.pageId,
        name: document.pagesById[operation.pageId]?.name ?? operation.model.name,
        route: document.pagesById[operation.pageId]?.route ?? '/',
        model: operation.model,
      })
  }
}
