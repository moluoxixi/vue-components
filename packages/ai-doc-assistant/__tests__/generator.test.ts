import type { ComponentContract } from '../src/core/types'
import { describe, expect, it } from 'vitest'
import { renderExampleSkeleton, renderSearchableDoc } from '../src/core/generator'

/** 构造测试用契约。 */
function makeContract(over: Partial<ComponentContract> = {}): ComponentContract {
  return {
    name: 'MyButton',
    packageName: '@moluoxixi/components',
    description: '一个按钮',
    props: [
      { name: 'type', type: 'string', required: false, defaultValue: 'default', description: '按钮类型', typeRefs: [] },
      { name: 'disabled', type: 'boolean', required: false, defaultValue: 'false', description: '是否禁用', typeRefs: [] },
      { name: 'count', type: 'number', required: true, defaultValue: null, description: '计数', typeRefs: [] },
    ],
    emits: [
      { name: 'click', payloadType: 'MouseEvent', description: '点击事件' },
    ],
    slots: [
      { name: 'default', scopeType: '', description: '默认插槽' },
    ],
    models: [
      { name: 'modelValue', type: 'string', description: '双向绑定值' },
    ],
    sourceFile: 'packages/components/src/MyButton/src/index.vue',
    typeDefs: [],
    ...over,
  }
}

describe('renderSearchableDoc', () => {
  it('包含组件名、包名与描述', () => {
    const doc = renderSearchableDoc(makeContract())
    expect(doc).toContain('MyButton')
    expect(doc).toContain('@moluoxixi/components')
    expect(doc).toContain('一个按钮')
  })

  it('列出所有 Props 名称与类型', () => {
    const doc = renderSearchableDoc(makeContract())
    expect(doc).toContain('type')
    expect(doc).toContain('disabled')
    expect(doc).toContain('count')
    expect(doc).toContain('boolean')
  })

  it('包含事件与插槽信息', () => {
    const doc = renderSearchableDoc(makeContract())
    expect(doc).toContain('click')
    expect(doc).toContain('default')
  })

  it('无 props 时不抛错', () => {
    const doc = renderSearchableDoc(makeContract({ props: [], emits: [], slots: [], models: [] }))
    expect(doc).toContain('MyButton')
  })
})

describe('renderExampleSkeleton', () => {
  it('生成可识别的 Vue SFC 骨架', () => {
    const code = renderExampleSkeleton(makeContract())
    expect(code).toContain('<template>')
    expect(code).toContain('<MyButton')
    expect(code).toContain('script setup')
  })

  it('必填 prop 渲染为绑定占位', () => {
    const code = renderExampleSkeleton(makeContract())
    // count 必填，应出现在示例中
    expect(code).toContain('count')
  })

  it('可选且有默认值的 prop 不渲染（保持示例精简，仅必填 prop + v-model）', () => {
    const code = renderExampleSkeleton(makeContract())
    // type/disabled 可选且有默认值，骨架刻意省略，避免噪音
    expect(code).not.toMatch(/\btype=/)
    expect(code).not.toMatch(/\bdisabled=/)
    // 必填 count 与 v-model 仍渲染
    expect(code).toContain(':count="count"')
    expect(code).toContain('v-model:modelValue=')
  })

  it('包含 import 语句引用包名', () => {
    const code = renderExampleSkeleton(makeContract())
    expect(code).toContain('@moluoxixi/components')
  })
})
