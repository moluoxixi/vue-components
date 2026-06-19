import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide } from 'vue'
import { ConfigTable } from './index'

const tableDataKey = Symbol('table-data')

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

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    border: Boolean,
    data: { type: Array, default: () => [] },
    emptyText: { type: String, default: '暂无数据' },
    stripe: Boolean,
  },
  setup(props, { slots }) {
    provide(tableDataKey, computed(() => props.data as any[]))

    return () => h('div', {
      'data-border': String(props.border),
      'data-testid': 'el-table-stub',
      'data-stripe': String(props.stripe),
    }, [
      (props.data as any[]).length > 0
        ? slots.default?.()
        : (slots.empty?.() ?? h('div', { 'data-testid': 'empty-text' }, props.emptyText)),
    ])
  },
})

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  props: {
    align: String,
    className: String,
    label: String,
    minWidth: [Number, String],
    prop: String,
    width: [Number, String],
  },
  setup(props, { slots }) {
    const injectedRows = inject<any>(tableDataKey)
    const fallbackRows = [
      { code: 'C-001', name: '华南仓', qty: 12 },
    ]
    return () => {
      const rows = (injectedRows?.value ?? fallbackRows) as Array<Record<string, unknown>>
      return h('section', {
        'data-align': props.align,
        'data-class-name': props.className,
        'data-label': props.label,
        'data-min-width': props.minWidth,
        'data-testid': `column-${props.prop}`,
        'data-width': props.width,
      }, [
        h('header', { 'data-testid': `header-${props.prop}` }, slots.header?.({ column: props, $index: 0 }) ?? props.label),
        ...rows.map((row, rowIndex) => h('div', { 'data-testid': `cell-${props.prop}` }, slots.default?.({ row, column: props, $index: rowIndex }))),
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

describe('config table', () => {
  it('按列配置渲染 el-table-column 并支持 header/default 动态插槽作用域', () => {
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
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="header-slot"]').text()).toBe('name:0')
    expect(wrapper.get('[data-testid="cell-slot"]').text()).toBe('C-001:name:0:0:华南仓')
    expect(wrapper.get('[data-testid="cell-qty"]').text()).toBe('12件')
  })

  it('透传表格和列配置并按 label 优先级渲染列头', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          {
            align: 'right',
            columnProps: { className: 'qty-column' } as any,
            field: 'qty',
            label: '库存',
            minWidth: 80,
            title: '数量',
            width: 120,
          },
        ],
        data: [{ qty: 12 }],
        tableProps: { border: false, stripe: true },
      },
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="el-table-stub"]').attributes('data-border')).toBe('false')
    expect(wrapper.get('[data-testid="el-table-stub"]').attributes('data-stripe')).toBe('true')
    expect(wrapper.get('[data-testid="column-qty"]').attributes()).toMatchObject({
      'data-align': 'right',
      'data-class-name': 'qty-column',
      'data-label': '库存',
      'data-min-width': '80',
      'data-width': '120',
    })
    expect(wrapper.get('[data-testid="header-qty"]').text()).toBe('库存')
  })

  it('空数据时渲染默认空态文案并支持 empty 插槽和 render 配置', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
        emptyText: '没有数据',
      },
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="el-table-stub"]').text()).toBe('没有数据')

    const slotWrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
      },
      slots: {
        empty: () => h('strong', { 'data-testid': 'empty-slot' }, '自定义空态'),
      },
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
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
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
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
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
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
      global: {
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
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
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    await waitFor(() => wrapper.get('[data-testid="cell-name"]').text().includes('请求仓库'))

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
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
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
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    await waitFor(() => wrapper.get('[data-testid="cell-name"]').text().includes('第3页'))

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
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
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
        stubs: {
          ElPagination: ElPaginationStub,
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '4/10/99')

    await wrapper.setProps({ params: { keyword: '更新' } })
    await waitFor(() => query.mock.calls.at(-1)?.[0].keyword === '更新' && query.mock.calls.at(-1)?.[0].currentPage === 1)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([1])
    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/99')
  })
})
