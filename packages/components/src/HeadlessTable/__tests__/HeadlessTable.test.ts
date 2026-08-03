import type { App } from 'vue'
import type {
  HeadlessTableColumn,
  HeadlessTableDefaultScope,
  HeadlessTableEmptyScope,
  HeadlessTableRendererMap,
} from '../index'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import {
  createHeadlessTableRenderer,
  HeadlessTable,
  headlessTableRenderer,
  headlessTableRendererKey,
} from '../index'

interface InventoryRow {
  code: string
  name: string
  owner: { name: string }
  quantity: number
  status: string
}

function renderTable(scope: HeadlessTableDefaultScope<InventoryRow>) {
  return h('div', { 'data-testid': 'table-adapter' }, [
    h('div', { 'data-testid': 'headers' }, scope.columns.map((column, columnIndex) => h(
      scope.Header,
      { column, columnIndex },
    ))),
    ...scope.data.map((row, rowIndex) => h('div', { 'data-testid': `row-${rowIndex}` }, scope.columns.map(
      (column, columnIndex) => h(scope.Cell, { row, column, rowIndex, columnIndex }),
    ))),
  ])
}

describe('headless table', () => {
  afterEach(() => {
    headlessTableRenderer.clear()
    vi.restoreAllMocks()
  })

  it('通过 app.use 按稳定名称注册组件', () => {
    const component = vi.fn()

    HeadlessTable.install!({ component } as unknown as App)

    expect(component).toHaveBeenCalledWith('HeadlessTable', HeadlessTable)
  })

  it('只输出适配器插槽，并解析列显隐、formatter、嵌套字段和动态 slots', () => {
    const columns: HeadlessTableColumn<InventoryRow>[] = [
      { field: 'code', title: '编码', visible: false },
      {
        field: 'name',
        title: '名称',
        slots: {
          default: 'nameCell',
          header: ({ columnIndex }) => h('strong', { 'data-testid': 'name-header' }, `名称:${columnIndex}`),
        },
      },
      { field: 'owner.name', title: '负责人' },
      { field: 'quantity', title: '数量', formatter: ({ value }) => `${value} 件` },
    ]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]

    const wrapper = mount(HeadlessTable as any, {
      props: { columns, data, diagnostics: false },
      slots: {
        default: renderTable as any,
        nameCell: ({ row, value }: any) => h('span', { 'data-testid': 'name-cell' }, `${row.code}:${value}`),
      },
    })

    expect(wrapper.html()).toMatch(/^<div data-testid="table-adapter">/)
    expect(wrapper.get('[data-testid="headers"]').text()).toBe('名称:0负责人数量')
    expect(wrapper.get('[data-testid="name-cell"]').text()).toBe('C-001:华东仓')
    expect(wrapper.get('[data-testid="row-0"]').text()).toBe('C-001:华东仓张三12 件')
    expect(wrapper.text()).not.toContain('编码')
  })

  it('按局部优先于全局的规则解析 vxe-table 风格 renderer 配置', () => {
    headlessTableRenderer.add<InventoryRow>('status', {
      renderDefault: () => h('span', '全局'),
    })

    const columns: HeadlessTableColumn<InventoryRow>[] = [{
      field: 'status',
      headerRender: { name: 'status', options: { prefix: '状态' } },
      cellRender: { name: 'status', props: { type: 'success' } },
    }]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]
    const localRenderers: HeadlessTableRendererMap<InventoryRow> = {
      status: {
        renderDefault: (renderOptions, { row, value }) => h(
          'span',
          { 'data-testid': 'status-renderer' },
          `${renderOptions.props?.type}:${row.code}:${value}`,
        ),
        renderHeader: renderOptions => h(
          'b',
          { 'data-testid': 'status-header-renderer' },
          renderOptions.options.prefix,
        ),
      },
    }

    const wrapper = mount(HeadlessTable as any, {
      props: {
        columns,
        data,
        renderers: localRenderers,
      },
      slots: { default: renderTable as any },
    })

    expect(wrapper.get('[data-testid="status-header-renderer"]').text()).toBe('状态')
    expect(wrapper.get('[data-testid="status-renderer"]').text()).toBe('success:C-001:启用')
    expect(headlessTableRenderer.delete('status')).toBe(true)

    const registry = createHeadlessTableRenderer()
    registry.add('temporary', {})
    expect(registry.get('temporary')).toBeDefined()
    expect(registry.delete('temporary')).toBe(true)
  })

  it('响应运行时 renderer 变更，并允许使用对象原型上的名称', async () => {
    const columns: HeadlessTableColumn<InventoryRow>[] = [{ field: 'status', cellRender: 'toString' }]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]

    headlessTableRenderer.add('toString', {
      renderDefault: () => h('span', { 'data-testid': 'live-renderer' }, 'renderer-a'),
    })
    const wrapper = mount(HeadlessTable as any, {
      props: { columns, data, diagnostics: false },
      slots: { default: renderTable as any },
    })
    expect(wrapper.get('[data-testid="live-renderer"]').text()).toBe('renderer-a')

    headlessTableRenderer.replace('toString', {
      renderDefault: () => h('span', { 'data-testid': 'live-renderer' }, 'renderer-b'),
    })
    await nextTick()
    expect(wrapper.get('[data-testid="live-renderer"]').text()).toBe('renderer-b')

    headlessTableRenderer.delete('toString')
    await nextTick()
    expect(wrapper.get('[data-testid="row-0"]').text()).toBe('启用')
  })

  it('父组件动态移除命名 slot 后回退到单元格原值', async () => {
    const showSlot = ref(true)
    const columns: HeadlessTableColumn<InventoryRow>[] = [{
      field: 'name',
      slots: { default: 'dynamicCell' },
    }]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]
    const Host = defineComponent({
      setup() {
        return () => h(HeadlessTable as any, { columns, data, diagnostics: false }, {
          default: renderTable,
          ...(showSlot.value
            ? { dynamicCell: () => h('span', { 'data-testid': 'dynamic-slot' }, 'slot-value') }
            : {}),
        })
      },
    })
    const wrapper = mount(Host)

    expect(wrapper.get('[data-testid="dynamic-slot"]').text()).toBe('slot-value')
    showSlot.value = false
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="dynamic-slot"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="row-0"]').text()).toBe('华东仓')
  })

  it('空态 render 配置优先于 Vue empty slot，并保留默认文案', () => {
    const renderWrapper = mount(HeadlessTable as any, {
      props: {
        columns: [{ field: 'name', title: '名称' }],
        slots: {
          empty: ({ columns }: HeadlessTableEmptyScope) => h('span', { 'data-testid': 'empty-render' }, `暂无${columns[0].title}`),
        },
      },
      slots: {
        default: ({ Empty }: any) => h(Empty),
        empty: () => h('span', { 'data-testid': 'empty-slot' }, 'Vue 空态'),
      },
    })

    expect(renderWrapper.get('[data-testid="empty-render"]').text()).toBe('暂无名称')
    expect(renderWrapper.find('[data-testid="empty-slot"]').exists()).toBe(false)

    const defaultWrapper = mount(HeadlessTable as any, {
      props: { emptyText: '没有记录' },
      slots: { default: ({ Empty }: any) => h(Empty) },
    })
    expect(defaultWrapper.text()).toBe('没有记录')
  })

  it('只在 slot 和 renderer 均未命中时执行 formatter，并向 renderer 暴露原值', () => {
    const formatter = vi.fn(({ value }) => `formatted:${value}`)
    const columns: HeadlessTableColumn<InventoryRow>[] = [
      {
        field: 'quantity',
        formatter,
        slots: { default: ({ value, rawValue }) => h('span', `slot:${value}:${rawValue}`) },
      },
      {
        id: 'renderer-quantity',
        accessor: row => row.quantity,
        formatter,
        cellRender: 'quantityRenderer',
      },
      { id: 'formatted-quantity', accessor: row => row.quantity, formatter },
    ]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]
    const renderers: HeadlessTableRendererMap<InventoryRow> = {
      quantityRenderer: {
        renderDefault: (_, { value, rawValue }) => h('span', `renderer:${value}:${rawValue}`),
      },
    }

    const wrapper = mount(HeadlessTable as any, {
      props: { columns, data, renderers },
      slots: { default: renderTable as any },
    })

    expect(wrapper.get('[data-testid="row-0"]').text())
      .toBe('slot:12:12renderer:12:12formatted:12')
    expect(formatter).toHaveBeenCalledTimes(1)
  })

  it('支持稳定列 id、函数 accessor 和无字段展示列', () => {
    const columns: HeadlessTableColumn<InventoryRow>[] = [
      { id: 'owner-label', accessor: row => `${row.owner.name}/${row.code}`, title: '负责人标识' },
      { id: 'actions', title: '操作', slots: { default: () => h('button', '查看') } },
    ]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]

    const wrapper = mount(HeadlessTable as any, {
      props: { columns, data },
      slots: {
        default: (scope: HeadlessTableDefaultScope<InventoryRow>) => h('div', [
          h('span', { 'data-testid': 'column-ids' }, scope.columns
            .map((column, index) => scope.getColumnId(column, index)).join(',')),
          renderTable(scope),
        ]),
      },
    })

    expect(wrapper.get('[data-testid="column-ids"]').text()).toBe('owner-label,actions')
    expect(wrapper.get('[data-testid="row-0"]').text()).toBe('张三/C-001查看')
  })

  it('响应同一局部 renderer map 上动态增加的自有属性', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const columns: HeadlessTableColumn<InventoryRow>[] = [{ field: 'status', cellRender: 'late' }]
    const data: InventoryRow[] = [
      { code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' },
    ]
    const renderers = reactive<HeadlessTableRendererMap<InventoryRow>>({})
    const wrapper = mount(HeadlessTable as any, {
      props: { columns, data, renderers },
      slots: { default: renderTable as any },
    })

    expect(wrapper.get('[data-testid="row-0"]').text()).toBe('启用')
    renderers.late = {
      renderDefault: () => h('span', { 'data-testid': 'late-renderer' }, '已接管'),
    }
    await nextTick()

    expect(wrapper.get('[data-testid="late-renderer"]').text()).toBe('已接管')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('优先使用表级 registry，并对重复 add 提供明确策略', () => {
    const registry = createHeadlessTableRenderer()
    registry.add('scoped', {
      renderDefault: () => h('span', { 'data-testid': 'scoped-renderer' }, '表级'),
    })
    expect(registry.has('scoped')).toBe(true)
    expect(() => registry.add('scoped', {})).toThrow(/use replace/)

    registry.replace('scoped', {
      renderDefault: () => h('span', { 'data-testid': 'scoped-renderer' }, '替换后'),
    })
    const wrapper = mount(HeadlessTable as any, {
      props: {
        columns: [{ field: 'status', cellRender: 'scoped' }],
        data: [{ code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' }],
        diagnostics: false,
        rendererRegistry: registry,
      },
      slots: { default: renderTable as any },
    })

    expect(wrapper.get('[data-testid="scoped-renderer"]').text()).toBe('替换后')
    registry.clear()
    expect(registry.has('scoped')).toBe(false)
  })

  it('通过 injection 隔离应用级 renderer registry', () => {
    headlessTableRenderer.add('isolated', {
      renderDefault: () => h('span', '全局'),
    })
    const registry = createHeadlessTableRenderer()
    registry.add('isolated', {
      renderDefault: () => h('span', { 'data-testid': 'injected-renderer' }, '应用级'),
    })

    const wrapper = mount(HeadlessTable as any, {
      props: {
        columns: [{ field: 'status', cellRender: 'isolated' }],
        data: [{ code: 'C-001', name: '华东仓', owner: { name: '张三' }, quantity: 12, status: '启用' }],
      },
      slots: { default: renderTable as any },
      global: {
        provide: { [headlessTableRendererKey as symbol]: registry },
      },
    })

    expect(wrapper.get('[data-testid="injected-renderer"]').text()).toBe('应用级')
  })
})
