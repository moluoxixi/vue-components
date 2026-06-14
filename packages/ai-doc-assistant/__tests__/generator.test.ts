import type { ComponentContract } from '../src/core/types'
import { describe, expect, it } from 'vitest'
import { renderExample, renderExampleSkeleton, renderSearchableDoc } from '../src/core/generator'

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

  it('结构化数组 prop（带字段类型）生成真实样例对象而非空数组', () => {
    const c = makeContract({
      name: 'PopoverTableSelect',
      props: [
        { name: 'columns', type: 'PopoverTableColumn[]', required: false, defaultValue: '() => []', description: '列定义', typeRefs: ['PopoverTableColumn'] },
        { name: 'data', type: 'PopoverTableRow[]', required: false, defaultValue: '() => []', description: '数据行', typeRefs: ['PopoverTableRow'] },
        { name: 'popType', type: 'PopoverTablePopType', required: false, defaultValue: '\'input\'', description: '触发方式', typeRefs: [] },
        { name: 'debounce', type: 'number', required: false, defaultValue: '0', description: '防抖', typeRefs: [] },
      ],
      emits: [{ name: 'select', payloadType: 'PopoverTableRow', description: '选择行' }],
      slots: [{ name: '[dynamic]', scopeType: 'Record<string, any>', description: '按列 field 声明的单元格插槽' }],
      models: [],
      typeDefs: [
        {
          name: 'PopoverTableColumn',
          kind: 'interface',
          fields: [
            { name: 'field', type: 'string', optional: false, description: '列字段' },
            { name: 'title', type: 'string', optional: true, description: '列标题' },
            { name: 'width', type: 'number | string', optional: true, description: '列宽' },
          ],
          raw: 'interface PopoverTableColumn { field: string; title?: string; width?: number | string }',
        },
        { name: 'PopoverTableRow', kind: 'type', fields: [], raw: 'type PopoverTableRow = Record<string, any>' },
      ],
    })
    const { ts, js } = renderExample(c)
    // TS 版必须导入示例里用到的契约类型，复制后才可直接 typecheck
    expect(ts).toContain('import type { PopoverTableColumn, PopoverTableRow } from \'@moluoxixi/components\'')
    // columns 展开为含 field/title 的真实列对象，不是空 []
    expect(ts).toContain('const columns = ref<PopoverTableColumn[]>([')
    expect(ts).toContain('field: \'name\'')
    expect(ts).toContain('field: \'price\'')
    expect(ts).toContain('title: \'姓名\'')
    expect(ts).toContain('title: \'价格\'')
    expect(ts).toContain('slots: { default: \'price\' }')
    // data 与 columns 的 field 联动，key 为 name/price，值是可读样例数据
    expect(ts).toContain('name: \'张三\'')
    expect(ts).toContain('price: 18')
    // 模板绑定结构化 prop
    expect(ts).toContain(':columns="columns"')
    expect(ts).toContain(':data="data"')
    expect(ts).toContain('@select="handleSelect"')
    expect(ts).toContain('function handleSelect(row: PopoverTableRow): void')
    expect(ts).toContain('<template #price="{ row }">')
    expect(ts).toContain('¥{{ row.price }}')
    // 次要 prop（debounce）不应挤占结构化数据 prop 的展示位
    expect(ts).not.toContain(':debounce=')
    // 不为了预览可见性额外改变组件行为；可选默认 prop 不应被主动塞入示例。
    expect(ts).not.toContain('pop-type=')
    // JS 版无类型注解但数据一致
    expect(js).toContain('const columns = ref([')
    expect(js).not.toContain('import type')
    expect(js).not.toContain('PopoverTableColumn[]')
    expect(js).toContain('function handleSelect(row) {')
    expect(js).toContain('<template #price="{ row }">')
    expect(js).toContain('field: \'name\'')
  })

  it('无结构化 prop 的组件保持原有「前 3 个 prop」骨架行为', () => {
    const c = makeContract({
      props: [
        { name: 'size', type: 'string', required: false, defaultValue: 'medium', description: '尺寸', typeRefs: [] },
      ],
      emits: [],
      slots: [],
      models: [],
      typeDefs: [],
    })
    const { ts } = renderExample(c)
    expect(ts).toContain('<MyButton')
    expect(ts).toContain('size=')
  })
})
