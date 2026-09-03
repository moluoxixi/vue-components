import type { ProjectDocument, ProjectOperation } from '../../../types'
import type { OperationResult } from '../types'
import { applyFlowOperation } from './flow-operation'
import { applyNodeOperation } from './node-operation'
import { applyProjectPageOperation } from './project-page-operation'

export function applyOperation(document: ProjectDocument, operation: ProjectOperation): OperationResult {
  switch (operation.type) {
    case 'page.add':
    case 'page.form':
    case 'page.move':
    case 'page.props':
    case 'page.remove':
    case 'page.rename':
    case 'page.route':
    case 'project.home':
    case 'project.settings':
      return applyProjectPageOperation(document, operation)
    case 'node.bindings':
    case 'node.config.remove':
    case 'node.events':
    case 'node.insert':
    case 'node.move':
    case 'node.placement':
    case 'node.props':
    case 'node.remove':
    case 'node.settings':
      return applyNodeOperation(document, operation)
    case 'flow.add':
    case 'flow.remove':
    case 'flow.update':
      return applyFlowOperation(document, operation)
  }
}
