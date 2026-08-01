import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormField,
  ConfigFormNode,
  ConfigFormSlotConfig,
  ConfigFormValues,
} from '../types'

export interface ConfigFormResolvedFieldState<
  TValues extends ConfigFormValues = ConfigFormValues,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
> {
  field: ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>
  visible: boolean
  disabled: boolean
  readonly: boolean
  required: boolean
  validatable: boolean
}

/** 判断节点是否为真实字段；容器节点没有 field，也不会生成 FormItem。 */
export function isConfigFormField<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): node is ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs> {
  return 'field' in node
}

/** 从顶层节点和配置化 slot 子树中收集当前可编辑字段。 */
export function collectConfigFormFields<
  TValues extends ConfigFormValues,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFieldAttrs, TCellAttrs>[],
  values: TValues,
): ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>[] {
  return resolveConfigFormFieldStates(nodes, values)
    .filter(state => state.validatable)
    .map(state => state.field)
}

/** 收集全部静态声明字段；render function slot 无法在渲染前静态收集。 */
export function collectAllConfigFormFields<
  TValues extends ConfigFormValues,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFieldAttrs, TCellAttrs>[],
): ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>[] {
  return nodes.flatMap(node => collectAllConfigFormFieldsFromNode(node, new Set()))
}

function collectAllConfigFormFieldsFromNode<
  TValues extends ConfigFormValues,
  TFieldAttrs,
  TCellAttrs,
>(
  node: ConfigFormNode<TValues, Component | string, TFieldAttrs, TCellAttrs>,
  ancestors: ReadonlySet<object>,
): ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>[] {
  assertAcyclicConfigFormNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node)
  const current = isConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>(node)
    ? [node]
    : []
  const nested = Object.values(node.slots ?? {}).flatMap(slot =>
    collectAllConfigFormFieldsFromSlot<TValues, TFieldAttrs, TCellAttrs>(slot, nextAncestors),
  )

  return [...current, ...nested]
}

function collectAllConfigFormFieldsFromSlot<
  TValues extends ConfigFormValues,
  TFieldAttrs,
  TCellAttrs,
>(
  slot: ConfigFormSlotConfig<TValues, Component | string, TFieldAttrs, TCellAttrs> | ((...args: unknown[]) => unknown),
  ancestors: ReadonlySet<object>,
): ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>[] {
  if (typeof slot === 'function')
    return []

  if (Array.isArray(slot)) {
    return slot.flatMap(node =>
      collectAllConfigFormFieldsFromNode<TValues, TFieldAttrs, TCellAttrs>(node, ancestors),
    )
  }

  return collectAllConfigFormFieldsFromNode<TValues, TFieldAttrs, TCellAttrs>(slot, ancestors)
}

/** 解析全部声明字段在当前模型下的统一状态。 */
export function resolveConfigFormFieldStates<
  TValues extends ConfigFormValues,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFieldAttrs, TCellAttrs>[],
  values: TValues,
  formReadonly?: ConfigFormCondition<TValues>,
): ConfigFormResolvedFieldState<TValues, TFieldAttrs, TCellAttrs>[] {
  const readonly = resolveConfigFormCondition(formReadonly, values, false)
  return nodes.flatMap(node => resolveConfigFormFieldStatesFromNode(node, values, true, readonly, new Set()))
}

function resolveConfigFormFieldStatesFromNode<
  TValues extends ConfigFormValues,
  TFieldAttrs,
  TCellAttrs,
>(
  node: ConfigFormNode<TValues, Component | string, TFieldAttrs, TCellAttrs>,
  values: TValues,
  parentVisible: boolean,
  formReadonly: boolean,
  ancestors: ReadonlySet<object>,
): ConfigFormResolvedFieldState<TValues, TFieldAttrs, TCellAttrs>[] {
  assertAcyclicConfigFormNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node)
  const visible = parentVisible && isConfigFormNodeVisible(node, values)
  const current = isConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>(node)
    ? [resolveConfigFormFieldState(node, values, visible, formReadonly)]
    : []
  const slots = Object.values(node.slots ?? {})
  const nested: ConfigFormResolvedFieldState<TValues, TFieldAttrs, TCellAttrs>[] = slots.flatMap((slot) => {
    if (typeof slot === 'function')
      return []
    const nodes = Array.isArray(slot) ? slot : [slot]
    return nodes.flatMap(child => resolveConfigFormFieldStatesFromNode<TValues, TFieldAttrs, TCellAttrs>(
      child,
      values,
      visible,
      formReadonly,
      nextAncestors,
    ))
  })

  return [...current, ...nested]
}

function assertAcyclicConfigFormNode(node: object, ancestors: ReadonlySet<object>): void {
  if (ancestors.has(node))
    throw new Error('ConfigForm node slots must not contain circular references.')
}

function resolveConfigFormFieldState<
  TValues extends ConfigFormValues,
  TFieldAttrs,
  TCellAttrs,
>(
  field: ConfigFormField<TValues, Component | string, TFieldAttrs, TCellAttrs>,
  values: TValues,
  visible: boolean,
  formReadonly: boolean,
): ConfigFormResolvedFieldState<TValues, TFieldAttrs, TCellAttrs> {
  const disabled = resolveConfigFormCondition(field.disabled, values, false)
  const readonly = formReadonly || resolveConfigFormCondition(field.readonly, values, false)
  const required = resolveConfigFormCondition(field.required, values, false)

  return {
    disabled,
    field,
    readonly,
    required,
    validatable: visible && !disabled && !readonly,
    visible,
  }
}

/** 解析字段或容器的布尔条件，支持静态值和基于当前 model 的派生函数。 */
export function resolveConfigFormCondition<TValues extends ConfigFormValues>(
  condition: ConfigFormCondition<TValues> | undefined,
  values: TValues,
  defaultValue: boolean,
): boolean {
  return typeof condition === 'function' ? condition(values) : (condition ?? defaultValue)
}

/** 节点可见性同时兼容原包 visible 语义和轻量版已有 hidden 语义。 */
export function isConfigFormNodeVisible<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  values: TValues,
): boolean {
  return resolveConfigFormCondition(node.visible, values, true)
    && !resolveConfigFormCondition(node.hidden, values, false)
}
