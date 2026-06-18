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
    fetchComponentDetail.mockResolvedValue(detail)
    exportComponentDetail.mockClear()
    preparePdfExport.mockClear()
    preparedPdf.fill.mockClear()
    preparedPdf.fail.mockClear()
  })

  it('总览卡片显示带 icon 的多格式导出入口，点击导出不打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    const exportButtons = wrapper.findAll('[data-testid="card-export-btn"]')
    expect(exportButtons).toHaveLength(3)
    expect(exportButtons.map(button => button.text())).toEqual(['📝', '🧩', '📄'])

    await exportButtons[0].trigger('click')
    await flushPromises()

    expect(fetchComponentDetail).toHaveBeenCalledWith('DemoButton')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'markdown')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('总览卡片 PDF 导出会同步预打开打印窗口并在详情加载后填充', async () => {
    const { default: OverviewView } = await import('../src/ui/views/OverviewView.vue')
    const wrapper = mount(OverviewView, { props: { components } })

    const pdfButton = wrapper.findAll('[data-testid="card-export-btn"]')[2]
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

    const pdfButton = wrapper.findAll('[data-testid="card-export-btn"]')[2]
    await pdfButton.trigger('click')
    await flushPromises()

    expect(preparePdfExport).toHaveBeenCalledTimes(1)
    expect(preparedPdf.fill).not.toHaveBeenCalled()
    expect(preparedPdf.fail).toHaveBeenCalledWith('详情加载失败')
  })

  it('详情页显示带 icon 的导出按钮', async () => {
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

    const exportButtons = wrapper.findAll('[data-testid="detail-export-btn"]')
    expect(exportButtons).toHaveLength(3)
    expect(exportButtons.map(button => button.text())).toEqual([
      '📝 导出 Markdown',
      '🧩 导出 JSON',
      '📄 导出 PDF',
    ])

    await exportButtons[2].trigger('click')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'pdf')
  })
})
