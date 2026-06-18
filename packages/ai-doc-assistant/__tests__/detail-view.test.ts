import type { ComponentDetailResponse } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const detail: ComponentDetailResponse = {
  name: 'PopoverTableSelect',
  packageName: '@moluoxixi/components',
  description: '',
  docPath: 'docs/out-components/PopoverTableSelect.md',
  props: [
    {
      name: 'columns',
      type: 'PopoverTableColumn[]',
      required: false,
      defaultValue: null,
      description: '列配置',
      typeRefs: ['PopoverTableColumn'],
    },
  ],
  emits: [
    {
      name: 'select',
      payloadType: '[row: PopoverTableRow]',
      description: '选择行',
      typeRefs: ['PopoverTableRow'],
    },
  ],
  slots: [
    {
      name: '[dynamic]',
      scopeType: 'PopoverTableSelectSlotScope',
      description: '动态单元格插槽',
      typeRefs: ['PopoverTableSelectSlotScope'],
    },
  ],
  models: [
    {
      name: 'selectedRow',
      type: 'PopoverTableRow',
    },
    {
      name: 'plainText',
      type: 'string',
    },
    {
      name: 'extendedRow',
      type: 'PopoverTableRowExtra',
    },
  ],
  attrs: [
    {
      name: 'activeColumn',
      type: 'PopoverTableColumn',
      optional: true,
      description: '当前列',
    },
    {
      name: 'plainAttr',
      type: 'string',
      optional: true,
      description: '普通属性',
    },
  ],
  exposed: [
    {
      name: 'options',
      type: 'ThrottleOrDebounceOptions',
      description: '节流防抖配置',
      typeRefs: ['ThrottleOrDebounceOptions'],
    },
  ],
  typeDefs: [
    {
      name: 'PopoverTableColumn',
      kind: 'interface',
      raw: 'export interface PopoverTableColumn { field: string; title?: string }',
      fields: [
        { name: 'field', type: 'string', optional: false, description: '行字段名' },
        { name: 'title', type: 'string', optional: true, description: '表头标题' },
      ],
    },
    {
      name: 'PopoverTableRow',
      kind: 'type',
      raw: 'export type PopoverTableRow = Record<string, any>',
      fields: [],
    },
    {
      name: 'PopoverTableSelectSlotScope',
      kind: 'interface',
      raw: 'export interface PopoverTableSelectSlotScope { row?: PopoverTableRow; column: PopoverTableColumn }',
      fields: [
        { name: 'row', type: 'PopoverTableRow', optional: true, description: '当前行数据' },
        { name: 'column', type: 'PopoverTableColumn', optional: false, description: '当前列配置' },
      ],
    },
    {
      name: 'ThrottleOrDebounceOptions',
      kind: 'interface',
      raw: 'export interface ThrottleOrDebounceOptions { leading?: boolean; trailing?: boolean }',
      fields: [
        { name: 'leading', type: 'boolean', optional: true, description: '' },
        { name: 'trailing', type: 'boolean', optional: true, description: '' },
      ],
    },
  ],
}

vi.mock('../src/ui/api', () => ({
  fetchComponentDetail: vi.fn(async () => detail),
}))

describe('detail view', () => {
  it('prop 类型通过 tooltip 展示展开后的字段明细', async () => {
    const { default: DetailView } = await import('../src/ui/views/DetailView.vue')
    const wrapper = mount(DetailView, {
      props: { name: 'PopoverTableSelect' },
      global: {
        stubs: {
          ElTooltip: defineComponent({
            name: 'ElTooltip',
            props: { content: String, placement: String },
            setup(props, { slots }) {
              return () => h('span', {
                'data-testid': 'type-tooltip',
                'data-content': props.content,
              }, slots.default?.())
            },
          }),
        },
      },
    })
    await flushPromises()

    const tooltips = wrapper.findAll('[data-testid="type-tooltip"]')
    const contents = tooltips.map(t => t.attributes('data-content') ?? '')

    expect(tooltips.some(t => t.text().includes('PopoverTableColumn[]'))).toBe(true)
    expect(contents.some(content => content.includes('PopoverTableColumn') && content.includes('field: string（必填）'))).toBe(true)
    expect(contents.some(content => content.includes('PopoverTableRow'))).toBe(true)
    expect(tooltips.some(t => t.text().includes('PopoverTableSelectSlotScope'))).toBe(true)
    expect(contents.some(content => content.includes('row: PopoverTableRow（可选）') && content.includes('column: PopoverTableColumn（必填）'))).toBe(true)
    expect(tooltips.some(t => t.text().includes('ThrottleOrDebounceOptions'))).toBe(true)
    expect(contents.some(content => content.includes('leading: boolean（可选）') && content.includes('trailing: boolean（可选）'))).toBe(true)
    expect(tooltips.some(t => t.text() === 'PopoverTableRow')).toBe(true)
    expect(tooltips.some(t => t.text() === 'PopoverTableColumn')).toBe(true)
    expect(tooltips.length).toBeGreaterThanOrEqual(6)
    expect(tooltips.some(t => t.text() === 'string')).toBe(false)
    expect(tooltips.some(t => t.text() === 'PopoverTableRowExtra')).toBe(false)
  })
})
