import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'
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
  ConfigFormSlotConfig,
  ConfigFormValues,
} from '../../../ConfigForm'

export type ShadcnConfigFormFormProps = FormHTMLAttributes
export type ShadcnConfigFormRowProps = HTMLAttributes
export type ShadcnConfigFormColProps = HTMLAttributes
export type ShadcnConfigFormItemProps = HTMLAttributes

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
