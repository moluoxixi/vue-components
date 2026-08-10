import type {
  ConfigFormComponentNode,
  ConfigFormComponentSlot,
  ConfigFormComponentSlotContent,
  ConfigFormComponentSlotContext,
  ConfigFormComponentSlots,
  ConfigFormField,
  ConfigFormFieldSlot,
  ConfigFormFieldSlotContent,
  ConfigFormFieldSlotContext,
  ConfigFormFieldSlots,
  ConfigFormNode,
  ConfigFormProps,
  ConfigFormReadonlyRender,
  ConfigFormSlotConfig,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form/renderer'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type ElementConfigFormFormAttrs = FormHTMLAttributes
export type ElementConfigFormLayoutAttrs = HTMLAttributes
export type ElementConfigFormCellAttrs = HTMLAttributes
export type ElementConfigFormFieldAttrs = HTMLAttributes

export type ElementConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  ElementConfigFormFieldAttrs,
  ElementConfigFormCellAttrs
>

export type ElementConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export type ElementConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, ElementConfigFormFieldAttrs, ElementConfigFormCellAttrs>

export interface ElementConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    ElementConfigFormFormAttrs,
    ElementConfigFormLayoutAttrs,
    ElementConfigFormCellAttrs,
    ElementConfigFormFieldAttrs
  > {
  /** 原生 CSS Grid 的列数。 */
  columns?: number
  /** 原生 Grid/Flex 的间距。 */
  gap?: string
  /** 语义组件别名注册表；与 Element Plus 默认别名合并。 */
  components?: ConfigFormComponentRegistry
}
