import type { PopoverTableRow } from './index'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { PopoverTableSelect } from './index'
import PopoverTableSelectBase from './src/base/index.vue'

const selectedRow: PopoverTableRow = {
  code: 'C-009',
  name: '测试仓',
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

async function waitFor(assertion: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now()
  let lastError: unknown
  while (true) {
    try {
      if (assertion())
        return
    }
    catch (error) {
      lastError = error
    }
    if (Date.now() - start > timeout) {
      if (lastError)
        throw lastError
      throw new Error('waitFor: timed out before condition was met')
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
  },
  emits: ['blur', 'clear', 'focus', 'input', 'update:modelValue'],
  setup(props, { emit }) {
    /**
     * 模拟 Element Plus Input 的 v-model 与 input 事件双契约。
     * 外层组件依赖两者分别维护本地展示值和对外 inputValue。
     */
    function handleInput(event: Event): void {
      const value = (event.target as HTMLInputElement).value
      emit('update:modelValue', value)
      emit('input', value)
    }

    return () => h('div', { 'data-testid': 'input-stub' }, [
      h('input', {
        'data-testid': 'popover-input',
        'onBlur': () => emit('blur'),
        'onFocus': () => emit('focus'),
        'onInput': handleInput,
        'placeholder': props.placeholder,
        'value': props.modelValue,
      }),
      h('button', {
        'data-testid': 'clear-input',
        'onClick': () => emit('clear'),
        'type': 'button',
      }, 'clear'),
    ])
  },
})

const BaseStub = defineComponent({
  name: 'PopoverTableSelectBase',
  props: {
    data: { type: Array, default: () => [] },
    loading: Boolean,
    modelValue: Boolean,
    popoverProps: { type: Object, default: () => ({}) },
    virtualRef: { type: Object, default: null },
  },
  emits: ['enter', 'scrollBoundary', 'select'],
  setup(props, { emit, slots }) {
    /**
     * 模拟弹层表格的三个关键用户动作：
     * 选择行、键盘确认行、滚动到底部。
     */
    return () => h('section', { 'data-testid': 'table-base-stub' }, [
      h('span', { 'data-testid': 'base-visible' }, props.modelValue ? 'open' : 'closed'),
      h('span', { 'data-testid': 'base-loading' }, props.loading ? 'loading' : 'idle'),
      h('span', { 'data-testid': 'base-data' }, JSON.stringify(props.data)),
      slots.default?.({ row: selectedRow, value: selectedRow.name }),
      h('div', { 'data-testid': 'base-footer' }, slots.footer?.()),
      h('button', {
        'data-testid': 'select-row',
        'onClick': () => emit('select', selectedRow),
        'type': 'button',
      }, 'select'),
      h('button', {
        'data-testid': 'enter-row',
        'onClick': () => emit('enter', selectedRow),
        'type': 'button',
      }, 'enter'),
      h('button', {
        'data-testid': 'load-more',
        'onClick': () => emit('scrollBoundary', { direction: 'bottom' }),
        'type': 'button',
      }, 'load more'),
    ])
  },
})

const ElPaginationStub = defineComponent({
  name: 'ElPagination',
  props: {
    currentPage: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    total: { type: Number, default: 0 },
  },
  emits: ['update:currentPage', 'update:pageSize'],
  setup(props, { emit }) {
    return () => h('div', { 'data-testid': 'pagination-stub' }, [
      h('span', { 'data-testid': 'pagination-state' }, `${props.currentPage}/${props.pageSize}/${props.total}`),
      h('button', {
        'data-testid': 'popover-next-page',
        'onClick': () => emit('update:currentPage', props.currentPage + 1),
        'type': 'button',
      }, 'next'),
    ])
  },
})

function getColumnId(column: Record<string, any>): string {
  return String(column.dataKey ?? column.key ?? column.title)
}

const ElTableV2Stub = defineComponent({
  name: 'ElTableV2',
  props: {
    columns: { type: Array, default: () => [] },
    data: { type: Array, default: () => [] },
    height: { type: Number, default: 300 },
    rowClass: { type: [String, Function], default: undefined },
    width: { type: Number, default: 400 },
  },
  setup(props, { slots }) {
    function resolveRowClass(rowData: Record<string, any>, rowIndex: number): string {
      if (typeof props.rowClass === 'function') {
        return props.rowClass({
          columns: props.columns,
          rowData,
          rowIndex,
        })
      }

      return props.rowClass ?? ''
    }

    return () => {
      const columns = props.columns as Array<Record<string, any>>
      const rows = props.data as Array<Record<string, any>>

      return h('div', {
        'data-height': String(props.height),
        'data-testid': 'el-table-v2-stub',
        'data-width': String(props.width),
      }, [
        rows.length > 0
          ? [
              h('div', {
                'class': resolveRowClass(rows[0], 0),
                'data-testid': 'table-row-0',
              }),
              h('div', { 'data-testid': 'virtual-header' }, columns.map((column, columnIndex) => h('section', {
                'data-testid': `header-${getColumnId(column)}`,
              }, slots['header-cell']?.({
                column,
                columnIndex,
                columns,
                headerIndex: 0,
                style: {},
              }) ?? column.title))),
              ...rows.map((rowData, rowIndex) => h('div', { 'data-testid': `virtual-row-${rowIndex}` }, columns.map((column, columnIndex) => h('div', {
                'data-testid': `cell-${getColumnId(column)}`,
              }, slots.cell?.({
                column,
                columnIndex,
                columns,
                depth: 0,
                isScrolling: false,
                rowData,
                rowIndex,
                style: {},
              }) ?? rowData[getColumnId(column)])))),
            ]
          : (slots.empty?.() ?? h('div', { 'data-testid': 'empty-text' }, '暂无数据')),
      ])
    }
  },
})

function defineScrollMetrics(element: HTMLElement, metrics: { clientHeight: number, scrollHeight: number, scrollTop: number }): void {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: { configurable: true, value: metrics.scrollTop },
  })
}

function createVirtualInput(): HTMLInputElement {
  const input = document.createElement('input')
  document.body.append(input)
  return input
}

function createElPopoverStub(update: () => void) {
  return defineComponent({
    name: 'ElPopover',
    setup(_, { expose, slots }) {
      /**
       * 暴露 Element Plus popover 的定位更新链路，验证基座组件何时触发 popper update。
       */
      expose({
        popperRef: {
          popperInstanceRef: { update },
        },
      })

      return () => h('div', { 'data-testid': 'el-popover-stub' }, slots.default?.())
    },
  })
}

function createEmptyElPopoverStub(update: () => void) {
  return defineComponent({
    name: 'ElPopover',
    setup(_, { expose }) {
      /**
       * 模拟弹层主体尚未渲染完成但 popper 实例已经可更新的中间状态。
       */
      expose({
        popperRef: {
          popperInstanceRef: { update },
        },
      })

      return () => h('div', { 'data-testid': 'empty-el-popover-stub' })
    },
  })
}

describe('popover table select', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('默认渲染内部输入框作为弹层触发源', async () => {
    const wrapper = mount(PopoverTableSelect, {
      global: {
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()

    expect(wrapper.find('[data-testid="popover-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="table-base-stub"]').exists()).toBe(true)
  })

  it('同步输入值并透传弹层表格选择、确认和加载事件', async () => {
    const updateInputValue = vi.fn()
    const onInput = vi.fn()

    const wrapper = mount(PopoverTableSelect, {
      props: {
        'enableLoadMore': true,
        'hasMore': true,
        'inputValue': '初始仓库',
        'onInput': onInput,
        'onUpdate:inputValue': updateInputValue,
        'popType': 'input',
        'throttle': 0,
      },
      global: {
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await wrapper.get('[data-testid="popover-input"]').trigger('focus')
    expect(wrapper.get('[data-testid="base-visible"]').text()).toBe('open')

    await wrapper.get('[data-testid="popover-input"]').setValue('华南')
    await wrapper.get('[data-testid="select-row"]').trigger('click')
    await wrapper.get('[data-testid="enter-row"]').trigger('click')
    await wrapper.get('[data-testid="load-more"]').trigger('click')
    await wrapper.get('[data-testid="clear-input"]').trigger('click')

    expect(updateInputValue).toHaveBeenCalledWith('华南')
    expect(updateInputValue).toHaveBeenCalledWith('')
    expect(onInput).toHaveBeenCalledWith('华南')
    expect(wrapper.emitted('focus')![0]).toEqual([])
    expect(wrapper.emitted('input')).toEqual([[''], ['华南']])
    expect(wrapper.emitted('select')![0]).toEqual([selectedRow])
    expect(wrapper.emitted('enter')![0]).toEqual([selectedRow])
    expect(wrapper.emitted('loadMore')![0]).toEqual([])
    expect(wrapper.emitted('clear')![0]).toEqual([])
  })

  it('query 模式把请求数据传给弹层表格并默认渲染分页', async () => {
    const query = vi.fn(async (params: Record<string, unknown> & { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-001', name: `${String(params.keyword ?? '')}-${params.currentPage}` }],
      total: 18,
    }))
    const loaded = vi.fn()

    const wrapper = mount(PopoverTableSelect, {
      props: {
        columns: [{ field: 'name' }],
        inputValue: '仓库',
        params: { keyword: '仓库' },
        query,
        onLoaded: loaded,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await waitFor(() => wrapper.get('[data-testid="base-data"]').text().includes('仓库-1'))

    expect(query).toHaveBeenCalledWith({ keyword: '仓库', currentPage: 1, pageSize: 10 })
    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/18')
    expect(wrapper.get('[data-testid="base-footer"]').find('[data-testid="pagination-stub"]').exists()).toBe(true)
    expect(loaded).toHaveBeenCalledWith({ data: [{ code: 'Q-001', name: '仓库-1' }], total: 18 })
  })

  it('静态 data 更新会继续同步给弹层表格', async () => {
    const wrapper = mount(PopoverTableSelect, {
      props: {
        data: [{ code: 'S-001', name: '初始仓库' }],
      },
      global: {
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    expect(wrapper.get('[data-testid="base-data"]').text()).toContain('初始仓库')

    await wrapper.setProps({ data: [{ code: 'S-002', name: '更新仓库' }] })
    await nextTick()

    expect(wrapper.get('[data-testid="base-data"]').text()).toContain('更新仓库')
  })

  it('pagination=false 隐藏分页且滚动到底仍只触发旧 loadMore', async () => {
    const query = vi.fn(async (params: { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-002', name: `第${params.currentPage}页` }],
      total: 18,
    }))

    const wrapper = mount(PopoverTableSelect, {
      props: {
        enableLoadMore: true,
        hasMore: true,
        pagination: false,
        query,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await waitFor(() => wrapper.get('[data-testid="base-data"]').text().includes('第1页'))
    await wrapper.get('[data-testid="load-more"]').trigger('click')

    expect(wrapper.find('[data-testid="pagination-stub"]').exists()).toBe(false)
    expect(wrapper.emitted('loadMore')![0]).toEqual([])
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('分页变化写回 v-model 并触发 pageChange', async () => {
    const query = vi.fn(async (params: { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-003', name: `第${params.currentPage}页` }],
      total: 18,
    }))
    const pageChange = vi.fn()

    const wrapper = mount(PopoverTableSelect, {
      props: {
        currentPage: 2,
        pageSize: 10,
        query,
        onPageChange: pageChange,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '2/10/18')
    await wrapper.get('[data-testid="popover-next-page"]').trigger('click')
    await waitFor(() => query.mock.calls.at(-1)?.[0].currentPage === 3)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([3])
    expect(pageChange).toHaveBeenLastCalledWith({ currentPage: 3, pageSize: 10 })
  })

  it('params 变化时默认重置到第一页', async () => {
    const query = vi.fn(async (params: Record<string, unknown> & { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-004', name: `${String(params.keyword ?? '')}-${params.currentPage}` }],
      total: 18,
    }))
    const wrapper = mount(PopoverTableSelect, {
      props: {
        currentPage: 4,
        pageSize: 10,
        params: { keyword: '初始' },
        query,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '4/10/18')

    await wrapper.setProps({ params: { keyword: '更新' } })
    await waitFor(() => query.mock.calls.at(-1)?.[0].keyword === '更新' && query.mock.calls.at(-1)?.[0].currentPage === 1)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([1])
    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/18')
  })

  it('query 失败时透出 error 事件', async () => {
    const failure = new Error('popover failed')
    const error = vi.fn()
    const query = vi.fn(async () => {
      throw failure
    })

    mount(PopoverTableSelect, {
      props: {
        query,
        onError: error,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await waitFor(() => error.mock.calls.length === 1)

    expect(error).toHaveBeenCalledWith(failure)
  })

  it('调度配置变化和组件卸载时取消尚未触发的选择事件', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PopoverTableSelect, {
      props: {
        debounce: 20,
        popType: 'input',
        throttle: 0,
      },
      global: {
        stubs: {
          ElInput: InputStub,
          ElPagination: ElPaginationStub,
          PopoverTableSelectBase: BaseStub,
        },
      },
    })

    await nextTick()
    await nextTick()

    await wrapper.get('[data-testid="select-row"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.setProps({ debounce: 40 })
    vi.advanceTimersByTime(20)
    expect(wrapper.emitted('select')).toBeUndefined()

    await wrapper.get('[data-testid="select-row"]').trigger('click')
    wrapper.unmount()
    vi.advanceTimersByTime(40)

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('隐藏状态下数据和列变化不会触发弹层定位更新', async () => {
    const update = vi.fn()
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        data: [{ name: '初始仓库' }],
        modelValue: false,
        virtualRef: createVirtualInput(),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(update),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })

    await nextTick()
    await nextTick()
    expect(update).not.toHaveBeenCalled()

    await wrapper.setProps({
      columns: [{ field: 'name' }, { field: 'code' }],
      data: [{ code: 'C-001', name: '更新仓库' }],
    })
    await nextTick()
    await nextTick()
    expect(update).not.toHaveBeenCalled()

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await nextTick()

    expect(update).toHaveBeenCalledTimes(1)
  })

  it('动态表头和单元格插槽收到明确的行列作用域参数', async () => {
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [
          { field: 'name', slots: { default: 'nameCell', header: 'nameHeader' } },
        ],
        data: [{ code: 'C-001', name: '初始仓库' }],
        modelValue: true,
        virtualRef: createVirtualInput(),
      },
      slots: {
        nameHeader: ({ column, columnIndex }: any) => h('span', { 'data-testid': 'header-slot' }, `${column.field}:${columnIndex}`),
        nameCell: ({ row, column, rowIndex, columnIndex, value }: any) => h(
          'span',
          { 'data-testid': 'cell-slot' },
          `${row.code}:${column.field}:${rowIndex}:${columnIndex}:${value}`,
        ),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })

    await nextTick()

    expect(wrapper.get('[data-testid="header-slot"]').text()).toBe('name:0')
    expect(wrapper.get('[data-testid="cell-slot"]').text()).toBe('C-001:name:0:0:初始仓库')
  })

  it('列配置 render 函数可直接渲染弹层表头和单元格', async () => {
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [
          {
            field: 'name',
            slots: {
              header: ({ column, index, columns, data }: any) => h('span', { 'data-testid': 'header-render' }, `${column.field}:${index}:${columns.length}:${data.length}`),
              default: ({ row, value, index, columns, data }: any) => h('span', { 'data-testid': 'cell-render' }, `${row.code}:${value}:${index}:${columns.length}:${data.length}`),
            },
          },
        ],
        data: [{ code: 'C-001', name: '初始仓库' }],
        modelValue: true,
        virtualRef: createVirtualInput(),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })

    await nextTick()

    expect(wrapper.get('[data-testid="header-render"]').text()).toBe('name:0:1:1')
    expect(wrapper.get('[data-testid="cell-render"]').text()).toBe('C-001:初始仓库:0:1:1')
  })

  it('默认插槽和动态插槽可以同时渲染且互不影响', async () => {
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [
          { field: 'name', slots: { default: 'nameCell' } },
        ],
        data: [{ code: 'C-001', name: '初始仓库' }],
        modelValue: true,
        virtualRef: createVirtualInput(),
      },
      slots: {
        default: () => h('span', { 'data-testid': 'default-slot' }, '默认内容'),
        nameCell: ({ value }: any) => h('span', { 'data-testid': 'cell-slot' }, value),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })

    await nextTick()

    expect(wrapper.get('[data-testid="default-slot"]').text()).toBe('默认内容')
    expect(wrapper.get('[data-testid="cell-slot"]').text()).toBe('初始仓库')
  })

  it('空态、非空加载态和当前行样式保持弹层表格反馈', async () => {
    const mountBase = (props: Record<string, any>) => mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        modelValue: true,
        virtualRef: createVirtualInput(),
        ...props,
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })

    const emptyWrapper = mountBase({ data: [], loading: false })
    expect(emptyWrapper.text()).toContain('暂无数据')

    const emptyLoadingWrapper = mountBase({ data: [], loading: true })
    expect(emptyLoadingWrapper.text()).toContain('加载中...')

    const loadingWrapper = mountBase({ data: [{ name: '初始仓库' }], loading: true })
    expect(loadingWrapper.get('.mx-popover-table-select-base__loading').text()).toBe('加载中...')
    expect(loadingWrapper.get('[data-testid="table-row-0"]').classes()).toContain('mx-popover-table-select-base__row--current')
  })

  it('滚动保持在底部边界时只触发一次加载边界事件', async () => {
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        data: [{ name: '初始仓库' }],
        modelValue: true,
        scrollY: { enabled: true, threshold: 0 },
        virtualRef: createVirtualInput(),
      },
      global: {
        stubs: {
          ElPopover: createElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
          ElTableV2: ElTableV2Stub,
        },
      },
    })
    const scrollWrap = wrapper.get('.mx-popover-table-select-base__table-wrap')

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 100,
    })
    await scrollWrap.trigger('scroll')
    await scrollWrap.trigger('scroll')

    expect(wrapper.emitted('scrollBoundary')).toEqual([[{ direction: 'bottom' }]])

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 20,
    })
    await scrollWrap.trigger('scroll')

    defineScrollMetrics(scrollWrap.element as HTMLElement, {
      clientHeight: 100,
      scrollHeight: 200,
      scrollTop: 100,
    })
    await scrollWrap.trigger('scroll')

    expect(wrapper.emitted('scrollBoundary')).toEqual([
      [{ direction: 'bottom' }],
      [{ direction: 'bottom' }],
    ])
  })

  it('弹层 DOM ref 暂不可用时外部点击不会抛出异常', async () => {
    const input = createVirtualInput()
    const wrapper = mount(PopoverTableSelectBase, {
      props: {
        columns: [{ field: 'name' }],
        data: [{ name: '初始仓库' }],
        modelValue: true,
        virtualRef: input,
      },
      global: {
        stubs: {
          ElPopover: createEmptyElPopoverStub(vi.fn()),
          ElPagination: ElPaginationStub,
        },
      },
    })

    await nextTick()
    await nextTick()

    expect(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    }).not.toThrow()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })
})
