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
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type AntdConfigFormFormAttrs = FormHTMLAttributes
export type AntdConfigFormLayoutAttrs = HTMLAttributes
export type AntdConfigFormCellAttrs = HTMLAttributes
export type AntdConfigFormFieldAttrs = HTMLAttributes

export type AntdConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  AntdConfigFormFieldAttrs,
  AntdConfigFormCellAttrs
>

export type AntdConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export type AntdConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, AntdConfigFormFieldAttrs, AntdConfigFormCellAttrs>

export interface AntdConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    AntdConfigFormFormAttrs,
    AntdConfigFormLayoutAttrs,
    AntdConfigFormCellAttrs,
    AntdConfigFormFieldAttrs
  > {
  /** 原生 CSS Grid 的列数。 */
  columns?: number
  /** 原生 Grid/Flex 的间距。 */
  gap?: string
}
