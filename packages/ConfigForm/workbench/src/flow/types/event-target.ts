/** A selectable component event exposed by the active page and Registry. */
export interface FlowEventTarget {
  component: string
  event: string
  eventLabel: string
  nodeId: string
  nodeLabel: string
}
