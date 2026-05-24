import type {
  ReadonlyAdapter,
  ReadonlyAdapterRegistry,
  ReadonlyRenderContext,
} from '@moluoxixi/config-form/plugins'
import type { VNodeChild } from 'vue'
import { h, toDisplayString } from 'vue'

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

function readOptionKeys(node: ReadonlyRenderContext['node']): OptionKeys {
  const optionProps = node.props.props as Partial<OptionKeys> | undefined

  return {
    children: optionProps?.children ?? 'children',
    label: optionProps?.label ?? 'label',
    value: optionProps?.value ?? 'value',
  }
}

function readOptionSource(node: ReadonlyRenderContext['node'], keys: readonly string[]): unknown {
  for (const key of keys) {
    const source = node.props[key]
    if (source != null)
      return source
  }

  return collectSlotOptions(node.slots?.default, readOptionKeys(node))
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

function findOptionLabel(options: unknown, value: unknown, keys: OptionKeys): unknown | undefined {
  if (!Array.isArray(options))
    return undefined

  for (const rawItem of options as OptionNode[]) {
    const item = normalizeOption(rawItem, keys)
    if (Object.is(item.value, value))
      return item.label ?? item.value

    const nestedLabel = findOptionLabel(item.children, value, keys)
    if (nestedLabel !== undefined)
      return nestedLabel
  }

  return undefined
}

function resolvePathLabel(options: unknown, value: unknown[], keys: OptionKeys): unknown | undefined {
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

function renderText(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}

function createChoiceReadonlyAdapter(optionsKeys: readonly string[], pathMode = false): ReadonlyAdapter {
  return ({ node, value }) => {
    const optionKeys = readOptionKeys(node)
    const options = readOptionSource(node, optionsKeys)

    if (Array.isArray(value)) {
      if (pathMode) {
        const pathLabel = resolvePathLabel(options, value, optionKeys)
        return renderText(pathLabel ?? value)
      }

      const labels = value.map(item => findOptionLabel(options, item, optionKeys) ?? item)
      return renderText(labels.map(item => toDisplayString(item)).join('、'))
    }

    const label = findOptionLabel(options, value, optionKeys)
    return renderText(label ?? value)
  }
}

function createSwitchReadonlyAdapter(): ReadonlyAdapter {
  return ({ node, value }) => {
    const props = node.props
    const activeValue = Object.hasOwn(props, 'activeValue') ? props.activeValue : true
    const inactiveValue = Object.hasOwn(props, 'inactiveValue') ? props.inactiveValue : false
    const label = Object.is(value, activeValue)
      ? props.activeText
      : Object.is(value, inactiveValue)
        ? props.inactiveText
        : value

    return renderText(label ?? value)
  }
}

function createColorReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => h('span', {
    style: {
      alignItems: 'center',
      display: 'inline-flex',
      gap: '6px',
    },
  }, [
    h('span', {
      'data-testid': 'readonly-color-swatch',
      'style': {
        backgroundColor: toDisplayString(value),
        borderRadius: '2px',
        display: 'inline-block',
        height: '12px',
        width: '12px',
      },
    }),
    renderText(value),
  ])
}

function createRawReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => renderText(value)
}

const rawReadonlyAdapter = createRawReadonlyAdapter()

export const ELEMENT_PLUS_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  ElAutocomplete: createChoiceReadonlyAdapter(['options']),
  ElCascader: createChoiceReadonlyAdapter(['options'], true),
  ElCheckbox: rawReadonlyAdapter,
  ElCheckboxGroup: createChoiceReadonlyAdapter(['options']),
  ElColorPicker: createColorReadonlyAdapter(),
  ElDatePicker: rawReadonlyAdapter,
  ElInput: rawReadonlyAdapter,
  ElInputNumber: rawReadonlyAdapter,
  ElRadio: rawReadonlyAdapter,
  ElRadioGroup: createChoiceReadonlyAdapter(['options']),
  ElRate: rawReadonlyAdapter,
  ElSelect: createChoiceReadonlyAdapter(['options']),
  ElSelectV2: createChoiceReadonlyAdapter(['options']),
  ElSwitch: createSwitchReadonlyAdapter(),
  ElTimePicker: rawReadonlyAdapter,
  ElTimeSelect: rawReadonlyAdapter,
  ElTreeSelect: createChoiceReadonlyAdapter(['data', 'options']),
})
