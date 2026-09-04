import type { CSSProperties, Ref } from 'vue'
import type {
  PopoverTableCellParams,
  PopoverTableColumn,
  PopoverTableRow,
  PopoverTableSelectBaseEmits,
  PopoverTableSelectBaseProps,
} from '../types'
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, watch } from 'vue'
import { resolveVirtualElement, toNumberSize } from '../utils'

interface PopoverTableSelectBaseModels {
  currentRowIndex: Ref<number>
  visible: Ref<boolean>
}

interface PopoverTableSelectBaseRefs {
  elPopover: Ref<any>
  popover: Readonly<Ref<HTMLElement | null>>
}

export function usePopoverTableSelectBase(
  props: Readonly<PopoverTableSelectBaseProps>,
  emit: PopoverTableSelectBaseEmits,
  models: PopoverTableSelectBaseModels,
  refs: PopoverTableSelectBaseRefs,
) {
  let virtualElement: HTMLElement
  let virtualListenersInstalled = false
  let outsideClickListenerInstalled = false
  let lifecycleActive = false
  let bottomBoundaryReached = false

  const popoverRefStyle = computed<CSSProperties>(() => {
    if (props.width === 'auto') {
      return {
        width: 'auto',
        maxWidth: 'calc(100vw - 64px)',
      }
    }

    return {}
  })

  const tableWrapperStyle = computed<CSSProperties>(() => ({ height: props.height }))
  const tableWidth = computed<number>(() => toNumberSize(props.width, 400))
  const tableHeight = computed<number>(() => toNumberSize(props.height, 300))

  const popoverTableProps = computed<Record<string, any>>(() => ({
    rowClass: ({ rowIndex }: { rowIndex: number }) => rowIndex === models.currentRowIndex.value
      ? 'mx-popover-table-select-base__row--current'
      : '',
  }))

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
        ...(props.popoverProps as any)?.popperStyle,
      },
    }

    const { visible, virtualRef, ...rest } = popoverProps as Record<string, any>
    return rest
  })

  function updatePopoverPosition(): void {
    if (!models.visible.value)
      return

    nextTick(() => {
      if (lifecycleActive && models.visible.value)
        refs.elPopover.value?.popperRef?.popperInstanceRef?.update()
    })
  }

  function focusVirtual(): void {
    resolveVirtualElement(props.virtualRef).focus()
    models.visible.value = true
  }

  function selectRow(index: number): void {
    models.currentRowIndex.value = index
    updatePopoverPosition()
  }

  function emitSelect(row: PopoverTableRow): void {
    models.visible.value = false
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
    if (!models.visible.value)
      return

    const rows = props.data ?? []
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (models.currentRowIndex.value < rows.length - 1)
        selectRow(models.currentRowIndex.value + 1)
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (models.currentRowIndex.value > 0)
        selectRow(models.currentRowIndex.value - 1)
    }
    else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[models.currentRowIndex.value]
      if (row) {
        models.visible.value = false
        nextTick(() => {
          emit('select', row)
          emit('enter', row)
        })
      }
    }
    else if (event.key === 'Escape') {
      event.preventDefault()
      models.visible.value = false
    }
  }

  function handleFocus(): void {
    if (!models.visible.value)
      models.visible.value = true
  }

  function handleClick(): void {
    models.visible.value = true
  }

  function handleOutsideClick(event: MouseEvent): void {
    const target = event.target as Node
    const virtualTarget = resolveVirtualElement(props.virtualRef)
    const clickedInsidePopover = refs.popover.value?.contains(target) ?? false
    const clickedInsideVirtual = virtualTarget.contains(target)

    if (!clickedInsidePopover && !clickedInsideVirtual) {
      models.visible.value = false
      virtualTarget.blur()
    }
  }

  function cleanupOutsideClickListener(): void {
    if (!outsideClickListenerInstalled)
      return

    document.removeEventListener('mousedown', handleOutsideClick)
    outsideClickListenerInstalled = false
  }

  function cleanupEventListeners(): void {
    cleanupOutsideClickListener()

    if (!virtualListenersInstalled)
      return

    virtualElement.removeEventListener('keydown', handleKeydown)
    virtualElement.removeEventListener('focus', handleFocus)
    virtualElement.removeEventListener('click', handleClick)
    virtualListenersInstalled = false
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

  function setupOutsideClickListener(): void {
    if (outsideClickListenerInstalled)
      return

    document.addEventListener('mousedown', handleOutsideClick)
    outsideClickListenerInstalled = true
  }

  function scheduleOutsideClickListener(): void {
    // Let the opening event finish before listening, then re-check lifecycle state.
    nextTick(() => {
      if (lifecycleActive && models.visible.value)
        setupOutsideClickListener()
    })
  }

  function deactivateEventListeners(): void {
    lifecycleActive = false
    cleanupEventListeners()
  }

  function handleTableScroll(event: Event): void {
    if (!props.scrollY?.enabled) {
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
      if (lifecycleActive) {
        setupEventListeners()
        if (models.visible.value)
          setupOutsideClickListener()
      }
    },
  )

  watch(
    () => props.columns,
    updatePopoverPosition,
    { immediate: true },
  )

  watch(
    () => props.data,
    (rows) => {
      if (rows?.length)
        selectRow(0)
    },
    { immediate: true },
  )

  watch(
    () => models.visible.value,
    (visible) => {
      if (visible) {
        updatePopoverPosition()
        scheduleOutsideClickListener()
      }
      else {
        cleanupOutsideClickListener()
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    lifecycleActive = true
    setupEventListeners()
  })

  onActivated(() => {
    lifecycleActive = true
    setupEventListeners()
    if (models.visible.value)
      setupOutsideClickListener()
  })

  onDeactivated(deactivateEventListeners)
  onUnmounted(deactivateEventListeners)

  return {
    computedPopoverProps,
    handleCellClick,
    handleCellDblClick,
    handleTableScroll,
    popoverRefStyle,
    popoverTableProps,
    tableHeight,
    tableWidth,
    tableWrapperStyle,
  }
}
