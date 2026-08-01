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

export type ElementConfigFormFormProps = FormHTMLAttributes
export type ElementConfigFormRowProps = HTMLAttributes & ConfigFormDataAttributes
export type ElementConfigFormColProps = HTMLAttributes & ConfigFormDataAttributes
export type ElementConfigFormItemProps = HTMLAttributes & ConfigFormDataAttributes

export type ElementConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  ElementConfigFormItemProps,
  ElementConfigFormColProps
>

export type ElementConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export type ElementConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, ElementConfigFormItemProps, ElementConfigFormColProps>

export interface ElementConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    ElementConfigFormFormProps,
    ElementConfigFormRowProps,
    ElementConfigFormColProps,
    ElementConfigFormItemProps
  > {
  /** 原生 CSS Grid 的列数。 */
  columns?: number
  /** 原生 Grid/Flex 的间距。 */
  gap?: string
}
