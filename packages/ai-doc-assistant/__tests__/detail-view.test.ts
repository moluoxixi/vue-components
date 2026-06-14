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
  emits: [],
  slots: [],
  models: [],
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

    const tooltip = wrapper.get('[data-testid="type-tooltip"]')
    expect(tooltip.text()).toContain('PopoverTableColumn[]')
    expect(tooltip.attributes('data-content')).toContain('PopoverTableColumn')
    expect(tooltip.attributes('data-content')).toContain('field: string（必填）')
    expect(tooltip.attributes('data-content')).toContain('title: string（可选）')
  })
})
