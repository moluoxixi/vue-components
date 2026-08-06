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
  HeadlessTableSlots,
  HeadlessTableEmptyComponent,
} from './types'
import { computed, defineComponent, inject, markRaw, onBeforeUpdate, shallowRef } from 'vue'
import {
  getHeadlessTableColumnId,
  getHeadlessTableColumnLabel,
  getHeadlessTableRawValue,
} from './core'
import {
  headlessTableRenderer,
  headlessTableRendererKey,
  resolveHeadlessTableRenderer,
} from './renderer'

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
  const scope: HeadlessTableCellScope<TRow> = {
    allColumns: props.columns,
    row,
    column,
    rowIndex,
    columnIndex,
    columns: visibleColumns.value,
    data: props.data,
    index: rowIndex,
    rawValue,
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
}))

defineExpose({
  columns: visibleColumns,
  getCellValue,
  getColumnId,
  getColumnLabel,
  getRawCellValue,
})
</script>

<template>
  <slot v-bind="tableScope" />
</template>
