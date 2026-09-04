import type { CanonicalPageIR, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { WorkspaceFile } from '../../types'
import type { CanonicalSourceBindingResolver } from '../types'
import type {
  StandaloneSourceComponentDefinition,
  StandaloneSourceNode,
  StandaloneSourceNodeBase,
  StandaloneSourcePage,
  StandaloneSourceRegistry,
} from '../types/source'

export function textFile(content: string, language: string): WorkspaceFile {
  return { content, kind: 'text', language }
}

export function createCanonicalSourceRegistry(
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): StandaloneSourceRegistry {
  const definitions = new Map(compilation.registry.components.map((component) => {
    const binding = resolver.resolveBinding(component.key)
    if (!binding)
      throw new Error(`Component "${component.key}" has no standalone Source binding.`)
    if (
      binding.component !== component.key
      || binding.contractVersion !== component.contractVersion
      || binding.contractFingerprint !== component.fingerprint
    ) {
      throw new Error(`Component "${component.key}" standalone Source binding does not match the compilation Registry snapshot.`)
    }
    return [component.key, {
      binding: structuredClone(binding),
      events: component.contract.events.map(event => ({ name: event.name })),
      bindings: component.contract.bindings.map(item => ({
        name: item.name,
        valueProp: item.valueProp,
        trigger: item.trigger,
      })),
    } satisfies StandaloneSourceComponentDefinition] as const
  }))
  return { get: component => definitions.get(component) }
}

function canonicalSourceNode(
  page: CanonicalPageIR,
  nodeId: string,
  ancestors: ReadonlySet<string>,
): StandaloneSourceNode {
  if (ancestors.has(nodeId))
    throw new Error(`Canonical page "${page.id}" contains a node cycle at "${nodeId}".`)
  const node = page.nodesById[nodeId]
  if (!node)
    throw new Error(`Canonical page "${page.id}" references unknown node "${nodeId}".`)
  const common: StandaloneSourceNodeBase = {
    id: node.id,
    component: node.component,
    props: structuredClone(node.props),
    events: structuredClone(node.events),
    flowEvents: [...(node.flowEvents ?? [])],
    bindings: structuredClone(node.bindings),
    placement: structuredClone(node.placement.props),
    ...(node.conditions === undefined ? {} : { conditions: structuredClone(node.conditions) }),
    ...(node.reactions === undefined ? {} : { reactions: structuredClone(node.reactions) }),
  }
  if (node.kind === 'field') {
    return {
      ...common,
      kind: 'field',
      field: node.field,
      ...(node.label === undefined ? {} : { label: node.label }),
      ...(node.defaultValue === undefined ? {} : { defaultValue: structuredClone(node.defaultValue) }),
      ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) }),
      ...(node.validateOn === undefined ? {} : { validateOn: structuredClone(node.validateOn) }),
    }
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(node.id)
  return {
    ...common,
    kind: 'layout',
    slots: Object.fromEntries(Object.entries(node.slots).map(([name, childIds]) => [
      name,
      childIds.map(childId => canonicalSourceNode(page, childId, nextAncestors)),
    ])),
  }
}

export function canonicalSourcePage(page: CanonicalPageIR): StandaloneSourcePage {
  return {
    id: page.id,
    name: page.name,
    route: page.route,
    form: structuredClone(page.form),
    root: page.rootIds.map(nodeId => canonicalSourceNode(page, nodeId, new Set())),
    flowPlans: page.flows.map(flow => structuredClone(flow.plan)),
  }
}
