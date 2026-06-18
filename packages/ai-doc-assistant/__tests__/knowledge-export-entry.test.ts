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
const preparedPdf = {
  fail: vi.fn(),
  fill: vi.fn(),
}
const preparePdfExport = vi.fn(() => preparedPdf)

vi.mock('../src/ui/api', () => ({
  fetchComponentDetail,
}))

vi.mock('../src/ui/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ui/export')>()
  return {
    ...actual,
    exportComponentDetail,
    preparePdfExport,
  }
})

describe('knowledge export entry points', () => {
  beforeEach(() => {
    fetchComponentDetail.mockClear()
    fetchComponentDetail.mockResolvedValue(detail)
    exportComponentDetail.mockClear()
    preparePdfExport.mockClear()
    preparedPdf.fill.mockClear()
    preparedPdf.fail.mockClear()
  })

  it('总览卡片只显示一个导出按钮，点击后下拉选择导出类型且不打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    expect(wrapper.findAll('[data-testid="card-export-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="card-export-option"]')).toHaveLength(0)

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const exportOptions = wrapper.findAll('[data-testid="card-export-option"]')
    expect(exportOptions).toHaveLength(3)
    expect(exportOptions.map(button => button.text())).toEqual(['📝 Markdown', '🧩 JSON', '📄 PDF'])
    expect(fetchComponentDetail).not.toHaveBeenCalled()

    await exportOptions[0].trigger('click')
    await flushPromises()

    expect(fetchComponentDetail).toHaveBeenCalledWith('DemoButton')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'markdown')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('总览卡片 PDF 导出会同步预打开打印窗口并在详情加载后填充', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const pdfButton = wrapper.findAll('[data-testid="card-export-option"]')[2]
    await pdfButton.trigger('click')

    expect(preparePdfExport).toHaveBeenCalledTimes(1)
    expect(exportComponentDetail).not.toHaveBeenCalled()

    await flushPromises()

    expect(fetchComponentDetail).toHaveBeenCalledWith('DemoButton')
    expect(preparedPdf.fill).toHaveBeenCalledWith(detail)
    expect(preparedPdf.fail).not.toHaveBeenCalled()
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('总览卡片 PDF 导出详情加载失败时写入预打开窗口的失败信息', async () => {
    fetchComponentDetail.mockRejectedValueOnce(new Error('详情加载失败'))
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const pdfButton = wrapper.findAll('[data-testid="card-export-option"]')[2]
    await pdfButton.trigger('click')
    await flushPromises()

    expect(preparePdfExport).toHaveBeenCalledTimes(1)
    expect(preparedPdf.fill).not.toHaveBeenCalled()
    expect(preparedPdf.fail).toHaveBeenCalledWith('详情加载失败')
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

  it('总览 PDF 预打开窗口失败时展示错误条', async () => {
    preparePdfExport.mockImplementationOnce(() => {
      throw new Error('无法打开 PDF 打印窗口')
    })
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const pdfButton = wrapper.findAll('[data-testid="card-export-option"]')[2]
    await pdfButton.trigger('click')
    await flushPromises()

    expect(fetchComponentDetail).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="overview-export-error"]').text()).toBe('无法打开 PDF 打印窗口')
  })

  it('详情页只显示一个带 icon 的导出按钮，点击后下拉选择导出类型', async () => {
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
    expect(exportOptions).toHaveLength(3)
    expect(exportOptions.map(button => button.text())).toEqual([
      '📝 Markdown',
      '🧩 JSON',
      '📄 PDF',
    ])

    await exportOptions[2].trigger('click')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'pdf')
  })
})
