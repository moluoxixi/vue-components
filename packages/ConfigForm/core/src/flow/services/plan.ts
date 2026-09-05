import type {
  ConfigFormFlow,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowEdge,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowNode,
  ConfigFormFlowPlanFailure,
  ConfigFormFlowPlanNode,
  ConfigFormFlowPlanResult,
} from '../types'
import { CONFIG_FORM_FLOW_PLAN_VERSION, CONFIG_FORM_FLOW_VERSION } from '../constants'

const NODE_TYPES = new Set(['trigger', 'condition', 'reaction', 'action', 'success', 'failure', 'end'])
const EDGE_CONDITIONS = new Set(['next', 'true', 'false', 'error'])
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export function analyzeConfigFormFlow(input: unknown): ConfigFormFlowPlanResult {
  const flow = input as ConfigFormFlow
  const diagnostics: ConfigFormFlowDiagnostic[] = []
  if (!isRecord(input))
    return failure(input as ConfigFormFlow, [{ code: 'FLOW_INVALID', message: 'Flow must be a JSON object.' }])
  if (flow.version !== CONFIG_FORM_FLOW_VERSION)
    diagnostics.push({ code: 'FLOW_VERSION_UNSUPPORTED', message: `Unsupported flow version: ${String(flow.version)}`, path: 'version' })
  if (!isNonEmptyString(flow.id) || !isNonEmptyString(flow.name))
    diagnostics.push({ code: 'FLOW_ID_NAME_REQUIRED', message: 'Flow id and name are required.' })
  if (!isRecord(flow.trigger) || !['page.mount', 'form.submit', 'component.event'].includes(flow.trigger.kind as string))
    diagnostics.push({ code: 'FLOW_TRIGGER_INVALID', message: 'Flow trigger is invalid.', path: 'trigger' })
  if (isRecord(flow.trigger) && Object.hasOwn(flow.trigger, 'field'))
    diagnostics.push({ code: 'FLOW_TRIGGER_FIELD_UNSUPPORTED', message: 'field.change triggers are no longer supported.', path: 'trigger.field' })
  if (flow.trigger?.kind === 'component.event') {
    if (!isNonEmptyString(flow.trigger.nodeId))
      diagnostics.push({ code: 'FLOW_TRIGGER_NODE_REQUIRED', message: 'component.event triggers require a nodeId.', path: 'trigger.nodeId' })
    if (!isNonEmptyString(flow.trigger.event))
      diagnostics.push({ code: 'FLOW_TRIGGER_EVENT_REQUIRED', message: 'component.event triggers require an event.', path: 'trigger.event' })
  }
  if (flow.trigger?.kind !== 'component.event' && flow.trigger?.nodeId !== undefined)
    diagnostics.push({ code: 'FLOW_TRIGGER_NODE_UNEXPECTED', message: 'Only component.event triggers may specify a nodeId.', path: 'trigger.nodeId' })
  if (flow.trigger?.kind !== 'component.event' && flow.trigger?.event !== undefined)
    diagnostics.push({ code: 'FLOW_TRIGGER_EVENT_UNEXPECTED', message: 'Only component.event triggers may specify an event.', path: 'trigger.event' })
  if (flow.concurrency !== undefined && !['latest', 'queue', 'ignore'].includes(flow.concurrency))
    diagnostics.push({ code: 'FLOW_CONCURRENCY_INVALID', message: `Unsupported flow concurrency: ${String(flow.concurrency)}`, path: 'concurrency' })
  if (flow.errorPolicy !== undefined) {
    if (!isRecord(flow.errorPolicy) || !['failure', 'end'].includes(flow.errorPolicy.onError as string))
      diagnostics.push({ code: 'FLOW_ERROR_POLICY_INVALID', message: 'Flow errorPolicy.onError must be "failure" or "end".', path: 'errorPolicy.onError' })
    const timeoutMs = flow.errorPolicy?.timeoutMs
    if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 0))
      diagnostics.push({ code: 'FLOW_TIMEOUT_INVALID', message: 'Flow timeoutMs must be a non-negative integer.', path: 'errorPolicy.timeoutMs' })
  }
  if (!Array.isArray(flow.nodes) || flow.nodes.length === 0)
    diagnostics.push({ code: 'FLOW_NODES_REQUIRED', message: 'Flow must contain at least one node.', path: 'nodes' })
  if (!Array.isArray(flow.edges))
    diagnostics.push({ code: 'FLOW_EDGES_REQUIRED', message: 'Flow edges must be an array.', path: 'edges' })
  if (!isJsonSafe(input))
    diagnostics.push({ code: 'FLOW_NON_JSON', message: 'Flow contains a non-JSON value.' })
  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const nodes = flow.nodes
  const edges = flow.edges
  const byId = new Map<string, ConfigFormFlowNode>()
  const nodeIds = new Set<string>()
  nodes.forEach((node, index) => {
    if (!isRecord(node) || !isNonEmptyString(node.id)) {
      diagnostics.push({ code: 'FLOW_NODE_ID_REQUIRED', message: 'Every flow node needs a stable id.', path: `nodes.${index}.id` })
      return
    }
    if (nodeIds.has(node.id))
      diagnostics.push({ code: 'FLOW_NODE_ID_DUPLICATE', message: `Duplicate flow node id: ${node.id}`, nodeId: node.id })
    nodeIds.add(node.id)
    if (!NODE_TYPES.has(node.type))
      diagnostics.push({ code: 'FLOW_NODE_TYPE_INVALID', message: `Unsupported flow node type: ${String(node.type)}`, nodeId: node.id })
    if ((node.type === 'condition' || node.type === 'reaction' || node.type === 'action') && !isRecord(node.config))
      diagnostics.push({ code: 'FLOW_NODE_CONFIG_REQUIRED', message: `${node.type} nodes require JSON config.`, nodeId: node.id })
    if (node.type === 'action' && !isNonEmptyString(node.ref))
      diagnostics.push({ code: 'FLOW_ACTION_REF_REQUIRED', message: 'Action nodes require a registry ref.', nodeId: node.id })
    byId.set(node.id, node)
  })

  // Stop before traversing the graph when a node is malformed. The public
  // validator accepts unknown input, so later passes must never dereference a
  // value that failed the shape checks above.
  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const triggerNodes = nodes.filter(node => node?.type === 'trigger')
  if (triggerNodes.length !== 1)
    diagnostics.push({ code: 'FLOW_TRIGGER_NODE_COUNT', message: 'Flow must contain exactly one trigger node.' })
  const outgoing = new Map<string, ConfigFormFlowEdge[]>()
  const incoming = new Map<string, ConfigFormFlowEdge[]>()
  const edgeIds = new Set<string>()
  edges.forEach((edge, index) => {
    if (!isRecord(edge) || !isNonEmptyString(edge.id) || !isNonEmptyString(edge.source) || !isNonEmptyString(edge.target)) {
      diagnostics.push({ code: 'FLOW_EDGE_INVALID', message: 'Every flow edge needs id, source and target.', path: `edges.${index}` })
      return
    }
    if (edgeIds.has(edge.id))
      diagnostics.push({ code: 'FLOW_EDGE_ID_DUPLICATE', message: `Duplicate flow edge id: ${edge.id}`, edgeId: edge.id })
    edgeIds.add(edge.id)
    if (!byId.has(edge.source) || !byId.has(edge.target))
      diagnostics.push({ code: 'FLOW_EDGE_NODE_UNKNOWN', message: `Edge references an unknown node: ${edge.id}`, edgeId: edge.id })
    if (edge.condition !== undefined && !EDGE_CONDITIONS.has(edge.condition))
      diagnostics.push({ code: 'FLOW_EDGE_CONDITION_INVALID', message: `Unsupported edge condition: ${String(edge.condition)}`, edgeId: edge.id })
    if (edge.source === edge.target)
      diagnostics.push({ code: 'FLOW_CYCLE', message: 'Self-referencing flow edges are not allowed.', edgeId: edge.id })
    const sourceEdges = outgoing.get(edge.source) ?? []
    sourceEdges.push(edge)
    outgoing.set(edge.source, sourceEdges)
    const targetEdges = incoming.get(edge.target) ?? []
    targetEdges.push(edge)
    incoming.set(edge.target, targetEdges)
  })

  for (const node of nodes) {
    const edgesFromNode = outgoing.get(node.id) ?? []
    if (node.type === 'condition') {
      if (!edgesFromNode.some(edge => edge.condition === 'true') || !edgesFromNode.some(edge => edge.condition === 'false'))
        diagnostics.push({ code: 'FLOW_BRANCH_INCOMPLETE', message: 'Condition nodes require true and false edges.', nodeId: node.id })
    }
    else if (!['success', 'failure', 'end'].includes(node.type) && edgesFromNode.length === 0) {
      diagnostics.push({ code: 'FLOW_NODE_DEAD_END', message: `${node.type} nodes must connect to a next node.`, nodeId: node.id })
    }
  }

  const triggerNode = triggerNodes[0]
  const order = triggerNode ? topologicalOrder(triggerNode.id, nodes, outgoing, diagnostics) : []
  const reachable = triggerNode ? reachableNodes(triggerNode.id, outgoing) : new Set<string>()
  if (triggerNode && reachable.size !== nodes.length)
    diagnostics.push({ code: 'FLOW_UNREACHABLE_NODE', message: 'Every flow node must be reachable from the trigger.' })
  for (const node of nodes) {
    if (node.type === 'end' || node.type === 'success' || node.type === 'failure')
      continue
    if (!(outgoing.get(node.id) ?? []).some(edge => reachesTerminal(edge.target, byId, outgoing, new Set())))
      diagnostics.push({ code: 'FLOW_NO_TERMINAL', message: `Node cannot reach a terminal node: ${node.id}`, nodeId: node.id })
  }
  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const planNodes: ConfigFormFlowPlanNode[] = nodes.map(({ position: _position, ...node }) => ({
    ...cloneJson(node),
    ...(node.config ? { config: cloneJson(node.config) } : {}),
    outgoing: cloneJson([...(outgoing.get(node.id) ?? [])].sort((left, right) => left.id.localeCompare(right.id))),
    incoming: cloneJson([...(incoming.get(node.id) ?? [])].sort((left, right) => left.id.localeCompare(right.id))),
  }))
  const plan: ConfigFormFlowExecutionPlan = {
    version: CONFIG_FORM_FLOW_PLAN_VERSION,
    flowId: flow.id,
    name: flow.name,
    trigger: cloneJson(flow.trigger),
    ...(flow.concurrency === undefined ? {} : { concurrency: flow.concurrency }),
    ...(flow.errorPolicy === undefined ? {} : { errorPolicy: cloneJson(flow.errorPolicy) }),
    triggerNodeId: triggerNode!.id,
    topologicalOrder: order,
    nodes: planNodes,
  }
  return { success: true, flow: cloneJson(flow), plan, diagnostics: [] }
}

function topologicalOrder(
  triggerId: string,
  nodes: ConfigFormFlowNode[],
  outgoing: Map<string, ConfigFormFlowEdge[]>,
  diagnostics: ConfigFormFlowDiagnostic[],
): string[] {
  const indegree = new Map(nodes.map(node => [node.id, 0]))
  for (const edges of outgoing.values()) {
    for (const edge of edges) {
      if (indegree.has(edge.target))
        indegree.set(edge.target, indegree.get(edge.target)! + 1)
    }
  }
  const queue = nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id).sort()
  const result: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)
    for (const edge of [...(outgoing.get(id) ?? [])].sort((left, right) => left.id.localeCompare(right.id))) {
      const next = (indegree.get(edge.target) ?? 0) - 1
      indegree.set(edge.target, next)
      if (next === 0)
        queue.push(edge.target)
    }
    queue.sort()
  }
  if (result.length !== nodes.length)
    diagnostics.push({ code: 'FLOW_CYCLE', message: 'Flow graph must be acyclic.' })
  if (!result.includes(triggerId))
    diagnostics.push({ code: 'FLOW_TRIGGER_UNREACHABLE', message: 'Trigger node is not part of the graph.' })
  return result
}

function reachesTerminal(
  id: string,
  byId: Map<string, ConfigFormFlowNode>,
  outgoing: Map<string, ConfigFormFlowEdge[]>,
  seen: Set<string>,
): boolean {
  if (seen.has(id))
    return false
  seen.add(id)
  const node = byId.get(id)
  if (!node)
    return false
  if (node.type === 'end' || node.type === 'success' || node.type === 'failure')
    return true
  return (outgoing.get(id) ?? []).some(edge => reachesTerminal(edge.target, byId, outgoing, seen))
}

function reachableNodes(triggerId: string, outgoing: Map<string, ConfigFormFlowEdge[]>): Set<string> {
  const reachable = new Set<string>()
  const queue = [triggerId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id))
      continue
    reachable.add(id)
    for (const edge of outgoing.get(id) ?? []) {
      if (!reachable.has(edge.target))
        queue.push(edge.target)
    }
  }
  return reachable
}

export function getConfigFormFlowTriggerKey(trigger: ConfigFormFlow['trigger']): string {
  if (trigger.kind === 'component.event')
    return JSON.stringify([trigger.kind, trigger.nodeId ?? '', trigger.event ?? ''])
  return JSON.stringify([trigger.kind])
}

function failure(flow: ConfigFormFlow, diagnostics: ConfigFormFlowDiagnostic[]): ConfigFormFlowPlanFailure {
  return { success: false, flow, diagnostics }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonSafe(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (typeof value !== 'object')
    return false
  if (seen.has(value))
    return false
  seen.add(value)
  const valid = Array.isArray(value)
    ? value.every(item => isJsonSafe(item, seen))
    : (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
      && Object.entries(value).every(([key, item]) => !UNSAFE_KEYS.has(key) && isJsonSafe(item, seen))
  // `seen` tracks the current recursion stack, not every object visited. JSON
  // permits shared references (they serialize as duplicated values), while a
  // reference encountered before its parent is removed is a real cycle.
  seen.delete(value)
  return valid
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function')
    return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
