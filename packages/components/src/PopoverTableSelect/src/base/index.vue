<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import type {
  PopoverTableCellParams,
  PopoverTableColumn,
  PopoverTableRow,
  PopoverTableSelectBaseEmits,
  PopoverTableSelectBaseProps,
  PopoverTableVirtualRef,
} from '../types'
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'

defineOptions({
  name: 'PopoverTableSelectBase',
})

const props = withDefaults(defineProps<PopoverTableSelectBaseProps>(), {
  popoverProps: () => ({}),
  height: 300,
  id: 'popoverTableSelect',
  columns: () => [],
  data: () => [],
  width: 400,
  placement: 'bottom',
  selectTrigger: 'click',
  virtualRef: null,
  zIndex: undefined,
  loading: false,
  scrollY: () => ({ enabled: false, threshold: 0 }),
})

const emit = defineEmits<PopoverTableSelectBaseEmits>()
const slots = defineSlots<Record<string, (params: any) => any>>()

const popoverVisible = defineModel<boolean>({ default: false })
const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const elPopoverRef = useTemplateRef<any>('elPopoverRef')
let virtualElement: HTMLElement

const currentRowIndex = defineModel<number>('currentRowIndex', { default: 0 })

const popoverRefStyle = computed<CSSProperties>(() => {
  if (props.width === 'auto') {
    return {
      width: 'auto',
      maxWidth: 'calc(100vw - 64px)',
    }
  }

  return {}
})

const tableWrapperStyle = computed<CSSProperties>(() => {
  return { height: props.height }
})

const computedPopoverProps = computed<Record<string, any>>(() => {
  const popoverProps = {
    placement: props.placement,
    trigger: 'hover' as const,
    effect: 'light',
    offset: 12,
    transition: 'el-fade-in-linear',
    showArrow: true,
    teleported: true,
    persistent: true,
    width: props.width,
    ...props.popoverProps,
    popperStyle: {
      zIndex: props.zIndex,
      ...(props.popoverProps as any).popperStyle,
    },
  }

  const { visible, virtualRef, ...rest } = popoverProps as Record<string, any>
  return rest
})

function resolveVirtualElement(target: PopoverTableVirtualRef): HTMLElement {
  return ((target as ComponentPublicInstance)?.$el || (target as any)?.input || target) as HTMLElement
}

function updatePopoverPosition(): void {
  nextTick(() => {
    elPopoverRef.value.popperRef.popperInstanceRef.update()
  })
}

function focusVirtual(): void {
  resolveVirtualElement(props.virtualRef).focus()
  popoverVisible.value = true
}

function selectRow(index: number): void {
  currentRowIndex.value = index
  updatePopoverPosition()
}

function emitSelect(row: PopoverTableRow): void {
  popoverVisible.value = false
  nextTick(() => {
    emit('select', row)
  })
}

function createCellParams(
  row: PopoverTableRow,
  column: PopoverTableColumn,
  rowIndex: number,
  columnIndex: number,
  event: MouseEvent,
): PopoverTableCellParams {
  return { row, column, rowIndex, columnIndex, event }
}

function handleCellClick(
  row: PopoverTableRow,
  column: PopoverTableColumn,
  rowIndex: number,
  columnIndex: number,
  event: MouseEvent,
): void {
  selectRow(rowIndex)
  emit('cellClick', createCellParams(row, column, rowIndex, columnIndex, event))

  if (props.selectTrigger === 'click')
    emitSelect(row)
  else
    focusVirtual()
}

function handleCellDblClick(
  row: PopoverTableRow,
  column: PopoverTableColumn,
  rowIndex: number,
  columnIndex: number,
  event: MouseEvent,
): void {
  selectRow(rowIndex)
  emit('cellDblClick', createCellParams(row, column, rowIndex, columnIndex, event))

  if (props.selectTrigger === 'dblclick')
    emitSelect(row)
}

function handleKeydown(event: KeyboardEvent): void {
  if (!popoverVisible.value)
    return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (currentRowIndex.value < props.data.length - 1)
      selectRow(currentRowIndex.value + 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (currentRowIndex.value > 0)
      selectRow(currentRowIndex.value - 1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    const row = props.data[currentRowIndex.value]
    if (row) {
      popoverVisible.value = false
      nextTick(() => {
        emit('select', row)
        emit('enter', row)
      })
    }
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    popoverVisible.value = false
  }
}

function handleFocus(): void {
  if (!popoverVisible.value)
    popoverVisible.value = true
}

function handleClick(): void {
  popoverVisible.value = true
}

function handleOutsideClick(event: MouseEvent): void {
  const target = event.target as Node
  const virtualTarget = resolveVirtualElement(props.virtualRef)
  const clickedInsidePopover = popoverRef.value!.contains(target)
  const clickedInsideVirtual = virtualTarget.contains(target)

  if (!clickedInsidePopover && !clickedInsideVirtual) {
    popoverVisible.value = false
    virtualTarget.blur()
  }
}

function setupEventListeners(): void {
  virtualElement = resolveVirtualElement(props.virtualRef)
  virtualElement.addEventListener('keydown', handleKeydown)
  virtualElement.addEventListener('focus', handleFocus)
  virtualElement.addEventListener('click', handleClick)
}

function cleanupEventListeners(): void {
  virtualElement.removeEventListener('keydown', handleKeydown)
  virtualElement.removeEventListener('focus', handleFocus)
  virtualElement.removeEventListener('click', handleClick)
  document.removeEventListener('mousedown', handleOutsideClick)
}

function handleTableScroll(event: Event): void {
  const target = event.target as HTMLElement
  const bottomReached = target.scrollTop + target.clientHeight >= target.scrollHeight - props.scrollY.threshold
  if (props.scrollY.enabled && bottomReached)
    emit('scrollBoundary', { direction: 'bottom' })
}

function getColumnTitle(column: PopoverTableColumn): string {
  return column.title ?? column.label ?? column.field
}

function getColumnWidth(column: PopoverTableColumn): string | number | undefined {
  return column.width ?? column.minWidth
}

function getCellValue(row: PopoverTableRow, column: PopoverTableColumn, rowIndex: number, columnIndex: number): any {
  const value = row[column.field]
  return column.formatter
    ? column.formatter({ row, column, rowIndex, columnIndex, value })
    : value
}

watch(
  () => props.virtualRef,
  () => {
    cleanupEventListeners()
    setupEventListeners()
  },
)

watch(
  () => props.columns,
  () => {
    updatePopoverPosition()
  },
  { immediate: true },
)

watch(
  () => props.data,
  (rows) => {
    if (rows.length > 0)
      selectRow(0)
  },
  { immediate: true },
)

watch(
  () => popoverVisible.value,
  (visible) => {
    if (visible) {
      updatePopoverPosition()
      nextTick(() => {
        document.addEventListener('mousedown', handleOutsideClick)
      })
    }
    else {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  cleanupEventListeners()
})

onMounted(() => {
  setupEventListeners()
})
</script>

<template>
  <ElPopover
    ref="elPopoverRef"
    :visible="popoverVisible"
    virtual-triggering
    :virtual-ref="props.virtualRef"
    v-bind="computedPopoverProps"
  >
    <div ref="popoverRef" class="mx-popover-table-select-base" :style="popoverRefStyle">
      <slot name="default" />
      <div
        class="mx-popover-table-select-base__table-wrap"
        :style="tableWrapperStyle"
        @mousedown.stop
        @scroll="handleTableScroll"
      >
        <table class="mx-popover-table-select-base__table">
          <colgroup>
            <col
              v-for="column in props.columns"
              :key="column.field"
              :style="{ width: getColumnWidth(column) }"
            >
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="(column, columnIndex) in props.columns"
                :key="column.field"
                class="mx-popover-table-select-base__header"
                :style="{ textAlign: column.align }"
              >
                <slot
                  v-if="column.slots?.header"
                  :name="column.slots.header"
                  :column="column"
                  :column-index="columnIndex"
                />
                <template v-else>
                  {{ getColumnTitle(column) }}
                </template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in props.data"
              :key="rowIndex"
              class="mx-popover-table-select-base__row"
              :class="{ 'mx-popover-table-select-base__row--current': rowIndex === currentRowIndex }"
            >
              <td
                v-for="(column, columnIndex) in props.columns"
                :key="column.field"
                class="mx-popover-table-select-base__cell"
                :style="{ textAlign: column.align }"
                @click="handleCellClick(row, column, rowIndex, columnIndex, $event)"
                @dblclick="handleCellDblClick(row, column, rowIndex, columnIndex, $event)"
              >
                <slot
                  v-if="column.slots?.default && slots[column.slots.default]"
                  :name="column.slots.default"
                  :row="row"
                  :column="column"
                  :row-index="rowIndex"
                  :column-index="columnIndex"
                  :value="getCellValue(row, column, rowIndex, columnIndex)"
                />
                <template v-else>
                  {{ getCellValue(row, column, rowIndex, columnIndex) }}
                </template>
              </td>
            </tr>
            <tr v-if="props.data.length === 0">
              <td class="mx-popover-table-select-base__empty" :colspan="props.columns.length">
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="props.loading" class="mx-popover-table-select-base__loading">
          加载中...
        </div>
      </div>
    </div>
  </ElPopover>
</template>

<style scoped>
.mx-popover-table-select-base {
  min-width: 100%;
}

.mx-popover-table-select-base__table-wrap {
  position: relative;
  overflow: auto;
}

.mx-popover-table-select-base__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.mx-popover-table-select-base__header,
.mx-popover-table-select-base__cell {
  height: 32px;
  padding: 6px 10px;
  overflow: hidden;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mx-popover-table-select-base__header {
  font-weight: 600;
  background: var(--el-fill-color-light);
}

.mx-popover-table-select-base__row {
  cursor: pointer;
}

.mx-popover-table-select-base__row:hover,
.mx-popover-table-select-base__row--current {
  background: var(--el-fill-color);
}

.mx-popover-table-select-base__empty,
.mx-popover-table-select-base__loading {
  padding: 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.mx-popover-table-select-base__loading {
  position: sticky;
  bottom: 0;
  background: var(--el-bg-color);
}
</style>
