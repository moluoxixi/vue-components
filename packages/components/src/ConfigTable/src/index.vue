<script setup lang="ts">
import type {
  ConfigTableCellParams,
  ConfigTableColumn,
  ConfigTableEmits,
  ConfigTableEmptyRender,
  ConfigTableProps,
  ConfigTableRender,
  ConfigTableSlots,
  ConfigTableRow,
} from './types'
import { computed, defineComponent } from 'vue'

const props = withDefaults(defineProps<ConfigTableProps>(), {
  columns: () => [],
  data: () => [],
  tableProps: () => ({}),
  emptyText: '暂无数据',
  currentRowIndex: -1,
})

const emit = defineEmits<ConfigTableEmits>()
const slots = defineSlots<ConfigTableSlots>()

const ConfigTableRenderNode = defineComponent({
  name: 'ConfigTableRenderNode',
  props: {
    params: { type: Object, required: true },
    render: { type: Function, required: true },
  },
  setup(renderProps) {
    return () => (renderProps.render as ConfigTableRender | ConfigTableEmptyRender)(renderProps.params as any)
  },
})

const tableProps = computed<Record<string, any>>(() => {
  return {
    border: true,
    stripe: false,
    ...props.tableProps,
  }
})

function getColumnLabel(column: ConfigTableColumn): string {
  return column.label ?? column.title ?? column.field
}

function getColumnMinWidth(column: ConfigTableColumn): string | number | undefined {
  return column.minWidth
}

function getColumnWidth(column: ConfigTableColumn): string | number | undefined {
  return column.width
}

function getCellValue(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number): any {
  const value = row[column.field]
  return column.formatter
    ? column.formatter({ row, column, rowIndex, columnIndex, value })
    : value
}

function isRender(slot: string | ConfigTableRender | undefined): slot is ConfigTableRender {
  return typeof slot === 'function'
}

function isSlotName(slot: string | ConfigTableRender | undefined): slot is string {
  return typeof slot === 'string'
}

function createHeaderParams(column: ConfigTableColumn, columnIndex: number) {
  return {
    column,
    columnIndex,
    columns: props.columns,
    data: props.data,
    index: columnIndex,
  }
}

function createSlotParams(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number) {
  return {
    row,
    column,
    rowIndex,
    columnIndex,
    columns: props.columns,
    data: props.data,
    index: rowIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
  }
}

function createCellParams(
  row: ConfigTableRow,
  column: ConfigTableColumn,
  rowIndex: number,
  columnIndex: number,
  event?: MouseEvent,
): ConfigTableCellParams {
  return {
    row,
    column,
    rowIndex,
    columnIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
    event,
  }
}

function handleCellClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, event: MouseEvent): void {
  emit('cellClick', createCellParams(row, column, rowIndex, columnIndex, event))
}

function handleCellDblClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, event: MouseEvent): void {
  emit('cellDblClick', createCellParams(row, column, rowIndex, columnIndex, event))
}
</script>

<template>
  <ElTable
    class="mx-config-table"
    :data="props.data"
    :empty-text="props.emptyText"
    highlight-current-row
    v-bind="tableProps"
  >
    <ElTableColumn
      v-for="(column, columnIndex) in props.columns"
      :key="column.field"
      :prop="column.field"
      :label="getColumnLabel(column)"
      :width="getColumnWidth(column)"
      :min-width="getColumnMinWidth(column)"
      :align="column.align"
      v-bind="column.columnProps"
    >
      <template #header>
        <ConfigTableRenderNode
          v-if="isRender(column.slots?.header)"
          :render="column.slots.header"
          :params="createHeaderParams(column, columnIndex)"
        />
        <slot
          v-else-if="isSlotName(column.slots?.header) && slots[column.slots.header]"
          :name="column.slots.header"
          :column="column"
          :column-index="columnIndex"
          :columns="props.columns"
          :data="props.data"
          :index="columnIndex"
        />
        <template v-else>
          {{ getColumnLabel(column) }}
        </template>
      </template>
      <template #default="scope">
        <div
          class="mx-config-table__cell"
          :class="{ 'mx-config-table__cell--current': scope.$index === props.currentRowIndex }"
          :data-field="column.field"
          :data-testid="`config-table-cell-${column.field}-${scope.$index}`"
          @click="handleCellClick(scope.row, column, scope.$index, columnIndex, $event)"
          @dblclick="handleCellDblClick(scope.row, column, scope.$index, columnIndex, $event)"
        >
          <ConfigTableRenderNode
            v-if="isRender(column.slots?.default)"
            :render="column.slots.default"
            :params="createSlotParams(scope.row, column, scope.$index, columnIndex)"
          />
          <slot
            v-else-if="isSlotName(column.slots?.default) && slots[column.slots.default]"
            :name="column.slots.default"
            :row="scope.row"
            :column="column"
            :row-index="scope.$index"
            :column-index="columnIndex"
            :columns="props.columns"
            :data="props.data"
            :index="scope.$index"
            :value="getCellValue(scope.row, column, scope.$index, columnIndex)"
          />
          <template v-else>
            {{ getCellValue(scope.row, column, scope.$index, columnIndex) }}
          </template>
        </div>
      </template>
    </ElTableColumn>
    <template #empty>
      <ConfigTableRenderNode
        v-if="props.slots?.empty"
        :render="props.slots.empty"
        :params="{ columns: props.columns, data: props.data }"
      />
      <slot v-else name="empty">
        {{ props.emptyText }}
      </slot>
    </template>
  </ElTable>
</template>

<style scoped>
.mx-config-table {
  width: 100%;
}

.mx-config-table__cell {
  width: 100%;
  min-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.mx-config-table__cell--current {
  font-weight: 600;
}
</style>
