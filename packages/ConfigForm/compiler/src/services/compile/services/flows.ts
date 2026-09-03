import type {
  ConfigFormFlow,
  ConfigFormFlowDiagnostic,
  ConfigFormReaction,
  ConfigFormReactionEffect,
} from '@moluoxixi/config-form-core'
import type { NodeId, PageGraph, PageId, RegistryContractComponentSnapshot } from '@moluoxixi/config-form-model'
import type { CanonicalFlowIR, SemanticCompilerDiagnostic } from '../../../types'
import { analyzeConfigFormFlow, getConfigFormFlowSemanticHash } from '@moluoxixi/config-form-core'
import { withoutFlowPositions } from '../../../utils'

export function compileFlows(
  flows: ConfigFormFlow[],
  pageId: string,
  diagnostics: SemanticCompilerDiagnostic[],
  graph: PageGraph,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
): CanonicalFlowIR[] {
  const declaredReactionCapabilities = collectGraphReactionCapabilities(graph)
  return flows.flatMap((flow) => {
    const semanticFlow = withoutFlowPositions(flow)
    const result = analyzeConfigFormFlow(semanticFlow)
    if (!result.success) {
      diagnostics.push(...result.diagnostics.map(diagnostic => flowDiagnostic(pageId, diagnostic)))
      return []
    }
    if (semanticFlow.trigger.kind === 'component.event') {
      const target = semanticFlow.trigger.nodeId ? graph.nodesById[semanticFlow.trigger.nodeId] : undefined
      if (!target) {
        diagnostics.push({
          code: 'COMPILER_FLOW_TRIGGER_NODE_UNKNOWN',
          message: `Flow component.event trigger references an unknown node: ${semanticFlow.trigger.nodeId ?? '<missing>'}.`,
          pageId,
          path: ['flows', flow.id, 'trigger', 'nodeId'],
        })
        return []
      }
      const contract = registry.get(target.component)
      if (!contract || !semanticFlow.trigger.event || !contract.contract.events.some(event => event.name === semanticFlow.trigger.event)) {
        diagnostics.push({
          code: 'COMPILER_FLOW_TRIGGER_EVENT_UNKNOWN',
          message: `Flow component.event trigger references an unregistered event: ${semanticFlow.trigger.event ?? '<missing>'}.`,
          pageId,
          nodeId: target.id,
          path: ['flows', flow.id, 'trigger', 'event'],
        })
        return []
      }
    }
    const capabilityDiagnostic = diagnoseFlowCapabilityConflict(
      semanticFlow,
      graph,
      registry,
      declaredReactionCapabilities,
      pageId,
    )
    if (capabilityDiagnostic) {
      diagnostics.push(capabilityDiagnostic)
      return []
    }
    return [{
      semanticHash: getConfigFormFlowSemanticHash(semanticFlow),
      plan: result.plan,
    }]
  })
}

export function collectFlowEvents(flows: readonly CanonicalFlowIR[]): ReadonlyMap<NodeId, readonly string[]> {
  const eventsByNode = new Map<NodeId, Set<string>>()
  for (const flow of flows) {
    const trigger = flow.plan.trigger
    if (trigger.kind !== 'component.event' || !trigger.nodeId || !trigger.event)
      continue
    const events = eventsByNode.get(trigger.nodeId) ?? new Set<string>()
    events.add(trigger.event)
    eventsByNode.set(trigger.nodeId, events)
  }
  return new Map([...eventsByNode].map(([nodeId, events]) => [nodeId, [...events].sort()]))
}

function diagnoseFlowCapabilityConflict(
  flow: ConfigFormFlow,
  graph: PageGraph,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  declaredReactionCapabilities: ReadonlySet<string>,
  pageId: PageId,
): SemanticCompilerDiagnostic | undefined {
  const flowCapabilities = collectFlowReactionCapabilities(flow)
  const duplicate = [...flowCapabilities].sort().find(capability => declaredReactionCapabilities.has(capability))
  if (duplicate) {
    return {
      code: 'COMPILER_FLOW_REACTION_CAPABILITY_CONFLICT',
      message: `Flow "${flow.id}" and a declarative reaction both own ${describeReactionCapability(duplicate)}. Keep synchronous state ownership in one mechanism.`,
      pageId,
      path: ['flows', flow.id, 'nodes'],
    }
  }

  const hasReaction = flow.nodes.some(node => node.type === 'reaction')
  const hasBranchOrAction = flow.nodes.some(node => node.type === 'condition' || node.type === 'action')
  if (!hasReaction || hasBranchOrAction)
    return undefined
  if (flow.trigger.kind === 'field.change') {
    return {
      code: 'COMPILER_FLOW_SYNC_REACTION_REDUNDANT',
      message: `Flow "${flow.id}" contains only synchronous form updates for field.change. Use a declarative reaction instead.`,
      pageId,
      path: ['flows', flow.id],
    }
  }
  if (flow.trigger.kind !== 'component.event' || !flow.trigger.nodeId || !flow.trigger.event)
    return undefined
  const node = graph.nodesById[flow.trigger.nodeId]
  const contract = node ? registry.get(node.component)?.contract : undefined
  const bindingEvent = contract?.bindings.some(binding => (
    Object.hasOwn(node.bindings, binding.name)
    && binding.trigger === flow.trigger.event
  ))
  if (!bindingEvent)
    return undefined
  return {
    code: 'COMPILER_FLOW_BINDING_REACTION_REDUNDANT',
    message: `Flow "${flow.id}" duplicates a bound value event with synchronous form updates. Keep the value binding and use a declarative reaction.`,
    pageId,
    nodeId: node?.id,
    path: ['flows', flow.id],
  }
}

function collectGraphReactionCapabilities(graph: PageGraph): ReadonlySet<string> {
  const capabilities = new Set<string>()
  for (const node of Object.values(graph.nodesById))
    collectReactionCapabilities(node.reactions ?? [], capabilities)
  return capabilities
}

function collectFlowReactionCapabilities(flow: ConfigFormFlow): ReadonlySet<string> {
  const capabilities = new Set<string>()
  for (const node of flow.nodes) {
    if (node.type !== 'reaction' || !Array.isArray(node.config?.reactions))
      continue
    collectReactionCapabilities(node.config.reactions as unknown as ConfigFormReaction[], capabilities)
  }
  return capabilities
}

function collectReactionCapabilities(
  reactions: readonly ConfigFormReaction[],
  capabilities: Set<string>,
): void {
  for (const reaction of reactions) {
    if (reaction.enabled === false)
      continue
    for (const effect of [...reaction.then, ...(reaction.else ?? [])])
      collectReactionEffectCapabilities(effect, capabilities)
  }
}

function collectReactionEffectCapabilities(
  effect: ConfigFormReactionEffect,
  capabilities: Set<string>,
): void {
  if (effect.kind === 'setValue' || effect.kind === 'clearValue') {
    capabilities.add(`value:${effect.target}`)
    return
  }
  if (effect.kind === 'validate') {
    capabilities.add(`validate:${effect.target}`)
    return
  }
  const values = effect.kind === 'setProps' ? effect.props : effect.state
  const family = effect.kind === 'setProps' ? 'prop' : 'state'
  for (const key of Object.keys(values))
    capabilities.add(`${family}:${effect.target}:${key}`)
}

function describeReactionCapability(capability: string): string {
  const [family, target, key] = capability.split(':')
  if (family === 'value')
    return `the value of field "${target}"`
  if (family === 'validate')
    return `validation of field "${target}"`
  return `${family} "${key}" of field "${target}"`
}

function flowDiagnostic(pageId: string, diagnostic: ConfigFormFlowDiagnostic): SemanticCompilerDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    pageId,
    ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    ...(diagnostic.path ? { path: diagnostic.path.split('.') } : {}),
  }
}
