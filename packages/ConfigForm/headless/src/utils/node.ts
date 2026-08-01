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
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
> {
  field: ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>
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
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>,
): node is ConfigFormField<TValues, TComponent, TFormItemProps, TColProps> {
  return 'field' in node
}

/** 从顶层节点和配置化 slot 子树中收集当前可编辑字段。 */
export function collectConfigFormFields<
  TValues extends ConfigFormValues,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>[],
  values: TValues,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  return resolveConfigFormFieldStates(nodes, values)
    .filter(state => state.validatable)
    .map(state => state.field)
}

/** 收集全部静态声明字段；render function slot 无法在渲染前静态收集。 */
export function collectAllConfigFormFields<
  TValues extends ConfigFormValues,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>[],
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  return nodes.flatMap(node => collectAllConfigFormFieldsFromNode(node, new Set()))
}

function collectAllConfigFormFieldsFromNode<
  TValues extends ConfigFormValues,
  TFormItemProps,
  TColProps,
>(
  node: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>,
  ancestors: ReadonlySet<object>,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  assertAcyclicConfigFormNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node as object)
  const current = isConfigFormField<TValues, Component | string, TFormItemProps, TColProps>(node)
    ? [node]
    : []
  const nested = Object.values(node.slots ?? {}).flatMap(slot =>
    collectAllConfigFormFieldsFromSlot<TValues, TFormItemProps, TColProps>(slot, nextAncestors),
  )

  return [...current, ...nested]
}

function collectAllConfigFormFieldsFromSlot<
  TValues extends ConfigFormValues,
  TFormItemProps,
  TColProps,
>(
  slot: ConfigFormSlotConfig<TValues, Component | string, TFormItemProps, TColProps> | ((...args: unknown[]) => unknown),
  ancestors: ReadonlySet<object>,
): ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>[] {
  if (typeof slot === 'function')
    return []

  if (Array.isArray(slot)) {
    return slot.flatMap(node =>
      collectAllConfigFormFieldsFromNode<TValues, TFormItemProps, TColProps>(node, ancestors),
    )
  }

  return collectAllConfigFormFieldsFromNode<TValues, TFormItemProps, TColProps>(slot, ancestors)
}

/** 解析全部声明字段在当前模型下的统一状态。 */
export function resolveConfigFormFieldStates<
  TValues extends ConfigFormValues,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  nodes: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>[],
  values: TValues,
  formReadonly?: ConfigFormCondition<TValues>,
): ConfigFormResolvedFieldState<TValues, TFormItemProps, TColProps>[] {
  const readonly = resolveConfigFormCondition(formReadonly, values, false)
  return nodes.flatMap(node => resolveConfigFormFieldStatesFromNode(node, values, true, readonly, new Set()))
}

function resolveConfigFormFieldStatesFromNode<
  TValues extends ConfigFormValues,
  TFormItemProps,
  TColProps,
>(
  node: ConfigFormNode<TValues, Component | string, TFormItemProps, TColProps>,
  values: TValues,
  parentVisible: boolean,
  formReadonly: boolean,
  ancestors: ReadonlySet<object>,
): ConfigFormResolvedFieldState<TValues, TFormItemProps, TColProps>[] {
  assertAcyclicConfigFormNode(node, ancestors)
  const nextAncestors = new Set(ancestors).add(node as object)
  const visible = parentVisible && isConfigFormNodeVisible(node, values)
  const current = isConfigFormField<TValues, Component | string, TFormItemProps, TColProps>(node)
    ? [resolveConfigFormFieldState(node, values, visible, formReadonly)]
    : []
  const slots = Object.values(node.slots ?? {}) as Array<
    ConfigFormSlotConfig<TValues, Component | string, TFormItemProps, TColProps>
    | ((...args: unknown[]) => unknown)
  >
  const nested: ConfigFormResolvedFieldState<TValues, TFormItemProps, TColProps>[] = slots.flatMap((slot) => {
    if (typeof slot === 'function')
      return []
    const nodes = Array.isArray(slot) ? slot : [slot]
    return nodes.flatMap(child => resolveConfigFormFieldStatesFromNode<TValues, TFormItemProps, TColProps>(
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
  TFormItemProps,
  TColProps,
>(
  field: ConfigFormField<TValues, Component | string, TFormItemProps, TColProps>,
  values: TValues,
  visible: boolean,
  formReadonly: boolean,
): ConfigFormResolvedFieldState<TValues, TFormItemProps, TColProps> {
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
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  node: ConfigFormNode<TValues, TComponent, TFormItemProps, TColProps>,
  values: TValues,
): boolean {
  return resolveConfigFormCondition(node.visible, values, true)
    && !resolveConfigFormCondition(node.hidden, values, false)
}
