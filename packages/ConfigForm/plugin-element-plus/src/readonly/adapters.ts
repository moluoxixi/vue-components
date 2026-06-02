import type { ReadonlyAdapter } from '@moluoxixi/config-form/plugins'
import type { VNodeChild } from 'vue'
import { h, toDisplayString } from 'vue'
import {
  findElementPlusOptionLabel,
  readElementPlusOptionKeys,
  readElementPlusOptionSource,
  resolveElementPlusPathLabel,
} from './options'

export function createElementPlusChoiceReadonlyAdapter(
  optionsKeys: readonly string[],
  pathMode = false,
): ReadonlyAdapter {
  /** 选择类只读态只消费字段值和候选项元数据，不向原组件注入 readonly props。 */
  return ({ node, value }) => {
    const optionKeys = readElementPlusOptionKeys(node)
    const options = readElementPlusOptionSource(node, optionsKeys)

    if (Array.isArray(value)) {
      if (pathMode) {
        const pathLabel = resolveElementPlusPathLabel(options, value, optionKeys)
        return renderReadonlyText(pathLabel ?? value)
      }

      const labels = value.map(item => findElementPlusOptionLabel(options, item, optionKeys) ?? item)
      return renderReadonlyText(labels.map(item => toDisplayString(item)).join('、'))
    }

    const label = findElementPlusOptionLabel(options, value, optionKeys)
    return renderReadonlyText(label ?? value)
  }
}

export function createElementPlusSwitchReadonlyAdapter(): ReadonlyAdapter {
  /** Switch 需要遵循 Element Plus 的 active/inactive value 与文案契约。 */
  return ({ node, value }) => {
    const props = node.props
    const activeValue = Object.hasOwn(props, 'activeValue') ? props.activeValue : true
    const inactiveValue = Object.hasOwn(props, 'inactiveValue') ? props.inactiveValue : false
    const label = Object.is(value, activeValue)
      ? props.activeText
      : Object.is(value, inactiveValue)
        ? props.inactiveText
        : value

    return renderReadonlyText(label ?? value)
  }
}

export function createElementPlusColorReadonlyAdapter(): ReadonlyAdapter {
  /** ColorPicker 展示色块和原始色值，保留测试定位点用于插件回归验证。 */
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
    renderReadonlyText(value),
  ])
}

export function createRawReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => renderReadonlyText(value)
}

function renderReadonlyText(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}
