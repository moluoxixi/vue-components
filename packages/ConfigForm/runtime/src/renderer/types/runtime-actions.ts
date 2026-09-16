import type { ConfigFormDataSourceState, ConfigFormFlowActionContext } from '@moluoxixi/config-form-core'
import type { ConfigFormPageRuntimeLoadOptions } from '../../runtime'

/** Refs of the built-in Flow actions owned by the Renderer itself. */
export type ConfigFormRendererBuiltinActionRef
  = | 'builtin.field.set'
    | 'builtin.variable.set'
    | 'builtin.field.state'
    | 'builtin.form.validate'
    | 'builtin.form.submit'
    | 'builtin.form.reset'
    | 'builtin.dataSource.load'

/** Renderer-side capabilities the built-in actions delegate to. */
export interface RendererBuiltinActionHost {
  validate: (context: ConfigFormFlowActionContext) => Promise<boolean>
  submit: (context: ConfigFormFlowActionContext) => Promise<boolean>
  reset: (context: ConfigFormFlowActionContext) => Promise<boolean>
  loadDataSource: (
    sourceId: string,
    settings: ConfigFormPageRuntimeLoadOptions,
    context: ConfigFormFlowActionContext,
  ) => Promise<ConfigFormDataSourceState>
}
