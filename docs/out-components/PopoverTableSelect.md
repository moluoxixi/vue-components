# PopoverTableSelect组件文档

## 用途

`PopoverTableSelect` 用输入框或外部虚拟引用触发表格弹层，支持键盘确认、行选择、动态列插槽和滚动到底加载。组件来源为 `packages/components/src/PopoverTableSelect`。

## 引入

```ts
import { PopoverTableSelect } from '@moluoxixi/components'
import type { PopoverTableColumn, PopoverTableRow } from '@moluoxixi/components'
```

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
| loading | `boolean` | `false` | 否 | 弹层表格加载状态。 |
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
- `loading` 展示表格加载提示。
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

## 测试建议

覆盖输入同步、行选择和键盘确认、调度配置变化后的取消逻辑、滚动到底加载去重、弹层定位更新以及外部点击关闭。

## 变更记录

- 2026-06-07：根据源码、类型、示例和测试生成组件契约文档。
