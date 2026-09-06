import type {
  LayoutNode,
  NodeId,
  PageGraph,
  PageId,
  PageNode,
  ProjectNodeRelation,
  RegistryContractComponentSnapshot,
  SlotName,
} from '@moluoxixi/config-form-model'
import type { CanonicalFieldNodeIR, CanonicalNodeIR, CanonicalNodePlacement, SemanticCompilerDiagnostic } from '../../../types'
import type { CompilePageContext } from '../types'
import { clone, mergeComponentProps, semanticHash } from '../../../utils'

export function resolveCanonicalPlacement(
  graph: PageGraph,
  nodeId: NodeId,
  relation: ProjectNodeRelation,
  diagnostics: SemanticCompilerDiagnostic[],
  pageId: PageId,
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
      message: `Incremental node relation does not match the page graph: ${nodeId}`,
      pageId,
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
  context: CompilePageContext,
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
        ? `Page graph references an unknown node: ${nodeId}`
        : !component
            ? `Component is not present in the registry snapshot: ${node.component}`
            : `Component ${node.component} does not support node kind ${node.kind}.`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  const common = compileNodeBase(node, component, placement, context.flowEvents.get(node.id))
  if (node.kind === 'field') {
    const semanticNode = compileFieldSemanticNode(node, common)
    return { ...semanticNode, subtreeHash: semanticHash(semanticNode) } as CanonicalNodeIR
  }

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
        message: `Page graph references an unknown node: ${item.nodeId}`,
        pageId: context.pageId,
        nodeId: item.nodeId,
      })
      return []
    })
  }
  const semanticNode = { ...common, kind: 'layout', slots }
  return {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  } as CanonicalNodeIR
}

export function compileNode(
  context: CompilePageContext,
  nodeId: NodeId,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR | undefined {
  const node = context.graph.nodesById[nodeId]
  if (!node) {
    context.diagnostics.push({
      code: 'COMPILER_NODE_UNKNOWN',
      message: `Page graph references an unknown node: ${nodeId}`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  const component = context.registry.get(node.component)
  if (!component) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_UNKNOWN',
      message: `Component is not present in the registry snapshot: ${node.component}`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  if (component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: `Component ${node.component} does not support node kind ${node.kind}.`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }

  const common = compileNodeBase(node, component, placement, context.flowEvents.get(node.id))
  if (node.kind === 'field') {
    const semanticNode = compileFieldSemanticNode(node, common)
    const compiled = {
      ...semanticNode,
      subtreeHash: semanticHash(semanticNode),
    } as CanonicalNodeIR
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
  const semanticNode = { ...common, kind: 'layout', slots }
  const compiled = {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  } as CanonicalNodeIR
  context.nodesById[node.id] = compiled
  return compiled
}

function compileFieldSemanticNode(
  node: Extract<PageNode, { kind: 'field' }>,
  common: ReturnType<typeof compileNodeBase>,
): Omit<CanonicalFieldNodeIR, 'subtreeHash'> {
  return {
    ...common,
    kind: 'field',
    field: node.field,
    ...(node.label === undefined ? {} : { label: node.label }),
    ...(node.defaultValue === undefined ? {} : { defaultValue: clone(node.defaultValue) }),
    ...(node.validation === undefined ? {} : { validation: clone(node.validation) }),
    ...(node.validateOn === undefined ? {} : { validateOn: clone(node.validateOn) }),
  }
}

function compileNodeBase(
  node: PageNode,
  component: RegistryContractComponentSnapshot,
  placement: CanonicalNodePlacement,
  flowEvents?: readonly string[],
) {
  return {
    id: node.id,
    component: node.component,
    componentVersion: component.contractVersion,
    componentFingerprint: component.fingerprint,
    placement,
    configuredProps: clone(node.props),
    props: mergeComponentProps(component.contract.defaults, node.props),
    events: clone(node.events),
    bindings: clone(node.bindings),
    ...(flowEvents?.length ? { flowEvents: [...flowEvents] } : {}),
    ...(node.extensions === undefined ? {} : { extensions: clone(node.extensions) }),
    ...(node.conditions === undefined ? {} : { conditions: clone(node.conditions) }),
    ...(node.reactions === undefined ? {} : { reactions: clone(node.reactions) }),
  }
}

function validateSlot(
  contract: RegistryContractComponentSnapshot['contract'],
  node: LayoutNode,
  slotName: string,
  context: CompilePageContext,
): boolean {
  if (contract.slots.some(slot => slot.name === slotName))
    return true
  context.diagnostics.push({
    code: 'COMPILER_SLOT_UNKNOWN',
    message: `Component ${node.component} does not declare slot ${slotName}.`,
    pageId: context.pageId,
    nodeId: node.id,
  })
  return false
}
