import type { ProjectDocument, ProjectOperation } from '../../../types'
import type { OperationResult } from '../types'
import { flowSchema } from '../../../schemas'
import { invalid } from '../errors'
import { requireParsedValue } from '../validation'
import { changed, cloneModelValue, semanticallyEqual, unchanged } from './changes'
import { assertInsertIndex, flowTargetChanges, requirePage } from './graph'

type FlowOperation = Extract<ProjectOperation, { type: 'flow.add' | 'flow.remove' | 'flow.update' }>

export function applyFlowOperation(document: ProjectDocument, operation: FlowOperation): OperationResult {
  const page = requirePage(document, operation.pageId)

  switch (operation.type) {
    case 'flow.add': {
      const flows = page.flows ??= []
      const flow = requireParsedValue(
        flowSchema.safeParse(operation.flow),
        'PROJECT_FLOW_INVALID',
        'Flow is invalid.',
        page.id,
      )
      if (flows.some(candidate => candidate.id === flow.id))
        invalid('PROJECT_FLOW_ID_DUPLICATE', `Flow already exists: ${flow.id}`, operation.pageId)
      const index = operation.index ?? flows.length
      assertInsertIndex(index, flows.length, 'PROJECT_FLOW_INDEX_INVALID')
      flows.splice(index, 0, flow)
      return changed(
        [{ type: 'flow.remove', pageId: page.id, flowId: flow.id }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, undefined, flow),
      )
    }
    case 'flow.update': {
      const flows = page.flows ?? []
      const index = flows.findIndex(flow => flow.id === operation.flowId)
      if (index < 0)
        invalid('PROJECT_FLOW_UNKNOWN', `Flow does not exist: ${operation.flowId}`, operation.pageId)
      const flow = requireParsedValue(
        flowSchema.safeParse(operation.flow),
        'PROJECT_FLOW_INVALID',
        'Flow is invalid.',
        page.id,
      )
      if (flow.id !== operation.flowId)
        invalid('PROJECT_FLOW_ID_CHANGE_INVALID', 'Flow update cannot change its id.', operation.pageId)
      const previous = cloneModelValue(flows[index]!)
      if (semanticallyEqual(previous, flow))
        return unchanged()
      flows[index] = flow
      return changed(
        [{ type: 'flow.update', pageId: page.id, flowId: previous.id, flow: previous }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, previous, flow),
      )
    }
    case 'flow.remove': {
      const flows = page.flows ?? []
      const index = flows.findIndex(flow => flow.id === operation.flowId)
      if (index < 0)
        invalid('PROJECT_FLOW_UNKNOWN', `Flow does not exist: ${operation.flowId}`, operation.pageId)
      const [removed] = flows.splice(index, 1)
      if (flows.length === 0)
        delete page.flows
      return changed(
        [{ type: 'flow.add', pageId: page.id, flow: cloneModelValue(removed!), index }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, removed, undefined),
      )
    }
  }
}
