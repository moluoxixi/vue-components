# PopoverTableSelect

A table selector opened from an input. It supports filtering rows and writing the selected record back to the input.

## Basic Usage

:::demo Configure `columns` and `data`, then handle the `select` event when the user chooses a row.

```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { PopoverTableSelect } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { computed, ref } from 'vue'

interface WarehouseRow {
  code: string
  name: string
  owner: string
  status: string
}

const inputValue = ref<string>('W-001 East Warehouse')
const rows: WarehouseRow[] = [
  { code: 'W-001', name: 'East Warehouse', owner: 'Operations A', status: 'Active' },
  { code: 'W-002', name: 'South Warehouse', owner: 'Operations B', status: 'Active' },
  { code: 'W-003', name: 'West Warehouse', owner: 'Operations C', status: 'Maintenance' },
]
const columns: ConfigTableColumn[] = [
  { field: 'code', title: 'Code', width: 120 },
  { field: 'name', title: 'Name', minWidth: 160 },
  { field: 'owner', title: 'Owner', minWidth: 140 },
  { field: 'status', title: 'Status', width: 120, slots: { default: 'status' } },
]
const filteredRows = computed<WarehouseRow[]>(() => {
  const keyword = inputValue.value.toLowerCase()
  return rows.filter(row => `${row.code} ${row.name} ${row.owner} ${row.status}`.toLowerCase().includes(keyword))
})

function handleSelect(row: WarehouseRow): void {
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
    placeholder="Search by warehouse code or name"
    @select="handleSelect"
  >
    <template #status="{ value }">
      <ElTag :type="value === 'Active' ? 'success' : 'warning'" size="small">{{ value }}</ElTag>
    </template>
  </PopoverTableSelect>
</template>
```

:::

## Input and selection contract

| Interface                    | Behavior                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `v-model:inputValue`         | Display text; keep the selected object/business ID separately.                |
| `popType`                    | default uses an external trigger; input uses a built-in input.                |
| `virtualRef` / default slot  | External anchor or custom trigger region.                                     |
| `columns` / `data`           | Columns and current rows, with named header/cell slots.                       |
| `selectTrigger`              | click, dblclick or none for mouse selection.                                  |
| `select(row)` / `enter(row)` | Full selected/keyboard-confirmed row; update both text and business identity. |
| `input(value)` / `clear`     | Input change / clear; clear the business selection too.                       |
| `focus` / `blur`             | Input focus events.                                                           |
| `footer`                     | Custom popover footer.                                                        |

Cell slots receive row, column, rowIndex, columnIndex and value. Header slots omit row/rowIndex/value. The default slot is the trigger region, not a row renderer.

## Remote pagination and loading more

query receives flattened params, currentPage and pageSize, and returns `{ data, total }`. Install VueQueryPlugin first. Default caches are instance-isolated; an explicit cacheKey can share the same resource. Bind currentPage/pageSize and handle pageChange for page parameters. Changing params resets the page by default.

Input does not automatically become a query parameter: map inputValue into business params. debounce/throttle can schedule input processing; avoid conflicting strategies. loaded/error report request results/failures; provide visible application error feedback.

enableLoadMore with hasMore/loading controls bottom-boundary notifications. loadMore only signals demand; the application appends/deduplicates rows and updates hasMore. Choose an explicit pagination or infinite-loading merge strategy; this wrapper does not merge all remote pages automatically.

## Display, clearing and disabled input

Display text is separate from the business ID. Prepare existing labels for edit forms and clear stale IDs when input, upstream conditions or selection changes. Use inputProps.disabled for the built-in input and explain the reason/recovery condition in an outer tooltip. width="auto" follows the anchor; verify fixed heights and column widths against available popover space.
