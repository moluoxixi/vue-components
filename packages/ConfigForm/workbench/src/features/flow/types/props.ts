import type {
  ConfigFormFlow,
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { FlowEventTarget } from '../../../flow'

export interface FlowReferenceField {
  nodeId: string
  field: string
  label: string
}

export interface FlowCatalogOption {
  value: string
  label: string
  /** Optional lossless path for event arguments; value remains the select identity. */
  path?: readonly string[]
}

export interface FlowSourceCatalog {
  variables?: readonly FlowCatalogOption[]
  dataSources?: readonly FlowCatalogOption[]
  eventArguments?: readonly FlowCatalogOption[]
}

export interface FlowCommandDiagnostic {
  code: string
  message: string
  path?: readonly (string | number)[]
}

export interface FlowCommandResult {
  changed: boolean
  diagnostics?: readonly FlowCommandDiagnostic[]
}

export type FlowCommandExecutor = (
  command: ProjectCommand,
) => FlowCommandResult | Promise<FlowCommandResult>

export interface FlowEditorProps {
  actionDescriptors?: readonly ConfigFormFlowActionDescriptor[]
  eventTargets?: readonly FlowEventTarget[]
  execute: FlowCommandExecutor
  flows: readonly ConfigFormFlow[]
  initialTrigger: ConfigFormFlowTrigger
  locale?: DesignerLocaleOptions
  pageId: string
  readonly?: boolean
  referenceFields?: readonly FlowReferenceField[]
  sourceCatalog?: FlowSourceCatalog
}

export interface FlowDialogProps extends FlowEditorProps {
  open: boolean
}
