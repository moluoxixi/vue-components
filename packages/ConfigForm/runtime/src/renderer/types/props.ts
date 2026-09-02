import type {
  ConfigFormCondition,
  ConfigFormReactionProjection,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { Component } from 'vue'
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
  fields: ConfigFormRendererNode<TValues>[]
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
