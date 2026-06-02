import type { ReadonlyRenderContext } from '@moluoxixi/config-form/plugins'
import { toDisplayString } from 'vue'

interface OptionKeys {
  children: string
  label: string
  value: string
}

interface OptionNode {
  [key: string]: unknown
  children?: unknown
  label?: unknown
  options?: unknown
  value?: unknown
}

/** Element Plus 支持通过 props.props 改写 options 的字段名映射。 */
export function readElementPlusOptionKeys(node: ReadonlyRenderContext['node']): OptionKeys {
  const optionProps = node.props.props as Partial<OptionKeys> | undefined

  return {
    children: optionProps?.children ?? 'children',
    label: optionProps?.label ?? 'label',
    value: optionProps?.value ?? 'value',
  }
}

/** Element Plus 选择类组件的候选项来源：优先 props，最后兼容静态 slot 节点。 */
export function readElementPlusOptionSource(
  node: ReadonlyRenderContext['node'],
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    const source = node.props[key]
    if (source != null)
      return source
  }

  return collectSlotOptions(node.slots?.default, readElementPlusOptionKeys(node))
}

export function findElementPlusOptionLabel(options: unknown, value: unknown, keys: OptionKeys): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  for (const rawItem of options as OptionNode[]) {
    const item = normalizeOption(rawItem, keys)
    if (Object.is(item.value, value))
      return item.label ?? item.value

    const nestedLabel = findElementPlusOptionLabel(item.children, value, keys)
    if (nestedLabel !== undefined)
      return nestedLabel
  }

  return undefined
}

export function resolveElementPlusPathLabel(
  options: unknown,
  value: unknown[],
  keys: OptionKeys,
): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  let current: unknown = options
  const labels: unknown[] = []

  for (const segment of value) {
    if (!Array.isArray(current))
      return undefined

    const item = (current as OptionNode[])
      .map(option => normalizeOption(option, keys))
      .find(option => Object.is(option.value, segment))
    if (!item)
      return undefined

    labels.push(item.label ?? item.value)
    current = item.children
  }

  return labels.map(label => toDisplayString(label)).join(' / ')
}

function collectSlotOptions(slot: unknown, keys: OptionKeys): OptionNode[] {
  if (Array.isArray(slot))
    return slot.flatMap(item => collectSlotOptions(item, keys))

  if (typeof slot === 'function' || slot === undefined)
    return []

  const slotNode = slot as {
    props?: Record<string, unknown>
    slots?: Record<string, unknown>
  }
  const props = slotNode.props ?? {}
  const value = props[keys.value] ?? props.value ?? props.label
  const label = props[keys.label] ?? props.label ?? value
  const children = collectSlotOptions(slotNode.slots?.default, keys)

  return [{
    children: children.length > 0 ? children : undefined,
    label,
    value,
  }]
}

function normalizeOption(item: OptionNode, keys: OptionKeys): OptionNode {
  return {
    children: item[keys.children] ?? item.children ?? item.options,
    label: item[keys.label] ?? item.label,
    value: item[keys.value] ?? item.value,
  }
}
