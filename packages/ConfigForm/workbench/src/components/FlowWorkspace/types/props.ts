import type { ConfigFormFlow, ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { FlowEventTarget } from '../../../flow'

export interface FlowWorkspaceProps {
  eventTargets?: FlowEventTarget[]
  fieldNames?: string[]
  flows: ConfigFormFlow[]
  initialTrigger?: ConfigFormFlowTrigger
  locale?: DesignerLocaleOptions
  pageId: string
  readonly?: boolean
}
