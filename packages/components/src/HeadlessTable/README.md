# HeadlessTable

`HeadlessTable` 只管理数据、列配置和渲染策略，不输出表格 DOM。默认作用域提供
`Cell`、`Header`、`Empty` 三个适配组件，可与 Element Plus、Ant Design Vue 或原生表格组合。

```vue
<HeadlessTable :columns="columns" :data="rows">
  <template #default="{ columns, data, Cell, Header, Empty }">
    <ElTable :data="data">
      <ElTableColumn v-for="(column, columnIndex) in columns" :key="column.field">
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

## Renderer

renderer API 采用与 vxe-table 类似的“注册名称 + 列配置”模式：

```ts
headlessTableRenderer.add('statusTag', {
  renderDefault(renderOptions, { value }) {
    return h(ElTag, renderOptions.props, () => value)
  },
})

const columns = [{
  field: 'status',
  cellRender: { name: 'statusTag', props: { type: 'success' } },
}]
```

`renderers` prop 可以为单个表格覆盖同名全局 renderer。全局 renderer 支持运行时
`add`、`mixin`、`get` 和 `delete`，变更会触发已挂载单元格更新。

单元格解析顺序为：列 `slots.default`、`cellRender`、`formatter`、字段原值。表头解析顺序为：
列 `slots.header`、`headerRender`、`label/title/field`。`slots.default/header` 均可填写 Vue
插槽名或直接传入 render 函数。
