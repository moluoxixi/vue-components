import type { ConfigFormFlow, ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { FlowEventTarget } from '../../../flow'

export interface FlowDialogProps {
  fieldNames?: string[]
  eventTargets?: FlowEventTarget[]
  flows: ConfigFormFlow[]
  initialTrigger?: ConfigFormFlowTrigger
  locale?: DesignerLocaleOptions
  open: boolean
  pageId: string
  readonly?: boolean
}
