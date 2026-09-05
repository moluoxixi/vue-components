import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormComponentNode,
  ConfigFormComponentNodeInput,
  ConfigFormComponentSlotContent,
  ConfigFormComponentSlots,
  ConfigFormField,
  ConfigFormFieldInput,
  ConfigFormFieldSlotContent,
  ConfigFormFieldSlots,
  ConfigFormNode,
  ConfigFormValues,
  DefineConfigFormFieldsResult,
} from '../types'
import { markRaw } from 'vue'

/** 定义单个轻量 ConfigForm 字段节点，运行时只做组件标记和 slot 子树复制。 */
export function defineField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs extends object = ConfigFormAttrs,
  TCellAttrs extends object = ConfigFormAttrs,
>(
  field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
  & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
export function defineField<
  TValues extends ConfigFormValues = ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs extends object = ConfigFormAttrs,
  TCellAttrs extends object = ConfigFormAttrs,
>(
  field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
  & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
export function defineField(
  field: ConfigFormNode<ConfigFormValues, unknown, unknown, unknown>,
): ConfigFormNode<ConfigFormValues, unknown, unknown, unknown> {
  return defineConfigFormNode(field)
}

/** 先绑定表单模型类型，再定义字段配置。 */
export function defineFields<TValues extends ConfigFormValues = ConfigFormValues>(): DefineConfigFormFieldsResult<TValues> {
  function defineBoundField<
    TComponent = unknown,
    TFieldAttrs extends object = ConfigFormAttrs,
    TCellAttrs extends object = ConfigFormAttrs,
  >(
    field: ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>
  function defineBoundField<
    TComponent = unknown,
    TFieldAttrs extends object = ConfigFormAttrs,
    TCellAttrs extends object = ConfigFormAttrs,
  >(
    field: ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ): ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    & ConfigFormComponentNode<TValues, TComponent, TFieldAttrs, TCellAttrs>
  function defineBoundField<
    TComponent,
    TFieldAttrs extends object,
    TCellAttrs extends object,
  >(
    field:
      | ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
      | ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  ):
    | ConfigFormFieldInput<TValues, TComponent, TFieldAttrs, TCellAttrs>
    | ConfigFormComponentNodeInput<TValues, TComponent, TFieldAttrs, TCellAttrs> {
    if ('field' in field)
      return defineField(field)
    return defineField(field)
  }

  return {
    defineField: defineBoundField,
  }
}

function markConfigFormComponent<TComponent>(component: TComponent): TComponent {
  if (isObject(component))
    return markRaw(component)

  return component
}

function isObject(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
}

function defineConfigFormNode<TValues extends ConfigFormValues, TComponent, TFieldAttrs, TCellAttrs>(
  node: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs> {
  if (isConfigFormFieldNode(node)) {
    return {
      ...node,
      component: markConfigFormComponent(node.component),
      slots: node.slots ? defineConfigFormFieldSlots(node.slots) : undefined,
    }
  }

  return {
    ...node,
    component: markConfigFormComponent(node.component),
    slots: node.slots ? defineConfigFormComponentSlots(node.slots) : undefined,
  }
}

function isConfigFormFieldNode<TValues extends ConfigFormValues, TComponent, TFieldAttrs, TCellAttrs>(
  node: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): node is ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs> {
  return 'field' in node
}

function defineConfigFormComponentSlots<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slots: ConfigFormComponentSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>,
): ConfigFormComponentSlots<TValues, Component | string, TFieldAttrs, TCellAttrs> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot]) => [name, defineConfigFormComponentSlotContent(slot)]),
  )
}

function defineConfigFormFieldSlots<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slots: ConfigFormFieldSlots<TValues, Component | string, TFieldAttrs, TCellAttrs>,
): ConfigFormFieldSlots<TValues, Component | string, TFieldAttrs, TCellAttrs> {
  return Object.fromEntries(
    Object.entries(slots).map(([name, slot]) => [name, defineConfigFormFieldSlotContent(slot)]),
  )
}

function defineConfigFormComponentSlotContent<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slot: ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>,
): ConfigFormComponentSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs> {
  if (typeof slot === 'function')
    return slot

  if (Array.isArray(slot))
    return slot.map(node => defineConfigFormNode(node))

  return defineConfigFormNode(slot)
}

function defineConfigFormFieldSlotContent<TValues extends ConfigFormValues, TFieldAttrs, TCellAttrs>(
  slot: ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs>,
): ConfigFormFieldSlotContent<TValues, Component | string, TFieldAttrs, TCellAttrs> {
  if (typeof slot === 'function')
    return slot

  if (Array.isArray(slot))
    return slot.map(node => defineConfigFormNode(node))

  return defineConfigFormNode(slot)
}
