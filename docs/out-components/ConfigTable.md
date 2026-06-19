# ConfigTable 组件文档

## 用途

`ConfigTable` 用配置化列渲染 Element Plus 表格，支持静态 `data` 模式，也支持传入 `query({ ...params, currentPage, pageSize })` 的接口缓存模式。组件来源为 `packages/components/src/ConfigTable`。

## 引入

```ts
import type { ConfigTableColumn, ConfigTableRow } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
```

使用 `query` 模式时，宿主应用必须先安装 `VueQueryPlugin` 并提供唯一 `QueryClient`。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| columns | `ConfigTableColumn[]` | `[]` | 否 | 表格列配置。 |
| data | `ConfigTableRow[]` | `[]` | 否 | 静态表格数据；`query` 存在时优先使用请求结果。 |
| tableProps | `Partial<TableProps<ConfigTableRow>>` | `{}` | 否 | 透传给 `ElTable`。 |
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

## 示例

```vue
<ConfigTable
  v-model:current-page="currentPage"
  v-model:page-size="pageSize"
  :columns="columns"
  :params="{ keyword }"
  :query="loadRows"
  :pagination="{ pageSizes: [10, 20, 50] }"
/>
```

## 测试建议

覆盖静态数据渲染、请求数据渲染、分页显示与隐藏、页码和页大小写回、`params` 变化重置页码、请求失败事件和空态优先级。

## 变更记录

- 2026-06-19：新增 `ConfigTable` 对外契约文档，并记录 request/pagination 模式。
