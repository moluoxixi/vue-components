# PopoverTableSelect组件文档

## 用途

`PopoverTableSelect` 用输入框或外部虚拟引用触发表格弹层，支持键盘确认、行选择、动态列插槽和滚动到底加载。组件来源为 `packages/components/src/PopoverTableSelect`。

## 引入

```ts
import type { PopoverTableColumn, PopoverTableRow } from '@moluoxixi/components'
import { PopoverTableSelect } from '@moluoxixi/components'
```

使用 `query` 模式时，宿主应用必须先安装 `VueQueryPlugin` 并提供唯一 `QueryClient`。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| debounce | `number` | `0` | 否 | 选择和输入事件的防抖毫秒数。 |
| throttle | `number` | `300` | 否 | 选择和输入事件的节流毫秒数。 |
| options | `ScheduleOptions & { promise?: boolean }` | `{}` | 否 | 防抖或节流配置。 |
| popType | `'default' \| 'input'` | `input` | 否 | 默认渲染 Element Plus Input 作为触发源；`default` 时需由调用方提供 `virtualRef`。 |
| placeholder | `string` | `点击或按下方向键试试` | 否 | 输入框占位内容。 |
| popoverProps | `Partial<PopoverProps>` | `{}` | 否 | 透传给 Element Plus Popover。 |
| inputProps | `Partial<InputProps>` | `{}` | 否 | 透传给 Element Plus Input。 |
| inputValue | `string` | `''` | 否 | 命名 `v-model:inputValue` 的输入值。 |
| virtualRef | `ComponentPublicInstance \| ComponentInternalInstance \| InputInstance \| HTMLElement \| null` | `null` | 否 | 外部触发源；`popType=input` 时可由内部 Input 提供。 |
| successiveShowType | `'enter' \| 'input'` | `enter` | 否 | 连续打开弹层的触发方式。 |
| onInput | `(value: string) => void` | `undefined` | 否 | 输入值变化回调。 |
| enableLoadMore | `boolean` | `false` | 否 | 是否启用滚动到底加载事件。 |
| hasMore | `boolean` | `false` | 否 | 是否还有更多数据。 |
| loading | `boolean` | `false` | 否 | 弹层表格加载状态；`query` 模式下会与请求加载态合并。 |
| query | `(params & { currentPage, pageSize }) => Promise<{ data, total }>` | `undefined` | 否 | 弹层表格请求函数。 |
| params | `Record<string, unknown>` | `{}` | 否 | 业务请求参数，同时作为缓存 key 的一部分。 |
| cacheKey | `QueryKeyBase` | `PopoverTableSelect` | 否 | 查询 key 前缀。 |
| enabled | `boolean` | `true` | 否 | 是否自动请求。 |
| staleTime | `number` | `undefined` | 否 | 透传给 TanStack Query 的数据新鲜时间。 |
| pagination | `boolean \| PopoverTablePaginationProps` | `undefined` | 否 | 分页 UI 配置；`false` 隐藏分页。 |
| resetPageOnParamsChange | `boolean` | `true` | 否 | `params` 变化时是否把当前页重置为 1。 |
| currentPage | `number` | `1` | 否 | 命名 `v-model:currentPage`。 |
| pageSize | `number` | `10` | 否 | 命名 `v-model:pageSize`。 |
| width | `number \| string` | `400` | 否 | 透传给内部 `PopoverTableSelectBase` 的弹层宽度。 |
| placement | `PopoverProps['placement']` | `bottom` | 否 | 弹层位置。 |
| height | `string \| number` | `300` | 否 | 表格滚动容器高度。 |
| columns | `PopoverTableColumn[]` | `[]` | 否 | 表格列配置。 |
| data | `PopoverTableRow[]` | `[]` | 否 | 表格数据。 |
| selectTrigger | `'click' \| 'dblclick' \| 'none'` | `click` | 否 | 行选择触发方式。 |
| scrollY | `{ enabled: boolean, threshold: number }` | `{ enabled: false, threshold: 0 }` | 否 | 滚动边界检测配置。 |

## 事件与回调

| 名称 | 触发时机 |
|---|---|
| focus | 输入框或虚拟触发源聚焦时触发。 |
| blur | 输入框失焦时触发。 |
| input | 输入值变化时触发。 |
| clear | 输入框清空时触发。 |
| select | 用户选择一行时触发。 |
| enter | 键盘 Enter 确认当前行时触发。 |
| loadMore | 启用加载更多且滚动到底部时触发。 |
| loaded | `query` 请求成功并获得 `{ data, total }` 时触发。 |
| error | `query` 请求失败时触发原始 `Error`。 |
| pageChange | 当前页或页大小变化时触发 `{ currentPage, pageSize }`。 |

## 插槽或 Children

| 名称 | 说明 |
|---|---|
| default | 弹层表格顶部内容。 |
| 动态列插槽 | `columns[].slots.default` 和 `columns[].slots.header` 指定的命名插槽，参数包含 `row`、`column`、`rowIndex`、`columnIndex`、`value`。 |

## 状态

- `v-model` 控制弹层可见状态。
- `v-model:inputValue` 控制输入值。
- 默认 `popType=input`，组件会渲染内部输入框并用它作为弹层触发源；切到 `default` 时必须提供外部 `virtualRef`，否则没有可见触发器。
- 内部基座维护当前行索引并响应 ArrowUp、ArrowDown、Enter、Escape。
- 静态模式直接使用 `data`；请求模式把 `params`、`currentPage`、`pageSize` 纳入查询 key，并把分页参数平铺传给 `query`。
- `params` 必须是稳定、可序列化的普通对象；不要传入函数、DOM、组件实例或循环引用。
- `pagination=false` 只隐藏分页 UI，不会把滚动到底解释成请求分页翻页。
- `pageSize` 变化会把 `currentPage` 重置为 1；默认 `params` 变化也会重置为 1。
- `loading` 展示表格加载提示，`query` 模式下请求中会展示加载态。
- `scrollY.enabled` 时滚动到底会按边界去重触发。

## 可访问性

虚拟触发源监听键盘方向键和 Enter；调用方应保证输入框具备 label 或可访问名称。动态列内容应避免只用颜色表达状态。

## 示例

```vue
<PopoverTableSelect
  v-model:input-value="inputValue"
  :data="filteredRows"
  :columns="columns"
  :height="240"
  @select="handleSelect"
>
  <template #status="{ value }">
    <ElTag :type="value === '启用' ? 'success' : 'warning'">
      {{ value }}
    </ElTag>
  </template>
</PopoverTableSelect>
```

请求模式：

```vue
<PopoverTableSelect
  v-model:input-value="inputValue"
  v-model:current-page="currentPage"
  :columns="columns"
  :params="{ keyword: inputValue }"
  :query="loadWarehouses"
  :pagination="{ pageSizes: [10, 20, 50] }"
  @select="handleSelect"
/>
```

## 测试建议

覆盖输入同步、行选择和键盘确认、调度配置变化后的取消逻辑、滚动到底加载去重、弹层定位更新、外部点击关闭、请求数据渲染、分页写回、`pagination=false` 和请求失败事件。

## 变更记录

- 2026-06-07：根据源码、类型、示例和测试生成组件契约文档。
- 2026-06-19：补充 request/pagination 模式、事件和示例。
