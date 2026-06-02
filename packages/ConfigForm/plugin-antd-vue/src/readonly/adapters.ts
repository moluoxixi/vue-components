import type { ReadonlyAdapter } from '@moluoxixi/config-form/plugins'
import type { VNodeChild } from 'vue'
import { h, toDisplayString } from 'vue'
import {
  findAntdVueOptionLabel,
  readAntdVueOptionSource,
  resolveAntdVuePathLabel,
} from './options'

export function createAntdVueChoiceReadonlyAdapter(
  optionsKeys: readonly string[],
  pathMode = false,
): ReadonlyAdapter {
  /** 选择类只读态只消费字段值和候选项元数据，不向原组件注入 readonly props。 */
  return ({ node, value }) => {
    const props = node.props as Record<string, unknown>
    const options = readAntdVueOptionSource(props, optionsKeys)

    if (Array.isArray(value)) {
      if (pathMode) {
        const pathLabel = resolveAntdVuePathLabel(options, value)
        return renderReadonlyText(pathLabel ?? value)
      }

      const labels = value.map(item => findAntdVueOptionLabel(options, item) ?? item)
      return renderReadonlyText(labels.map(item => toDisplayString(item)).join('、'))
    }

    const label = findAntdVueOptionLabel(options, value)
    return renderReadonlyText(label ?? value)
  }
}

export function createAntdVueSwitchReadonlyAdapter(): ReadonlyAdapter {
  /** Switch 需要优先遵循 Ant Design Vue 的 checkedChildren 文案契约。 */
  return ({ node, value }) => {
    const props = node.props as Record<string, unknown>
    const checkedLabel = props.checkedChildren ?? props.activeText
    const uncheckedLabel = props.unCheckedChildren ?? props.inactiveText
    const nextLabel = value ? checkedLabel : uncheckedLabel
    return renderReadonlyText(nextLabel ?? value)
  }
}

export function createRawReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => renderReadonlyText(value)
}

function renderReadonlyText(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}
