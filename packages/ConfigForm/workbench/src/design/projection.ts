import type { CanonicalPageIR } from '@moluoxixi/config-form-compiler'
import type {
  DesignerDocument,
  DesignerFieldNode,
  DesignerNode,
} from '@moluoxixi/config-form-designer'
import type { ProjectPage } from '@moluoxixi/config-form-model'

/**
 * Stateless compatibility projection for the current DesignSurface API.
 *
 * ProjectPage/CanonicalPageIR remain the source of truth. The returned
 * DesignerDocument is disposable UI input and must never be persisted or
 * mutated back into the project store.
 */
export function projectPageToDesignerDocument(page: ProjectPage): DesignerDocument {
  const graph = page.graph
  const materialize = (nodeId: string, seen = new Set<string>()): DesignerNode => {
    if (seen.has(nodeId))
      throw new TypeError(`PROJECT_NODE_CYCLE: Page graph contains a cycle at ${nodeId}.`)
    const node = graph.nodesById[nodeId]
    if (!node)
      throw new TypeError(`PROJECT_NODE_UNKNOWN: Page graph does not contain node ${nodeId}.`)
    const nextSeen = new Set(seen)
    nextSeen.add(nodeId)
    const common = {
      id: node.id,
      material: node.component,
      ...(Object.keys(node.props).length > 0 ? { props: structuredClone(node.props) as DesignerNode['props'] } : {}),
      ...(Object.keys(node.events).length > 0 ? { events: structuredClone(node.events) as DesignerNode['events'] } : {}),
      ...(Object.keys(node.bindings).length > 0 ? { bindings: structuredClone(node.bindings) as DesignerNode['bindings'] } : {}),
      ...(node.extensions ? { extensions: structuredClone(node.extensions) as DesignerNode['extensions'] } : {}),
      ...(node.conditions ? { conditions: structuredClone(node.conditions) as DesignerNode['conditions'] } : {}),
      ...(node.reactions ? { reactions: structuredClone(node.reactions) as DesignerNode['reactions'] } : {}),
    }
    if (node.kind === 'field') {
      return {
        ...common,
        kind: 'field',
        field: node.field,
        ...(node.label === undefined ? {} : { label: node.label }),
        ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) as DesignerFieldNode['defaultValue'] }),
        ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) as DesignerFieldNode['validation'] }),
        ...(node.validateOn === undefined ? {} : { validateOn: structuredClone(node.validateOn) as DesignerFieldNode['validateOn'] }),
      }
    }

    const slots = Object.fromEntries(Object.entries(node.slots).map(([slotName, items]) => [
      slotName,
      items.map(item => materialize(item.nodeId, nextSeen)),
    ]))
    return { ...common, kind: 'container', slots }
  }

  return {
    version: 1,
    form: structuredClone(graph.form),
    nodes: graph.root.map(item => materialize(item.nodeId)),
  }
}

/** Build the same disposable DesignSurface shape from the canonical page IR. */
export function canonicalPageToDesignerDocument(page: CanonicalPageIR): DesignerDocument {
  const materialize = (nodeId: string, seen = new Set<string>()): DesignerNode => {
    if (seen.has(nodeId))
      throw new TypeError(`RUNTIME_IR_CYCLE: Canonical page contains a cycle at ${nodeId}.`)
    const node = page.nodesById[nodeId]
    if (!node)
      throw new TypeError(`RUNTIME_IR_NODE_UNKNOWN: Canonical page does not contain node ${nodeId}.`)
    const nextSeen = new Set(seen)
    nextSeen.add(nodeId)
    const span = node.placement.props.span
    const common = {
      id: node.id,
      material: node.component,
      ...(Object.keys(node.configuredProps).length > 0 ? { props: structuredClone(node.configuredProps) as DesignerNode['props'] } : {}),
      ...(Object.keys(node.events).length > 0 ? { events: structuredClone(node.events) as DesignerNode['events'] } : {}),
      ...(Object.keys(node.bindings).length > 0 ? { bindings: structuredClone(node.bindings) as DesignerNode['bindings'] } : {}),
      ...(node.extensions ? { extensions: structuredClone(node.extensions) as DesignerNode['extensions'] } : {}),
      ...(typeof span === 'number' ? { span } : {}),
      ...(node.conditions ? { conditions: structuredClone(node.conditions) as DesignerNode['conditions'] } : {}),
      ...(node.reactions ? { reactions: structuredClone(node.reactions) as DesignerNode['reactions'] } : {}),
    }
    if (node.kind === 'field') {
      return {
        ...common,
        kind: 'field',
        field: node.field,
        ...(node.label === undefined ? {} : { label: node.label }),
        ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) as DesignerFieldNode['defaultValue'] }),
        ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) as DesignerFieldNode['validation'] }),
        ...(node.validateOn === undefined ? {} : { validateOn: structuredClone(node.validateOn) as DesignerFieldNode['validateOn'] }),
      }
    }
    const slots = Object.fromEntries(Object.entries(node.slots).map(([slotName, childIds]) => [
      slotName,
      childIds.map(childId => materialize(childId, nextSeen)),
    ]))
    return { ...common, kind: 'container', slots }
  }

  return {
    version: 1,
    form: structuredClone(page.form),
    nodes: page.rootIds.map(nodeId => materialize(nodeId)),
  }
}

export function createPreviewModel(document: DesignerDocument): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const visit = (nodes: DesignerNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field' && node.defaultValue !== undefined)
        values[node.field] = structuredClone(node.defaultValue)
      if (node.kind === 'container')
        Object.values(node.slots).forEach(visit)
    })
  }
  visit(document.nodes)
  return values
}

export function mergePreviewModel(
  document: DesignerDocument,
  current: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const fields = new Set<string>()
  const visit = (nodes: DesignerNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field')
        fields.add(node.field)
      else
        Object.values(node.slots).forEach(visit)
    })
  }
  visit(document.nodes)

  const next: Record<string, unknown> = {}
  fields.forEach((field) => {
    if (Object.hasOwn(current, field))
      next[field] = structuredClone(current[field])
    else if (Object.hasOwn(defaults, field))
      next[field] = structuredClone(defaults[field])
  })
  return next
}
