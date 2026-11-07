# PopoverTableSelect

输入框触发弹出表格的选择器，支持筛选数据并将选中行回填到输入框。

## 基础用法

:::demo 配置 `columns` 和 `data`，点击输入框弹出表格，点击行触发 `select` 事件。

```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { PopoverTableSelect } from '@moluoxixi/components'
import { ElDescriptions, ElDescriptionsItem, ElTag } from 'element-plus'
import { computed, ref } from 'vue'

interface WarehouseRow {
  code: string
  name: string
  owner: string
  status: string
}

const inputValue = ref<string>('C-001 华东仓')
const selectedRow = ref<WarehouseRow>({ code: 'C-001', name: '华东仓', owner: '运营一部', status: '启用' })

const allRows: WarehouseRow[] = [
  { code: 'C-001', name: '华东仓', owner: '运营一部', status: '启用' },
  { code: 'C-002', name: '华南仓', owner: '运营二部', status: '启用' },
  { code: 'C-003', name: '西南仓', owner: '运营三部', status: '维护' },
  { code: 'C-004', name: '华北仓', owner: '运营四部', status: '启用' },
]

const columns: ConfigTableColumn[] = [
  { field: 'code', title: '编码', width: 120 },
  { field: 'name', title: '名称', minWidth: 150 },
  { field: 'owner', title: '负责人', minWidth: 130 },
  { field: 'status', title: '状态', width: 90, align: 'center', slots: { default: 'status' } },
]

const filteredRows = computed<WarehouseRow[]>(() =>
  allRows.filter(row => {
    const keyword = inputValue.value.replace(/\s+/g, '').toLowerCase()
    const searchable = `${row.code}${row.name}${row.owner}${row.status}`.toLowerCase()
    return searchable.includes(keyword)
  }),
)

function handleSelect(row: WarehouseRow): void {
  selectedRow.value = row
  inputValue.value = `${row.code} ${row.name}`
}
</script>
<template>
  <PopoverTableSelect
    v-model:input-value="inputValue"
    pop-type="input"
    width="auto"
    :data="filteredRows"
    :columns="columns"
    :height="200"
    placeholder="输入仓库编码或名称搜索"
    @select="handleSelect"
  >
    <template #status="{ value }">
      <ElTag :type="value === '启用' ? 'success' : 'warning'" size="small">{{ value }}</ElTag>
    </template>
  </PopoverTableSelect>

  <ElDescriptions :column="2" border style="margin-top:16px;">
    <ElDescriptionsItem label="编码">{{ selectedRow.code }}</ElDescriptionsItem>
    <ElDescriptionsItem label="名称">{{ selectedRow.name }}</ElDescriptionsItem>
    <ElDescriptionsItem label="负责人">{{ selectedRow.owner }}</ElDescriptionsItem>
    <ElDescriptionsItem label="状态">{{ selectedRow.status }}</ElDescriptionsItem>
  </ElDescriptions>
</template>
```

:::

## 输入与选择契约

| 接口                         | 行为                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `v-model:inputValue`         | 输入显示文本；选中对象或业务 ID 由调用方独立保存。            |
| `popType`                    | default 使用外部触发元素，input 使用内置输入框。              |
| `virtualRef` / 默认插槽      | 可指定外部触发元素或组合默认触发区域。                        |
| `columns` / `data`           | 表格列与当前展示数据；列支持具名表头和单元格插槽。            |
| `selectTrigger`              | click、dblclick、none，控制鼠标选择方式。                     |
| `select(row)` / `enter(row)` | 选择或键盘确认的完整行；在处理器中更新 inputValue 与业务 ID。 |
| `input(value)` / `clear`     | 输入变化 / 清空；清空输入时也应清空业务选择。                 |
| `focus` / `blur`             | 输入焦点变化。                                                |
| `footer`                     | 自定义弹层底部内容。                                          |

单元格插槽包含 row、column、rowIndex、columnIndex、value；表头没有 row/rowIndex/value。默认插槽用于触发区域，不是表格行内容。

## 远程分页与加载更多

query 接收展开后的 params、currentPage、pageSize，返回 `{ data, total }`。使用前安装 VueQueryPlugin。默认缓存按实例隔离；显式 cacheKey 可共享同一资源。分页通过 currentPage/pageSize 双向绑定，pageChange 返回两项页参数；params 改变时默认回第一页。

输入变化不会自动拼接为接口查询参数，应把 inputValue 映射到业务 params。可用 debounce 或 throttle 调度输入处理；避免同时设置相互冲突的策略。loaded/error 分别通知请求结果和失败，业务需提供可见错误反馈。

enableLoadMore 配合 hasMore/loading 控制底部触发，loadMore 只是加载通知；业务负责追加数据、去重和更新 hasMore。远程分页与无限加载请选择清晰的一种数据合并策略，组件不会自动把全部远程页合并。

## 回显、清空和禁用

显示文本不等于业务 ID。编辑页面应先准备已选对象的显示文本；重新输入、清空或切换上游条件时，同步清理失效 ID。禁用内置输入框可使用 inputProps.disabled，并在外层 tooltip 说明原因及恢复条件。width="auto" 跟随触发区域；固定高度和列宽应结合弹层空间验收。
