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
import type { ColProps, RowProps } from 'ant-design-vue'
import type { Component, FormHTMLAttributes, HTMLAttributes } from 'vue'

export type AntdConfigFormFormProps = FormHTMLAttributes
export type AntdConfigFormRowProps = Partial<RowProps> & ConfigFormDataAttributes
export type AntdConfigFormColProps = Partial<ColProps> & ConfigFormDataAttributes
export type AntdConfigFormItemProps = HTMLAttributes & ConfigFormDataAttributes

export type AntdConfigFormReadonlyRender<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormReadonlyRender<
  TValues,
  TComponent,
  AntdConfigFormItemProps,
  AntdConfigFormColProps
>

export type AntdConfigFormComponentSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContext<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormFieldSlotContext<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContext<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormComponentSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlot<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormFieldSlot<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlot<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormSlotConfig<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormSlotConfig<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormComponentSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlotContent<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormFieldSlotContent<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlotContent<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormComponentSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentSlots<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormFieldSlots<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormFieldSlots<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormField<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormComponentNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormComponentNode<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export type AntdConfigFormNode<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = Component | string,
> = ConfigFormNode<TValues, TComponent, AntdConfigFormItemProps, AntdConfigFormColProps>

export interface AntdConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues>
  extends ConfigFormProps<
    TValues,
    AntdConfigFormFormProps,
    AntdConfigFormRowProps,
    AntdConfigFormColProps,
    AntdConfigFormItemProps
  > {}
