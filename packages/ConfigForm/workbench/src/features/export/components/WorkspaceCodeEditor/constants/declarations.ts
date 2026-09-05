export const WORKBENCH_MODULES = [
  'vue',
  '@moluoxixi/config-form',
  '@moluoxixi/config-form-headless',
  '@moluoxixi/config-form-element',
  '@moluoxixi/config-form-antd-vue',
  './form.config',
] as const

export const WORKBENCH_TYPES_URI = 'inmemory://config-form-workbench/workspace-types.d.ts'
export const WORKBENCH_CONFIG_TYPES_URI = 'inmemory://config-form-workbench/src/form.config.d.ts'

export const WORKBENCH_TYPE_DECLARATIONS = `
declare module 'vue' {
  export interface Ref<T> { value: T }
  export interface ComputedRef<T> { readonly value: T }
  export type Component = object | ((...args: unknown[]) => unknown)
  export type VNodeChild = unknown
  export type FormHTMLAttributes = Record<string, unknown>
  export type HTMLAttributes = Record<string, unknown>
  export function computed<T>(getter: () => T): ComputedRef<T>
  export function defineAsyncComponent<T>(loader: () => Promise<T>): T
  export function defineComponent<T>(component: T): T
  export function h(...args: unknown[]): unknown
  export function inject<T>(key: string | symbol, defaultValue?: T): T | undefined
  export function nextTick(): Promise<void>
  export function onBeforeUnmount(callback: () => void): void
  export function onMounted(callback: () => void): void
  export function provide<T>(key: string | symbol, value: T): void
  export function reactive<T extends object>(value: T): T
  export function ref<T>(value: T): Ref<T>
  export function shallowRef<T>(value?: T): Ref<T | undefined>
  export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]>
  export function unref<T>(value: T | Ref<T>): T
  export function watch<T>(source: () => T, callback: (value: T, previous: T) => void): void
  export function watchEffect(effect: () => void): void
  export function useTemplateRef<T>(name: string): Ref<T | null>
}
declare module '@moluoxixi/config-form-element' {
  import type {
    ConfigFormComponentRegistry,
    ConfigFormField,
    ConfigFormNode,
    ConfigFormProps,
    ConfigFormValues,
  } from '@moluoxixi/config-form-headless'
  export type ElementConfigFormFormAttrs = Record<string, unknown>
  export type ElementConfigFormLayoutAttrs = Record<string, unknown>
  export type ElementConfigFormCellAttrs = Record<string, unknown>
  export type ElementConfigFormFieldAttrs = Record<string, unknown>
  export type ElementConfigFormNode<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormNode<TValues>
  export type ElementConfigFormField<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormField<TValues>
  export interface ElementConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues> extends ConfigFormProps<TValues> {
    columns?: number
    gap?: string
    components?: ConfigFormComponentRegistry
  }
  export interface ElementConfigFormComponent {
    new <TValues extends ConfigFormValues = ConfigFormValues>(): { $props: ElementConfigFormProps<TValues> }
  }
  export const ElementConfigForm: ElementConfigFormComponent
  export default ElementConfigForm
  export const ELEMENT_CONFIG_FORM_COMPONENTS: Record<string, unknown>
  export const ELEMENT_CONFIG_FORM_MATERIAL_REGISTRY: Record<string, unknown>
}
declare module '@moluoxixi/config-form-antd-vue' {
  import type { ConfigFormComponentRegistry, ConfigFormField, ConfigFormNode, ConfigFormProps, ConfigFormValues } from '@moluoxixi/config-form-headless'
  export type AntdConfigFormFormAttrs = Record<string, unknown>
  export type AntdConfigFormLayoutAttrs = Record<string, unknown>
  export type AntdConfigFormCellAttrs = Record<string, unknown>
  export type AntdConfigFormFieldAttrs = Record<string, unknown>
  export type AntdConfigFormNode<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormNode<TValues>
  export type AntdConfigFormField<TValues extends ConfigFormValues = ConfigFormValues> = ConfigFormField<TValues>
  export interface AntdConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues> extends ConfigFormProps<TValues> {
    columns?: number
    gap?: string
    components?: ConfigFormComponentRegistry
  }
  export interface AntdConfigFormComponent {
    new <TValues extends ConfigFormValues = ConfigFormValues>(): { $props: AntdConfigFormProps<TValues> }
  }
  export const AntdConfigForm: AntdConfigFormComponent
  export default AntdConfigForm
  export const ANTD_CONFIG_FORM_COMPONENTS: Record<string, unknown>
  export const ANTD_CONFIG_FORM_MATERIAL_REGISTRY: Record<string, unknown>
}
declare module '@moluoxixi/config-form-headless' {
  import type { Component, VNodeChild } from 'vue'
  export type ConfigFormValues = Record<string, any>
  export type ConfigFormAttrs = Record<string, unknown>
  export type ConfigFormFieldKey<TValues extends ConfigFormValues = ConfigFormValues> = Extract<keyof TValues, string>
  export type ConfigFormCondition<TValues extends ConfigFormValues = ConfigFormValues> = boolean | ((values: TValues) => boolean)
  export type ConfigFormColumnSpan = number
  export interface ConfigFormComponentRegistration<TComponent = Component> {
    component: TComponent
    props?: ConfigFormAttrs
    valueProp?: string
    trigger?: string
    blurTrigger?: string
    getValueFromEvent?: (...args: unknown[]) => unknown
  }
  export type ConfigFormExtensions = Record<string, unknown>
  export type ConfigFormValidateTrigger = 'submit' | 'blur' | 'change'
  export type ConfigFormFieldValidatorResult = string | string[] | void | null | undefined
  export interface ConfigFormErrors {
    [field: string]: string[]
  }
  export type ConfigFormFieldValidator<TValues extends ConfigFormValues = ConfigFormValues, TValue = unknown> = (
    value: TValue,
    values: TValues,
  ) => ConfigFormFieldValidatorResult | Promise<ConfigFormFieldValidatorResult>
  export interface ConfigFormFieldMeta {
    dirty: boolean
    touched: boolean
  }
  export interface ConfigFormMeta {
    dirty: boolean
    touched: boolean
    fields: Record<string, ConfigFormFieldMeta>
  }
  export interface ConfigFormReadonlyRenderContext<
    TValues extends ConfigFormValues = ConfigFormValues,
    _TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
    TValue = unknown,
  > {
    field: ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>
    model: TValues
    value: TValue
    componentProps: ConfigFormAttrs
  }
  export type ConfigFormReadonlyRender<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
    TValue = unknown,
  > = (context: ConfigFormReadonlyRenderContext<TValues, TComponent, TFieldAttrs, TCellAttrs, TValue>) => VNodeChild
  export type ConfigFormComponentRegistry<TComponent = Component> = Record<string, TComponent | ConfigFormComponentRegistration<TComponent>>
  export interface ConfigFormNodeBase<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TCellAttrs = ConfigFormAttrs,
  > {
    component: TComponent
    extensions?: Record<string, unknown>
    props?: Record<string, unknown>
    reactions?: unknown[]
    cellAttrs?: TCellAttrs
    span?: ConfigFormColumnSpan
    visible?: ConfigFormCondition<TValues>
    hidden?: ConfigFormCondition<TValues>
  }
  export interface ConfigFormField<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > extends ConfigFormNodeBase<TValues, TComponent, TCellAttrs> {
    defaultValue?: unknown
    field: ConfigFormFieldKey<TValues> | string
    label?: string
    slots?: ConfigFormFieldSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>
    fieldAttrs?: TFieldAttrs
    required?: ConfigFormCondition<TValues>
    requiredMessage?: string
    schema?: unknown
    validator?: ConfigFormFieldValidator<TValues>
    validateOn?: ConfigFormValidateTrigger | ConfigFormValidateTrigger[]
    disabled?: ConfigFormCondition<TValues>
    readonly?: ConfigFormCondition<TValues>
    readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs>
    submitWhenHidden?: boolean
    submitWhenDisabled?: boolean
    transform?: (value: unknown, values: TValues) => unknown
    valueProp?: string
    trigger?: string
    blurTrigger?: string
    getValueFromEvent?: (...args: unknown[]) => unknown
  }
  export interface ConfigFormComponentNode<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > extends ConfigFormNodeBase<TValues, TComponent, TCellAttrs> {
    slots?: ConfigFormComponentSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>
  }
  export type ConfigFormNode<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs> | ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
  export interface ConfigFormComponentSlotContext<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > {
    node: ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
    model: TValues
    meta: ConfigFormMeta
    slotProps: Record<string, unknown>
  }
  export interface ConfigFormFieldSlotContext<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > {
    field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
    model: TValues
    meta: ConfigFormFieldMeta
    value: unknown
    slotProps: Record<string, unknown>
    setValue: (value: unknown) => void
  }
  export type ConfigFormSlotConfig<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs> | Array<ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>>
  export type ConfigFormComponentSlot<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = (context: ConfigFormComponentSlotContext<TValues, TComponent, TFieldAttrs, TCellAttrs>) => VNodeChild
  export type ConfigFormFieldSlot<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = (context: ConfigFormFieldSlotContext<TValues, TComponent, TFieldAttrs, TCellAttrs>) => VNodeChild
  export type ConfigFormComponentSlotContent<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = ConfigFormSlotConfig<TValues, TComponent, TFieldAttrs, TCellAttrs> | ConfigFormComponentSlot<TValues, TComponent, TFieldAttrs, TCellAttrs>
  export type ConfigFormFieldSlotContent<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = ConfigFormSlotConfig<TValues, TComponent, TFieldAttrs, TCellAttrs> | ConfigFormFieldSlot<TValues, TComponent, TFieldAttrs, TCellAttrs>
  export type ConfigFormComponentSlots<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = Record<string, ConfigFormComponentSlotContent<TValues, TComponent, TFieldAttrs, TCellAttrs>>
  export type ConfigFormFieldSlots<
    TValues extends ConfigFormValues = ConfigFormValues,
    TComponent = Component | string,
    TFieldAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
  > = Record<string, ConfigFormFieldSlotContent<TValues, TComponent, TFieldAttrs, TCellAttrs>>
  export interface ConfigFormProps<
    TValues extends ConfigFormValues = ConfigFormValues,
    TFormAttrs = ConfigFormAttrs,
    TLayoutAttrs = ConfigFormAttrs,
    TCellAttrs = ConfigFormAttrs,
    TFieldAttrs = ConfigFormAttrs,
    TComponent = Component | string,
  > {
    fields: Array<ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>>
    defaultValues?: Partial<TValues>
    readonly?: ConfigFormCondition<TValues>
    readonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs>
    formAttrs?: TFormAttrs
    inline?: boolean
    layoutAttrs?: TLayoutAttrs
    cellAttrs?: TCellAttrs
    fieldSpan?: ConfigFormColumnSpan
  }
  export type ConfigFormComponentPart<TComponent> = {
    component: TComponent
    props?: Partial<TComponent extends { new (...args: any[]): { $props: infer TProps } } ? TProps : Record<string, unknown>> & Record<string, unknown>
  }
  export type ConfigFormFieldInput<TValues extends ConfigFormValues, TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs> = Omit<ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>, 'component' | 'props'> & ConfigFormComponentPart<TComponent>
  export type ConfigFormComponentNodeInput<TValues extends ConfigFormValues, TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs> = Omit<ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>, 'component' | 'props'> & ConfigFormComponentPart<TComponent>
  export interface DefineConfigFormFieldFactory<TValues extends ConfigFormValues> {
    <TComponent = unknown, TFieldAttrs extends object = ConfigFormAttrs, TCellAttrs extends object = ConfigFormAttrs>(field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs> & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
    <TComponent = unknown, TFieldAttrs extends object = ConfigFormAttrs, TCellAttrs extends object = ConfigFormAttrs>(field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs> & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
  }
  export interface DefineConfigFormFieldsResult<TValues extends ConfigFormValues> {
    defineField: DefineConfigFormFieldFactory<TValues>
  }
  export type DefineFieldFactory<TValues extends ConfigFormValues> = DefineConfigFormFieldFactory<TValues>
  export type DefineFieldsResult<TValues extends ConfigFormValues> = DefineConfigFormFieldsResult<TValues>
  export function defineField<TValues extends ConfigFormValues = ConfigFormValues, TComponent = unknown, TFieldAttrs extends object = ConfigFormAttrs, TCellAttrs extends object = ConfigFormAttrs>(field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs> & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  export function defineField<TValues extends ConfigFormValues = ConfigFormValues, TComponent = unknown, TFieldAttrs extends object = ConfigFormAttrs, TCellAttrs extends object = ConfigFormAttrs>(field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs> & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
  export function defineFields<TValues extends ConfigFormValues = ConfigFormValues>(): DefineConfigFormFieldsResult<TValues>
}
declare module '@moluoxixi/config-form' {
  export {
    defineField,
    defineFields,
  } from '@moluoxixi/config-form-headless'
  import type { Component } from 'vue'
  import type { ConfigFormNode, ConfigFormValues } from '@moluoxixi/config-form-headless'
  export interface ConfigFormProps<TValues extends ConfigFormValues = ConfigFormValues> {
    namespace?: string
    inline?: boolean
    columns?: number
    gap?: string
    responsive?: Record<string, unknown>
    fields: Array<ConfigFormNode<TValues>>
    labelWidth?: string | number
    defaultValues?: Partial<TValues>
    runtime?: Record<string, unknown>
    components?: Record<string, unknown>
  }
  export interface ConfigFormComponent {
    new <TValues extends ConfigFormValues = ConfigFormValues>(): { $props: ConfigFormProps<TValues> }
  }
  export const ConfigForm: ConfigFormComponent
  export const FormLayout: Component
  export const ConfigFormRenderer: Component
  export const ConfigFormError: typeof Error
  export function useForm<TValues extends ConfigFormValues = ConfigFormValues>(): Record<string, unknown>
}
`

export const WORKBENCH_CONFIG_TYPE_DECLARATIONS = `
import type { ConfigFormNode } from '@moluoxixi/config-form-headless'

export const fields: Array<ConfigFormNode<Record<string, unknown>>>
export const form: {
  columns?: number
  fieldSpan?: number
  gap?: string
  inline?: boolean
  labelPosition?: 'left' | 'top'
  labelWidth?: number
  readonly?: boolean
}
export const initialValues: Record<string, unknown>
`
