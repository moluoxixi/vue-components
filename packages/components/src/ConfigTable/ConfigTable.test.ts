import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { ConfigTable } from './index'

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    border: Boolean,
    data: { type: Array, default: () => [] },
    emptyText: { type: String, default: '暂无数据' },
    stripe: Boolean,
  },
  setup(props, { slots }) {
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
    const rows = [
      { code: 'C-001', name: '华南仓', qty: 12 },
    ]
    return () => h('section', {
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

  it('空数据时渲染默认空态文案并支持 empty 插槽', () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [],
        emptyText: '没有数据',
      },
      global: {
        stubs: {
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
          ElTable: ElTableStub,
          ElTableColumn: ElTableColumnStub,
        },
      },
    })

    expect(slotWrapper.get('[data-testid="empty-slot"]').text()).toBe('自定义空态')
  })

  it('单元格点击和双击事件返回行列配置与索引', async () => {
    const wrapper = mount(ConfigTable, {
      props: {
        columns: [{ field: 'name', label: '仓库' }],
        data: [{ code: 'C-001', name: '华南仓' }],
      },
      global: {
        stubs: {
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
})
