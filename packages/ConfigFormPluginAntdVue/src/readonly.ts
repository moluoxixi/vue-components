import type {
  ReadonlyAdapter,
  ReadonlyAdapterRegistry,
  ReadonlyRenderContext,
} from '@moluoxixi/config-form/plugins'
import type { VNodeChild } from 'vue'
import { h, toDisplayString } from 'vue'

interface OptionNode {
  children?: unknown
  label?: unknown
  options?: unknown
  value?: unknown
}

function readOptionSource(node: ReadonlyRenderContext['node'], keys: readonly string[]): unknown {
  const props = node.props as Record<string, unknown>

  for (const key of keys) {
    const source = props[key]
    if (source != null)
      return source
  }

  return undefined
}

function findOptionLabel(options: unknown, value: unknown): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  for (const item of options as OptionNode[]) {
    if (Object.is(item.value, value))
      return item.label ?? item.value

    const nested = item.options ?? item.children
    const nestedLabel = findOptionLabel(nested, value)
    if (nestedLabel !== undefined)
      return nestedLabel
  }

  return undefined
}

function resolvePathLabel(options: unknown, value: unknown[]): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  let current: unknown = options
  const labels: unknown[] = []

  for (const segment of value) {
    if (!Array.isArray(current))
      return undefined

    const item = (current as OptionNode[]).find(option => Object.is(option.value, segment))
    if (!item)
      return undefined

    labels.push(item.label ?? item.value)
    current = item.options ?? item.children
  }

  return labels.map(label => toDisplayString(label)).join(' / ')
}

function renderText(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}

function createChoiceReadonlyAdapter(optionsKeys: readonly string[], pathMode = false): ReadonlyAdapter {
  return ({ node, value }) => {
    const options = readOptionSource(node, optionsKeys)

    if (Array.isArray(value)) {
      if (pathMode) {
        const pathLabel = resolvePathLabel(options, value)
        return renderText(pathLabel ?? value)
      }

      const labels = value.map(item => findOptionLabel(options, item) ?? item)
      return renderText(labels.map(item => toDisplayString(item)).join('、'))
    }

    const label = findOptionLabel(options, value)
    return renderText(label ?? value)
  }
}

function createSwitchReadonlyAdapter(): ReadonlyAdapter {
  return ({ node, value }) => {
    const props = node.props as Record<string, unknown>
    const checkedLabel = props.checkedChildren ?? props.activeText
    const uncheckedLabel = props.unCheckedChildren ?? props.inactiveText
    const nextLabel = value ? checkedLabel : uncheckedLabel
    return renderText(nextLabel ?? value)
  }
}

function createRawReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => renderText(value)
}

export const ANTD_VUE_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  AAutoComplete: createChoiceReadonlyAdapter(['options']),
  ACascader: createChoiceReadonlyAdapter(['options'], true),
  ACheckbox: createRawReadonlyAdapter(),
  ACheckboxGroup: createChoiceReadonlyAdapter(['options']),
  ADatePicker: createRawReadonlyAdapter(),
  AInput: createRawReadonlyAdapter(),
  AInputNumber: createRawReadonlyAdapter(),
  AInputPassword: createRawReadonlyAdapter(),
  AInputSearch: createRawReadonlyAdapter(),
  ARadioGroup: createChoiceReadonlyAdapter(['options']),
  ARangePicker: createRawReadonlyAdapter(),
  ARate: createRawReadonlyAdapter(),
  ASelect: createChoiceReadonlyAdapter(['options']),
  ASlider: createRawReadonlyAdapter(),
  ASwitch: createSwitchReadonlyAdapter(),
  ATextarea: createRawReadonlyAdapter(),
  ATimePicker: createRawReadonlyAdapter(),
  ATimeRangePicker: createRawReadonlyAdapter(),
  ATreeSelect: createChoiceReadonlyAdapter(['treeData', 'options'], true),
})
