import type { ReadonlyAdapter, ReadonlyAdapterRegistry } from '@moluoxixi/config-form/plugins'
import type { VNodeChild } from 'vue'
import { h, toDisplayString } from 'vue'
import { findShadcnOptionLabel, joinShadcnLabels, readShadcnOptions } from './options'

export function createRawReadonlyAdapter(): ReadonlyAdapter {
  return ({ value }) => renderReadonlyText(value)
}

export function createShadcnChoiceReadonlyAdapter(): ReadonlyAdapter {
  /** 选择类只读态根据示例字段的 options 元数据展示 label，而不是泄漏内部 value。 */
  return ({ node, value }) => {
    const options = readShadcnOptions(node.props)

    if (Array.isArray(value)) {
      const labels = value.map(item => findShadcnOptionLabel(options, item) ?? item)
      return renderReadonlyText(joinShadcnLabels(labels))
    }

    return renderReadonlyText(findShadcnOptionLabel(options, value) ?? value)
  }
}

function renderReadonlyText(value: unknown): VNodeChild {
  return h('span', toDisplayString(value))
}

const rawReadonlyAdapter = createRawReadonlyAdapter()

/** shadcn-vue playground 字段组件的只读展示适配表。 */
export const SHADCN_VUE_READONLY_ADAPTERS: ReadonlyAdapterRegistry = Object.freeze({
  Input: rawReadonlyAdapter,
  NativeSelect: createShadcnChoiceReadonlyAdapter(),
  Textarea: rawReadonlyAdapter,
})
