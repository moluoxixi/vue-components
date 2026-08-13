import type {
  HeadlessTableMode,
  HeadlessTableModeApi,
  HeadlessTableModeChange,
  HeadlessTableRowKey,
} from '../types'
import { computed, shallowRef, triggerRef } from 'vue'

export interface UseHeadlessTableModeOptions {
  mode?: () => HeadlessTableMode | undefined
  onModeChange?: (change: HeadlessTableModeChange) => void
}

/** Creates ephemeral table, row, and cell rendering-mode overrides. */
export function useHeadlessTableMode(
  options: UseHeadlessTableModeOptions = {},
): HeadlessTableModeApi {
  const globalOverride = shallowRef<HeadlessTableMode>()
  const rowOverrides = shallowRef(new Map<HeadlessTableRowKey, HeadlessTableMode>())
  const cellOverrides = shallowRef(new Map<HeadlessTableRowKey, Map<string, HeadlessTableMode>>())
  const mode = computed<HeadlessTableMode>(() => globalOverride.value ?? options.mode?.() ?? 'default')

  function setMode(value: HeadlessTableMode): void {
    if (globalOverride.value === value)
      return
    const previousMode = mode.value
    globalOverride.value = value
    options.onModeChange?.({ scope: 'table', action: 'set', mode: mode.value, previousMode })
  }

  function clearMode(): void {
    if (globalOverride.value === undefined)
      return
    const previousMode = mode.value
    globalOverride.value = undefined
    options.onModeChange?.({ scope: 'table', action: 'clear', mode: mode.value, previousMode })
  }

  function setRowMode(rowId: HeadlessTableRowKey, value: HeadlessTableMode): void {
    if (rowOverrides.value.get(rowId) === value)
      return
    const previousMode = getRowMode(rowId)
    rowOverrides.value.set(rowId, value)
    triggerRef(rowOverrides)
    options.onModeChange?.({
      scope: 'row',
      action: 'set',
      rowId,
      mode: getRowMode(rowId),
      previousMode,
    })
  }

  function clearRowMode(rowId: HeadlessTableRowKey): void {
    if (!rowOverrides.value.has(rowId))
      return
    const previousMode = getRowMode(rowId)
    rowOverrides.value.delete(rowId)
    triggerRef(rowOverrides)
    options.onModeChange?.({
      scope: 'row',
      action: 'clear',
      rowId,
      mode: getRowMode(rowId),
      previousMode,
    })
  }

  function setCellMode(
    rowId: HeadlessTableRowKey,
    columnId: string,
    value: HeadlessTableMode,
  ): void {
    let rowCells = cellOverrides.value.get(rowId)
    if (rowCells?.get(columnId) === value)
      return
    const previousMode = getCellMode(rowId, columnId)
    if (!rowCells) {
      rowCells = new Map()
      cellOverrides.value.set(rowId, rowCells)
    }
    rowCells.set(columnId, value)
    triggerRef(cellOverrides)
    options.onModeChange?.({
      scope: 'cell',
      action: 'set',
      rowId,
      columnId,
      mode: getCellMode(rowId, columnId),
      previousMode,
    })
  }

  function clearCellMode(rowId: HeadlessTableRowKey, columnId: string): void {
    const rowCells = cellOverrides.value.get(rowId)
    if (!rowCells?.has(columnId))
      return
    const previousMode = getCellMode(rowId, columnId)
    rowCells.delete(columnId)

    if (rowCells.size === 0)
      cellOverrides.value.delete(rowId)
    triggerRef(cellOverrides)
    options.onModeChange?.({
      scope: 'cell',
      action: 'clear',
      rowId,
      columnId,
      mode: getCellMode(rowId, columnId),
      previousMode,
    })
  }

  function clearAllRowModes(): void {
    const cleared = rowOverrides.value.size
    if (cleared === 0)
      return
    rowOverrides.value.clear()
    triggerRef(rowOverrides)
    options.onModeChange?.({ scope: 'row', action: 'clearAll', cleared, mode: mode.value })
  }

  function clearAllCellModes(): void {
    const cleared = Array.from(cellOverrides.value.values())
      .reduce((count, cells) => count + cells.size, 0)
    if (cleared === 0)
      return
    cellOverrides.value.clear()
    triggerRef(cellOverrides)
    options.onModeChange?.({ scope: 'cell', action: 'clearAll', cleared, mode: mode.value })
  }

  function clearAllModes(): void {
    const cleared = (globalOverride.value === undefined ? 0 : 1)
      + rowOverrides.value.size
      + Array.from(cellOverrides.value.values()).reduce((count, cells) => count + cells.size, 0)
    if (cleared === 0)
      return
    globalOverride.value = undefined
    rowOverrides.value.clear()
    cellOverrides.value.clear()
    triggerRef(rowOverrides)
    triggerRef(cellOverrides)
    options.onModeChange?.({ scope: 'all', action: 'clearAll', cleared, mode: mode.value })
  }

  function getRowMode(rowId: HeadlessTableRowKey): HeadlessTableMode {
    return rowOverrides.value.get(rowId) ?? mode.value
  }

  function getCellMode(rowId: HeadlessTableRowKey, columnId: string): HeadlessTableMode {
    return cellOverrides.value.get(rowId)?.get(columnId) ?? getRowMode(rowId)
  }

  return {
    clearAllCellModes,
    clearAllModes,
    clearAllRowModes,
    clearCellMode,
    clearMode,
    clearRowMode,
    getCellMode,
    getRowMode,
    mode,
    setCellMode,
    setMode,
    setRowMode,
  }
}
