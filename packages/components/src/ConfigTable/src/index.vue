<script setup lang="ts">
import type {
  ConfigTableEmits,
  ConfigTableProps,
  ConfigTableSlots,
} from './types'
import { ElPagination, ElTableV2 } from 'element-plus'
import { ConfigTableColumnSettings, ConfigTableRenderNode } from './components'
import {
  useConfigTableColumns,
  useConfigTableData,
  useConfigTableRenderer,
} from './composables'

defineOptions({ name: 'ConfigTable' })

const props = withDefaults(defineProps<ConfigTableProps>(), {
  columns: () => [],
  columnConfig: false,
  columnOrder: () => [],
  columnVisibility: () => ({}),
  columnWidths: () => ({}),
  data: () => [],
  diagnostics: true,
  tableProps: () => ({}),
  emptyText: '暂无数据',
  currentRowIndex: -1,
  params: () => ({}),
  enabled: true,
  pagination: undefined,
  resetPageOnParamsChange: true,
  renderers: () => ({}),
  width: 800,
  height: 320,
  rowHeight: 44,
  headerHeight: 40,
  defaultColumnWidth: 160,
  rowKey: '__mx_config_table_row_key',
})

const emit = defineEmits<ConfigTableEmits>()
const slots = defineSlots<ConfigTableSlots>()
const currentPage = defineModel<number>('currentPage', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })

const {
  computedEmptyText,
  handleCurrentPageUpdate,
  handlePageSizeUpdate,
  paginationProps,
  requestTotal,
  shouldShowPagination,
  tableData,
  virtualRows,
} = useConfigTableData(props, currentPage, pageSize, emit)

const {
  applyColumnSettings,
  columnConfigEnabled,
  columnOrderState,
  columnVisibilityState,
  columnWidthsState,
  getConfigColumn,
  getConfigColumnIndex,
  getRawRow,
  getVisibleColumnIndex,
  normalizedColumnConfig,
  orderedColumns,
  virtualColumns,
  virtualTableProps,
  visibleColumns,
} = useConfigTableColumns(props, tableData, emit)

const {
  handleVirtualCellClick,
  handleVirtualCellDblClick,
  renderVirtualCell,
  renderVirtualHeader,
} = useConfigTableRenderer({
  props,
  emit,
  slots,
  tableData,
  orderedColumns,
  visibleColumns,
  getRawRow,
  getConfigColumn,
  getConfigColumnIndex,
  getVisibleColumnIndex,
})
</script>

<template>
  <div class="mx-config-table-shell">
    <ConfigTableColumnSettings
      v-if="columnConfigEnabled"
      class="mx-config-table__toolbar"
      :columns="props.columns"
      :column-order="columnOrderState"
      :column-visibility="columnVisibilityState"
      :column-widths="columnWidthsState"
      :default-column-width="props.defaultColumnWidth"
      :config="normalizedColumnConfig"
      @apply="applyColumnSettings"
    />
    <ElTableV2
      v-bind="virtualTableProps"
      :columns="virtualColumns"
      :data="virtualRows"
      :header-height="props.headerHeight"
      :height="props.height"
      :row-height="props.rowHeight"
      :row-key="props.rowKey"
      :width="props.width"
    >
      <template #header-cell="{ column, columnIndex }">
        <ConfigTableRenderNode
          :render="renderVirtualHeader"
          :params="{ column, columnIndex }"
        />
      </template>
      <template #cell="{ rowData, rowIndex, column, columnIndex }">
        <div
          class="mx-config-table__cell"
          :class="{ 'mx-config-table__cell--current': rowIndex === props.currentRowIndex }"
          :data-field="getConfigColumn(column, columnIndex).field"
          :data-testid="`config-table-cell-${getConfigColumn(column, columnIndex).field}-${rowIndex}`"
          @click="handleVirtualCellClick(rowData, column, rowIndex, columnIndex, $event)"
          @dblclick="handleVirtualCellDblClick(rowData, column, rowIndex, columnIndex, $event)"
        >
          <ConfigTableRenderNode
            :render="renderVirtualCell"
            :params="{ rowData, rowIndex, column, columnIndex }"
          />
        </div>
      </template>
      <template #empty>
        <ConfigTableRenderNode
          v-if="props.slots?.empty"
          :render="props.slots.empty"
          :params="{ columns: props.columns, data: tableData }"
        />
        <slot
          v-else
          name="empty"
          :columns="props.columns"
          :data="tableData"
        >
          {{ computedEmptyText }}
        </slot>
      </template>
    </ElTableV2>
    <div
      v-if="shouldShowPagination"
      class="mx-config-table__pagination-shell"
    >
      <ElPagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="requestTotal"
        v-bind="paginationProps"
        @update:current-page="handleCurrentPageUpdate"
        @update:page-size="handlePageSizeUpdate"
      />
    </div>
  </div>
</template>

<style scoped>
.mx-config-table-shell {
  width: 100%;
  min-width: 0;
}

.mx-config-table__toolbar {
  margin-bottom: 10px;
}

.mx-config-table__cell {
  width: 100%;
  min-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.mx-config-table__cell--current,
:deep(.mx-config-table__row--current) .mx-config-table__cell {
  font-weight: 600;
}

.mx-config-table__pagination-shell {
  display: grid;
  grid-template-columns: minmax(100%, max-content);
  justify-items: end;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  padding: 2px 0;
}
</style>
