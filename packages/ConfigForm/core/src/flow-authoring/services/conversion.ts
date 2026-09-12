import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowEdgeCondition,
  ConfigFormFlowNode,
} from '../../flow'
import type { ConfigFormJsonValue } from '../../json'
import type { ConfigFormValueInput } from '../../value-reference'
import type {
  ConfigFormFlowActionStep,
  ConfigFormFlowAuthoringDiagnostic,
  ConfigFormFlowConditionStep,
  ConfigFormFlowCreateResult,
  ConfigFormFlowMetadata,
  ConfigFormFlowReactionStep,
  ConfigFormFlowStep,
  ConfigFormFlowStepIdFactory,
  ConfigFormFlowStepPolicy,
  ConfigFormFlowStepsResult,
  ConfigFormFlowTerminateOutcome,
} from '../types'
import { analyzeConfigFormFlow } from '../../flow'
import { ConfigFormValueReferenceError, remapConfigFormValueReferences } from '../../value-reference'
import { remapConfigFormExpressionOutputs } from './expressions'
import {
  analyzeConfigFormFlowStepTree,
  CONFIG_FORM_FLOW_AUTHORING_MAX_NODES,
  validateConfigFormFlowSteps,
} from './validation'

const INTERNAL_PREFIX = '$flow-authoring:'
const INTERNAL_TRIGGER_ID = `${INTERNAL_PREFIX}trigger`
const INTERNAL_END_ID = `${INTERNAL_PREFIX}end`

interface SequenceFallthrough {
  conditions: Map<string, boolean>
  root: boolean
}

interface ParseContext {
  authoringGraph: boolean
  byId: Map<string, ConfigFormFlowNode>
  consumed: Set<string>
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
  outgoing: Map<string, ConfigFormFlowEdge[]>
  titles: Map<string, string>
}

interface ParsedSequence {
  steps: ConfigFormFlowStep[]
  reachedStop: boolean
  terminated: boolean
}

type RemapMode = 'flow-input' | 'reaction'

export function createConfigFormFlowFromSteps(
  metadata: ConfigFormFlowMetadata,
  steps: readonly ConfigFormFlowStep[],
): ConfigFormFlowCreateResult {
  const analysis = analyzeConfigFormFlowStepTree(steps)
  if (analysis.diagnostics.length > 0)
    return { success: false, diagnostics: analysis.diagnostics }

  const collisionDiagnostics = getGeneratedIdCollisions(steps)
  if (collisionDiagnostics.length > 0)
    return { success: false, diagnostics: collisionDiagnostics }

  let flowMetadata: ConfigFormFlowMetadata
  try {
    flowMetadata = cloneMetadata(metadata)
  }
  catch (cause) {
    return {
      success: false,
      diagnostics: [{
        code: 'FLOW_AUTHORING_METADATA_INVALID',
        message: cause instanceof Error ? cause.message : 'Flow metadata must be serializable.',
        path: 'metadata',
      }],
    }
  }

  const fallthrough = getSequenceFallthrough(steps)
  const nodes: ConfigFormFlowNode[] = [{ id: INTERNAL_TRIGGER_ID, type: 'trigger' }]
  appendStepNodes(steps, fallthrough.conditions, nodes)
  if (fallthrough.root)
    nodes.push({ id: INTERNAL_END_ID, type: 'end' })

  const edges: ConfigFormFlowEdge[] = []
  const continuation = fallthrough.root ? INTERNAL_END_ID : undefined
  const first = compileSequence(steps, continuation, fallthrough.conditions, edges)
  if (!first) {
    return {
      success: false,
      diagnostics: [{
        code: 'FLOW_AUTHORING_GRAPH_INTERNAL',
        message: 'The validated step tree did not produce an executable entry.',
        path: 'steps',
      }],
    }
  }
  addEdge(edges, INTERNAL_TRIGGER_ID, first, 'next')
  const titles = getStepTitles(steps)
  edges.forEach((edge) => {
    edge.id += encodeEdgeTitle(titles.get(edge.target))
  })
  edges.sort((left, right) => left.id.localeCompare(right.id))

  const flow: ConfigFormFlow = {
    version: flowMetadata.version,
    id: flowMetadata.id,
    name: flowMetadata.name,
    trigger: flowMetadata.trigger,
    ...(flowMetadata.concurrency === undefined ? {} : { concurrency: flowMetadata.concurrency }),
    ...(flowMetadata.errorPolicy === undefined ? {} : { errorPolicy: flowMetadata.errorPolicy }),
    nodes,
    edges,
  }
  try {
    const plan = analyzeConfigFormFlow(flow)
    if (!plan.success) {
      return {
        success: false,
        diagnostics: plan.diagnostics.map(diagnostic => ({ ...diagnostic })),
      }
    }
  }
  catch (cause) {
    return {
      success: false,
      diagnostics: [{
        code: 'FLOW_AUTHORING_GRAPH_INVALID',
        message: cause instanceof Error ? cause.message : 'The generated flow graph is invalid.',
      }],
    }
  }
  return { success: true, flow, diagnostics: [] }
}

export function readConfigFormFlowSteps(flow: ConfigFormFlow): ConfigFormFlowStepsResult {
  if (!flow || typeof flow !== 'object' || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    return {
      success: false,
      steps: [],
      diagnostics: [{
        code: 'FLOW_AUTHORING_GRAPH_INVALID',
        message: 'Flow nodes and edges must be arrays.',
      }],
    }
  }
  if (flow.nodes.length > CONFIG_FORM_FLOW_AUTHORING_MAX_NODES) {
    return {
      success: false,
      steps: [],
      diagnostics: [{
        code: 'FLOW_AUTHORING_NODE_LIMIT_EXCEEDED',
        message: `Flow graph exceeds the ${CONFIG_FORM_FLOW_AUTHORING_MAX_NODES}-node authoring limit.`,
        path: 'nodes',
      }],
    }
  }

  let planResult: ReturnType<typeof analyzeConfigFormFlow>
  try {
    planResult = analyzeConfigFormFlow(flow)
  }
  catch (cause) {
    return {
      success: false,
      steps: [],
      diagnostics: [{
        code: 'FLOW_AUTHORING_GRAPH_INVALID',
        message: cause instanceof Error ? cause.message : 'Flow graph analysis failed.',
      }],
    }
  }
  if (!planResult.success) {
    return {
      success: false,
      steps: [],
      diagnostics: planResult.diagnostics.map(diagnostic => ({ ...diagnostic })),
    }
  }

  const byId = new Map(flow.nodes.map(node => [node.id, node]))
  const outgoing = new Map<string, ConfigFormFlowEdge[]>()
  for (const edge of flow.edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge)
    outgoing.set(edge.source, list)
  }
  const trigger = flow.nodes.find(node => node.type === 'trigger')!
  const authoringGraph = trigger.id === INTERNAL_TRIGGER_ID
  const titleResult = authoringGraph
    ? readEdgeTitles(flow.edges)
    : { diagnostics: [], titles: new Map<string, string>() }
  const context: ParseContext = {
    authoringGraph,
    byId,
    consumed: new Set([trigger.id]),
    diagnostics: titleResult.diagnostics,
    outgoing,
    titles: titleResult.titles,
  }
  if (trigger.config !== undefined || trigger.ref !== undefined || trigger.policy !== undefined) {
    context.diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
      message: 'Trigger node configuration cannot be represented as ordered steps.',
      nodeId: trigger.id,
    })
  }
  const triggerNext = getOnlyEdge(context, trigger, 'next')
  const parsed = triggerNext
    ? parseSequence(triggerNext.target, undefined, 'steps', 0, context)
    : { steps: [], reachedStop: false, terminated: false }

  for (const node of flow.nodes) {
    if (!context.consumed.has(node.id)) {
      context.diagnostics.push({
        code: 'FLOW_AUTHORING_GRAPH_UNCONSUMED_NODE',
        message: `Flow node ${node.id} is part of an unsupported merge or branch structure.`,
        nodeId: node.id,
      })
    }
  }
  if (context.diagnostics.length > 0)
    return { success: false, steps: [], diagnostics: context.diagnostics }

  const diagnostics = validateConfigFormFlowSteps(parsed.steps)
  return {
    success: diagnostics.length === 0,
    steps: parsed.steps,
    diagnostics,
  }
}

export function cloneConfigFormFlowSteps(
  steps: readonly ConfigFormFlowStep[],
  idFactory: ConfigFormFlowStepIdFactory,
): ConfigFormFlowStepsResult {
  const analysis = analyzeConfigFormFlowStepTree(steps, { references: false })
  if (analysis.diagnostics.length > 0)
    return { success: false, steps: [], diagnostics: analysis.diagnostics }

  const ids = new Map<string, string>()
  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const sourceIds = new Set(analysis.paths.keys())
  const used = new Set<string>()
  for (const [sourceId, path] of analysis.paths) {
    const step = findStep(steps, sourceId)
    if (!step)
      continue
    let nextId: unknown
    try {
      nextId = idFactory(sourceId, { path, step })
    }
    catch (cause) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_ID_FACTORY_ERROR',
        message: cause instanceof Error ? cause.message : `Could not clone flow step ${sourceId}.`,
        path: `${path}.id`,
        stepId: sourceId,
      })
      continue
    }
    if (typeof nextId !== 'string' || nextId.trim().length === 0 || isUnsafeId(nextId)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_ID_FACTORY_INVALID',
        message: `The id factory returned an invalid id for ${sourceId}.`,
        path: `${path}.id`,
        stepId: sourceId,
      })
      continue
    }
    if (sourceIds.has(nextId)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_ID_FACTORY_REUSED',
        message: `The id factory must replace the identity of ${sourceId}.`,
        path: `${path}.id`,
        stepId: sourceId,
      })
      continue
    }
    if (used.has(nextId)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_ID_FACTORY_DUPLICATE',
        message: `The id factory returned duplicate id ${nextId}.`,
        path: `${path}.id`,
        stepId: sourceId,
      })
      continue
    }
    used.add(nextId)
    ids.set(sourceId, nextId)
  }
  if (diagnostics.length > 0)
    return { success: false, steps: [], diagnostics }

  const cloned = remapStepSequence(steps, ids, 'steps', diagnostics)
  if (diagnostics.length > 0)
    return { success: false, steps: [], diagnostics }
  return { success: true, steps: cloned, diagnostics: [] }
}

function appendStepNodes(
  steps: readonly ConfigFormFlowStep[],
  conditionFallthrough: ReadonlyMap<string, boolean>,
  nodes: ConfigFormFlowNode[],
): void {
  for (const step of steps) {
    if (step.type === 'action') {
      nodes.push({
        id: step.id,
        type: 'action',
        ref: step.ref,
        config: {
          ...(step.input === undefined ? {} : { input: cloneValue(step.input) }),
          ...(step.output === undefined ? {} : { output: cloneValue(step.output) }),
        } as unknown as ConfigFormFlowNode['config'],
        ...(step.policy === undefined ? {} : { policy: cloneValue(step.policy) }),
      })
    }
    else if (step.type === 'reaction') {
      nodes.push({
        id: step.id,
        type: 'reaction',
        config: { reactions: cloneValue(step.reactions) as unknown as ConfigFormJsonValue },
        ...(step.policy === undefined ? {} : { policy: cloneValue(step.policy) }),
      })
    }
    else if (step.type === 'condition') {
      nodes.push({
        id: step.id,
        type: 'condition',
        config: { condition: cloneValue(step.when) },
      })
      appendStepNodes(step.then, conditionFallthrough, nodes)
      appendStepNodes(step.else, conditionFallthrough, nodes)
      if (conditionFallthrough.get(step.id)) {
        nodes.push({
          id: getJoinId(step.id),
          type: 'reaction',
          config: { reactions: [] },
        })
      }
    }
    else {
      nodes.push({
        id: step.id,
        type: step.outcome,
      })
    }
  }
}

function compileSequence(
  steps: readonly ConfigFormFlowStep[],
  continuation: string | undefined,
  conditionFallthrough: ReadonlyMap<string, boolean>,
  edges: ConfigFormFlowEdge[],
): string | undefined {
  let target = continuation
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]!
    if (step.type === 'terminate') {
      target = step.id
      continue
    }
    if (step.type === 'condition') {
      const fallsThrough = conditionFallthrough.get(step.id) === true
      const branchContinuation = fallsThrough ? getJoinId(step.id) : undefined
      if (fallsThrough && target) {
        addEdge(edges, branchContinuation!, target, 'next')
      }
      const thenEntry = compileSequence(step.then, branchContinuation, conditionFallthrough, edges)
      const elseEntry = compileSequence(step.else, branchContinuation, conditionFallthrough, edges)
      if (thenEntry)
        addEdge(edges, step.id, thenEntry, 'true')
      if (elseEntry)
        addEdge(edges, step.id, elseEntry, 'false')
      target = step.id
      continue
    }
    if (target)
      addEdge(edges, step.id, target, 'next')
    target = step.id
  }
  return target
}

function getSequenceFallthrough(steps: readonly ConfigFormFlowStep[]): SequenceFallthrough {
  const conditions = new Map<string, boolean>()
  function visit(sequence: readonly ConfigFormFlowStep[]): boolean {
    let reachable = true
    for (const step of sequence) {
      if (!reachable)
        return false
      if (step.type === 'terminate') {
        reachable = false
      }
      else if (step.type === 'condition') {
        const thenFallsThrough = visit(step.then)
        const elseFallsThrough = visit(step.else)
        const branchFallsThrough = thenFallsThrough || elseFallsThrough
        conditions.set(step.id, branchFallsThrough)
        reachable = branchFallsThrough
      }
    }
    return reachable
  }
  return { conditions, root: visit(steps) }
}

function parseSequence(
  startId: string | undefined,
  stopId: string | undefined,
  path: string,
  depth: number,
  context: ParseContext,
): ParsedSequence {
  if (depth > 32) {
    context.diagnostics.push({
      code: 'FLOW_AUTHORING_DEPTH_EXCEEDED',
      message: 'Flow graph conditions exceed the maximum authoring depth of 32.',
      path,
    })
    return { steps: [], reachedStop: false, terminated: false }
  }
  const steps: ConfigFormFlowStep[] = []
  let currentId = startId
  while (currentId !== undefined) {
    if (currentId === stopId)
      return { steps, reachedStop: true, terminated: false }
    const node = context.byId.get(currentId)
    if (!node) {
      context.diagnostics.push({
        code: 'FLOW_AUTHORING_GRAPH_UNKNOWN_NODE',
        message: `Flow references unknown node ${currentId}.`,
        nodeId: currentId,
      })
      return { steps, reachedStop: false, terminated: false }
    }
    if (context.consumed.has(currentId)) {
      context.diagnostics.push({
        code: 'FLOW_AUTHORING_GRAPH_UNSTRUCTURED_MERGE',
        message: `Flow node ${currentId} is reached by multiple unstructured branches.`,
        nodeId: currentId,
      })
      return { steps, reachedStop: false, terminated: false }
    }
    if (context.authoringGraph && currentId === INTERNAL_END_ID) {
      if (node.type !== 'end' || (context.outgoing.get(node.id)?.length ?? 0) > 0 || node.config !== undefined || node.policy !== undefined) {
        context.diagnostics.push({
          code: 'FLOW_AUTHORING_INTERNAL_NODE_INVALID',
          message: 'The generated fallthrough terminal is malformed.',
          nodeId: node.id,
        })
      }
      context.consumed.add(node.id)
      return { steps, reachedStop: false, terminated: true }
    }
    if (context.authoringGraph && node.id.startsWith(`${INTERNAL_PREFIX}join:`)) {
      context.diagnostics.push({
        code: 'FLOW_AUTHORING_GRAPH_UNSTRUCTURED_MERGE',
        message: `Internal join ${node.id} was reached outside its owning condition.`,
        nodeId: node.id,
      })
      return { steps, reachedStop: false, terminated: false }
    }

    context.consumed.add(node.id)
    if (node.type === 'end' || node.type === 'success' || node.type === 'failure' || node.type === 'blocked') {
      const terminal = readTerminateStep(node, path, steps.length, context.titles.get(node.id), context.diagnostics)
      if (terminal)
        steps.push(terminal)
      return { steps, reachedStop: false, terminated: true }
    }
    if (node.type === 'action') {
      const action = readActionStep(node, path, steps.length, context.titles.get(node.id), context.diagnostics)
      if (action)
        steps.push(action)
      currentId = getOnlyEdge(context, node, 'next')?.target
      continue
    }
    if (node.type === 'reaction') {
      const reaction = readReactionStep(node, path, steps.length, context.titles.get(node.id), context.diagnostics)
      if (reaction)
        steps.push(reaction)
      currentId = getOnlyEdge(context, node, 'next')?.target
      continue
    }
    if (node.type !== 'condition') {
      context.diagnostics.push({
        code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
        message: `Flow node type ${node.type} cannot be represented as an authoring step.`,
        nodeId: node.id,
      })
      return { steps, reachedStop: false, terminated: false }
    }

    const trueEdge = getOnlyEdge(context, node, 'true')
    const falseEdge = getOnlyEdge(context, node, 'false')
    if (!trueEdge || !falseEdge)
      return { steps, reachedStop: false, terminated: false }
    const joinId = getJoinId(node.id)
    const join = context.authoringGraph ? context.byId.get(joinId) : undefined
    let thenResult: ParsedSequence
    let elseResult: ParsedSequence
    let nextId: string | undefined
    if (join) {
      validateJoinNode(join, node.id, context)
      thenResult = parseSequence(trueEdge.target, joinId, `${path}.${steps.length}.then`, depth + 1, context)
      elseResult = parseSequence(falseEdge.target, joinId, `${path}.${steps.length}.else`, depth + 1, context)
      if (!thenResult.reachedStop && !elseResult.reachedStop) {
        context.diagnostics.push({
          code: 'FLOW_AUTHORING_INTERNAL_NODE_INVALID',
          message: `Join ${joinId} is not reached by either condition branch.`,
          nodeId: joinId,
        })
      }
      context.consumed.add(joinId)
      nextId = getOnlyEdge(context, join, 'next')?.target
    }
    else {
      thenResult = parseSequence(trueEdge.target, undefined, `${path}.${steps.length}.then`, depth + 1, context)
      elseResult = parseSequence(falseEdge.target, undefined, `${path}.${steps.length}.else`, depth + 1, context)
      if (!thenResult.terminated || !elseResult.terminated) {
        context.diagnostics.push({
          code: 'FLOW_AUTHORING_GRAPH_UNSTRUCTURED_BRANCH',
          message: `Condition ${node.id} has no explicit structured join.`,
          nodeId: node.id,
        })
      }
    }
    const condition = readConditionStep(node, thenResult.steps, elseResult.steps, path, steps.length, context.titles.get(node.id), context.diagnostics)
    if (condition)
      steps.push(condition)
    if (!join)
      return { steps, reachedStop: false, terminated: true }
    currentId = nextId
  }
  return { steps, reachedStop: false, terminated: false }
}

function readActionStep(
  node: ConfigFormFlowNode,
  path: string,
  index: number,
  title: string | undefined,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): ConfigFormFlowActionStep | undefined {
  const stepPath = `${path}.${index}`
  const config = readConfig(node, ['input', 'output'], diagnostics)
  if (!config || typeof node.ref !== 'string' || node.ref.trim().length === 0) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
      message: `Action node ${node.id} has unsupported configuration.`,
      path: stepPath,
      nodeId: node.id,
    })
    return undefined
  }
  return {
    id: node.id,
    type: 'action',
    ref: node.ref,
    ...(title === undefined ? {} : { title }),
    ...(config.input === undefined ? {} : { input: cloneValue(config.input) as ConfigFormFlowActionStep['input'] }),
    ...(config.output === undefined ? {} : { output: cloneValue(config.output) as ConfigFormFlowActionStep['output'] }),
    ...(node.policy === undefined ? {} : { policy: cloneValue(node.policy) }),
  }
}

function readReactionStep(
  node: ConfigFormFlowNode,
  path: string,
  index: number,
  title: string | undefined,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): ConfigFormFlowReactionStep | undefined {
  const config = readConfig(node, ['reactions'], diagnostics)
  if (!config || !Array.isArray(config.reactions) || node.ref !== undefined) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
      message: `Reaction node ${node.id} has unsupported configuration.`,
      path: `${path}.${index}`,
      nodeId: node.id,
    })
    return undefined
  }
  return {
    id: node.id,
    type: 'reaction',
    reactions: cloneValue(config.reactions) as ConfigFormFlowReactionStep['reactions'],
    ...(title === undefined ? {} : { title }),
    ...(node.policy === undefined ? {} : { policy: cloneValue(node.policy) }),
  }
}

function readConditionStep(
  node: ConfigFormFlowNode,
  thenSteps: ConfigFormFlowStep[],
  elseSteps: ConfigFormFlowStep[],
  path: string,
  index: number,
  title: string | undefined,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): ConfigFormFlowConditionStep | undefined {
  const config = readConfig(node, ['condition'], diagnostics)
  if (!config || !config.condition || node.ref !== undefined || node.policy !== undefined) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
      message: `Condition node ${node.id} has unsupported configuration.`,
      path: `${path}.${index}`,
      nodeId: node.id,
    })
    return undefined
  }
  return {
    id: node.id,
    type: 'condition',
    when: cloneValue(config.condition) as ConfigFormFlowConditionStep['when'],
    then: thenSteps,
    else: elseSteps,
    ...(title === undefined ? {} : { title }),
  }
}

function readTerminateStep(
  node: ConfigFormFlowNode,
  path: string,
  index: number,
  title: string | undefined,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): ConfigFormFlowStep | undefined {
  if (node.config !== undefined || node.ref !== undefined || node.policy !== undefined) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED',
      message: `Terminal node ${node.id} has unsupported configuration.`,
      path: `${path}.${index}`,
      nodeId: node.id,
    })
    return undefined
  }
  return {
    id: node.id,
    type: 'terminate',
    outcome: node.type as ConfigFormFlowTerminateOutcome,
    ...(title === undefined ? {} : { title }),
  }
}

function readConfig(
  node: ConfigFormFlowNode,
  allowed: readonly string[],
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): Record<string, unknown> | undefined {
  if (!node.config || typeof node.config !== 'object' || Array.isArray(node.config)) {
    diagnostics.push({
      code: 'FLOW_AUTHORING_NODE_CONFIG_INVALID',
      message: `Flow node ${node.id} requires object configuration.`,
      nodeId: node.id,
    })
    return undefined
  }
  const allowedKeys = new Set(allowed)
  for (const key of Object.keys(node.config)) {
    if (!allowedKeys.has(key)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_NODE_CONFIG_UNSUPPORTED',
        message: `Flow node ${node.id} configuration key ${key} cannot be represented.`,
        nodeId: node.id,
      })
    }
  }
  return node.config
}

function validateJoinNode(join: ConfigFormFlowNode, ownerId: string, context: ParseContext): void {
  const reactions = join.config?.reactions
  if (
    join.type !== 'reaction'
    || join.ref !== undefined
    || join.policy !== undefined
    || !Array.isArray(reactions)
    || reactions.length !== 0
    || Object.keys(join.config ?? {}).length !== 1
  ) {
    context.diagnostics.push({
      code: 'FLOW_AUTHORING_INTERNAL_NODE_INVALID',
      message: `Condition ${ownerId} has a malformed internal join.`,
      nodeId: join.id,
    })
  }
}

function getOnlyEdge(
  context: ParseContext,
  node: ConfigFormFlowNode,
  condition: ConfigFormFlowEdgeCondition,
): ConfigFormFlowEdge | undefined {
  const edges = (context.outgoing.get(node.id) ?? []).filter(edge => (edge.condition ?? 'next') === condition)
  const unexpected = (context.outgoing.get(node.id) ?? []).filter((edge) => {
    const outlet = edge.condition ?? 'next'
    if (node.type === 'condition')
      return outlet !== 'true' && outlet !== 'false'
    return outlet !== 'next'
  })
  if (unexpected.length > 0) {
    context.diagnostics.push(...unexpected.map(edge => ({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED_EDGE',
      message: `Edge outlet ${edge.condition ?? 'next'} cannot be represented by ordered steps.`,
      nodeId: node.id,
      edgeId: edge.id,
    })))
  }
  if (edges.length !== 1) {
    context.diagnostics.push({
      code: 'FLOW_AUTHORING_GRAPH_UNSUPPORTED_EDGE',
      message: `Node ${node.id} requires exactly one ${condition} edge for ordered authoring.`,
      nodeId: node.id,
    })
    return undefined
  }
  return edges[0]
}

function remapStepSequence(
  steps: readonly ConfigFormFlowStep[],
  ids: ReadonlyMap<string, string>,
  path: string,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): ConfigFormFlowStep[] {
  return steps.map((step, index) => {
    const stepPath = `${path}.${index}`
    const id = ids.get(step.id)!
    if (step.type === 'action') {
      return {
        id,
        type: 'action',
        ref: step.ref,
        ...(step.title === undefined ? {} : { title: step.title }),
        ...(step.input === undefined
          ? {}
          : {
              input: cloneAndRemap(step.input, ids, `${stepPath}.input`, 'flow-input', diagnostics) as ConfigFormFlowActionStep['input'],
            }),
        ...(step.output === undefined
          ? {}
          : {
              output: cloneAndRemap(step.output, ids, `${stepPath}.output`, 'flow-input', diagnostics) as ConfigFormFlowActionStep['output'],
            }),
        ...(step.policy === undefined
          ? {}
          : {
              policy: cloneAndRemap(step.policy, ids, `${stepPath}.policy`, 'reaction', diagnostics) as ConfigFormFlowStepPolicy,
            }),
      }
    }
    if (step.type === 'reaction') {
      return {
        id,
        type: 'reaction',
        reactions: cloneAndRemap(step.reactions, ids, `${stepPath}.reactions`, 'reaction', diagnostics) as ConfigFormFlowReactionStep['reactions'],
        ...(step.title === undefined ? {} : { title: step.title }),
        ...(step.policy === undefined
          ? {}
          : {
              policy: cloneAndRemap(step.policy, ids, `${stepPath}.policy`, 'reaction', diagnostics) as ConfigFormFlowStepPolicy,
            }),
      }
    }
    if (step.type === 'condition') {
      return {
        id,
        type: 'condition',
        when: cloneAndRemap(step.when, ids, `${stepPath}.when`, 'reaction', diagnostics) as ConfigFormFlowConditionStep['when'],
        then: remapStepSequence(step.then, ids, `${stepPath}.then`, diagnostics),
        else: remapStepSequence(step.else, ids, `${stepPath}.else`, diagnostics),
        ...(step.title === undefined ? {} : { title: step.title }),
      }
    }
    return {
      id,
      type: 'terminate',
      outcome: step.outcome,
      ...(step.title === undefined ? {} : { title: step.title }),
    }
  })
}

function cloneAndRemap(
  value: unknown,
  ids: ReadonlyMap<string, string>,
  path: string,
  mode: RemapMode,
  diagnostics: ConfigFormFlowAuthoringDiagnostic[],
): unknown {
  if (Array.isArray(value))
    return value.map((item, index) => cloneAndRemap(item, ids, `${path}.${index}`, mode, diagnostics))
  if (!value || typeof value !== 'object')
    return value
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (mode === 'flow-input' && keys.length === 1 && keys[0] === '$ref') {
    try {
      return remapConfigFormValueReferences(value as ConfigFormValueInput, { outputs: ids })
    }
    catch (cause) {
      diagnostics.push({
        code: cause instanceof ConfigFormValueReferenceError ? cause.code : 'FLOW_AUTHORING_REFERENCE_INVALID',
        message: cause instanceof Error ? cause.message : 'Flow value reference is invalid.',
        path: cause instanceof ConfigFormValueReferenceError ? prefixValuePath(path, cause.path) : path,
      })
      return cloneValue(value)
    }
  }
  if (mode === 'flow-input' && keys.length === 1 && keys[0] === '$output' && typeof record.$output === 'string')
    return { $output: ids.get(record.$output) ?? record.$output }
  if (mode === 'flow-input' && keys.length === 1 && keys[0] === '$expression' && typeof record.$expression === 'string') {
    const result = remapConfigFormExpressionOutputs(record.$expression, ids, `${path}.$expression`)
    diagnostics.push(...result.diagnostics)
    return { $expression: result.source }
  }

  const result: Record<string, unknown> = {}
  for (const key of keys) {
    let child = record[key]
    if (mode === 'reaction' && key === 'expression' && record.kind === 'expression' && typeof child === 'string') {
      const remapped = remapConfigFormExpressionOutputs(child, ids, `${path}.expression`)
      diagnostics.push(...remapped.diagnostics)
      child = remapped.source
    }
    else {
      child = cloneAndRemap(child, ids, `${path}.${key}`, mode, diagnostics)
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: child,
      writable: true,
    })
  }
  return result
}

function findStep(steps: readonly ConfigFormFlowStep[], id: string): ConfigFormFlowStep | undefined {
  const stack = [...steps].reverse()
  while (stack.length > 0) {
    const step = stack.pop()!
    if (step.id === id)
      return step
    if (step.type === 'condition') {
      for (let index = step.else.length - 1; index >= 0; index -= 1)
        stack.push(step.else[index]!)
      for (let index = step.then.length - 1; index >= 0; index -= 1)
        stack.push(step.then[index]!)
    }
  }
  return undefined
}

function getGeneratedIdCollisions(steps: readonly ConfigFormFlowStep[]): ConfigFormFlowAuthoringDiagnostic[] {
  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const stack = [...steps].reverse()
  while (stack.length > 0) {
    const step = stack.pop()!
    if (step.id.startsWith(INTERNAL_PREFIX)) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_GENERATED_ID_COLLISION',
        message: `Flow step id ${step.id} collides with the generated authoring namespace.`,
        stepId: step.id,
      })
    }
    if (step.type === 'condition') {
      for (let index = step.else.length - 1; index >= 0; index -= 1)
        stack.push(step.else[index]!)
      for (let index = step.then.length - 1; index >= 0; index -= 1)
        stack.push(step.then[index]!)
    }
  }
  return diagnostics
}

function addEdge(
  edges: ConfigFormFlowEdge[],
  source: string,
  target: string,
  condition: ConfigFormFlowEdgeCondition,
): void {
  edges.push({
    id: `${INTERNAL_PREFIX}edge:${source.length}:${source}:${condition}`,
    source,
    target,
    condition,
  })
}

function getJoinId(conditionId: string): string {
  return `${INTERNAL_PREFIX}join:${conditionId.length}:${conditionId}`
}

function getStepTitles(steps: readonly ConfigFormFlowStep[]): Map<string, string> {
  const titles = new Map<string, string>()
  const stack = [...steps].reverse()
  while (stack.length > 0) {
    const step = stack.pop()!
    if (step.title !== undefined)
      titles.set(step.id, step.title)
    if (step.type === 'condition') {
      for (let index = step.else.length - 1; index >= 0; index -= 1)
        stack.push(step.else[index]!)
      for (let index = step.then.length - 1; index >= 0; index -= 1)
        stack.push(step.then[index]!)
    }
  }
  return titles
}

function encodeEdgeTitle(title: string | undefined): string {
  if (title === undefined)
    return ':title:n'
  let encoded = ''
  for (let index = 0; index < title.length; index += 1)
    encoded += title.charCodeAt(index).toString(16).padStart(4, '0')
  return `:title:s${encoded}`
}

function readEdgeTitles(edges: readonly ConfigFormFlowEdge[]): {
  diagnostics: ConfigFormFlowAuthoringDiagnostic[]
  titles: Map<string, string>
} {
  const diagnostics: ConfigFormFlowAuthoringDiagnostic[] = []
  const encodedByTarget = new Map<string, string | undefined>()
  for (const edge of edges) {
    const match = /:title:(n|s(?:[0-9a-f]{4})*)$/.exec(edge.id)
    if (!match) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_EDGE_TITLE_INVALID',
        message: `Generated edge ${edge.id} does not contain valid authoring title data.`,
        edgeId: edge.id,
      })
      continue
    }
    const token = match[1]!
    let title: string | undefined
    if (token !== 'n') {
      title = ''
      for (let index = 1; index < token.length; index += 4)
        title += String.fromCharCode(Number.parseInt(token.slice(index, index + 4), 16))
    }
    if (encodedByTarget.has(edge.target) && encodedByTarget.get(edge.target) !== title) {
      diagnostics.push({
        code: 'FLOW_AUTHORING_EDGE_TITLE_CONFLICT',
        message: `Incoming edges for node ${edge.target} contain conflicting authoring titles.`,
        edgeId: edge.id,
        nodeId: edge.target,
      })
    }
    else {
      encodedByTarget.set(edge.target, title)
    }
  }
  return {
    diagnostics,
    titles: new Map([...encodedByTarget].filter((entry): entry is [string, string] => entry[1] !== undefined)),
  }
}

function cloneMetadata(metadata: ConfigFormFlowMetadata): ConfigFormFlowMetadata {
  return {
    version: metadata.version,
    id: metadata.id,
    name: metadata.name,
    trigger: cloneValue(metadata.trigger),
    ...(metadata.concurrency === undefined ? {} : { concurrency: metadata.concurrency }),
    ...(metadata.errorPolicy === undefined ? {} : { errorPolicy: cloneValue(metadata.errorPolicy) }),
  }
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
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

function isUnsafeId(id: string): boolean {
  return id === '__proto__' || id === 'prototype' || id === 'constructor' || id.startsWith(INTERNAL_PREFIX)
}
