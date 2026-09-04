import type { ProjectCommandAction } from '@moluoxixi/config-form-model'

export type FlowEditAction = Extract<ProjectCommandAction, {
  type: 'flow.settings' | 'flow.node' | 'flow.edges' | 'flow.graph'
}>
