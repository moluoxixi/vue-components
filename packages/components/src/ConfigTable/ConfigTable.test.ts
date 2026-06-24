import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { ConfigTable } from './index'

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

function getColumnId(column: Record<string, any>): string {
  return String(column.dataKey ?? column.key ?? column.title)
}

const ElTableV2Stub = defineComponent({
  name: 'ElTableV2',
  props: {
    columns: { type: Array, default: () => [] },
    data: { type: Array, default: () => [] },
    headerHeight: { type: Number, default: 40 },
    height: { type: Number, default: 320 },
    rowClass: { type: [String, Function], default: undefined },
    rowHeight: { type: Number, default: 44 },
    rowKey: { type: [String, Number, Symbol], default: 'id' },
    scrollbarAlwaysOn: Boolean,
    width: { type: Number, default: 800 },
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
        'data-header-height': String(props.headerHeight),
        'data-height': String(props.height),
        'data-row-height': String(props.rowHeight),
        'data-row-key': String(props.rowKey),
        'data-scrollbar-always-on': String(props.scrollbarAlwaysOn),
        'data-testid': 'el-table-v2-stub',
        'data-width': String(props.width),
      }, [
        rows.length > 0
          ? [
              h('div', { 'data-testid': 'virtual-header' }, columns.map((column, columnIndex) => h('section', {
                'data-align': column.align,
                'data-class': column.class,
                'data-fixed': String(column.fixed),
                'data-min-width': column.minWidth,
                'data-testid': `virtual-column-${getColumnId(column)}`,
                'data-title': column.title,
                'data-width': column.width,
              }, slots['header-cell']?.({
                column,
                columnIndex,
                columns,
                headerIndex: 0,
                style: {},
              }) ?? column.title))),
              ...rows.map((rowData, rowIndex) => h('div', {
                'class': resolveRowClass(rowData, rowIndex),
                'data-testid': `table-row-${rowIndex}`,
              }, columns.map((column, columnIndex) => h('div', {
                'data-testid': `virtual-cell-${getColumnId(column)}-${rowIndex}`,
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
        'data-testid': 'next-page',
        'onClick': () => emit('update:currentPage', props.currentPage + 1),
        'type': 'button',
      }, 'next'),
      h('button', {
        'data-testid': 'bigger-page-size',
        'onClick': () => emit('update:pageSize', 50),
        'type': 'button',
      }, 'size'),
    ])
  },
})

const elementStubs = {
  ElPagination: ElPaginationStub,
  ElTableV2: ElTableV2Stub,
}

describe('config table', () => {
  it('按列配置渲染虚拟表格并支持 header/default 动态插槽作用域', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          { field: 'name', label: '仓库', slots: { default: 'nameCell', header: 'nameHeader' } },
          { field: 'qty', title: '数量', formatter: ({ value }: any) => `${value}件` },
        ],
        data: [{ code: 'C-001', name: '华南仓', qty: 12 }],
      },
      slots: {
        nameHeader: ({ column, columnIndex }: any) => h('span', { 'data-testid': 'header-slot' }, `${column.field}:${columnIndex}`),
        nameCell: ({ row, column, rowIndex, columnIndex, value }: any) => h(
          'span',
          { 'data-testid': 'cell-slot' },
          `${row.code}:${column.field}:${rowIndex}:${columnIndex}:${value}`,
        ),
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="header-slot"]').text()).toBe('name:0')
    expect(wrapper.get('[data-testid="cell-slot"]').text()).toBe('C-001:name:0:0:华南仓')
    expect(wrapper.get('[data-testid="config-table-cell-qty-0"]').text()).toBe('12件')
  })

  it('透传虚拟表格尺寸和列配置并按 label 优先级渲染列头', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          {
            align: 'right',
            columnProps: { class: 'qty-column', fixed: true } as any,
            field: 'qty',
            label: '库存',
            minWidth: 80,
            title: '数量',
            width: 120,
          },
        ],
        currentRowIndex: 0,
        data: [{ code: 'C-001', qty: 12 }],
        headerHeight: 44,
        height: 360,
        rowHeight: 48,
        rowKey: 'code',
        tableProps: { scrollbarAlwaysOn: true },
        width: 640,
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="el-table-v2-stub"]').attributes()).toMatchObject({
      'data-header-height': '44',
      'data-height': '360',
      'data-row-height': '48',
      'data-row-key': 'code',
      'data-scrollbar-always-on': 'true',
      'data-width': '640',
    })
    expect(wrapper.get('[data-testid="virtual-column-qty"]').attributes()).toMatchObject({
      'data-align': 'right',
      'data-class': 'qty-column',
      'data-fixed': 'true',
      'data-min-width': '80',
      'data-title': '库存',
      'data-width': '120',
    })
    expect(wrapper.get('[data-testid="virtual-column-qty"]').text()).toBe('库存')
    expect(wrapper.get('[data-testid="table-row-0"]').classes()).toContain('mx-config-table__row--current')
  })

  it('空数据时渲染默认空态文案并支持 empty 插槽和 render 配置', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
        emptyText: '没有数据',
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="el-table-v2-stub"]').text()).toBe('没有数据')

    const slotWrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
      },
      slots: {
        empty: () => h('strong', { 'data-testid': 'empty-slot' }, '自定义空态'),
      },
      global: { stubs: elementStubs },
    })

    expect(slotWrapper.get('[data-testid="empty-slot"]').text()).toBe('自定义空态')

    const renderWrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
        slots: {
          empty: ({ columns }: any) => h('em', { 'data-testid': 'empty-render' }, `无${columns[0].label}`),
        },
      },
      slots: {
        empty: () => h('strong', { 'data-testid': 'empty-vue-slot' }, 'Vue 空态'),
      },
      global: { stubs: elementStubs },
    })

    expect(renderWrapper.get('[data-testid="empty-render"]').text()).toBe('无仓库')
    expect(renderWrapper.find('[data-testid="empty-vue-slot"]').exists()).toBe(false)
  })

  it('支持在列 slots 配置中直接传入 render 函数', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          {
            field: 'name',
            label: '仓库',
            slots: {
              header: ({ column, columnIndex, columns, data, index }: any) => h('span', { 'data-testid': 'header-render' }, `${column.field}:${columnIndex}:${index}:${columns.length}:${data.length}`),
              default: ({ row, value, rowIndex, columnIndex, columns, data, index }: any) => h('strong', { 'data-testid': 'cell-render' }, `${row.code}:${value}:${rowIndex}:${columnIndex}:${index}:${columns.length}:${data.length}`),
            },
          },
        ],
        data: [{ code: 'C-001', name: '华南仓' }],
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="header-render"]').text()).toBe('name:0:0:1:1')
    expect(wrapper.get('[data-testid="cell-render"]').text()).toBe('C-001:华南仓:0:0:0:1:1')
  })

  it('单元格点击和双击事件返回行列配置与索引', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [{ code: 'C-001', name: '华南仓' }],
      },
      global: { stubs: elementStubs },
    })

    await wrapper.get('[data-testid="config-table-cell-name-0"]').trigger('click')
    await wrapper.get('[data-testid="config-table-cell-name-0"]').trigger('dblclick')

    expect(wrapper.emitted('cellClick')![0][0]).toMatchObject({
      row: { code: 'C-001', name: '华南仓' },
      column: { field: 'name', label: '仓库' },
      rowIndex: 0,
      columnIndex: 0,
      value: '华南仓',
    })
    expect(wrapper.emitted('cellDblClick')![0][0]).toMatchObject({
      row: { code: 'C-001', name: '华南仓' },
      column: { field: 'name', label: '仓库' },
      rowIndex: 0,
      columnIndex: 0,
      value: '华南仓',
    })
  })

  it('query 模式使用请求数据并默认渲染分页', async () => {
    const query = vi.fn(async (params: Record<string, unknown> & { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-001', name: `请求${String(params.keyword ?? '')}`, qty: params.currentPage }],
      total: 33,
    }))
    const loaded = vi.fn()
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        query,
        params: { keyword: '仓库' },
        onLoaded: loaded,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="config-table-cell-name-0"]').text().includes('请求仓库'))

    expect(query).toHaveBeenCalledWith({ keyword: '仓库', currentPage: 1, pageSize: 10 })
    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/33')
    expect(loaded).toHaveBeenCalledWith({ data: [{ code: 'Q-001', name: '请求仓库', qty: 1 }], total: 33 })
  })

  it('query 失败时触发 error 并展示加载失败空态', async () => {
    const failure = new Error('table failed')
    const error = vi.fn()
    const query = vi.fn(async () => {
      throw failure
    })

    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        query,
        onError: error,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => error.mock.calls.length === 1)

    expect(error).toHaveBeenCalledWith(failure)
    expect(wrapper.text()).toContain('加载失败')
  })

  it('pagination=false 隐藏内置分页但仍按分页参数请求', async () => {
    const query = vi.fn(async (params: { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-002', name: `第${params.currentPage}页`, qty: params.pageSize }],
      total: 12,
    }))
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        currentPage: 3,
        pageSize: 20,
        pagination: false,
        query,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="config-table-cell-name-0"]').text().includes('第3页'))

    expect(query).toHaveBeenCalledWith({ currentPage: 3, pageSize: 20 })
    expect(wrapper.find('[data-testid="pagination-stub"]').exists()).toBe(false)
  })

  it('分页变化写回 v-model 并在 pageSize 变化时回到第一页', async () => {
    const query = vi.fn(async (params: { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-003', name: `第${params.currentPage}页`, qty: params.pageSize }],
      total: 99,
    }))
    const pageChange = vi.fn()
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        currentPage: 2,
        pageSize: 10,
        query,
        onPageChange: pageChange,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '2/10/99')
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await waitFor(() => query.mock.calls.at(-1)?.[0].currentPage === 3)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([3])
    expect(pageChange).toHaveBeenLastCalledWith({ currentPage: 3, pageSize: 10 })

    await wrapper.get('[data-testid="bigger-page-size"]').trigger('click')
    await waitFor(() => query.mock.calls.at(-1)?.[0].pageSize === 50)

    expect(wrapper.emitted('update:pageSize')?.at(-1)).toEqual([50])
    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([1])
    expect(pageChange).toHaveBeenLastCalledWith({ currentPage: 1, pageSize: 50 })
  })

  it('params 变化时默认重置到第一页', async () => {
    const query = vi.fn(async (params: Record<string, unknown> & { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-004', name: `${String(params.keyword ?? '')}-${params.currentPage}`, qty: params.pageSize }],
      total: 99,
    }))
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        currentPage: 4,
        pageSize: 10,
        params: { keyword: '初始' },
        query,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '4/10/99')

    await wrapper.setProps({ params: { keyword: '更新' } })
    await waitFor(() => query.mock.calls.at(-1)?.[0].keyword === '更新' && query.mock.calls.at(-1)?.[0].currentPage === 1)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([1])
    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/99')
  })
})
