import type { ComponentDetailResponse, ComponentListItem } from '../src/shared/protocol'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, provide, ref } from 'vue'

const dropdownCommandKey = Symbol('dropdown-command')
const dropdownStubs = {
  ElDropdown: defineComponent({
    name: 'ElDropdown',
    emits: ['command'],
    setup(_, { emit, slots }) {
      const open = ref(false)
      provide(dropdownCommandKey, (command: unknown) => emit('command', command))
      return () => h('div', [
        h('span', { onClickCapture: () => { open.value = !open.value } }, slots.default?.()),
        open.value ? slots.dropdown?.() : null,
      ])
    },
  }),
  ElDropdownMenu: defineComponent({
    name: 'ElDropdownMenu',
    setup(_, { attrs, slots }) {
      return () => h('div', { ...attrs, role: 'menu' }, slots.default?.())
    },
  }),
  ElDropdownItem: defineComponent({
    name: 'ElDropdownItem',
    inheritAttrs: false,
    props: { command: [String, Number, Object], disabled: Boolean },
    setup(props, { attrs, slots }) {
      const send = inject<(command: unknown) => void>(dropdownCommandKey)
      const invoke = (event: Event) => {
        event.stopPropagation()
        if (!props.disabled)
          send?.(props.command)
      }
      return () => h('button', {
        ...attrs,
        disabled: props.disabled,
        onClick: invoke,
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ')
            invoke(event)
        },
      }, slots.default?.())
    },
  }),
}

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

  it('总览卡片主体使用独立按钮打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/App/components/OverviewView/index.vue')
    const wrapper = mount(OverviewView, { props: { components }, global: { stubs: dropdownStubs } })
    const openButton = wrapper.find('[data-testid="component-open"]')

    expect(openButton.element.tagName).toBe('BUTTON')
    expect(openButton.find('button').exists()).toBe(false)

    await openButton.trigger('click')
    expect(wrapper.emitted('open')).toEqual([['DemoButton']])
  })

  it('总览卡片只显示一个导出按钮，点击后下拉选择普通 JSON 且不打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/App/components/OverviewView/index.vue')
    const wrapper = mount(OverviewView, { props: { components }, global: { stubs: dropdownStubs } })

    expect(wrapper.findAll('[data-testid="card-export-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="card-export-option"]')).toHaveLength(0)

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const exportOptions = wrapper.findAll('[data-testid="card-export-option"]')
    expect(exportOptions).toHaveLength(1)
    expect(exportOptions.map(button => button.text())).toEqual(['JSON'])
    expect(fetchComponentDetail).not.toHaveBeenCalled()

    await exportOptions[0].trigger('click')
    await flushPromises()

    expect(fetchComponentDetail).toHaveBeenCalledWith('DemoButton')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'json')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('总览卡片 JSON 导出详情加载失败时展示错误条', async () => {
    fetchComponentDetail.mockRejectedValueOnce(new Error('详情加载失败'))
    const { default: OverviewView } = await import('../src/ui/App/components/OverviewView/index.vue')
    const wrapper = mount(OverviewView, { props: { components }, global: { stubs: dropdownStubs } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const jsonButton = wrapper.find('[data-testid="card-export-option"]')
    await jsonButton.trigger('click')
    await flushPromises()

    expect(exportComponentDetail).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="overview-export-error"]').text()).toBe('详情加载失败')
  })

  it('总览卡片导出下拉选项键盘触发不会冒泡打开详情', async () => {
    const { default: OverviewView } = await import('../src/ui/App/components/OverviewView/index.vue')
    const wrapper = mount(OverviewView, { props: { components }, global: { stubs: dropdownStubs } })

    await wrapper.find('[data-testid="card-export-trigger"]').trigger('click')
    const exportOption = wrapper.find('[data-testid="card-export-option"]')
    await exportOption.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('详情页只显示一个导出按钮，点击后下拉选择普通 JSON', async () => {
    const { default: DetailView } = await import('../src/ui/App/components/DetailView/index.vue')
    const wrapper = mount(DetailView, {
      props: { name: 'DemoButton' },
      global: {
        stubs: {
          ...dropdownStubs,
        },
      },
    })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="detail-export-trigger"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="detail-export-option"]')).toHaveLength(0)

    await wrapper.find('[data-testid="detail-export-trigger"]').trigger('click')
    const exportOptions = wrapper.findAll('[data-testid="detail-export-option"]')
    expect(exportOptions).toHaveLength(1)
    expect(exportOptions.map(button => button.text())).toEqual(['JSON'])

    await exportOptions[0].trigger('click')
    expect(exportComponentDetail).toHaveBeenCalledWith(detail, 'json')
  })
})
