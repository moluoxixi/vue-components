import type {
  ConfigFormComponentNode,
  ConfigFormComponentSlot,
  ConfigFormComponentSlotContent,
  ConfigFormComponentSlotContext,
  ConfigFormComponentSlots,
  ConfigFormDataAttributes,
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

export type ShadcnConfigFormFormAttrs = FormHTMLAttributes
export type ShadcnConfigFormLayoutAttrs = HTMLAttributes & ConfigFormDataAttributes
export type ShadcnConfigFormCellAttrs = HTMLAttributes & ConfigFormDataAttributes
export type ShadcnConfigFormFieldAttrs = HTMLAttributes & ConfigFormDataAttributes

export type ShadcnConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  ShadcnConfigFormFieldAttrs,
  ShadcnConfigFormCellAttrs
>

export type ShadcnConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export type ShadcnConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, ShadcnConfigFormFieldAttrs, ShadcnConfigFormCellAttrs>

export interface ShadcnConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    ShadcnConfigFormFormAttrs,
    ShadcnConfigFormLayoutAttrs,
    ShadcnConfigFormCellAttrs,
    ShadcnConfigFormFieldAttrs
  > {
  /** 原生 CSS Grid 的列数。 */
  columns?: number
  /** 原生 Grid/Flex 的间距。 */
  gap?: string
}
