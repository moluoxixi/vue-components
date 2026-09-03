import type { ComponentContract, ComponentContractRegistry, LayoutNode, NodeId, PageNode, ProjectDocument, ProjectPage } from '../../../types'
import type { ValidationPlan } from '../types'
import { invalid } from '../errors'
import { requireNodeLocation } from '../services/graph'

export function validateDocumentAgainstRegistry(
  document: ProjectDocument,
  registry: ComponentContractRegistry,
  plan: ValidationPlan,
): void {
  plan.registryPageIds.forEach((pageId) => {
    const page = document.pagesById[pageId]
    if (page)
      validatePageAgainstRegistry(page, registry)
  })

  plan.registryNodeIdsByPage.forEach((nodeIds, pageId) => {
    if (plan.registryPageIds.has(pageId))
      return
    const page = document.pagesById[pageId]
    if (!page)
      return
    nodeIds.forEach((nodeId) => {
      const node = page.graph.nodesById[nodeId]
      if (!node)
        return
      const contract = requireComponentContract(registry, page, node)
      validateNodeContract(page, node, contract)
      if (node.kind === 'layout')
        validateLayoutSlots(page, node, contract, registry)
    })
  })

  plan.registryPlacementIdsByPage.forEach((nodeIds, pageId) => {
    if (plan.registryPageIds.has(pageId))
      return
    const page = document.pagesById[pageId]
    if (page)
      nodeIds.forEach(nodeId => validateNodePlacement(page, nodeId, registry))
  })
}

export function validateRegistryLock(document: ProjectDocument, registry: ComponentContractRegistry): void {
  if (document.registryLock.adapter !== registry.lock.adapter)
    invalid('PROJECT_REGISTRY_ADAPTER_MISMATCH', 'Project registry adapter does not match the active component registry.')
  if (document.registryLock.version !== registry.lock.version)
    invalid('PROJECT_REGISTRY_VERSION_MISMATCH', 'Project registry version does not match the active component registry.')
  const projectComponents = Object.keys(document.registryLock.components).sort((left, right) => left.localeCompare(right))
  const registryComponents = Object.keys(registry.lock.components).sort((left, right) => left.localeCompare(right))
  if (
    projectComponents.length !== registryComponents.length
    || projectComponents.some((component, index) => component !== registryComponents[index])
  ) {
    invalid('PROJECT_REGISTRY_COMPONENT_SET_MISMATCH', 'Project registry lock must contain every component in the active Registry.')
  }
  if (document.registryLock.fingerprint !== registry.lock.fingerprint)
    invalid('PROJECT_REGISTRY_FINGERPRINT_MISMATCH', 'Project registry fingerprint does not match the active component registry.')
  const usedComponents = new Set(Object.values(document.pagesById)
    .flatMap(page => Object.values(page.graph.nodesById).map(node => node.component)))
  for (const component of usedComponents) {
    if (!registry.lock.components[component])
      invalid('PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${component}`)
  }
  for (const component of registryComponents) {
    const expected = document.registryLock.components[component]
    const actual = registry.lock.components[component]!
    if (expected.contractVersion !== actual.contractVersion) {
      invalid(
        'PROJECT_REGISTRY_COMPONENT_VERSION_MISMATCH',
        `Component contract version does not match for ${component}: expected ${expected.contractVersion}, received ${actual.contractVersion}.`,
      )
    }
    if (expected.fingerprint !== actual.fingerprint) {
      invalid(
        'PROJECT_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
        `Component contract fingerprint does not match for ${component}.`,
      )
    }
  }
}

function validatePageAgainstRegistry(page: ProjectPage, registry: ComponentContractRegistry): void {
  const fields = new Set<string>()
  Object.values(page.graph.nodesById).forEach((node) => {
    const contract = requireComponentContract(registry, page, node)
    validateNodeContract(page, node, contract)
    if (node.kind === 'field') {
      if (fields.has(node.field))
        invalid('PROJECT_FIELD_DUPLICATE', `Field name must be unique: ${node.field}`, page.id, node.id)
      fields.add(node.field)
      return
    }
    validateLayoutSlots(page, node, contract, registry)
  })
  page.graph.root.forEach((item) => {
    const node = page.graph.nodesById[item.nodeId]
    if (!node)
      invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${item.nodeId}`, page.id, item.nodeId)
    const contract = requireComponentContract(registry, page, node)
    if (contract.allowedParents.length > 0)
      invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} requires a registered parent slot.`, page.id, node.id)
  })
  validatePageFlowTriggers(page, registry)
}

function validatePageFlowTriggers(page: ProjectPage, registry: ComponentContractRegistry): void {
  for (const flow of page.flows ?? []) {
    if (flow.trigger.kind !== 'component.event')
      continue
    const nodeId = flow.trigger.nodeId
    const eventName = flow.trigger.event
    const node = nodeId ? page.graph.nodesById[nodeId] : undefined
    if (!node)
      invalid('PROJECT_FLOW_TRIGGER_NODE_UNKNOWN', `Flow trigger node does not exist: ${nodeId ?? '<missing>'}`, page.id, nodeId)
    const contract = requireComponentContract(registry, page, node)
    if (!eventName || !contract.events.some(event => event.name === eventName)) {
      invalid(
        'PROJECT_FLOW_TRIGGER_EVENT_UNKNOWN',
        `Event is not registered for ${node.component}: ${eventName ?? '<missing>'}`,
        page.id,
        node.id,
      )
    }
  }
}

function requireComponentContract(
  registry: ComponentContractRegistry,
  page: ProjectPage,
  node: PageNode,
): ComponentContract {
  const contract = registry.get(node.component)
  if (!contract)
    invalid('PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${node.component}`, page.id, node.id)
  if (contract.kind !== node.kind)
    invalid('PROJECT_COMPONENT_KIND_INVALID', `Component kind does not match node ${node.id}.`, page.id, node.id)
  return contract
}

function validateNodeContract(page: ProjectPage, node: PageNode, contract: ComponentContract): void {
  const allowedProps = new Set([
    ...Object.keys(contract.defaults),
    ...contract.props.map(property => property.path[0] === 'props' ? property.path[1] : property.path[0]).filter(Boolean),
  ])
  const unknownProp = Object.keys(node.props).find(key => !allowedProps.has(key))
  if (unknownProp)
    invalid('PROJECT_COMPONENT_PROP_UNKNOWN', `Property is not registered for ${node.component}: ${unknownProp}`, page.id, node.id)
  const eventNames = new Set(contract.events.map(event => event.name))
  const unknownEvent = Object.keys(node.events).find(name => !eventNames.has(name))
  if (unknownEvent)
    invalid('PROJECT_COMPONENT_EVENT_UNKNOWN', `Event is not registered for ${node.component}: ${unknownEvent}`, page.id, node.id)
  const bindingNames = new Set(contract.bindings.map(binding => binding.name))
  const unknownBinding = Object.keys(node.bindings).find(name => !bindingNames.has(name))
  if (unknownBinding)
    invalid('PROJECT_COMPONENT_BINDING_UNKNOWN', `Binding is not registered for ${node.component}: ${unknownBinding}`, page.id, node.id)
}

function validateLayoutSlots(
  page: ProjectPage,
  node: LayoutNode,
  contract: ComponentContract,
  registry: ComponentContractRegistry,
): void {
  Object.entries(node.slots).forEach(([slotName, items]) => {
    const slot = contract.slots.find(candidate => candidate.name === slotName)
    if (!slot)
      invalid('PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${node.component}: ${slotName}`, page.id, node.id)
    items.forEach((item) => {
      const child = page.graph.nodesById[item.nodeId]
      if (!child)
        invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${item.nodeId}`, page.id, item.nodeId)
      if (slot.accepts && !slot.accepts.includes(child.kind))
        invalid('PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.kind}.`, page.id, child.id)
      if (slot.components && !slot.components.includes(child.component))
        invalid('PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.component}.`, page.id, child.id)
      const childContract = requireComponentContract(registry, page, child)
      if (
        childContract.allowedParents.length > 0
        && !childContract.allowedParents.some(parent => parent.component === node.component && parent.slot === slotName)
      ) {
        invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${child.component} is not allowed in ${node.component}.${slotName}.`, page.id, child.id)
      }
    })
  })
}

function validateNodePlacement(
  page: ProjectPage,
  nodeId: NodeId,
  registry: ComponentContractRegistry,
): void {
  const node = page.graph.nodesById[nodeId]
  if (!node)
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}`, page.id, nodeId)
  const contract = requireComponentContract(registry, page, node)
  const location = requireNodeLocation(page.graph, nodeId, page.id)
  if (location.parentId === null) {
    if (contract.allowedParents.length > 0)
      invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} requires a registered parent slot.`, page.id, node.id)
    return
  }

  const parent = page.graph.nodesById[location.parentId]
  if (!parent || parent.kind !== 'layout')
    invalid('PROJECT_TARGET_PARENT_INVALID', `Target parent is not a layout: ${location.parentId}`, page.id, location.parentId)
  const parentContract = requireComponentContract(registry, page, parent)
  const slotName = location.slot ?? 'default'
  const slot = parentContract.slots.find(candidate => candidate.name === slotName)
  if (!slot)
    invalid('PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${parent.component}: ${slotName}`, page.id, parent.id)
  if (slot.accepts && !slot.accepts.includes(node.kind))
    invalid('PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.kind}.`, page.id, node.id)
  if (slot.components && !slot.components.includes(node.component))
    invalid('PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.component}.`, page.id, node.id)
  if (
    contract.allowedParents.length > 0
    && !contract.allowedParents.some(candidate => candidate.component === parent.component && candidate.slot === slotName)
  ) {
    invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} is not allowed in ${parent.component}.${slotName}.`, page.id, node.id)
  }
}
