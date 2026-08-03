# HeadlessTable

`HeadlessTable` 是表格渲染协议层。它管理列配置、值解析、renderer 和 slots，但不输出表格 DOM，
可以适配 Element Plus、Ant Design Vue、原生表格或虚拟列表。

## Adapter

```vue
<HeadlessTable :columns="columns" :data="rows">
  <template
    #default="{
      columns,
      data,
      Cell,
      Header,
      Empty,
      getColumnId,
      getColumnLabel,
    }"
  >
    <ElTable :data="data">
      <ElTableColumn
        v-for="(column, columnIndex) in columns"
        :key="getColumnId(column, columnIndex)"
        :prop="column.accessorKey ?? column.field"
        :label="getColumnLabel(column, columnIndex)"
        v-bind="column.columnProps"
      >
        <template #header>
          <component :is="Header" :column="column" :column-index="columnIndex" />
        </template>
        <template #default="{ row, $index }">
          <component
            :is="Cell"
            :row="row"
            :column="column"
            :row-index="$index"
            :column-index="columnIndex"
          />
        </template>
      </ElTableColumn>
      <template #empty>
        <component :is="Empty" />
      </template>
    </ElTable>
  </template>
</HeadlessTable>
```

`Cell` 和 `Header` 要求 adapter 显式传入 `columnIndex`，避免列对象被复制后通过引用推断出错误索引。

## Columns

字段列可以继续只配置 `field`。计算列和展示列使用稳定的 `id`：

```ts
const columns = [
  { field: 'user.name', title: '姓名' },
  {
    id: 'total',
    title: '合计',
    accessor: row => row.price * row.quantity,
    formatter: ({ value }) => `¥${value}`,
  },
  {
    id: 'actions',
    title: '操作',
    slots: { default: 'actions' },
  },
]
```

列值解析顺序为 `accessor -> accessorKey -> field`。`id` 只负责列 identity，可安全用于 Vue key、
列顺序、显隐状态和持久化。

单元格渲染顺序为：

1. `slots.default`，可以是命名 Vue slot 或 render 函数
2. `cellRender`
3. `formatter`
4. accessor 原值

slot 和 renderer scope 中的 `value`、`rawValue` 都是 accessor 原值。formatter 只在前两项未命中时执行。
默认作用域中的 `getRawCellValue` 返回原值，`getCellValue` 返回 formatter 结果。

表头渲染顺序为 `slots.header -> headerRender -> label/title/accessorKey/field/id`。

## Renderer

renderer API 采用与 vxe-table 类似的“注册名称 + 列配置”模式：

```ts
const statusRenderer = defineHeadlessTableRenderer<
  UserRow,
  { type: 'success' | 'warning' },
  { prefix: string }
>({
  renderDefault(renderOptions, { value }) {
    return h(ElTag, renderOptions.props, () => (
      `${renderOptions.options?.prefix ?? ''}${value}`
    ))
  },
})

headlessTableRenderer.add('statusTag', statusRenderer)

const columns = [{
  field: 'status',
  cellRender: {
    name: 'statusTag',
    props: { type: 'success' },
    options: { prefix: '状态：' },
  },
}]
```

`add` 拒绝重复名称；需要热替换时使用 `replace`。registry 还提供 `mixin`、`get`、`has`、
`delete` 和 `clear`，运行时变化会更新已挂载单元格。

renderer 解析作用域依次为：

1. 单表 `renderers` prop
2. 单表 `rendererRegistry` prop
3. `headlessTableRendererKey` 注入的 app/request registry
4. 全局 `headlessTableRenderer`

SSR 或多应用场景应使用隔离 registry：

```ts
const registry = createHeadlessTableRenderer()
app.provide(headlessTableRendererKey, registry)
```

也可以在组件 setup 中调用 `provideHeadlessTableRenderer(registry)`。开发环境默认会对缺失 renderer、
缺少 render hook 和不存在的命名 slot 输出一次诊断；传入 `:diagnostics="false"` 可以关闭。

## State

`useHeadlessTable` 是独立、可选的状态层，支持过滤、排序、分页、选择、列显隐和列顺序：

```ts
const table = useHeadlessTable({
  columns,
  data: rows,
  getRowId: row => row.id,
  initialState: {
    pagination: { currentPage: 1, pageSize: 20 },
    columnVisibility: { internalCode: false },
  },
})

table.setFilter('status', 'active')
table.toggleSorting('createdAt')
table.toggleRowSelected(row, rowIndex)
```

`columns` 和 `rows` 是处理后的 adapter 输入，`allColumns`、`allRows`、`filteredRows`、`sortedRows`
保留各阶段数据。所有状态都可以通过 `state` 传入外部 `Ref` 进行受控管理。

服务端模式设置 `manualFiltering`、`manualSorting`、`manualPagination`。此时 composable 仍更新状态，
但不会重复处理服务端已返回的数据；`manualPagination` 下通过 `total` 提供服务端总记录数。
