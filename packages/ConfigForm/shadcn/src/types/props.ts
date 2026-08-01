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

export type ShadcnConfigFormFormProps = FormHTMLAttributes
export type ShadcnConfigFormRowProps = HTMLAttributes & ConfigFormDataAttributes
export type ShadcnConfigFormColProps = HTMLAttributes & ConfigFormDataAttributes
export type ShadcnConfigFormItemProps = HTMLAttributes & ConfigFormDataAttributes

export type ShadcnConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  ShadcnConfigFormItemProps,
  ShadcnConfigFormColProps
>

export type ShadcnConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export type ShadcnConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, ShadcnConfigFormItemProps, ShadcnConfigFormColProps>

export interface ShadcnConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    ShadcnConfigFormFormProps,
    ShadcnConfigFormRowProps,
    ShadcnConfigFormColProps,
    ShadcnConfigFormItemProps
  > {}
