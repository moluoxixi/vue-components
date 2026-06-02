import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormComponentNode,
  ConfigFormComponentSlotContent,
  ConfigFormField,
  ConfigFormFieldKey,
  ConfigFormFieldSlotContent,
  ConfigFormNode,
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
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> = {
  [TField in ConfigFormFieldKey<TValues>]:
    & Omit<
      ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>,
      'component' | 'field' | 'getValueFromEvent' | 'props'
    >
    & ConfigFormComponentPart<TComponent>
    & {
      field: TField
      getValueFromEvent?: (...args: unknown[]) => TValues[TField]
    }
}[ConfigFormFieldKey<TValues>]

type ConfigFormComponentNodeInput<
  TValues extends ConfigFormValues,
  TComponent,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>
  = & Omit<ConfigFormComponentNode<TValues, TComponent, TFormItemProps, TColProps>, 'component' | 'props'>
    & ConfigFormComponentPart<TComponent>

export interface DefineConfigFormFieldFactory<TValues extends ConfigFormValues> {
  /** 定义绑定表单值的真实字段节点。 */
  <TComponent = unknown, TFormItemProps = ConfigFormAttrs, TColProps = ConfigFormAttrs>(
    field: ConfigFormFieldInput<TValues, TComponent, TFormItemProps, TColProps>,
  ): ConfigFormFieldInput<TValues, TComponent, TFormItemProps, TColProps>
    & ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>
  /** 定义只渲染组件和 slots 的容器节点。 */
  <TComponent = unknown, TFormItemProps = ConfigFormAttrs, TColProps = ConfigFormAttrs>(
    field: ConfigFormComponentNodeInput<TValues, TComponent, TFormItemProps, TColProps>,
  ): ConfigFormComponentNodeInput<TValues, TComponent, TFormItemProps, TColProps>
    & ConfigFormComponentNode<TValues, TComponent, TFormItemProps, TColProps>
}

export interface DefineConfigFormFieldsResult<TValues extends ConfigFormValues> {
  /** 绑定模型类型后的字段定义函数。 */
  defineField: DefineConfigFormFieldFactory<TValues>
}

/** 定义单个轻量 ConfigForm 字段节点，运行时只做组件标记和 slot 子树复制。 */
export function defineConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  field: ConfigFormFieldInput<TValues, TComponent, TFormItemProps, TColProps>,
): ConfigFormFieldInput<TValues, TComponent, TFormItemProps, TColProps>
  & ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>
export function defineConfigFormField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  field: ConfigFormComponentNodeInput<TValues, TComponent, TFormItemProps, TColProps>,
): ConfigFormComponentNodeInput<TValues, TComponent, TFormItemProps, TColProps>
  & ConfigFormComponentNode<TValues, TComponent, TFormItemProps, TColProps>
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

function defineConfigFormNode<TValues extends ConfigFormValues, TComponent, TFormItemProps, TColProps>(
  node: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>,
): ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps> {
  const next = {
    ...node,
    component: markConfigFormComponent(node.component),
  } as ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>

  if (node.slots) {
    const nodeWithSlots = next as {
      slots?: Record<
        string,
        | ConfigFormComponentSlotContent<TValues, Component | string, TFormItemProps, TColProps>
        | ConfigFormFieldSlotContent<TValues, Component | string, TFormItemProps, TColProps>
      >
    }
    nodeWithSlots.slots = defineConfigFormSlots(node.slots)
  }

  return next
}

function defineConfigFormSlots<TValues extends ConfigFormValues, TFormItemProps, TColProps>(
  slots: Record<
    string,
    | ConfigFormComponentSlotContent<TValues, Component | string, TFormItemProps, TColProps>
    | ConfigFormFieldSlotContent<TValues, Component | string, TFormItemProps, TColProps>
  >,
): Record<
  string,
  | ConfigFormComponentSlotContent<TValues, Component | string, TFormItemProps, TColProps>
  | ConfigFormFieldSlotContent<TValues, Component | string, TFormItemProps, TColProps>
> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot]) => [name, defineConfigFormSlotContent(slot)]),
  )
}

function defineConfigFormSlotContent<TValues extends ConfigFormValues, TFormItemProps, TColProps>(
  slot:
    | ConfigFormComponentSlotContent<TValues, Component | string, TFormItemProps, TColProps>
    | ConfigFormFieldSlotContent<TValues, Component | string, TFormItemProps, TColProps>,
):
  | ConfigFormComponentSlotContent<TValues, Component | string, TFormItemProps, TColProps>
  | ConfigFormFieldSlotContent<TValues, Component | string, TFormItemProps, TColProps> {
  if (typeof slot === 'function')
    return slot

  if (Array.isArray(slot))
    return slot.map(node => defineConfigFormNode(node))

  return defineConfigFormNode(slot)
}
