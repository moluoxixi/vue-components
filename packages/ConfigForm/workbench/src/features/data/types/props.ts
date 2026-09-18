import type {
  ConfigFormDataSourceHost,
  ConfigFormPageRuntimeConfiguration,
  ConfigFormValueContext,
} from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { DataReferenceField } from '../components/DataValueEditor/types'

export interface DataCommandDiagnostic {
  code: string
  message: string
  path?: readonly (string | number)[] | string
}

export interface DataCommandResult {
  changed: boolean
  diagnostics?: readonly DataCommandDiagnostic[]
}

export type DataCommandExecutor = (
  command: ProjectCommand,
) => DataCommandResult | Promise<DataCommandResult>

export interface DataEditorBaseProps {
  execute: DataCommandExecutor
  locale?: DesignerLocaleOptions
  onRequest?: ConfigFormDataSourceHost['request']
  pageId: string
  readonly?: boolean
  referenceFields?: readonly DataReferenceField[]
  runtime?: ConfigFormPageRuntimeConfiguration
  /** Optional page/project revision captured with runtime for optimistic conflict detection. */
  runtimeRevision?: number | string
  /** Optional live values used only by an explicitly requested data-source test. */
  testContext?: ConfigFormValueContext
}

export interface DataWorkspaceProps extends DataEditorBaseProps {
  active: boolean
}

export interface DataDialogProps extends DataEditorBaseProps {
  open: boolean
}
