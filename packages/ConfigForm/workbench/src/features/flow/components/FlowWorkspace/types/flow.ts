import type {
  ConfigFormFlowNode,
} from '@moluoxixi/config-form-core'

export interface FlowNodeData extends Record<string, unknown> {
  deletable: boolean
  node: ConfigFormFlowNode
  title: string
}
