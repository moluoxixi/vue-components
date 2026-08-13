<script setup lang="ts" generic="TRow extends HeadlessTableRow = HeadlessTableRow">
import type {
  HeadlessTableCellRender,
  HeadlessTableCellComponent,
  HeadlessTableCellScope,
  HeadlessTableColumn,
  HeadlessTableDefaultScope,
  HeadlessTableEmptyScope,
  HeadlessTableHeaderRender,
  HeadlessTableHeaderComponent,
  HeadlessTableHeaderScope,
  HeadlessTableProps,
  HeadlessTableRow,
  HeadlessTableRowKey,
  HeadlessTableSlots,
  HeadlessTableEmptyComponent,
} from './types'
import { computed, defineComponent, inject, markRaw, onBeforeUpdate, shallowRef } from 'vue'
import {
  getHeadlessTableColumnId,
  getHeadlessTableColumnLabel,
  getHeadlessTableRawValue,
} from './utils'
import {
  headlessTableRenderer,
  headlessTableRendererKey,
  resolveHeadlessTableRenderer,
} from './core'
import { useHeadlessTableMode } from './composables'

defineOptions({ name: 'HeadlessTable' })

const props = withDefaults(defineProps<HeadlessTableProps<TRow>>(), {
  columns: () => [],
  data: () => [],
  diagnostics: true,
  emptyText: '暂无数据',
  renderers: () => ({}),
  slots: () => ({}),
})

const slots = defineSlots<HeadlessTableSlots<TRow>>()
const slotsVersion = shallowRef(0)
const warnedDiagnostics = new Set<string>()
const injectedRendererRegistry = inject(headlessTableRendererKey, null)
const modeApi = useHeadlessTableMode({ mode: () => props.mode })

function captureSlots(): Record<string, unknown> {
  return Object.fromEntries(Object.keys(slots).map(name => [name, slots[name]]))
}

let slotSnapshot = captureSlots()

onBeforeUpdate(() => {
  const nextSnapshot = captureSlots()
  const previousKeys = Object.keys(slotSnapshot)
  const nextKeys = Object.keys(nextSnapshot)
  const changed = previousKeys.length !== nextKeys.length
    || nextKeys.some(name => slotSnapshot[name] !== nextSnapshot[name])

  if (changed) {
    slotSnapshot = nextSnapshot
    slotsVersion.value += 1
  }
})

const visibleColumns = computed(() => props.columns.filter(column => column.visible !== false))

function warnOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || !props.diagnostics || warnedDiagnostics.has(key))
    return

  warnedDiagnostics.add(key)
  console.warn(`[HeadlessTable] ${message}`)
}

function getColumnId(column: HeadlessTableColumn<TRow>, columnIndex?: number): string {
  return getHeadlessTableColumnId(column, columnIndex)
}

function getColumnLabel(column: HeadlessTableColumn<TRow>, columnIndex?: number): string {
  return getHeadlessTableColumnLabel(column, columnIndex)
}

function resolveRowId(row: TRow, rowIndex: number): HeadlessTableRowKey | undefined {
  return props.getRowId?.(row, rowIndex)
}

function requireRowId(row: TRow, rowIndex: number): HeadlessTableRowKey | undefined {
  const rowId = resolveRowId(row, rowIndex)
  if (rowId == null) {
    warnOnce(
      'mode-row-id',
      'getRowId is required before row or cell mode actions can be used',
    )
  }
  return rowId
}

function getRawCellValue(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  rowIndex: number,
): any {
  return getHeadlessTableRawValue(row, column, rowIndex)
}

function createHeaderScope(
  column: HeadlessTableColumn<TRow>,
  columnIndex: number,
): HeadlessTableHeaderScope<TRow> {
  return {
    allColumns: props.columns,
    column,
    columnIndex,
    columns: visibleColumns.value,
    data: props.data,
    index: columnIndex,
    mode: modeApi.mode.value,
  }
}

function getCellValue(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  rowIndex: number,
  columnIndex: number,
): any {
  const scope = createCellScope(row, column, rowIndex, columnIndex)
  return column.formatter ? column.formatter(scope) : scope.value
}

function createCellScope(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  rowIndex: number,
  columnIndex: number,
): HeadlessTableCellScope<TRow> {
  const rawValue = getRawCellValue(row, column, rowIndex)
  const rowId = resolveRowId(row, rowIndex)
  const columnId = getColumnId(column, columnIndex)
  const mode = rowId == null
    ? modeApi.mode.value
    : modeApi.getCellMode(rowId, columnId)
  const scope: HeadlessTableCellScope<TRow> = {
    allColumns: props.columns,
    row,
    column,
    rowIndex,
    columnIndex,
    columns: visibleColumns.value,
    data: props.data,
    index: rowIndex,
    mode,
    rawValue,
    rowId,
    clearCellMode: () => {
      const resolvedRowId = requireRowId(row, rowIndex)
      if (resolvedRowId != null)
        modeApi.clearCellMode(resolvedRowId, columnId)
    },
    clearRowMode: () => {
      const resolvedRowId = requireRowId(row, rowIndex)
      if (resolvedRowId != null)
        modeApi.clearRowMode(resolvedRowId)
    },
    setCellMode: (nextMode) => {
      const resolvedRowId = requireRowId(row, rowIndex)
      if (resolvedRowId != null)
        modeApi.setCellMode(resolvedRowId, columnId, nextMode)
    },
    setRowMode: (nextMode) => {
      const resolvedRowId = requireRowId(row, rowIndex)
      if (resolvedRowId != null)
        modeApi.setRowMode(resolvedRowId, nextMode)
    },
    value: rawValue,
  }

  return scope
}

function renderHeader(column: HeadlessTableColumn<TRow>, columnIndex: number): any {
  void slotsVersion.value
  const scope = createHeaderScope(column, columnIndex)
  const configuredSlot = column.slots?.header

  if (typeof configuredSlot === 'function')
    return (configuredSlot as HeadlessTableHeaderRender<TRow>)(scope)

  if (typeof configuredSlot === 'string') {
    const configuredSlotRender = slots[configuredSlot]
    if (configuredSlotRender)
      return configuredSlotRender(scope)

    warnOnce(`header-slot:${configuredSlot}`, `header slot "${configuredSlot}" was not found`)
  }

  if (column.headerRender) {
    const { options, renderer } = resolveHeadlessTableRenderer(
      column.headerRender,
      props.renderers,
      props.rendererRegistry ?? injectedRendererRegistry ?? headlessTableRenderer,
    )
    if (renderer?.renderHeader)
      return renderer.renderHeader(options, scope)

    const reason = renderer ? 'does not implement renderHeader' : 'was not found'
    warnOnce(`header-renderer:${options.name}:${reason}`, `renderer "${options.name}" ${reason}`)
  }

  return getColumnLabel(column, columnIndex)
}

function renderCell(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  rowIndex: number,
  columnIndex: number,
): any {
  void slotsVersion.value
  const scope = createCellScope(row, column, rowIndex, columnIndex)
  const configuredEditSlot = scope.mode === 'edit' ? column.slots?.edit : undefined

  if (typeof configuredEditSlot === 'function')
    return (configuredEditSlot as HeadlessTableCellRender<TRow>)(scope)

  if (typeof configuredEditSlot === 'string') {
    const configuredEditSlotRender = slots[configuredEditSlot]
    if (configuredEditSlotRender)
      return configuredEditSlotRender(scope)

    warnOnce(`edit-cell-slot:${configuredEditSlot}`, `edit cell slot "${configuredEditSlot}" was not found`)
  }

  const configuredSlot = column.slots?.default

  if (typeof configuredSlot === 'function')
    return (configuredSlot as HeadlessTableCellRender<TRow>)(scope)

  if (typeof configuredSlot === 'string') {
    const configuredSlotRender = slots[configuredSlot]
    if (configuredSlotRender)
      return configuredSlotRender(scope)

    warnOnce(`cell-slot:${configuredSlot}`, `cell slot "${configuredSlot}" was not found`)
  }

  if (column.cellRender) {
    const { options, renderer } = resolveHeadlessTableRenderer(
      column.cellRender,
      props.renderers,
      props.rendererRegistry ?? injectedRendererRegistry ?? headlessTableRenderer,
    )
    if (renderer?.renderDefault)
      return renderer.renderDefault(options, scope)

    const reason = renderer ? 'does not implement renderDefault' : 'was not found'
    warnOnce(`cell-renderer:${options.name}:${reason}`, `renderer "${options.name}" ${reason}`)
  }

  return column.formatter ? column.formatter(scope) : scope.value
}

const Header = markRaw(defineComponent({
  name: 'HeadlessTableHeader',
  props: {
    column: { type: Object, required: true },
    columnIndex: { type: Number, required: true },
  },
  setup(componentProps) {
    return () => renderHeader(
      componentProps.column as HeadlessTableColumn<TRow>,
      componentProps.columnIndex,
    )
  },
}))

const Cell = markRaw(defineComponent({
  name: 'HeadlessTableCell',
  props: {
    row: { type: Object, required: true },
    column: { type: Object, required: true },
    rowIndex: { type: Number, required: true },
    columnIndex: { type: Number, required: true },
  },
  setup(componentProps) {
    return () => renderCell(
      componentProps.row as TRow,
      componentProps.column as HeadlessTableColumn<TRow>,
      componentProps.rowIndex,
      componentProps.columnIndex,
    )
  },
}))

const Empty = markRaw(defineComponent({
  name: 'HeadlessTableEmpty',
  setup() {
    return () => {
      void slotsVersion.value
      const scope: HeadlessTableEmptyScope<TRow> = {
        allColumns: props.columns,
        columns: visibleColumns.value,
        data: props.data,
        mode: modeApi.mode.value,
      }

      if (props.slots.empty)
        return props.slots.empty(scope)

      return slots.empty?.(scope) ?? props.emptyText
    }
  },
})) as HeadlessTableEmptyComponent

const TypedHeader = Header as HeadlessTableHeaderComponent<TRow>
const TypedCell = Cell as HeadlessTableCellComponent<TRow>

const tableScope = computed<HeadlessTableDefaultScope<TRow>>(() => ({
  allColumns: props.columns,
  Cell: TypedCell,
  columns: visibleColumns.value,
  data: props.data,
  Empty,
  getCellValue,
  getColumnId,
  getColumnLabel,
  getRawCellValue,
  Header: TypedHeader,
  mode: modeApi.mode.value,
  clearCellMode: modeApi.clearCellMode,
  clearMode: modeApi.clearMode,
  clearRowMode: modeApi.clearRowMode,
  getCellMode: modeApi.getCellMode,
  getRowMode: modeApi.getRowMode,
  setCellMode: modeApi.setCellMode,
  setMode: modeApi.setMode,
  setRowMode: modeApi.setRowMode,
}))

defineExpose({
  columns: visibleColumns,
  getCellValue,
  getColumnId,
  getColumnLabel,
  getRawCellValue,
  ...modeApi,
})
</script>

<template>
  <slot v-bind="tableScope" />
</template>
