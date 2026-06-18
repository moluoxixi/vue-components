<script setup lang="ts">
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import type {
  PopoverTableCellParams,
  PopoverTableColumn,
  PopoverTableRow,
  PopoverTableSelectBaseEmits,
  PopoverTableSelectBaseProps,
  PopoverTableSelectSlots,
  PopoverTableVirtualRef,
} from '../types'
import { ElPopover } from 'element-plus'
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { ConfigTable } from '../../../ConfigTable'

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
const slots = defineSlots<PopoverTableSelectSlots>()

const popoverVisible = defineModel<boolean>({ default: false })
const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const elPopoverRef = useTemplateRef<any>('elPopoverRef')
let virtualElement: HTMLElement
let virtualListenersInstalled = false
let outsideClickListenerInstalled = false
let bottomBoundaryReached = false

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

const popoverTableProps = computed<Record<string, any>>(() => {
  return {
    border: false,
    showHeader: props.columns.length > 0,
    rowClassName: ({ rowIndex }: { rowIndex: number }) => rowIndex === currentRowIndex.value ? 'mx-popover-table-select-base__row--current' : '',
  }
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
  if (!popoverVisible.value)
    return

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
  const clickedInsidePopover = popoverRef.value?.contains(target) ?? false
  const clickedInsideVirtual = virtualTarget.contains(target)

  if (!clickedInsidePopover && !clickedInsideVirtual) {
    popoverVisible.value = false
    virtualTarget.blur()
  }
}

function setupEventListeners(): void {
  if (virtualListenersInstalled)
    cleanupEventListeners()

  virtualElement = resolveVirtualElement(props.virtualRef)
  virtualElement.addEventListener('keydown', handleKeydown)
  virtualElement.addEventListener('focus', handleFocus)
  virtualElement.addEventListener('click', handleClick)
  virtualListenersInstalled = true
}

function cleanupEventListeners(): void {
  if (!virtualListenersInstalled)
    return

  virtualElement.removeEventListener('keydown', handleKeydown)
  virtualElement.removeEventListener('focus', handleFocus)
  virtualElement.removeEventListener('click', handleClick)
  cleanupOutsideClickListener()
  virtualListenersInstalled = false
}

function setupOutsideClickListener(): void {
  if (outsideClickListenerInstalled)
    return

  document.addEventListener('mousedown', handleOutsideClick)
  outsideClickListenerInstalled = true
}

function cleanupOutsideClickListener(): void {
  if (!outsideClickListenerInstalled)
    return

  document.removeEventListener('mousedown', handleOutsideClick)
  outsideClickListenerInstalled = false
}

function handleTableScroll(event: Event): void {
  if (!props.scrollY.enabled) {
    bottomBoundaryReached = false
    return
  }

  const target = event.target as HTMLElement
  const bottomReached = target.scrollTop + target.clientHeight >= target.scrollHeight - props.scrollY.threshold
  if (!bottomReached) {
    bottomBoundaryReached = false
    return
  }

  if (bottomBoundaryReached)
    return

  bottomBoundaryReached = true
  emit('scrollBoundary', { direction: 'bottom' })
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
        setupOutsideClickListener()
      })
    }
    else {
      cleanupOutsideClickListener()
    }
  },
  { immediate: true },
)

onMounted(() => {
  setupEventListeners()
})

onActivated(() => {
  setupEventListeners()
  if (popoverVisible.value)
    setupOutsideClickListener()
})

onDeactivated(() => {
  cleanupEventListeners()
})

onUnmounted(() => {
  cleanupEventListeners()
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
        <ConfigTable
          :columns="props.columns"
          :data="props.data"
          :current-row-index="currentRowIndex"
          :empty-text="props.loading ? '加载中...' : '暂无数据'"
          :table-props="popoverTableProps"
          @cell-click="({ row, column, rowIndex, columnIndex, event }) => handleCellClick(row, column, rowIndex, columnIndex, event as MouseEvent)"
          @cell-dbl-click="({ row, column, rowIndex, columnIndex, event }) => handleCellDblClick(row, column, rowIndex, columnIndex, event as MouseEvent)"
        >
          <template
            v-for="(_, name) in slots"
            #[name]="slotParams"
          >
            <slot :name="name" v-bind="slotParams" />
          </template>
          <template #empty>
            <span v-if="props.loading">加载中...</span>
            <span v-else>暂无数据</span>
          </template>
        </ConfigTable>
        <div v-if="props.loading && props.data.length > 0" class="mx-popover-table-select-base__loading">
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

:deep(.mx-popover-table-select-base__row--current) {
  background: var(--el-fill-color);
}

.mx-popover-table-select-base__loading {
  position: sticky;
  bottom: 0;
  padding: 18px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-bg-color);
}
</style>
