import type {
  DeepReadonly,
  LayoutNode,
  NodeId,
  ProjectNodeRelation,
  RegistryContractComponentSnapshot,
  SlotName,
  SurfaceGraph,
  SurfaceId,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalFieldNodeIR,
  CanonicalNodeIR,
  CanonicalNodePlacement,
  SemanticCompilerDiagnostic,
} from '../../../types'
import type { CompileSurfaceContext } from '../types'
import { normalizeConfigFormValidateOn } from '@moluoxixi/config-form-core'
import { clone, cloneJsonObject, mergeComponentProps, semanticHash } from '../../../utils'

export function resolveCanonicalPlacement(
  graph: DeepReadonly<SurfaceGraph>,
  nodeId: NodeId,
  relation: ProjectNodeRelation,
  diagnostics: SemanticCompilerDiagnostic[],
  surfaceId: SurfaceId,
): CanonicalNodePlacement | undefined {
  const parent = relation.parentId === null ? undefined : graph.nodesById[relation.parentId]
  const sequence = relation.parentId === null
    ? graph.root
    : parent?.kind === 'layout'
      ? parent.slots[relation.slot ?? 'default']
      : undefined
  const item = sequence?.find(candidate => candidate.nodeId === nodeId)
  if (!item) {
    diagnostics.push({
      code: 'COMPILER_NODE_RELATION_MISMATCH',
      message: `Incremental node relation does not match the Surface graph: ${nodeId}`,
      surfaceId,
      nodeId,
    })
    return undefined
  }
  return {
    parentId: relation.parentId,
    slot: relation.parentId === null ? null : (relation.slot ?? 'default'),
    props: clone(item.placement),
  }
}

export function compileNodeShallow(
  context: CompileSurfaceContext,
  nodeId: NodeId,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR | undefined {
  const node = context.graph.nodesById[nodeId]
  const component = node ? context.registry.get(node.component) : undefined
  if (!node || !component || component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: !node
        ? 'COMPILER_NODE_UNKNOWN'
        : !component
            ? 'COMPILER_COMPONENT_UNKNOWN'
            : 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: !node
        ? `Surface graph references an unknown node: ${nodeId}`
        : !component
            ? `Component is not present in the registry snapshot: ${node.component}`
            : `Component ${node.component} does not support node kind ${node.kind}.`,
      surfaceId: context.surfaceId,
      nodeId,
    })
    return undefined
  }
  return compileKnownNodeShallow(context, node, component, placement)
}

export function compileNode(
  context: CompileSurfaceContext,
  nodeId: NodeId,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR | undefined {
  const node = context.graph.nodesById[nodeId]
  if (!node) {
    context.diagnostics.push({
      code: 'COMPILER_NODE_UNKNOWN',
      message: `Surface graph references an unknown node: ${nodeId}`,
      surfaceId: context.surfaceId,
      nodeId,
    })
    return undefined
  }
  const component = context.registry.get(node.component)
  if (!component) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_UNKNOWN',
      message: `Component is not present in the registry snapshot: ${node.component}`,
      surfaceId: context.surfaceId,
      nodeId,
    })
    return undefined
  }
  if (component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: `Component ${node.component} does not support node kind ${node.kind}.`,
      surfaceId: context.surfaceId,
      nodeId,
    })
    return undefined
  }

  if (node.kind !== 'layout') {
    const compiled = compileLeafNode(node, component, placement)
    context.nodesById[node.id] = compiled
    return compiled
  }

  const slots: Record<SlotName, NodeId[]> = Object.create(null)
  const childHashes: Record<SlotName, string[]> = Object.create(null)
  Object.entries(node.slots).forEach(([slotName, children]) => {
    if (!validateSlot(component.contract, node, slotName, context))
      return
    slots[slotName] = children.map(item => item.nodeId)
    childHashes[slotName] = children.flatMap((item) => {
      const child = compileNode(context, item.nodeId, {
        parentId: node.id,
        slot: slotName,
        props: clone(item.placement),
      })
      return child ? [child.subtreeHash] : []
    })
  })
  const semanticNode = {
    ...compileNodeBase(node, component, placement),
    kind: 'layout' as const,
    slots,
    ...(node.valueScope === undefined ? {} : { valueScope: clone(node.valueScope) }),
  }
  const compiled: CanonicalNodeIR = {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  }
  context.nodesById[node.id] = compiled
  return compiled
}

function compileKnownNodeShallow(
  context: CompileSurfaceContext,
  node: DeepReadonly<SurfaceNode>,
  component: RegistryContractComponentSnapshot,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR {
  if (node.kind !== 'layout')
    return compileLeafNode(node, component, placement)

  const slots: Record<SlotName, NodeId[]> = Object.create(null)
  const childHashes: Record<SlotName, string[]> = Object.create(null)
  for (const [slotName, children] of Object.entries(node.slots)) {
    if (!validateSlot(component.contract, node, slotName, context))
      continue
    slots[slotName] = children.map(item => item.nodeId)
    childHashes[slotName] = children.flatMap((item) => {
      const child = context.nodesById[item.nodeId]
      if (child)
        return [child.subtreeHash]
      context.diagnostics.push({
        code: 'COMPILER_NODE_UNKNOWN',
        message: `Surface graph references an unknown node: ${item.nodeId}`,
        surfaceId: context.surfaceId,
        nodeId: item.nodeId,
      })
      return []
    })
  }
  const semanticNode = {
    ...compileNodeBase(node, component, placement),
    kind: 'layout' as const,
    slots,
    ...(node.valueScope === undefined ? {} : { valueScope: clone(node.valueScope) }),
  }
  return {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  }
}

function compileLeafNode(
  node: DeepReadonly<Exclude<SurfaceNode, { kind: 'layout' }>>,
  component: RegistryContractComponentSnapshot,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR {
  if (node.kind === 'field') {
    const semanticNode = compileFieldSemanticNode(node, compileNodeBase(node, component, placement))
    return { ...semanticNode, subtreeHash: semanticHash(semanticNode) }
  }
  const semanticNode = {
    ...compileNodeBase(node, component, placement),
    kind: 'element' as const,
  }
  return { ...semanticNode, subtreeHash: semanticHash(semanticNode) }
}

function compileFieldSemanticNode(
  node: DeepReadonly<Extract<SurfaceNode, { kind: 'field' }>>,
  common: ReturnType<typeof compileNodeBase>,
): Omit<CanonicalFieldNodeIR, 'subtreeHash'> {
  return {
    ...common,
    kind: 'field',
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: clone(node.defaultValue) }),
    ...(node.validation === undefined
      ? {}
      : { validation: clone(node.validation) as unknown as CanonicalFieldNodeIR['validation'] }),
    validateOn: normalizeConfigFormValidateOn(node.validateOn),
  }
}

function compileNodeBase(
  node: DeepReadonly<SurfaceNode>,
  component: RegistryContractComponentSnapshot,
  placement: CanonicalNodePlacement,
) {
  return {
    id: node.id,
    component: node.component,
    componentVersion: component.contractVersion,
    componentFingerprint: component.fingerprint,
    placement,
    configuredProps: clone(node.props),
    props: mergeComponentProps(component.contract.defaults, cloneJsonObject(node.props)),
    ...(node.datasetBindings === undefined ? {} : { datasetBindings: clone(node.datasetBindings) }),
    ...(node.resourceBindings === undefined ? {} : { resourceBindings: clone(node.resourceBindings) }),
    ...(node.extensions === undefined ? {} : { extensions: clone(node.extensions) }),
  }
}

function validateSlot(
  contract: RegistryContractComponentSnapshot['contract'],
  node: DeepReadonly<LayoutNode>,
  slotName: string,
  context: CompileSurfaceContext,
): boolean {
  if (contract.slots.some(slot => slot.name === slotName))
    return true
  context.diagnostics.push({
    code: 'COMPILER_SLOT_UNKNOWN',
    message: `Component ${node.component} does not declare slot ${slotName}.`,
    surfaceId: context.surfaceId,
    nodeId: node.id,
  })
  return false
}
