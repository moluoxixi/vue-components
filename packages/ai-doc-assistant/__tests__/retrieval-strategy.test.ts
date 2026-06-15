import type { ComponentContract } from '../src/core/types'
import { describe, expect, it } from 'vitest'
import { ContentStrategy } from '../src/core/retrieval-strategy'

function contract(name: string, description: string, propNames: string[] = []): ComponentContract {
  return {
    name,
    packageName: '@moluoxixi/components',
    description,
    props: propNames.map(prop => ({
      name: prop,
      type: 'string',
      required: false,
      defaultValue: null,
      description: prop,
      typeRefs: [],
    })),
    emits: [],
    slots: [],
    models: [],
    sourceFile: `packages/components/src/${name}/src/index.vue`,
    typeDefs: [],
  }
}

describe('content strategy', () => {
  it('按问题关键词把相关组件排在兜底示例首位', async () => {
    const strategy = new ContentStrategy()
    await strategy.build([
      contract('PopoverTableSelect', '下拉表格选择，支持动态插槽。', ['columns', 'data']),
      contract('DateRangePicker', '时间选择器，支持禁用日期范围和最近几天范围。', ['disabledDateRange', 'dateRange']),
      contract('EnterNextContainer', 'Enter 键焦点跳转容器。', ['virtualRef']),
    ])

    const result = await strategy.retrieve('时间选择器最近四天禁用', 5)

    expect(result.chunks[0].component).toBe('DateRangePicker')
    expect(result.chunks[0].score).toBeGreaterThan(result.chunks[1].score)
  })

  it('中文问题可命中英文组件名和 prop 名', async () => {
    const strategy = new ContentStrategy()
    await strategy.build([
      contract('PopoverTableSelect', '', ['columns', 'data']),
      contract('DateRangePicker', '', ['disabledDateRange', 'dateRange']),
      contract('EnterNextContainer', '', ['virtualRef']),
    ])

    const result = await strategy.retrieve('时间选择器最近四天禁用', 5)

    expect(result.chunks[0].component).toBe('DateRangePicker')
    expect(result.chunks[0].score).toBeGreaterThan(0)
  })
})
