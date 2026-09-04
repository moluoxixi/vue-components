import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowNode,
  ConfigFormFlowNodeType,
} from '@moluoxixi/config-form-core'
import type { Connection, Edge, Node, XYPosition } from '@vue-flow/core'
import type { FlowNodeData } from '../types'
import { cloneWorkbenchJson } from '../../../../../utils'

export function defaultNodePosition(node: ConfigFormFlowNode, index: number): XYPosition {
  if (node.type === 'failure')
    return { x: 280, y: 300 }
  return { x: 60 + index * 220, y: 140 }
}

export function isNodeDeletable(node: ConfigFormFlowNode): boolean {
  return !['trigger', 'end', 'success', 'failure'].includes(node.type)
}

export function projectFlowNodes(
  flow: ConfigFormFlow | undefined,
  draftPositions: Readonly<Record<string, XYPosition>>,
  selectedNodeId: string | undefined,
  readonly: boolean,
  title: (node: ConfigFormFlowNode) => string,
): Node<FlowNodeData>[] {
  return (flow?.nodes ?? []).map((node, index) => ({
    id: node.id,
    type: 'flow',
    position: draftPositions[node.id] ?? node.position ?? defaultNodePosition(node, index),
    selected: selectedNodeId === node.id,
    draggable: !readonly,
    selectable: true,
    deletable: isNodeDeletable(node) && !readonly,
    data: {
      node,
      title: title(node),
      deletable: isNodeDeletable(node),
    },
  }))
}

export function projectFlowEdges(flow: ConfigFormFlow | undefined, readonly: boolean): Edge[] {
  return (flow?.edges ?? []).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.condition ?? 'next',
    targetHandle: 'input',
    type: 'smoothstep',
    label: edge.condition && edge.condition !== 'next' ? edge.condition : undefined,
    class: `is-${edge.condition ?? 'next'}`,
    deletable: !readonly,
    selectable: !readonly,
  }))
}

function uniqueNodeId(flow: ConfigFormFlow, type: ConfigFormFlowNodeType): string {
  const ids = new Set(flow.nodes.map(node => node.id))
  let index = 1
  while (ids.has(`${flow.id}-${type}-${index}`)) index += 1
  return `${flow.id}-${type}-${index}`
}

function uniqueEdgeId(flow: ConfigFormFlow, source: string, condition: string, target: string): string {
  const base = `${source}-${condition}-${target}`.replace(/[^\w-]/g, '-')
  const ids = new Set(flow.edges.map(edge => edge.id))
  if (!ids.has(base))
    return base
  let index = 2
  while (ids.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

export function insertFlowNode(
  current: ConfigFormFlow,
  type: Exclude<ConfigFormFlowNodeType, 'trigger' | 'success' | 'failure' | 'end'>,
): { flow: ConfigFormFlow, nodeId: string } | undefined {
  const flow = cloneWorkbenchJson(current)
  const terminal = flow.nodes.find(node => node.type === 'end' || node.type === 'success' || node.type === 'failure')
  if (!terminal)
    return undefined
  const id = uniqueNodeId(flow, type)
  const terminalPosition = terminal.position ?? { x: 420, y: 140 }
  const node: ConfigFormFlowNode = {
    id,
    type,
    position: { x: Math.max(180, terminalPosition.x - 220), y: terminalPosition.y },
    ...(type === 'action' ? { ref: 'notify', config: {} } : {}),
    ...(type === 'condition' ? { config: { condition: { kind: 'literal', value: true } } } : {}),
    ...(type === 'reaction' ? { config: { reactions: [] } } : {}),
  }
  terminal.position = { x: terminalPosition.x + 220, y: terminalPosition.y }
  const incoming = flow.edges.filter(edge => edge.target === terminal.id && edge.condition !== 'error')
  incoming.forEach((edge) => {
    edge.target = id
  })
  const terminalIndex = flow.nodes.indexOf(terminal)
  flow.nodes.splice(terminalIndex < 0 ? flow.nodes.length : terminalIndex, 0, node)
  if (type === 'condition') {
    flow.edges.push(
      { id: uniqueEdgeId(flow, id, 'true', terminal.id), source: id, target: terminal.id, condition: 'true' },
      { id: uniqueEdgeId(flow, id, 'false', terminal.id), source: id, target: terminal.id, condition: 'false' },
    )
  }
  else {
    flow.edges.push({ id: uniqueEdgeId(flow, id, 'next', terminal.id), source: id, target: terminal.id, condition: 'next' })
  }
  return { flow, nodeId: id }
}

export function removeFlowNode(
  current: ConfigFormFlow,
  nodeId: string,
): { flow?: ConfigFormFlow, reason?: 'branching' } | undefined {
  const removed = current.nodes.find(node => node.id === nodeId)
  if (!removed || !isNodeDeletable(removed))
    return undefined
  const flow = cloneWorkbenchJson(current)
  const incoming = flow.edges.filter(edge => edge.target === nodeId)
  const outgoing = flow.edges.filter(edge => edge.source === nodeId && edge.condition !== 'error')
  const targetIds = [...new Set(outgoing.map(edge => edge.target))]
  if (targetIds.length !== 1)
    return { reason: 'branching' }
  flow.edges = flow.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
  for (const source of incoming) {
    flow.edges.push({
      id: uniqueEdgeId(flow, source.source, source.condition ?? 'next', targetIds[0]!),
      source: source.source,
      target: targetIds[0]!,
      condition: source.condition ?? 'next',
    })
  }
  flow.nodes = flow.nodes.filter(node => node.id !== nodeId)
  return { flow }
}

function edgeCondition(flow: ConfigFormFlow, connection: Connection): ConfigFormFlowEdge['condition'] | undefined {
  const source = flow.nodes.find(node => node.id === connection.source)
  if (!source || ['success', 'failure', 'end'].includes(source.type))
    return undefined
  if (source.type === 'condition')
    return connection.sourceHandle === 'true' || connection.sourceHandle === 'false' ? connection.sourceHandle : undefined
  if (source.type === 'action' && connection.sourceHandle === 'error')
    return 'error'
  return connection.sourceHandle === 'next' || connection.sourceHandle === null || connection.sourceHandle === undefined
    ? 'next'
    : undefined
}

export function connectFlowNodes(current: ConfigFormFlow, connection: Connection): ConfigFormFlow | undefined {
  if (connection.source === connection.target)
    return undefined
  const flow = cloneWorkbenchJson(current)
  const target = flow.nodes.find(node => node.id === connection.target)
  const condition = edgeCondition(flow, connection)
  if (!target || target.type === 'trigger' || !condition)
    return undefined
  flow.edges = flow.edges.filter(edge => !(edge.source === connection.source && (edge.condition ?? 'next') === condition))
  flow.edges.push({
    id: uniqueEdgeId(flow, connection.source, condition, connection.target),
    source: connection.source,
    target: connection.target,
    condition,
  })
  return flow
}

export function positionFlowNode(
  current: ConfigFormFlow,
  nodeId: string,
  position: XYPosition,
): { flow: ConfigFormFlow, node: ConfigFormFlowNode } | undefined {
  const flow = cloneWorkbenchJson(current)
  const node = flow.nodes.find(candidate => candidate.id === nodeId)
  if (!node)
    return undefined
  node.position = { x: Math.round(position.x), y: Math.round(position.y) }
  return { flow, node }
}

export function removeFlowEdges(current: ConfigFormFlow, removedIds: readonly string[]): ConfigFormFlow {
  const flow = cloneWorkbenchJson(current)
  flow.edges = flow.edges.filter(edge => !removedIds.includes(edge.id))
  return flow
}

export function patchFlowNode(
  current: ConfigFormFlow,
  nodeId: string,
  patch: Partial<ConfigFormFlowNode>,
): { flow: ConfigFormFlow, node: ConfigFormFlowNode } | undefined {
  const flow = cloneWorkbenchJson(current)
  const node = flow.nodes.find(candidate => candidate.id === nodeId)
  if (!node)
    return undefined
  Object.assign(node, patch)
  return { flow, node }
}
