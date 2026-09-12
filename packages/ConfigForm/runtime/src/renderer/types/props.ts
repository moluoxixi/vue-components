import type { ConfigFormDataSourceHost, ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import type {
  ConfigFormCondition,
  ConfigFormModelAdapter,
  ConfigFormReactionProjection,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import type {
  ConfigFormComponentRegistry,
  ConfigFormControlBindingResolver,
  ConfigFormRendererCellAttrs,
  ConfigFormRendererFieldAttrs,
  ConfigFormRendererFormAttrs,
  ConfigFormRendererLayoutAttrs,
  ConfigFormRendererNode,
  ConfigFormRenderMode,
  ConfigFormRuntimeEditorBridge,
} from './contracts'
import type { ConfigFormBreakpoint, ConfigFormResponsiveLayout } from './responsive'

export interface ConfigFormRendererProps<TValues extends ConfigFormValues = ConfigFormValues> {
  /** read() must access Vue reactive state; write() must commit synchronously. */
  model: ConfigFormModelAdapter<TValues>
  fields: ConfigFormRendererNode<TValues>[]
  /** Complete compiled page execution data; raw authoring flows are not accepted here. */
  plan?: ConfigFormPageRuntimePlan
  flowActions?: ConfigFormFlowActionRegistry
  dataSourceHost?: ConfigFormDataSourceHost
  components?: ConfigFormComponentRegistry
  defaultValues?: Partial<TValues>
  readonly?: ConfigFormCondition<TValues>
  readonlyRender?: ConfigFormReadonlyRender<
    TValues,
    Component | string,
    ConfigFormRendererFieldAttrs,
    ConfigFormRendererCellAttrs
  >
  formAttrs?: ConfigFormRendererFormAttrs
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  labelWidth?: string | number
  responsive?: ConfigFormResponsiveLayout
  layoutAttrs?: ConfigFormRendererLayoutAttrs
  cellAttrs?: ConfigFormRendererCellAttrs
  namespace?: string
  defaultValueProp?: string
  defaultTrigger?: string
  resolveBinding?: ConfigFormControlBindingResolver<TValues>
  mode?: ConfigFormRenderMode
  breakpoint?: ConfigFormBreakpoint
  editor?: ConfigFormRuntimeEditorBridge<TValues>
  reactionProjection?: ConfigFormReactionProjection<TValues>
}
