import type { HeadlessTableMode, HeadlessTableModeApi, HeadlessTableRowKey } from '../types'
import { computed, shallowRef, triggerRef } from 'vue'

export interface UseHeadlessTableModeOptions {
  mode?: () => HeadlessTableMode | undefined
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
    globalOverride.value = value
  }

  function clearMode(): void {
    globalOverride.value = undefined
  }

  function setRowMode(rowId: HeadlessTableRowKey, value: HeadlessTableMode): void {
    rowOverrides.value.set(rowId, value)
    triggerRef(rowOverrides)
  }

  function clearRowMode(rowId: HeadlessTableRowKey): void {
    if (rowOverrides.value.delete(rowId))
      triggerRef(rowOverrides)
  }

  function setCellMode(
    rowId: HeadlessTableRowKey,
    columnId: string,
    value: HeadlessTableMode,
  ): void {
    let rowCells = cellOverrides.value.get(rowId)
    if (!rowCells) {
      rowCells = new Map()
      cellOverrides.value.set(rowId, rowCells)
    }
    rowCells.set(columnId, value)
    triggerRef(cellOverrides)
  }

  function clearCellMode(rowId: HeadlessTableRowKey, columnId: string): void {
    const rowCells = cellOverrides.value.get(rowId)
    if (!rowCells?.delete(columnId))
      return

    if (rowCells.size === 0)
      cellOverrides.value.delete(rowId)
    triggerRef(cellOverrides)
  }

  function getRowMode(rowId: HeadlessTableRowKey): HeadlessTableMode {
    return rowOverrides.value.get(rowId) ?? mode.value
  }

  function getCellMode(rowId: HeadlessTableRowKey, columnId: string): HeadlessTableMode {
    return cellOverrides.value.get(rowId)?.get(columnId) ?? getRowMode(rowId)
  }

  return {
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
