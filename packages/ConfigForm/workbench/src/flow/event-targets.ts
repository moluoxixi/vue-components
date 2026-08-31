import type {
  DesignerDocument,
  DesignerNode,
  LowCodeComponentRegistry,
} from '@moluoxixi/config-form-designer'

/** A selectable component event exposed by the active page and Registry. */
export interface FlowEventTarget {
  nodeId: string
  nodeLabel: string
  component: string
  event: string
  eventLabel: string
}

/** Stable value used by the trigger selector without making event names opaque. */
export function flowEventTargetKey(target: Pick<FlowEventTarget, 'nodeId' | 'event'>): string {
  return JSON.stringify([target.nodeId, target.event])
}

export function collectFlowEventTargets(
  document: DesignerDocument | undefined,
  registry: LowCodeComponentRegistry | undefined,
): FlowEventTarget[] {
  if (!document || !registry)
    return []

  const targets: FlowEventTarget[] = []
  const visit = (nodes: DesignerNode[]): void => {
    for (const node of nodes) {
      const definition = registry.get(node.material)
      if (definition) {
        const nodeLabel = node.kind === 'field'
          ? (node.label || node.field || definition.displayName)
          : definition.displayName
        for (const event of definition.events) {
          targets.push({
            nodeId: node.id,
            nodeLabel,
            component: definition.component,
            event: event.name,
            eventLabel: event.displayName || event.name,
          })
        }
      }
      if (node.kind === 'container') {
        for (const children of Object.values(node.slots))
          visit(children)
      }
    }
  }

  visit(document.nodes)
  return targets
}
