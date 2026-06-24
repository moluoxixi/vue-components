# ConfigTable 组件文档

## 用途

`ConfigTable` 用配置化列渲染 Element Plus `ElTableV2` 虚拟表格，支持静态 `data` 模式，也支持传入 `query({ ...params, currentPage, pageSize })` 的接口缓存模式。组件来源为 `packages/components/src/ConfigTable`。

## 引入

```ts
import type { ConfigTableColumn, ConfigTableRow } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
```

使用 `query` 模式时，宿主应用必须先安装 `VueQueryPlugin` 并提供唯一 `QueryClient`。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| columns | `ConfigTableColumn[]` | `[]` | 否 | 表格列配置，会映射为 TableV2 columns。 |
| data | `ConfigTableRow[]` | `[]` | 否 | 静态表格数据；`query` 存在时优先使用请求结果。 |
| width | `number` | `800` | 否 | 虚拟表格宽度，传给 `ElTableV2.width`。 |
| height | `number` | `320` | 否 | 虚拟表格高度，传给 `ElTableV2.height`。 |
| rowHeight | `number` | `44` | 否 | 虚拟表格行高。 |
| headerHeight | `number` | `40` | 否 | 虚拟表格表头高度。 |
| defaultColumnWidth | `number` | `160` | 否 | 列未声明可解析宽度时的默认列宽。 |
| rowKey | `string` | `__mx_config_table_row_key` | 否 | TableV2 行 key 字段；默认使用内部行索引 key，传入业务稳定字段可减少重排。 |
| tableProps | `Partial<TableV2Props> & { rowClassName?: ConfigTableRowClass }` | `{}` | 否 | 透传给 `ElTableV2`；`columns`、`data`、尺寸和 `rowKey` 由 `ConfigTable` 管理。 |
| slots | `ConfigTableRenderSlots` | `undefined` | 否 | 表格级渲染函数配置，当前支持 `empty`。 |
| emptyText | `string` | `暂无数据` | 否 | 空态文本。 |
| currentRowIndex | `number` | `-1` | 否 | 当前行样式索引。 |
| query | `(params & { currentPage, pageSize }) => Promise<{ data, total }>` | `undefined` | 否 | 表格请求函数。 |
| params | `Record<string, unknown>` | `{}` | 否 | 业务请求参数，同时作为缓存 key 的一部分。 |
| cacheKey | `QueryKeyBase` | `ConfigTable` | 否 | 查询 key 前缀。 |
| enabled | `boolean` | `true` | 否 | 是否自动请求。 |
| staleTime | `number` | `undefined` | 否 | 透传给 TanStack Query 的数据新鲜时间。 |
| pagination | `boolean \| ConfigTablePaginationProps` | `undefined` | 否 | 分页 UI 配置；`false` 隐藏分页。 |
| resetPageOnParamsChange | `boolean` | `true` | 否 | `params` 变化时是否把当前页重置为 1。 |
| currentPage | `number` | `1` | 否 | 命名 `v-model:currentPage`。 |
| pageSize | `number` | `10` | 否 | 命名 `v-model:pageSize`。 |

## 列配置

- `field` 用作默认 `dataKey` 和 `key`。
- `title` / `label` 会映射为 TableV2 `title`，其中 `label` 优先。
- `width`、`minWidth` 支持数字或数字型字符串，例如 `120`、`"120"`、`"120px"`；其它字符串会回退到 `defaultColumnWidth`。
- `columnProps` 透传给 TableV2 column，并兼容旧 `className` 字段到 TableV2 `class`。

## 事件

| 名称 | 触发时机 |
|---|---|
| cellClick | 单元格点击时触发，返回行列和值上下文。 |
| cellDblClick | 单元格双击时触发，返回行列和值上下文。 |
| loaded | `query` 请求成功并获得 `{ data, total }` 时触发。 |
| error | `query` 请求失败时触发原始 `Error`。 |
| pageChange | 当前页或页大小变化时触发 `{ currentPage, pageSize }`。 |

## 插槽

| 名称 | 说明 |
|---|---|
| empty | 空态插槽，优先级高于 `emptyText`。 |
| 动态列插槽 | `columns[].slots.default` 和 `columns[].slots.header` 指定的命名插槽，参数包含 `row`、`column`、`rowIndex`、`columnIndex`、`value`。 |

## 状态

- 静态模式直接渲染 `data`。
- 请求模式把 `params`、`currentPage`、`pageSize` 纳入查询 key，并把分页参数平铺传给 `query`。
- `params` 必须是稳定、可序列化的普通对象；不要传入函数、DOM、组件实例或循环引用。
- `pagination=false` 只隐藏分页 UI，请求模式仍会传递 `currentPage` 和 `pageSize`。
- `pageSize` 变化会把 `currentPage` 重置为 1；默认 `params` 变化也会重置为 1。
- `ElTableV2` 必须有数字宽高；调用方需要按实际容器传入 `width` 和 `height`，否则使用默认 `800 x 320`。

## 示例

```vue
<ConfigTable
  v-model:current-page="currentPage"
  v-model:page-size="pageSize"
  :columns="columns"
  :height="360"
  :params="{ keyword }"
  :query="loadRows"
  :width="720"
  :pagination="{ pageSizes: [10, 20, 50] }"
/>
```

## 测试建议

覆盖静态数据渲染、虚拟表格尺寸与列宽映射、动态表头和单元格插槽、请求数据渲染、分页显示与隐藏、页码和页大小写回、`params` 变化重置页码、请求失败事件和空态优先级。

## 变更记录

- 2026-06-24：底层表格切换为 Element Plus `ElTableV2`，新增虚拟表格宽高、行高、表头高度、默认列宽和行 key 配置。
- 2026-06-19：新增 `ConfigTable` 对外契约文档，并记录 request/pagination 模式。
