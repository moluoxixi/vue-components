import type { ComponentDetailResponse, ComponentListItem } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const detail: ComponentDetailResponse = {
  name: 'DemoButton',
  packageName: '@demo/components',
  description: '演示按钮',
  docPath: 'packages/components/src/DemoButton/index.vue',
  props: [],
  emits: [],
  slots: [],
  models: [],
  typeDefs: [],
}

const components: ComponentListItem[] = [
  { name: 'DemoButton', packageName: '@demo/components', propsCount: 0, docPath: detail.docPath },
]

const fetchComponentDetail = vi.fn(async () => detail)
const exportComponentDetail = vi.fn()

vi.mock('../src/ui/api', () => ({
  fetchComponentDetail,
}))

vi.mock('../src/ui/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ui/export')>()
  return {
    ...actual,
    exportComponentDetail,
  }
})

describe('knowledge export entry points', () => {
  beforeEach(() => {
    fetchComponentDetail.mockClear()
    fetchComponentDetail.mockResolvedValue(detail)
    exportComponentDetail.mockClear()
  })

  it('总览卡片只显示一个导出按钮，点击后下拉选择普通 JSON 且不打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    expect(wrapper.findAll('[data-testid="card-export-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="card-export-option"]')).toHaveLength(0)

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const exportOptions = wrapper.findAll('[data-testid="card-export-option"]')
    expect(exportOptions).toHaveLength(1)
    expect(exportOptions.map(button => button.text())).toEqual(['🧩 JSON'])
    expect(fetchComponentDetail).not.toHaveBeenCalled()

    await exportOptions[0].trigger('click')
    await flushPromises()

    expect(fetchComponentDetail).toHaveBeenCalledWith('DemoButton')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'json')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('总览卡片 JSON 导出详情加载失败时展示错误条', async () => {
    fetchComponentDetail.mockRejectedValueOnce(new Error('详情加载失败'))
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const jsonButton = wrapper.find('[data-testid="card-export-option"]')
    await jsonButton.trigger('click')
    await flushPromises()

    expect(exportComponentDetail).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="overview-export-error"]').text()).toBe('详情加载失败')
  })

  it('总览卡片导出下拉选项键盘触发不会冒泡打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const exportOption = wrapper.find('[data-testid="card-export-option"]')
    await exportOption.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('详情页只显示一个导出按钮，点击后下拉选择普通 JSON', async () => {
    const { default: DetailView } = await import('../src/ui/views/DetailView.vue')
    const wrapper = mount(DetailView, {
      props: { name: 'DemoButton' },
      global: {
        stubs: {
          ElTooltip: defineComponent({
            name: 'ElTooltip',
            setup(_, { slots }) {
              return () => h('span', slots.default?.())
            },
          }),
        },
      },
    })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="detail-export-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="detail-export-option"]')).toHaveLength(0)

    await wrapper.find('[data-testid="detail-export-trigger"]').trigger('click')
    const exportOptions = wrapper.findAll('[data-testid="detail-export-option"]')
    expect(exportOptions).toHaveLength(1)
    expect(exportOptions.map(button => button.text())).toEqual(['🧩 JSON'])

    await exportOptions[0].trigger('click')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'json')
  })
})
