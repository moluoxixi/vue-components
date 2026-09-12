import type { ConfigFormExpressionNode } from '../../expression'
import type { ConfigFormValueInput } from '../../value-reference'

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
import {
  CONFIG_FORM_EXPRESSION_FUNCTIONS,
  ConfigFormExpressionError,
  parseConfigFormExpression,
} from '../../expression'
import {
  analyzeConfigFormReactionCondition,
  analyzeConfigFormReactionList,
} from '../../reaction'
import {
  collectConfigFormValueReferences,
  ConfigFormValueReferenceError,
} from '../../value-reference'
import {
  CONFIG_FORM_FLOW_MAX_EDGES,
  CONFIG_FORM_FLOW_MAX_NODES,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES,
  CONFIG_FORM_FLOW_PLAN_VERSION,
  CONFIG_FORM_FLOW_TRIGGER_KINDS,
  CONFIG_FORM_FLOW_VERSION,
} from '../constants'
import { cloneConfigFormFlowData as cloneJson, ConfigFormFlowDataError } from './event'

const NODE_TYPES = new Set(['trigger', 'condition', 'reaction', 'action', 'success', 'failure', 'end', 'blocked'])
const EDGE_CONDITIONS = new Set(['next', 'true', 'false', 'error'])
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const REFERENCE_KEYS = new Set(['$field', '$event', '$output', '$expression'])

interface OutputReference {
  ref: string
  path: string
  allowSelf: boolean
}

export function analyzeConfigFormFlow(input: unknown): ConfigFormFlowPlanResult {
  try {
    return analyzeFlow(input)
  }
  catch (cause) {
    return failure(input as ConfigFormFlow, [{
      code: cause instanceof ConfigFormFlowDataError ? cause.code : 'FLOW_DATA_UNREADABLE',
      message: cause instanceof Error ? cause.message : 'Flow data could not be read.',
      ...(cause instanceof ConfigFormFlowDataError && cause.path ? { path: cause.path } : {}),
    }])
  }
}

function analyzeFlow(input: unknown): ConfigFormFlowPlanResult {
  if (!isRecord(input))
    return failure(input as ConfigFormFlow, [{ code: 'FLOW_INVALID', message: 'Flow must be a JSON object.' }])

  const flow = input as unknown as ConfigFormFlow
  const diagnostics: ConfigFormFlowDiagnostic[] = []
  const structureDiagnostic = inspectFlowStructure(input)
  if (structureDiagnostic)
    diagnostics.push(structureDiagnostic)
  checkKeys(input, ['version', 'id', 'name', 'trigger', 'concurrency', 'errorPolicy', 'nodes', 'edges'], '', diagnostics)
  if (flow.version !== CONFIG_FORM_FLOW_VERSION)
    diagnostics.push({ code: 'FLOW_VERSION_UNSUPPORTED', message: `Unsupported flow version: ${String(flow.version)}`, path: 'version' })
  if (!isIdentifier(flow.id) || !isNonEmptyString(flow.name))
    diagnostics.push({ code: 'FLOW_ID_NAME_REQUIRED', message: 'Flow id and name are required.' })
  analyzeTrigger(flow.trigger, diagnostics)
  if (flow.concurrency !== undefined && !['latest', 'queue', 'ignore'].includes(flow.concurrency))
    diagnostics.push({ code: 'FLOW_CONCURRENCY_INVALID', message: `Unsupported flow concurrency: ${String(flow.concurrency)}`, path: 'concurrency' })
  analyzeErrorPolicy(flow.errorPolicy, diagnostics)
  if (!Array.isArray(flow.nodes) || flow.nodes.length === 0) {
    diagnostics.push({ code: 'FLOW_NODES_REQUIRED', message: 'Flow must contain at least one node.', path: 'nodes' })
  }
  else if (flow.nodes.length > CONFIG_FORM_FLOW_MAX_NODES) {
    diagnostics.push({
      code: 'FLOW_NODE_LIMIT_EXCEEDED',
      message: `Flow cannot contain more than ${CONFIG_FORM_FLOW_MAX_NODES} nodes.`,
      path: 'nodes',
    })
  }
  if (!Array.isArray(flow.edges)) {
    diagnostics.push({ code: 'FLOW_EDGES_REQUIRED', message: 'Flow edges must be an array.', path: 'edges' })
  }
  else if (flow.edges.length > CONFIG_FORM_FLOW_MAX_EDGES) {
    diagnostics.push({
      code: 'FLOW_EDGE_LIMIT_EXCEEDED',
      message: `Flow cannot contain more than ${CONFIG_FORM_FLOW_MAX_EDGES} edges.`,
      path: 'edges',
    })
  }
  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const nodes = flow.nodes
  const edges = flow.edges
  const byId = new Map<string, ConfigFormFlowNode>()
  const nodeIds = new Set<string>()
  const outputReferences = new Map<string, OutputReference[]>()
  nodes.forEach((node, index) => {
    const nodePath = `nodes.${index}`
    if (!isRecord(node) || !isIdentifier(node.id)) {
      diagnostics.push({ code: 'FLOW_NODE_ID_REQUIRED', message: 'Every flow node needs a stable safe id.', path: `${nodePath}.id` })
      return
    }
    checkKeys(node, ['id', 'type', 'ref', 'config', 'policy', 'position'], nodePath, diagnostics, node.id)
    if (nodeIds.has(node.id))
      diagnostics.push({ code: 'FLOW_NODE_ID_DUPLICATE', message: `Duplicate flow node id: ${node.id}`, nodeId: node.id, path: `${nodePath}.id` })
    nodeIds.add(node.id)
    if (!NODE_TYPES.has(node.type))
      diagnostics.push({ code: 'FLOW_NODE_TYPE_INVALID', message: `Unsupported flow node type: ${String(node.type)}`, nodeId: node.id, path: `${nodePath}.type` })
    if (node.position !== undefined && (!isRecord(node.position) || !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y))) {
      diagnostics.push({ code: 'FLOW_NODE_POSITION_INVALID', message: 'Flow node position must contain finite x and y values.', nodeId: node.id, path: `${nodePath}.position` })
    }
    analyzeNodeConfig(node, nodePath, diagnostics, outputReferences)
    analyzeNodePolicy(node, nodePath, diagnostics, outputReferences)
    byId.set(node.id, node)
  })

  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const triggerNodes = nodes.filter(node => node.type === 'trigger')
  if (triggerNodes.length !== 1)
    diagnostics.push({ code: 'FLOW_TRIGGER_NODE_COUNT', message: 'Flow must contain exactly one trigger node.' })
  const outgoing = new Map<string, ConfigFormFlowEdge[]>()
  const incoming = new Map<string, ConfigFormFlowEdge[]>()
  const edgeIds = new Set<string>()
  edges.forEach((edge, index) => {
    const edgePath = `edges.${index}`
    if (!isRecord(edge) || !isIdentifier(edge.id) || !isIdentifier(edge.source) || !isIdentifier(edge.target)) {
      diagnostics.push({ code: 'FLOW_EDGE_INVALID', message: 'Every flow edge needs safe id, source and target.', path: edgePath })
      return
    }
    checkKeys(edge, ['id', 'source', 'target', 'condition'], edgePath, diagnostics, undefined, edge.id)
    if (edgeIds.has(edge.id))
      diagnostics.push({ code: 'FLOW_EDGE_ID_DUPLICATE', message: `Duplicate flow edge id: ${edge.id}`, edgeId: edge.id, path: `${edgePath}.id` })
    edgeIds.add(edge.id)
    if (!byId.has(edge.source) || !byId.has(edge.target))
      diagnostics.push({ code: 'FLOW_EDGE_NODE_UNKNOWN', message: `Edge references an unknown node: ${edge.id}`, edgeId: edge.id, path: edgePath })
    if (edge.condition !== undefined && !EDGE_CONDITIONS.has(edge.condition))
      diagnostics.push({ code: 'FLOW_EDGE_CONDITION_INVALID', message: `Unsupported edge condition: ${String(edge.condition)}`, edgeId: edge.id, path: `${edgePath}.condition` })
    if (edge.source === edge.target)
      diagnostics.push({ code: 'FLOW_CYCLE', message: 'Self-referencing flow edges are not allowed.', edgeId: edge.id })
    const sourceEdges = outgoing.get(edge.source) ?? []
    sourceEdges.push(edge)
    outgoing.set(edge.source, sourceEdges)
    const targetEdges = incoming.get(edge.target) ?? []
    targetEdges.push(edge)
    incoming.set(edge.target, targetEdges)
  })

  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  for (const node of nodes) {
    const edgesFromNode = outgoing.get(node.id) ?? []
    const terminal = isTerminal(node)
    const allowed = node.type === 'condition'
      ? ['true', 'false', 'error']
      : node.type === 'action' || node.type === 'reaction'
        ? ['next', 'error']
        : terminal ? [] : ['next']
    const exits = new Set<string>()
    for (const edge of edgesFromNode) {
      const condition = edge.condition ?? 'next'
      if (!allowed.includes(condition))
        diagnostics.push({ code: 'FLOW_EXIT_INVALID', message: `${node.type} nodes cannot use the ${condition} exit.`, nodeId: node.id, edgeId: edge.id })
      if (exits.has(condition))
        diagnostics.push({ code: 'FLOW_EXIT_DUPLICATE', message: `Only one edge may leave the ${condition} exit.`, nodeId: node.id, edgeId: edge.id })
      exits.add(condition)
    }
    if (node.type === 'trigger' && (incoming.get(node.id)?.length ?? 0) > 0)
      diagnostics.push({ code: 'FLOW_TRIGGER_INCOMING', message: 'The event source cannot have incoming edges.', nodeId: node.id })
    if (node.type === 'condition') {
      if (!edgesFromNode.some(edge => edge.condition === 'true') || !edgesFromNode.some(edge => edge.condition === 'false'))
        diagnostics.push({ code: 'FLOW_BRANCH_INCOMPLETE', message: 'Condition nodes require true and false edges.', nodeId: node.id })
    }
    else if (!terminal && !exits.has('next')) {
      diagnostics.push({ code: 'FLOW_NODE_DEAD_END', message: `${node.type} nodes must connect to a next node.`, nodeId: node.id })
    }
  }

  const triggerNode = triggerNodes[0]
  const order = triggerNode ? topologicalOrder(triggerNode.id, nodes, outgoing, diagnostics) : []
  const reachable = triggerNode ? reachableNodes(triggerNode.id, outgoing) : new Set<string>()
  if (triggerNode && reachable.size !== nodes.length)
    diagnostics.push({ code: 'FLOW_UNREACHABLE_NODE', message: 'Every flow node must be reachable from the trigger.' })
  for (const node of nodes) {
    if (isTerminal(node))
      continue
    if (!(outgoing.get(node.id) ?? []).some(edge => reachesTerminal(edge.target, byId, outgoing, new Set())))
      diagnostics.push({ code: 'FLOW_NO_TERMINAL', message: `Node cannot reach a terminal node: ${node.id}`, nodeId: node.id })
  }
  if (!diagnostics.some(diagnostic => diagnostic.code === 'FLOW_CYCLE')) {
    validateOutputReferences(
      nodes,
      order,
      incoming,
      byId,
      outputReferences,
      diagnostics,
    )
  }
  if (diagnostics.length > 0)
    return failure(flow, diagnostics)

  const planNodes: ConfigFormFlowPlanNode[] = nodes.map(({ position: _position, ...node }) => ({
    ...cloneJson(node),
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

function analyzeTrigger(trigger: unknown, diagnostics: ConfigFormFlowDiagnostic[]): void {
  if (!isRecord(trigger) || !CONFIG_FORM_FLOW_TRIGGER_KINDS.includes(trigger.kind as never)) {
    diagnostics.push({ code: 'FLOW_TRIGGER_INVALID', message: 'Flow trigger is invalid.', path: 'trigger' })
    return
  }
  checkKeys(trigger, ['kind', 'nodeId', 'event'], 'trigger', diagnostics)
  if (Object.hasOwn(trigger, 'field'))
    diagnostics.push({ code: 'FLOW_TRIGGER_FIELD_UNSUPPORTED', message: 'field.change triggers are no longer supported.', path: 'trigger.field' })
  if (trigger.kind === 'component.event') {
    if (!isIdentifier(trigger.nodeId))
      diagnostics.push({ code: 'FLOW_TRIGGER_NODE_REQUIRED', message: 'component.event triggers require a nodeId.', path: 'trigger.nodeId' })
    if (!isIdentifier(trigger.event))
      diagnostics.push({ code: 'FLOW_TRIGGER_EVENT_REQUIRED', message: 'component.event triggers require an event.', path: 'trigger.event' })
  }
  else {
    if (trigger.nodeId !== undefined)
      diagnostics.push({ code: 'FLOW_TRIGGER_NODE_UNEXPECTED', message: 'Only component.event triggers may specify a nodeId.', path: 'trigger.nodeId' })
    if (trigger.event !== undefined)
      diagnostics.push({ code: 'FLOW_TRIGGER_EVENT_UNEXPECTED', message: 'Only component.event triggers may specify an event.', path: 'trigger.event' })
  }
}

function analyzeErrorPolicy(policy: unknown, diagnostics: ConfigFormFlowDiagnostic[]): void {
  if (policy === undefined)
    return
  if (!isRecord(policy)) {
    diagnostics.push({ code: 'FLOW_ERROR_POLICY_INVALID', message: 'Flow errorPolicy must be an object.', path: 'errorPolicy' })
    return
  }
  checkKeys(policy, ['onError', 'timeoutMs'], 'errorPolicy', diagnostics)
  if (!['failure', 'end'].includes(policy.onError as string))
    diagnostics.push({ code: 'FLOW_ERROR_POLICY_INVALID', message: 'Flow errorPolicy.onError must be "failure" or "end".', path: 'errorPolicy.onError' })
  if (policy.timeoutMs !== undefined && (!Number.isInteger(policy.timeoutMs) || (policy.timeoutMs as number) < 0))
    diagnostics.push({ code: 'FLOW_TIMEOUT_INVALID', message: 'Flow timeoutMs must be a non-negative integer.', path: 'errorPolicy.timeoutMs' })
}

function analyzeNodeConfig(
  node: ConfigFormFlowNode,
  nodePath: string,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
): void {
  const configPath = `${nodePath}.config`
  if (node.type === 'condition') {
    if (!isRecord(node.config)) {
      diagnostics.push({ code: 'FLOW_NODE_CONFIG_REQUIRED', message: 'condition nodes require JSON config.', nodeId: node.id, path: configPath })
      return
    }
    checkKeys(node.config, ['condition'], configPath, diagnostics, node.id)
    appendReactionDiagnostics(
      analyzeConfigFormReactionCondition(node.config.condition, `${configPath}.condition`),
      node.id,
      diagnostics,
    )
    collectReactionOutputReferences(node.config.condition, `${configPath}.condition`, node.id, false, outputReferences, diagnostics)
    return
  }
  if (node.type === 'reaction') {
    if (!isRecord(node.config)) {
      diagnostics.push({ code: 'FLOW_NODE_CONFIG_REQUIRED', message: 'reaction nodes require JSON config.', nodeId: node.id, path: configPath })
      return
    }
    checkKeys(node.config, ['reactions'], configPath, diagnostics, node.id)
    appendReactionDiagnostics(
      analyzeConfigFormReactionList(node.config.reactions, `${configPath}.reactions`),
      node.id,
      diagnostics,
    )
    collectReactionOutputReferences(node.config.reactions, `${configPath}.reactions`, node.id, false, outputReferences, diagnostics)
    return
  }
  if (node.type === 'action') {
    if (!isIdentifier(node.ref))
      diagnostics.push({ code: 'FLOW_ACTION_REF_REQUIRED', message: 'Action nodes require a registry ref.', nodeId: node.id, path: `${nodePath}.ref` })
    if (!isRecord(node.config)) {
      diagnostics.push({ code: 'FLOW_NODE_CONFIG_REQUIRED', message: 'action nodes require JSON config.', nodeId: node.id, path: configPath })
      return
    }
    checkKeys(node.config, ['input', 'output'], configPath, diagnostics, node.id)
    if (Object.hasOwn(node.config, 'input'))
      analyzeFlowValue(node.config.input, `${configPath}.input`, node.id, false, diagnostics, outputReferences)
    if (node.config.output !== undefined) {
      if (!isRecord(node.config.output)) {
        diagnostics.push({ code: 'FLOW_ACTION_OUTPUT_INVALID', message: 'Action output mappings must be an object.', nodeId: node.id, path: `${configPath}.output` })
      }
      else {
        Object.entries(node.config.output).forEach(([field, value]) => {
          if (!isIdentifier(field)) {
            diagnostics.push({ code: 'FLOW_ACTION_OUTPUT_FIELD_INVALID', message: `Invalid action output field: ${field}`, nodeId: node.id, path: `${configPath}.output.${field}` })
          }
          analyzeFlowValue(value, `${configPath}.output.${field}`, node.id, true, diagnostics, outputReferences)
        })
      }
    }
  }
}

function analyzeNodePolicy(
  node: ConfigFormFlowNode,
  nodePath: string,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
): void {
  if (node.policy === undefined)
    return
  const path = `${nodePath}.policy`
  if (!isRecord(node.policy)) {
    diagnostics.push({ code: 'FLOW_NODE_POLICY_INVALID', message: 'Flow node policy must be an object.', nodeId: node.id, path })
    return
  }
  checkKeys(node.policy, ['when', 'stopWhen', 'onError', 'timeoutMs'], path, diagnostics, node.id)
  if (node.policy.when !== undefined) {
    appendReactionDiagnostics(analyzeConfigFormReactionCondition(node.policy.when, `${path}.when`), node.id, diagnostics)
    collectReactionOutputReferences(node.policy.when, `${path}.when`, node.id, false, outputReferences, diagnostics)
  }
  if (node.policy.stopWhen !== undefined) {
    appendReactionDiagnostics(analyzeConfigFormReactionCondition(node.policy.stopWhen, `${path}.stopWhen`), node.id, diagnostics)
    collectReactionOutputReferences(node.policy.stopWhen, `${path}.stopWhen`, node.id, node.type === 'action', outputReferences, diagnostics)
  }
  if (node.policy.onError !== undefined && !['continue', 'failure'].includes(node.policy.onError)) {
    diagnostics.push({ code: 'FLOW_NODE_ERROR_POLICY_INVALID', message: 'Node policy.onError must be "continue" or "failure".', nodeId: node.id, path: `${path}.onError` })
  }
  if (node.policy.timeoutMs !== undefined && (!Number.isInteger(node.policy.timeoutMs) || node.policy.timeoutMs < 0)) {
    diagnostics.push({ code: 'FLOW_TIMEOUT_INVALID', message: 'Node timeoutMs must be a non-negative integer.', nodeId: node.id, path: `${path}.timeoutMs` })
  }
}

function analyzeFlowValue(
  value: unknown,
  path: string,
  nodeId: string,
  allowSelf: boolean,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
): void {
  try {
    collectConfigFormValueReferences(value as ConfigFormValueInput).forEach((reference) => {
      if (reference.kind === 'output') {
        addOutputReference(
          outputReferences,
          nodeId,
          reference.id,
          prefixValuePath(path, reference.path),
          allowSelf,
        )
      }
    })
  }
  catch (cause) {
    diagnostics.push({
      code: cause instanceof ConfigFormValueReferenceError ? cause.code : 'FLOW_REFERENCE_INVALID',
      message: cause instanceof Error ? cause.message : 'Flow value reference is invalid.',
      nodeId,
      path: cause instanceof ConfigFormValueReferenceError ? prefixValuePath(path, cause.path) : path,
    })
    return
  }
  analyzeLegacyFlowValue(value, path, nodeId, allowSelf, diagnostics, outputReferences)
}

function analyzeLegacyFlowValue(
  value: unknown,
  path: string,
  nodeId: string,
  allowSelf: boolean,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => analyzeLegacyFlowValue(item, `${path}.${index}`, nodeId, allowSelf, diagnostics, outputReferences))
    return
  }
  if (!isRecord(value))
    return
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === '$ref')
    return
  const special = keys.filter(key => REFERENCE_KEYS.has(key) || key.startsWith('$'))
  if (special.length > 0) {
    if (keys.length !== 1 || !REFERENCE_KEYS.has(keys[0]!) || !isIdentifier(value[keys[0]!])) {
      diagnostics.push({ code: 'FLOW_REFERENCE_INVALID', message: 'Flow references require exactly one supported non-empty string key.', nodeId, path })
      return
    }
    const key = keys[0]!
    if (key === '$output')
      addOutputReference(outputReferences, nodeId, value[key] as string, `${path}.$output`, allowSelf)
    else if (key === '$expression')
      analyzeExpression(value[key] as string, `${path}.$expression`, nodeId, allowSelf, diagnostics, outputReferences)
    return
  }
  Object.entries(value).forEach(([key, child]) => analyzeLegacyFlowValue(
    child,
    `${path}.${key}`,
    nodeId,
    allowSelf,
    diagnostics,
    outputReferences,
  ))
}

function collectReactionOutputReferences(
  input: unknown,
  path: string,
  nodeId: string,
  allowSelf: boolean,
  outputReferences: Map<string, OutputReference[]>,
  diagnostics: ConfigFormFlowDiagnostic[],
): void {
  if (Array.isArray(input)) {
    input.forEach((item, index) => collectReactionOutputReferences(item, `${path}.${index}`, nodeId, allowSelf, outputReferences, diagnostics))
    return
  }
  if (!isRecord(input))
    return
  if (input.kind === 'expression' && typeof input.expression === 'string') {
    analyzeExpression(input.expression, `${path}.expression`, nodeId, allowSelf, diagnostics, outputReferences)
    return
  }
  Object.entries(input).forEach(([key, child]) => collectReactionOutputReferences(
    child,
    `${path}.${key}`,
    nodeId,
    allowSelf,
    outputReferences,
    diagnostics,
  ))
}

function analyzeExpression(
  source: string,
  path: string,
  nodeId: string,
  allowSelf: boolean,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
): void {
  try {
    const expression = parseConfigFormExpression(source)
    validateExpressionNode(expression, path, nodeId, allowSelf, diagnostics, outputReferences)
  }
  catch (cause) {
    diagnostics.push({
      code: cause instanceof ConfigFormExpressionError ? cause.code : 'CONFIG_FORM_EXPRESSION_INVALID',
      message: cause instanceof Error ? cause.message : 'Flow expression is invalid.',
      nodeId,
      path,
    })
  }
}

function validateExpressionNode(
  node: ConfigFormExpressionNode,
  path: string,
  nodeId: string,
  allowSelf: boolean,
  diagnostics: ConfigFormFlowDiagnostic[],
  outputReferences: Map<string, OutputReference[]>,
  parentIsAccess = false,
): void {
  if ((node.kind === 'member' || node.kind === 'index') && !parentIsAccess) {
    const access = getOutputAccess(node)
    if (access.matched) {
      if (access.ref === undefined) {
        diagnostics.push({ code: 'FLOW_OUTPUT_REFERENCE_DYNAMIC', message: 'Flow output references must use a static action node id.', nodeId, path })
      }
      else {
        addOutputReference(outputReferences, nodeId, access.ref, path, allowSelf)
      }
      visitExpressionIndexes(node, child => validateExpressionNode(child, path, nodeId, allowSelf, diagnostics, outputReferences))
      return
    }
  }
  if (node.kind === 'identifier' && node.name === '$outputs') {
    diagnostics.push({ code: 'FLOW_OUTPUT_REFERENCE_DYNAMIC', message: 'Flow output references must select a static action node id.', nodeId, path })
  }
  else if (node.kind === 'call') {
    if (!Object.keys(CONFIG_FORM_EXPRESSION_FUNCTIONS).some(name => name.toUpperCase() === node.callee.toUpperCase())) {
      diagnostics.push({ code: 'CONFIG_FORM_EXPRESSION_UNKNOWN_FUNCTION', message: `Unknown function "${node.callee}".`, nodeId, path })
    }
    node.args.forEach(argument => validateExpressionNode(argument, path, nodeId, allowSelf, diagnostics, outputReferences))
  }
  else if (node.kind === 'member') {
    validateExpressionNode(node.object, path, nodeId, allowSelf, diagnostics, outputReferences, true)
  }
  else if (node.kind === 'index') {
    validateExpressionNode(node.object, path, nodeId, allowSelf, diagnostics, outputReferences, true)
    validateExpressionNode(node.index, path, nodeId, allowSelf, diagnostics, outputReferences)
  }
  else if (node.kind === 'array') {
    node.items.forEach(item => validateExpressionNode(item, path, nodeId, allowSelf, diagnostics, outputReferences))
  }
  else if (node.kind === 'unary') {
    validateExpressionNode(node.operand, path, nodeId, allowSelf, diagnostics, outputReferences)
  }
  else if (node.kind === 'binary') {
    validateExpressionNode(node.left, path, nodeId, allowSelf, diagnostics, outputReferences)
    validateExpressionNode(node.right, path, nodeId, allowSelf, diagnostics, outputReferences)
  }
  else if (node.kind === 'conditional') {
    validateExpressionNode(node.test, path, nodeId, allowSelf, diagnostics, outputReferences)
    validateExpressionNode(node.consequent, path, nodeId, allowSelf, diagnostics, outputReferences)
    validateExpressionNode(node.alternate, path, nodeId, allowSelf, diagnostics, outputReferences)
  }
}

function getOutputAccess(node: ConfigFormExpressionNode): { matched: boolean, ref?: string } {
  let current = node
  while (current.kind === 'member' || current.kind === 'index') {
    if (current.object.kind === 'identifier' && current.object.name === '$outputs') {
      if (current.kind === 'member')
        return { matched: true, ref: current.property }
      return current.index.kind === 'literal' && typeof current.index.value === 'string'
        ? { matched: true, ref: current.index.value }
        : { matched: true }
    }
    current = current.object
  }
  return { matched: false }
}

function visitExpressionIndexes(node: ConfigFormExpressionNode, visit: (node: ConfigFormExpressionNode) => void): void {
  let current = node
  while (current.kind === 'member' || current.kind === 'index') {
    if (current.kind === 'index')
      visit(current.index)
    current = current.object
  }
}

function addOutputReference(
  references: Map<string, OutputReference[]>,
  nodeId: string,
  ref: string,
  path: string,
  allowSelf: boolean,
): void {
  const current = references.get(nodeId) ?? []
  current.push({ allowSelf, path, ref })
  references.set(nodeId, current)
}

function validateOutputReferences(
  nodes: ConfigFormFlowNode[],
  order: string[],
  incoming: Map<string, ConfigFormFlowEdge[]>,
  byId: Map<string, ConfigFormFlowNode>,
  references: Map<string, OutputReference[]>,
  diagnostics: ConfigFormFlowDiagnostic[],
): void {
  const availableBefore = new Map<string, Set<string>>()
  order.forEach((nodeId) => {
    const edges = incoming.get(nodeId) ?? []
    if (edges.length === 0) {
      availableBefore.set(nodeId, new Set())
      return
    }
    const candidates = edges.map((edge) => {
      const available = new Set(availableBefore.get(edge.source) ?? [])
      const source = byId.get(edge.source)
      if (source?.type === 'action' && isNextEdge(edge) && actionAlwaysProducesOutput(source))
        available.add(source.id)
      return available
    })
    const intersection = new Set(candidates[0] ?? [])
    for (const candidate of candidates.slice(1)) {
      for (const ref of intersection) {
        if (!candidate.has(ref))
          intersection.delete(ref)
      }
    }
    availableBefore.set(nodeId, intersection)
  })

  nodes.forEach((node) => {
    const available = availableBefore.get(node.id) ?? new Set<string>()
    for (const reference of references.get(node.id) ?? []) {
      const source = byId.get(reference.ref)
      if (!source) {
        diagnostics.push({ code: 'FLOW_OUTPUT_UNKNOWN', message: `Flow output references an unknown node: ${reference.ref}`, nodeId: node.id, path: reference.path })
      }
      else if (source.type !== 'action') {
        diagnostics.push({ code: 'FLOW_OUTPUT_SOURCE_INVALID', message: `Flow output source is not an action node: ${reference.ref}`, nodeId: node.id, path: reference.path })
      }
      else if (!(reference.allowSelf && reference.ref === node.id) && !available.has(reference.ref)) {
        diagnostics.push({ code: 'FLOW_OUTPUT_UNAVAILABLE', message: `Action output is not guaranteed before this node: ${reference.ref}`, nodeId: node.id, path: reference.path })
      }
    }
  })
}

function actionAlwaysProducesOutput(node: ConfigFormFlowNode): boolean {
  const when = node.policy?.when
  const alwaysRuns = when === undefined || (when.kind === 'literal' && when.value === true)
  return alwaysRuns && node.policy?.onError !== 'continue'
}

function isNextEdge(edge: ConfigFormFlowEdge): boolean {
  return edge.condition === undefined || edge.condition === 'next'
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
  const nextSeen = new Set(seen).add(id)
  const node = byId.get(id)
  if (!node)
    return false
  if (isTerminal(node))
    return true
  return (outgoing.get(id) ?? []).some(edge => reachesTerminal(edge.target, byId, outgoing, nextSeen))
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

function appendReactionDiagnostics(
  source: Array<{ code: string, message: string, path?: string }>,
  nodeId: string,
  diagnostics: ConfigFormFlowDiagnostic[],
): void {
  source.forEach(diagnostic => diagnostics.push({ ...diagnostic, nodeId }))
}

function inspectFlowStructure(value: unknown): ConfigFormFlowDiagnostic | undefined {
  const ancestors = new Set<object>()
  let entries = 0
  const visit = (current: unknown, depth: number, path: string): ConfigFormFlowDiagnostic | undefined => {
    entries += 1
    if (entries > CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES || depth > CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH) {
      return {
        code: 'FLOW_STRUCTURE_LIMIT_EXCEEDED',
        message: `Flow JSON exceeds ${CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES} entries or depth ${CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH}.`,
        path,
      }
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      return undefined
    if (typeof current === 'number')
      return Number.isFinite(current) ? undefined : { code: 'FLOW_NON_JSON', message: 'Flow contains a non-finite number.', path }
    if (typeof current !== 'object')
      return { code: 'FLOW_NON_JSON', message: 'Flow contains a non-JSON value.', path }
    if (ancestors.has(current))
      return { code: 'FLOW_NON_JSON', message: 'Flow contains a circular reference.', path }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null)
      return { code: 'FLOW_NON_JSON', message: 'Flow contains a non-JSON object.', path }
    ancestors.add(current)
    const children = Array.isArray(current)
      ? current.map((item, index) => [String(index), item] as const)
      : Object.entries(current)
    for (const [key, child] of children) {
      const childPath = path ? `${path}.${key}` : key
      if (UNSAFE_KEYS.has(key)) {
        ancestors.delete(current)
        return { code: 'FLOW_UNSAFE_KEY', message: `Flow contains an unsafe object key: ${key}`, path: childPath }
      }
      const diagnostic = visit(child, depth + 1, childPath)
      if (diagnostic) {
        ancestors.delete(current)
        return diagnostic
      }
    }
    ancestors.delete(current)
    return undefined
  }
  return visit(value, 0, '')
}

function checkKeys(
  value: object,
  allowed: readonly string[],
  path: string,
  diagnostics: ConfigFormFlowDiagnostic[],
  nodeId?: string,
  edgeId?: string,
): void {
  const allowedKeys = new Set(allowed)
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      diagnostics.push({
        code: UNSAFE_KEYS.has(key) ? 'FLOW_UNSAFE_KEY' : 'FLOW_PROPERTY_UNEXPECTED',
        message: UNSAFE_KEYS.has(key) ? `Unsafe flow object key: ${key}` : `Unexpected flow property: ${key}`,
        path: path ? `${path}.${key}` : key,
        ...(nodeId ? { nodeId } : {}),
        ...(edgeId ? { edgeId } : {}),
      })
    }
  })
}

function isTerminal(node: Pick<ConfigFormFlowNode, 'type'>): boolean {
  return ['success', 'failure', 'end', 'blocked'].includes(node.type)
}

function failure(flow: ConfigFormFlow, diagnostics: ConfigFormFlowDiagnostic[]): ConfigFormFlowPlanFailure {
  return { success: false, flow, diagnostics }
}

function prefixValuePath(prefix: string, path: string): string {
  if (path === '$')
    return prefix
  if (path.startsWith('$.'))
    return `${prefix}${path.slice(1)}`
  if (path.startsWith('$['))
    return `${prefix}${path.slice(1)}`
  return prefix
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return isNonEmptyString(value) && !UNSAFE_KEYS.has(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
