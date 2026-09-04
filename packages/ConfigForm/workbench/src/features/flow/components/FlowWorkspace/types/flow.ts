import type {
  ConfigFormFlowNode,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'

export interface FlowNodeData extends Record<string, unknown> {
  deletable: boolean
  node: ConfigFormFlowNode
  title: string
}

export type FlowTriggerGroup = 'component' | 'field' | 'form' | 'lifecycle'

export interface FlowTriggerChoice {
  detail: string
  group: FlowTriggerGroup
  key: string
  label: string
  trigger: ConfigFormFlowTrigger
}
