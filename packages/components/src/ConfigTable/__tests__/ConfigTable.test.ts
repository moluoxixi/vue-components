import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createHeadlessTableRendererPlugin } from '../../HeadlessTable'
import { ConfigTable } from '../index'

const sortableCreate = vi.hoisted(() => vi.fn((
  _element: HTMLElement,
  _options: { onEnd?: (event: { oldIndex?: number, newIndex?: number }) => void },
) => ({ destroy: vi.fn() })))

vi.mock('sortablejs', () => ({
  default: { create: sortableCreate },
}))

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
      h('button', {
        'data-testid': 'invalid-page',
        'onClick': () => emit('update:currentPage', 0),
        'type': 'button',
      }, 'invalid page'),
      h('button', {
        'data-testid': 'invalid-page-size',
        'onClick': () => emit('update:pageSize', Number.NaN),
        'type': 'button',
      }, 'invalid size'),
    ])
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: { disabled: Boolean },
  setup(props, { attrs, slots }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled,
      type: 'button',
    }, slots.default?.())
  },
})

const ElCheckboxStub = defineComponent({
  name: 'ElCheckbox',
  props: { disabled: Boolean, modelValue: Boolean },
  emits: ['change'],
  setup(props, { emit, slots }) {
    return () => h('label', [
      h('input', {
        checked: props.modelValue,
        disabled: props.disabled,
        type: 'checkbox',
        onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).checked),
      }),
      slots.default?.(),
    ])
  },
})

const ElInputNumberStub = defineComponent({
  name: 'ElInputNumber',
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: 1 },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      class: ['el-input-number-stub', attrs.class],
      min: props.min,
      max: props.max,
      step: props.step,
      type: 'number',
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', Number((event.target as HTMLInputElement).value)),
    })
  },
})

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: { modelValue: Boolean, title: String, width: [Number, String] },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () => props.modelValue
      ? h('div', {
          'data-testid': 'column-settings-dialog',
          'data-width': String(props.width),
        }, [
          h('h2', props.title),
          slots.default?.(),
          slots.footer?.(),
        ])
      : null
  },
})

const ElTooltipStub = defineComponent({
  name: 'ElTooltip',
  props: { content: String, placement: String },
  setup(_, { slots }) {
    return () => slots.default?.()
  },
})

const elementStubs = {
  ElButton: ElButtonStub,
  ElCheckbox: ElCheckboxStub,
  ElDialog: ElDialogStub,
  ElInputNumber: ElInputNumberStub,
  ElPagination: ElPaginationStub,
  ElTableV2: ElTableV2Stub,
  ElTooltip: ElTooltipStub,
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

  it('字符串 width 跟随容器测量结果更新虚拟表格宽度', async () => {
    let resizeCallback: ResizeObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    const OriginalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
    }

    try {
      const wrapper = mount(ConfigTable, {
        props: {
          columns: [{ field: 'name' }],
          data: [{ name: '华南仓' }],
          width: '100%',
        },
        global: { stubs: elementStubs },
      })

      expect(wrapper.get('.mx-config-table-shell').attributes('style')).toContain('width: 100%')
      expect(wrapper.get('[data-testid="el-table-v2-stub"]').attributes('data-width')).toBe('800')
      expect(observe).toHaveBeenCalledOnce()

      resizeCallback?.([
        { contentRect: { width: 672 } } as ResizeObserverEntry,
      ], {} as ResizeObserver)
      await nextTick()

      expect(wrapper.get('[data-testid="el-table-v2-stub"]').attributes('data-width')).toBe('672')
      wrapper.unmount()
      expect(disconnect).toHaveBeenCalledOnce()
    }
    finally {
      globalThis.ResizeObserver = OriginalResizeObserver
    }
  })

  it('不在 Element Plus 表格和分页根节点上注入内部布局 class', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [{ name: '华南仓' }],
        pagination: true,
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="el-table-v2-stub"]').classes()).not.toContain('mx-config-table')
    expect(wrapper.get('[data-testid="pagination-stub"]').classes()).not.toContain('mx-config-table__pagination')
    expect(wrapper.find('.mx-config-table__pagination-shell').exists()).toBe(true)
    expect(wrapper.find('.mx-config-table__pagination-content').exists()).toBe(false)
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

    let emptySlotScope: unknown
    const slotColumns = [{ field: 'name', label: '仓库' }]
    const slotWrapper = mount(ConfigTable, {
      props: {
        columns: slotColumns,
        data: [],
      },
      slots: {
        empty: (scope) => {
          emptySlotScope = scope
          return h('strong', { 'data-testid': 'empty-slot' }, '自定义空态')
        },
      },
      global: { stubs: elementStubs },
    })

    expect(slotWrapper.get('[data-testid="empty-slot"]').text()).toBe('自定义空态')
    expect(emptySlotScope).toMatchObject({ columns: slotColumns, data: [] })

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

  it('全局 mode API 选择 edit 插槽，缺少 row id 时仍支持全局切换', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', slots: { edit: 'editName' } }],
        data: [{ code: 'C-001', name: '华南仓' }],
      },
      slots: {
        editName: ({ row, mode }: any) => h('strong', { 'data-testid': 'config-edit-cell' }, `${row.code}:${mode}`),
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.find('[data-testid="config-edit-cell"]').exists()).toBe(false)
    ;(wrapper.vm as any).setMode('edit')
    await nextTick()
    expect(wrapper.get('[data-testid="config-edit-cell"]').text()).toBe('C-001:edit')
    ;(wrapper.vm as any).clearMode()
    await nextTick()
    expect(wrapper.find('[data-testid="config-edit-cell"]').exists()).toBe(false)
    expect(wrapper.emitted('modeChange')?.map(args => args[0])).toEqual([
      { scope: 'table', action: 'set', mode: 'edit', previousMode: 'default' },
      { scope: 'table', action: 'clear', mode: 'default', previousMode: 'edit' },
    ])
    expect(wrapper.emitted('update:mode')).toBeUndefined()
  })

  it('通过组件 API 独立批量清理 row、cell 和全部 mode override', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name' }],
        data: [
          { code: 'C-001', name: '华南仓' },
          { code: 'C-002', name: '华北仓' },
        ],
        rowKey: 'code',
      },
      global: { stubs: elementStubs },
    })

    ;(wrapper.vm as any).setMode('edit')
    ;(wrapper.vm as any).setRowMode('C-001', 'default')
    ;(wrapper.vm as any).setRowMode('C-002', 'default')
    ;(wrapper.vm as any).setCellMode('C-001', 'name', 'edit')
    const beforeRowClear = wrapper.emitted('modeChange')?.length ?? 0
    ;(wrapper.vm as any).clearAllRowModes()

    expect((wrapper.vm as any).getRowMode('C-001')).toBe('edit')
    expect((wrapper.vm as any).getCellMode('C-001', 'name')).toBe('edit')
    expect(wrapper.emitted('modeChange')).toHaveLength(beforeRowClear + 1)
    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual([
      { scope: 'row', action: 'clearAll', cleared: 2, mode: 'edit' },
    ])

    const beforeRowNoop = wrapper.emitted('modeChange')?.length ?? 0
    ;(wrapper.vm as any).clearAllRowModes()
    expect(wrapper.emitted('modeChange')).toHaveLength(beforeRowNoop)

    ;(wrapper.vm as any).clearAllCellModes()
    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual([
      { scope: 'cell', action: 'clearAll', cleared: 1, mode: 'edit' },
    ])

    ;(wrapper.vm as any).setRowMode('C-001', 'default')
    ;(wrapper.vm as any).setCellMode('C-001', 'name', 'edit')
    const beforeAllClear = wrapper.emitted('modeChange')?.length ?? 0
    ;(wrapper.vm as any).clearAllModes()

    expect((wrapper.vm as any).getCellMode('C-001', 'name')).toBe('default')
    expect(wrapper.emitted('modeChange')).toHaveLength(beforeAllClear + 1)
    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual([
      { scope: 'all', action: 'clearAll', cleared: 3, mode: 'default' },
    ])
    expect(wrapper.emitted('update:mode')).toBeUndefined()
  })

  it('全局 API override 覆盖 mode prop，clearMode 后恢复 prop 模式', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', slots: { edit: 'editName' } }],
        data: [{ code: 'C-001', name: '华南仓' }],
        mode: 'edit',
      },
      slots: {
        editName: ({ mode }: any) => h('strong', { 'data-testid': 'prop-edit-cell' }, mode),
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="prop-edit-cell"]').text()).toBe('edit')
    ;(wrapper.vm as any).setMode('default')
    await nextTick()
    expect(wrapper.find('[data-testid="prop-edit-cell"]').exists()).toBe(false)
    ;(wrapper.vm as any).clearMode()
    await nextTick()
    expect(wrapper.get('[data-testid="prop-edit-cell"]').text()).toBe('edit')
  })

  it('selector API 扫描当前数据并以稳定 id 保持匹配状态', async () => {
    const columns = [
      { field: 'name', slots: { edit: ({ row }: any) => h('strong', { 'data-testid': `selector-name-${row.code}` }, row.code) } },
      { field: 'status', slots: { edit: ({ row }: any) => h('strong', { 'data-testid': `selector-status-${row.code}` }, row.code) } },
    ]
    const first = { code: 'C-001', name: '华南仓', status: '启用' }
    const second = { code: 'C-002', name: '华北仓', status: '停用' }
    const wrapper = mount(ConfigTable, {
      props: { columns, data: [first, second], rowKey: 'code' },
      global: { stubs: elementStubs },
    })

    ;(wrapper.vm as any).setRowMode(({ row }: any) => row.status === '启用', 'edit')
    ;(wrapper.vm as any).setCellMode(({ rowId, columnId }: any) => (
      rowId === 'C-002' && columnId === 'status'
    ), 'edit')
    await nextTick()

    expect(wrapper.get('[data-testid="selector-name-C-001"]').text()).toBe('C-001')
    expect(wrapper.get('[data-testid="selector-status-C-001"]').text()).toBe('C-001')
    expect(wrapper.find('[data-testid="selector-name-C-002"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="selector-status-C-002"]').text()).toBe('C-002')

    await wrapper.setProps({ data: [second, first] })
    expect(wrapper.get('[data-testid="selector-status-C-002"]').text()).toBe('C-002')
    expect(wrapper.get('[data-testid="selector-name-C-001"]').text()).toBe('C-001')
  })

  it('显式 rowKey 在重排、过滤和分页数据替换后保持 mode 稳定', async () => {
    const columns = [
      { field: 'name', slots: { edit: ({ row }: any) => h('strong', { 'data-testid': `row-key-name-${row.code}` }, `edit:${row.code}`) } },
      { field: 'status', slots: { edit: ({ row }: any) => h('strong', { 'data-testid': `row-key-status-${row.code}` }, `edit:${row.code}`) } },
    ]
    const first = { code: 'C-001', name: '华南仓', status: '启用' }
    const second = { code: 'C-002', name: '华北仓', status: '停用' }
    const wrapper = mount(ConfigTable, {
      props: { columns, data: [first, second], pagination: true, rowKey: 'code', total: 2 },
      global: { stubs: elementStubs },
    })

    ;(wrapper.vm as any).setRowMode('C-001', 'edit')
    ;(wrapper.vm as any).setCellMode('C-002', 'name', 'edit')
    await nextTick()
    expect(wrapper.get('[data-testid="row-key-name-C-001"]').text()).toBe('edit:C-001')
    expect(wrapper.get('[data-testid="row-key-status-C-001"]').text()).toBe('edit:C-001')
    expect(wrapper.get('[data-testid="row-key-name-C-002"]').text()).toBe('edit:C-002')
    expect(wrapper.find('[data-testid="row-key-status-C-002"]').exists()).toBe(false)

    await wrapper.setProps({ data: [second, first] })
    expect(wrapper.get('[data-testid="row-key-name-C-001"]').text()).toBe('edit:C-001')
    expect(wrapper.get('[data-testid="row-key-name-C-002"]').text()).toBe('edit:C-002')
    expect(wrapper.get('[data-testid="config-table-cell-status-0"]').text()).toBe('停用')
    expect(wrapper.get('[data-testid="config-table-cell-status-1"]').text()).toBe('edit:C-001')

    await wrapper.setProps({ data: [second] })
    expect(wrapper.get('[data-testid="row-key-name-C-002"]').text()).toBe('edit:C-002')
    expect(wrapper.get('[data-testid="config-table-cell-status-0"]').text()).toBe('停用')

    await wrapper.setProps({ data: [first] })
    expect(wrapper.get('[data-testid="row-key-name-C-001"]').text()).toBe('edit:C-001')
    expect(wrapper.get('[data-testid="row-key-status-C-001"]').text()).toBe('edit:C-001')

    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await wrapper.setProps({ data: [second] })
    expect(wrapper.get('[data-testid="row-key-name-C-002"]').text()).toBe('edit:C-002')
    expect(wrapper.get('[data-testid="config-table-cell-status-0"]').text()).toBe('停用')
  })

  it('getRowId 优先于 rowKey 作为 mode 的稳定行标识', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', slots: { edit: ({ rowId }: any) => h('strong', { 'data-testid': 'get-row-id-edit' }, String(rowId)) } }],
        data: [{ code: 'C-001', stableId: 'ROW-001', name: '华南仓' }],
        getRowId: row => row.stableId,
        rowKey: 'code',
      },
      global: { stubs: elementStubs },
    })

    ;(wrapper.vm as any).setRowMode('ROW-001', 'edit')
    await nextTick()
    expect(wrapper.get('[data-testid="get-row-id-edit"]').text()).toBe('ROW-001')
    expect((wrapper.vm as any).getRowMode('C-001')).toBe('default')
  })

  it('edit slot 缺失时回退 renderer 和 formatter，且不提前执行 formatter', () => {
    const rendererFormatter = vi.fn(({ value }: any) => `不应执行:${value}`)
    const fallbackFormatter = vi.fn(({ value }: any) => `格式化:${value}`)
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          {
            cellRender: 'status',
            field: 'status',
            formatter: rendererFormatter,
            slots: { edit: 'missingStatusEdit' },
          },
          {
            field: 'name',
            formatter: fallbackFormatter,
            slots: { edit: 'missingNameEdit' },
          },
        ],
        data: [{ code: 'C-001', name: '华南仓', status: '启用' }],
        diagnostics: false,
        mode: 'edit',
        renderers: {
          status: {
            renderDefault: (_, { mode, rawValue }) => h(
              'strong',
              { 'data-testid': 'edit-fallback-renderer' },
              `${mode}:${rawValue}`,
            ),
          },
        },
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="edit-fallback-renderer"]').text()).toBe('edit:启用')
    expect(wrapper.get('[data-testid="config-table-cell-name-0"]').text()).toBe('格式化:华南仓')
    expect(rendererFormatter).not.toHaveBeenCalled()
    expect(fallbackFormatter).toHaveBeenCalledTimes(1)
  })

  it('命中 edit slot 时不执行 formatter', () => {
    const formatter = vi.fn(({ value }: any) => `格式化:${value}`)
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{
          field: 'name',
          formatter,
          slots: {
            edit: ({ rawValue, mode }: any) => h(
              'strong',
              { 'data-testid': 'inline-edit-cell' },
              `${mode}:${rawValue}`,
            ),
          },
        }],
        data: [{ code: 'C-001', name: '华南仓' }],
        mode: 'edit',
        rowKey: 'code',
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="inline-edit-cell"]').text()).toBe('edit:华南仓')
    expect(formatter).not.toHaveBeenCalled()
  })

  it('父组件动态移除命名 slot 后回退到格式化值', async () => {
    const showSlot = ref(true)
    const columns = [{
      field: 'name',
      formatter: ({ value }: any) => `格式化:${value}`,
      slots: { default: 'dynamicCell' },
    }]
    const data = [{ name: '华南仓' }]
    const Host = defineComponent({
      setup() {
        return () => h(ConfigTable, { columns, data, diagnostics: false }, {
          ...(showSlot.value
            ? { dynamicCell: () => h('span', { 'data-testid': 'dynamic-slot' }, '插槽值') }
            : {}),
        })
      },
    })
    const wrapper = mount(Host, { global: { stubs: elementStubs } })

    expect(wrapper.get('[data-testid="dynamic-slot"]').text()).toBe('插槽值')
    showSlot.value = false
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="dynamic-slot"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="config-table-cell-name-0"]').text()).toBe('格式化:华南仓')
  })

  it('按 slot、renderer、formatter 的优先级渲染表头和单元格', () => {
    const formatter = vi.fn(({ value }: any) => `格式化:${value}`)
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          {
            cellRender: { name: 'status', props: { prefix: 'R' } },
            field: 'status',
            formatter,
            headerRender: 'status',
          },
          {
            cellRender: 'status',
            field: 'name',
            slots: { default: 'nameCell', header: 'nameHeader' },
          },
        ],
        data: [{ name: '华南仓', status: '启用' }],
        renderers: {
          status: {
            renderDefault: (options, { rawValue }) => h(
              'strong',
              { 'data-testid': 'cell-renderer' },
              `${String(options.props?.prefix ?? '')}:${rawValue}`,
            ),
            renderHeader: (_, { columnIndex }) => h(
              'b',
              { 'data-testid': 'header-renderer' },
              `renderer:${columnIndex}`,
            ),
          },
        },
      },
      slots: {
        nameCell: ({ value }: any) => h('span', { 'data-testid': 'slot-cell-wins' }, value),
        nameHeader: () => h('span', { 'data-testid': 'slot-header-wins' }, '插槽表头'),
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="header-renderer"]').text()).toBe('renderer:0')
    expect(wrapper.get('[data-testid="cell-renderer"]').text()).toBe('R:启用')
    expect(wrapper.get('[data-testid="slot-header-wins"]').text()).toBe('插槽表头')
    expect(wrapper.get('[data-testid="slot-cell-wins"]').text()).toBe('华南仓')
    expect(formatter).not.toHaveBeenCalled()
  })

  it('按稳定列 id 排序和显隐，并在事件中保留源索引', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          { field: 'name', label: '仓库' },
          { field: 'status', label: '状态' },
          { field: 'qty', label: '数量' },
        ],
        columnOrder: ['qty', 'name'],
        columnVisibility: { status: false },
        data: [{ name: '华南仓', qty: 12, status: '启用' }],
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-qty', 'virtual-column-name'])

    await wrapper.get('[data-testid="config-table-cell-qty-0"]').trigger('click')
    expect(wrapper.emitted('cellClick')![0][0]).toMatchObject({
      columnIndex: 2,
      sourceColumnIndex: 2,
      visibleColumnIndex: 0,
      rawValue: 12,
      value: 12,
    })
  })

  it('通过列设置弹窗确认排序和显示隐藏并发出受控更新', async () => {
    sortableCreate.mockClear()
    const sourceColumns = [
      { field: 'name', label: '仓库' },
      { field: 'status', label: '状态' },
      { field: 'qty', label: '数量' },
    ]
    const wrapper = mount(ConfigTable, {
      props: {
        columnConfig: true,
        columns: sourceColumns,
        data: [{ name: '华南仓', qty: 12, status: '启用' }],
      },
      global: { stubs: elementStubs },
    })

    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    expect(wrapper.find('[data-testid="column-settings-dialog"]').exists()).toBe(true)
    expect(sortableCreate).toHaveBeenCalledTimes(1)

    await wrapper.get('[aria-label="下移 仓库"]').trigger('click')
    await wrapper.get('[data-column-id="status"] input').setValue(false)
    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-name', 'virtual-column-status', 'virtual-column-qty'])

    const confirm = wrapper.findAll('button').find(button => button.text() === '确定')
    expect(confirm).toBeDefined()
    await confirm!.trigger('click')

    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-name', 'virtual-column-qty'])
    expect(wrapper.emitted('update:columnOrder')?.at(-1)).toEqual([['status', 'name', 'qty']])
    expect(wrapper.emitted('update:columnVisibility')?.at(-1)).toEqual([{ name: true, qty: true, status: false }])
    expect(sourceColumns.map(column => column.field)).toEqual(['name', 'status', 'qty'])
  })

  it('pane 配置面板支持宽度、拖拽排序和显示隐藏', async () => {
    sortableCreate.mockClear()
    const wrapper = mount(ConfigTable, {
      props: {
        columnConfig: false,
        columns: [
          { field: 'name', label: '仓库', width: 40 },
          { field: 'status', label: '状态' },
          { field: 'qty', label: '数量' },
        ],
        data: [{ name: '华南仓', qty: 12, status: '启用' }],
        pane: { buttonText: '配置列', minColumnWidth: 80, width: 560 },
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('.mx-config-table-column-settings__trigger').text()).toBe('配置列')
    expect(wrapper.get('[data-testid="virtual-column-name"]').attributes('data-width')).toBe('80')
    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    expect(wrapper.get('[data-testid="column-settings-dialog"]').attributes('data-width')).toBe('560')
    expect(wrapper.get('[aria-label="仓库 宽度"]').attributes('min')).toBe('80')

    const sortableOptions = sortableCreate.mock.calls[0]?.[1]
    sortableOptions.onEnd?.({ oldIndex: 2, newIndex: 0 })
    await nextTick()
    await wrapper.get('[data-column-id="status"] input').setValue(false)
    await wrapper.findAll('button').find(button => button.text() === '确定')!.trigger('click')

    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-qty', 'virtual-column-name'])
    expect(wrapper.emitted('update:columnOrder')?.at(-1)).toEqual([['qty', 'name', 'status']])
    expect(wrapper.emitted('update:columnVisibility')?.at(-1)).toEqual([{ name: true, qty: true, status: false }])
  })

  it('打开面板后动态切换 draggable 会销毁并重建拖拽实例', async () => {
    sortableCreate.mockClear()
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [
          { field: 'name', label: '仓库' },
          { field: 'status', label: '状态' },
        ],
        data: [{ name: '华南仓', status: '启用' }],
        pane: { draggable: true },
      },
      global: { stubs: elementStubs },
    })

    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    expect(sortableCreate).toHaveBeenCalledTimes(1)
    const firstSortable = sortableCreate.mock.results[0]?.value

    await wrapper.setProps({ pane: { draggable: false } })
    expect(firstSortable?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('.mx-config-table-column-settings__drag').exists()).toBe(false)
    expect(wrapper.get('[data-column-id="name"]').classes())
      .toContain('mx-config-table-column-settings__item--static')

    await wrapper.setProps({ pane: { draggable: true } })
    await nextTick()
    expect(sortableCreate).toHaveBeenCalledTimes(2)
    expect(wrapper
      .get('[data-column-id="name"]')
      .classes())
      .not
      .toContain('mx-config-table-column-settings__item--static')

    const secondSortable = sortableCreate.mock.results[1]?.value
    wrapper.unmount()
    expect(secondSortable?.destroy).toHaveBeenCalledOnce()
  })

  it('列设置不会确认零个可见列', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columnConfig: true,
        columns: [
          { field: 'name', label: '仓库' },
          { field: 'status', label: '状态' },
        ],
        columnVisibility: { name: false, status: false },
        data: [{ name: '华南仓', status: '启用' }],
      },
      global: { stubs: elementStubs },
    })

    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    const confirm = wrapper.findAll('button').find(button => button.text() === '确定')
    expect(confirm?.attributes('disabled')).toBeDefined()

    await confirm!.trigger('click')
    expect(wrapper.emitted('columnSettingChange')).toBeUndefined()

    await wrapper.get('[data-column-id="name"] input').setValue(true)
    expect(confirm?.attributes('disabled')).toBeUndefined()
    await confirm!.trigger('click')

    expect(wrapper.emitted('update:columnVisibility')?.at(-1)).toEqual([{ name: true, status: false }])
  })

  it('列设置可以一起编辑稳定列宽、顺序和显隐，并支持重置且不修改源配置', async () => {
    const sourceColumns = [
      { id: 'name-column', field: 'name', label: '仓库', width: 120 },
      { id: 'status-column', field: 'status', label: '状态', width: 180, visible: false },
    ]
    const sourceSnapshot = structuredClone(sourceColumns)
    const wrapper = mount(ConfigTable, {
      props: {
        columnConfig: true,
        columns: sourceColumns,
        columnWidths: { 'name-column': 240 },
        data: [{ name: '华南仓', status: '启用' }],
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="virtual-column-name"]').attributes('data-width')).toBe('240')
    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    await wrapper.get('[aria-label="仓库 宽度"]').setValue('300')
    await wrapper.get('[aria-label="下移 仓库"]').trigger('click')
    await wrapper.get('[data-column-id="status-column"] input').setValue(true)

    const confirm = wrapper.findAll('button').find(button => button.text() === '确定')
    await confirm!.trigger('click')

    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-status', 'virtual-column-name'])
    expect(wrapper.get('[data-testid="virtual-column-name"]').attributes('data-width')).toBe('300')
    expect(wrapper.get('[data-testid="virtual-column-status"]').attributes('data-width')).toBe('180')
    expect(wrapper.emitted('update:columnWidths')?.at(-1)).toEqual([{ 'name-column': 300, 'status-column': 180 }])
    expect(sourceColumns).toEqual(sourceSnapshot)

    await wrapper.get('.mx-config-table-column-settings__trigger').trigger('click')
    await wrapper.get('[aria-label="仓库 宽度"]').setValue('320')
    await wrapper.get('[aria-label="上移 仓库"]').trigger('click')
    await wrapper.get('[data-column-id="status-column"] input').setValue(false)
    await wrapper.findAll('button').find(button => button.text() === '重置')!.trigger('click')

    expect((wrapper.get('[aria-label="仓库 宽度"]').element as HTMLInputElement).value).toBe('120')
    expect((wrapper.get('[aria-label="状态 宽度"]').element as HTMLInputElement).value).toBe('180')
    expect((wrapper.get('[data-column-id="status-column"] input').element as HTMLInputElement).checked).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === '确定')!.trigger('click')

    expect(wrapper.findAll('[data-testid^="virtual-column-"]').map(node => node.attributes('data-testid')))
      .toEqual(['virtual-column-name'])
    expect(wrapper.get('[data-testid="virtual-column-name"]').attributes('data-width')).toBe('120')
  })

  it('app renderer plugin 可被 ConfigTable 实例消费', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'status', title: '状态', cellRender: 'app-status' }],
        data: [{ status: '启用' }],
      },
      global: {
        plugins: [createHeadlessTableRendererPlugin({
          renderers: {
            'app-status': {
              renderDefault: () => h('strong', { 'data-testid': 'app-status-renderer' }, '应用 renderer'),
            },
          },
        })],
        stubs: elementStubs,
      },
    })

    expect(wrapper.get('[data-testid="app-status-renderer"]').text()).toBe('应用 renderer')
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

  it('分页透传对象不能覆盖受控页码、页大小、总数和 pageCount', async () => {
    const query = vi.fn(async () => ({
      data: [{ name: '请求仓库' }],
      total: 33,
    }))
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        currentPage: 2,
        pageSize: 20,
        pagination: {
          currentPage: 99,
          pageSize: 50,
          total: 999,
          pageCount: 999,
          layout: 'total',
        },
        query,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '2/20/33')
  })

  it('静态数据分页支持显式 total', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [{ name: '仓库' }],
        pagination: true,
        total: 88,
      },
      global: { stubs: elementStubs },
    })

    expect(wrapper.get('[data-testid="pagination-state"]').text()).toBe('1/10/88')
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

  it('query 分页事件复用请求 hook 的正整数归一化', async () => {
    const query = vi.fn(async (params: { currentPage: number, pageSize: number }) => ({
      data: [{ code: 'Q-003-N', name: `第${params.currentPage}页`, qty: params.pageSize }],
      total: 99,
    }))
    const pageChange = vi.fn()
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        currentPage: 2,
        pageSize: 25,
        query,
        onPageChange: pageChange,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: elementStubs,
      },
    })

    await waitFor(() => wrapper.get('[data-testid="pagination-state"]').text() === '2/25/99')
    await wrapper.get('[data-testid="invalid-page"]').trigger('click')
    await waitFor(() => query.mock.calls.at(-1)?.[0].currentPage === 1)

    expect(wrapper.emitted('update:currentPage')?.at(-1)).toEqual([1])
    expect(pageChange).toHaveBeenLastCalledWith({ currentPage: 1, pageSize: 25 })

    await wrapper.get('[data-testid="invalid-page-size"]').trigger('click')
    await waitFor(() => query.mock.calls.at(-1)?.[0].pageSize === 10)

    expect(wrapper.emitted('update:pageSize')?.at(-1)).toEqual([10])
    expect(pageChange).toHaveBeenLastCalledWith({ currentPage: 1, pageSize: 10 })
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
