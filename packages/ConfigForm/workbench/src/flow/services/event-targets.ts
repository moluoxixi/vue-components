import type { DesignerRegistry } from '@moluoxixi/config-form-designer'
import type { ComponentContractRegistry, PageGraph } from '@moluoxixi/config-form-model'
import type { FlowEventTarget } from '../types'
import { walkDesignGraph } from '@moluoxixi/config-form-designer'

/** Stable value used by the trigger selector without making event names opaque. */
export function flowEventTargetKey(target: Pick<FlowEventTarget, 'nodeId' | 'event'>): string {
  return JSON.stringify([target.nodeId, target.event])
}

export function collectFlowEventTargets(
  graph: PageGraph | undefined,
  contracts: ComponentContractRegistry | undefined,
  designer: DesignerRegistry | undefined,
  labels: { valueChange: string } = { valueChange: 'Value change' },
): FlowEventTarget[] {
  if (!graph || !contracts || !designer)
    return []

  const targets: FlowEventTarget[] = []
  walkDesignGraph(graph, ({ node }) => {
    const contract = contracts.get(node.component)
    const material = designer.getMaterial(node.component)
    if (!contract || !material)
      return
    const eventTitles = new Map(material.events?.map(event => [event.name, event.title]) ?? [])
    const nodeLabel = node.kind === 'field'
      ? (node.label || node.field || material.title)
      : material.title
    contract.events.forEach((event) => {
      const bindingEvent = contract.bindings.some(binding => binding.trigger === event.name)
      targets.push({
        nodeId: node.id,
        nodeLabel,
        component: node.component,
        event: event.name,
        eventLabel: eventTitles.get(event.name) ?? (bindingEvent ? labels.valueChange : event.name),
      })
    })
  })
  return targets
}
