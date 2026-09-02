import { toDisplayString } from 'vue'

interface OptionNode {
  children?: unknown
  label?: unknown
  options?: unknown
  value?: unknown
}

/** Ant Design Vue 选择类组件的候选项来源统一从 props 中读取。 */
export function readAntdVueOptionSource(props: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const source = props[key]
    if (source != null)
      return source
  }

  return undefined
}

export function findAntdVueOptionLabel(options: unknown, value: unknown): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  for (const item of options.filter(isOptionNode)) {
    if (Object.is(item.value, value))
      return item.label ?? item.value

    const nested = item.options ?? item.children
    const nestedLabel = findAntdVueOptionLabel(nested, value)
    if (nestedLabel !== undefined)
      return nestedLabel
  }

  return undefined
}

export function resolveAntdVuePathLabel(options: unknown, value: unknown[]): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  let current: unknown = options
  const labels: unknown[] = []

  for (const segment of value) {
    if (!Array.isArray(current))
      return undefined

    const item = current.filter(isOptionNode).find(option => Object.is(option.value, segment))
    if (!item)
      return undefined

    labels.push(item.label ?? item.value)
    current = item.options ?? item.children
  }

  return labels.map(label => toDisplayString(label)).join(' / ')
}

function isOptionNode(value: unknown): value is OptionNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
