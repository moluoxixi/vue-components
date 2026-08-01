import type { Component } from 'vue'
import type { ZodType, ZodTypeDef } from 'zod'
import type {
  ConfigFormAttrs,
  ConfigFormComponentNode,
  ConfigFormComponentSlotContent,
  ConfigFormField,
  ConfigFormFieldKey,
  ConfigFormFieldSlotContent,
  ConfigFormFieldValidator,
  ConfigFormNode,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '../types'
import { markRaw } from 'vue'

export type ExtractConfigFormComponentProps<TComponent>
  = TComponent extends abstract new (...args: unknown[]) => { $props: infer TProps }
    ? TProps
    : TComponent extends { $props: infer TProps }
      ? TProps
      : Record<string, unknown>

type NoInferComponent<TValue> = [TValue][TValue extends unknown ? 0 : never]

interface ConfigFormComponentPart<TComponent> {
  component: TComponent
  props?: Partial<ExtractConfigFormComponentProps<NoInferComponent<TComponent>>> & Record<string, unknown>
}

type ConfigFormFieldInput<
  TValues extends ConfigFormValues,
  TComponent,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> = {
  [TField in ConfigFormFieldKey<TValues>]:
    & Omit<
      ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>,
      | 'component'
      | 'defaultValue'
      | 'field'
      | 'getValueFromEvent'
      | 'props'
      | 'readonlyRender'
      | 'schema'
      | 'transform'
      | 'validator'
    >
    & ConfigFormComponentPart<TComponent>
    & {
      field: TField
      defaultValue?: TValues[TField]
      getValueFromEvent?: (...args: unknown[]) => TValues[TField]
      readonlyRender?: ConfigFormReadonlyRender<
        TValues,
        TComponent,
        TFieldAttrs,
        TCellAttrs,
        TValues[TField]
      >
      schema?: ZodType<TValues[TField], ZodTypeDef, unknown>
      transform?: (value: TValues[TField], values: TValues) => unknown
      validator?: ConfigFormFieldValidator<TValues, TValues[TField]>
    }
}[ConfigFormFieldKey<TValues>]

type ConfigFormComponentNodeInput<
  TValues extends ConfigFormValues,
  TComponent,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>
  = & Omit<ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>, 'component' | 'props'>
    & ConfigFormComponentPart<TComponent>

export interface DefineConfigFormFieldFactory<TValues extends ConfigFormValues> {
  /** 定义绑定表单值的真实字段节点。 */
  <TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs>(
    field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  /** 定义只渲染组件和 slots 的容器节点。 */
  <TComponent = unknown, TFieldAttrs = ConfigFormAttrs, TCellAttrs = ConfigFormAttrs>(
    field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
}

export interface DefineConfigFormFieldsResult<TValues extends ConfigFormValues> {
  /** 绑定模型类型后的字段定义函数。 */
  defineField: DefineConfigFormFieldFactory<TValues>
}

/** 定义单个轻量 ConfigForm 字段节点，运行时只做组件标记和 slot 子树复制。 */
export function defineConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
  & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
export function defineConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
  & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
export function defineConfigFormField(
  field: ConfigFormNode<ConfigFormValues, unknown, unknown, unknown>,
): ConfigFormNode<ConfigFormValues, unknown, unknown, unknown> {
  return defineConfigFormNode(field)
}

/** 先绑定表单模型类型，再定义字段配置。 */
export function defineConfigFormFields<TValues extends ConfigFormValues = ConfigFormValues>(): DefineConfigFormFieldsResult<TValues> {
  return {
    defineField: defineConfigFormField as unknown as DefineConfigFormFieldFactory<TValues>,
  }
}

export const defineField = defineConfigFormField
export const defineFields = defineConfigFormFields

function markConfigFormComponent<TComponent>(component: TComponent): TComponent {
  if (typeof component === 'object' || typeof component === 'function')
    return markRaw(component as object) as TComponent

  return component
}

function defineConfigFormNode<TValues extends ConfigFormValues, TComponent, TFieldAttrs, TCellAttrs>(
  node: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs> {
  const next = {
    ...node,
    component: markConfigFormComponent(node.component),
  } as ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>

  if (node.slots) {
    const nodeWithSlots = next as {
      slots?: Record<
        string,
        | ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
        | ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
      >
    }
    nodeWithSlots.slots = defineConfigFormSlots(node.slots)
  }

  return next
}

function defineConfigFormSlots<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slots: Record<
    string,
    | ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
    | ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
  >,
): Record<
  string,
  | ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
  | ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot]) => [name, defineConfigFormSlotContent(slot)]),
  )
}

function defineConfigFormSlotContent<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slot:
    | ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
    | ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>,
):
  | ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>
  | ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs> {
  if (typeof slot === 'function')
    return slot

  if (Array.isArray(slot))
    return slot.map(node => defineConfigFormNode(node))

  return defineConfigFormNode(slot)
}
