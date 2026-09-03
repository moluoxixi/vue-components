import type { ComponentContractRegistry, ModelDiagnostic, NodeId, PageId, ProjectDocument, ProjectOperation } from '../../../types'
import type { OperationResult, ValidationPlan } from '../types'
import { projectPageSchema } from '../../../schemas'
import { TransactionError } from '../errors'
import { validateDocumentAgainstRegistry } from './registry'

export function createValidationPlan(): ValidationPlan {
  return {
    pageIds: new Set(),
    registryNodeIdsByPage: new Map(),
    registryPageIds: new Set(),
    registryPlacementIdsByPage: new Map(),
  }
}

export function collectValidationPlan(
  plan: ValidationPlan,
  operation: ProjectOperation,
  result: OperationResult,
): void {
  if (!result.changedProject && result.changedPageIds.length === 0 && result.changedNodeIds.length === 0)
    return

  switch (operation.type) {
    case 'project.settings':
    case 'page.props':
    case 'page.form':
      return
    case 'node.props':
    case 'node.events':
    case 'node.bindings':
    case 'node.placement': {
      const registryNodeIds = plan.registryNodeIdsByPage.get(operation.pageId) ?? new Set<NodeId>()
      registryNodeIds.add(operation.nodeId)
      plan.registryNodeIdsByPage.set(operation.pageId, registryNodeIds)
      if (operation.type === 'node.placement')
        addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, operation.nodeId)
      return
    }
    case 'node.config.remove':
      plan.pageIds.add(operation.pageId)
      return
    case 'page.add':
      result.changedPageIds.forEach(pageId => plan.registryPageIds.add(pageId))
      return
    case 'node.settings':
      plan.pageIds.add(operation.pageId)
      addValidationNode(plan.registryNodeIdsByPage, operation.pageId, operation.nodeId)
      addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, operation.nodeId)
      return
    case 'node.insert':
      result.changedNodeIds.forEach(nodeId => addValidationNode(plan.registryNodeIdsByPage, operation.pageId, nodeId))
      result.inverse.forEach((inverse) => {
        if (inverse.type === 'node.remove')
          addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, inverse.nodeId)
      })
      return
    case 'node.remove':
      plan.pageIds.add(operation.pageId)
      break
    case 'flow.add':
    case 'flow.update':
    case 'flow.remove':
      plan.pageIds.add(operation.pageId)
      plan.registryPageIds.add(operation.pageId)
      break
    case 'node.move':
      addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, operation.nodeId)
      break
    case 'page.remove':
    case 'page.move':
    case 'page.rename':
    case 'page.route':
    case 'project.home':
      break
  }
}

function addValidationNode(target: Map<PageId, Set<NodeId>>, pageId: PageId, nodeId: NodeId): void {
  const nodeIds = target.get(pageId) ?? new Set<NodeId>()
  nodeIds.add(nodeId)
  target.set(pageId, nodeIds)
}

export function validateChangedDocument(
  document: ProjectDocument,
  plan: ValidationPlan,
  registry?: ComponentContractRegistry,
): ModelDiagnostic[] {
  for (const pageId of plan.pageIds) {
    const page = document.pagesById[pageId]
    if (!page)
      continue
    const result = projectPageSchema.safeParse(page)
    if (!result.success)
      return schemaDiagnostics(result.error.issues, ['pagesById', pageId], pageId)
  }

  if (!registry)
    return []
  try {
    validateDocumentAgainstRegistry(document, registry, plan)
    return []
  }
  catch (error) {
    if (error instanceof TransactionError)
      return [error.diagnostic]
    throw error
  }
}

function schemaDiagnostics(
  issues: Array<{ message: string, path: Array<string | number> }>,
  pathPrefix: Array<string | number>,
  pageId?: PageId,
  nodeId?: NodeId,
): ModelDiagnostic[] {
  return issues.map(issue => ({
    code: 'PROJECT_DOCUMENT_INVALID',
    message: issue.message,
    path: [...pathPrefix, ...issue.path],
    ...(pageId ? { pageId } : {}),
    ...(nodeId ? { nodeId } : {}),
  }))
}
