import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormField,
  ConfigFormNode,
  ConfigFormSlotConfig,
  ConfigFormValues,
} from '../types'

/** 判断节点是否为真实字段；容器节点没有 field，也不会生成 FormItem。 */
export function isConfigFormField<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>,
): node is ConfigFormField<TValues, TComponent, TFormItemProps, TColProps> {
  return 'field' in node
}

/** 从顶层节点和配置化 slot 子树中收集真实字段，供 Element Plus rules 合并使用。 */
export function collectConfigFormFields<
  TValues extends ConfigFormValues,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>[],
  values?: TValues,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  return nodes.flatMap(node => collectConfigFormFieldsFromNode(node, values))
}

function collectConfigFormFieldsFromNode<
  TValues extends ConfigFormValues,
  TFormItemProps,
  TColProps,
>(
  node: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>,
  values?: TValues,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  if (values && !isConfigFormNodeVisible(node, values))
    return []

  const current = isConfigFormField<TValues, Component | string, TFormItemProps, TColProps>(node)
    && !resolveConfigFormCondition(node.disabled, values, false)
    ? [node]
    : []
  const nested = Object.values(node.slots ?? {}).flatMap(slot =>
    collectConfigFormFieldsFromSlot<TValues, TFormItemProps, TColProps>(slot, values),
  )

  return [...current, ...nested]
}

function collectConfigFormFieldsFromSlot<
  TValues extends ConfigFormValues,
  TFormItemProps,
  TColProps,
>(
  slot: ConfigFormSlotConfig<TValues, Component | string, TFormItemProps, TColProps> | ((...args: unknown[]) => unknown),
  values?: TValues,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  if (typeof slot === 'function')
    return []

  if (Array.isArray(slot)) {
    return slot.flatMap(node =>
      collectConfigFormFieldsFromNode<TValues, TFormItemProps, TColProps>(node, values),
    )
  }

  return collectConfigFormFieldsFromNode<TValues, TFormItemProps, TColProps>(slot, values)
}

/** 解析字段或容器的布尔条件，支持静态值和基于当前 model 的派生函数。 */
export function resolveConfigFormCondition<TValues extends ConfigFormValues>(
  condition: ConfigFormCondition<TValues> | undefined,
  values: TValues | undefined,
  defaultValue: boolean,
): boolean {
  return typeof condition === 'function' ? condition(values!) : (condition ?? defaultValue)
}

/** 节点可见性同时兼容原包 visible 语义和轻量版已有 hidden 语义。 */
export function isConfigFormNodeVisible<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>,
  values: TValues,
): boolean {
  return resolveConfigFormCondition(node.visible, values, true)
    && !resolveConfigFormCondition(node.hidden, values, false)
}
