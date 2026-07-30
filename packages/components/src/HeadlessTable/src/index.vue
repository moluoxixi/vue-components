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
  HeadlessTableRendererConfig,
  HeadlessTableRendererDefinition,
  HeadlessTableRendererOptions,
  HeadlessTableRow,
  HeadlessTableSlots,
  HeadlessTableEmptyComponent,
} from './types'
import { computed, defineComponent, markRaw, onUpdated, shallowRef } from 'vue'
import { headlessTableRenderer } from './renderer'

defineOptions({ name: 'HeadlessTable' })

const props = withDefaults(defineProps<HeadlessTableProps<TRow>>(), {
  columns: () => [],
  data: () => [],
  emptyText: '暂无数据',
  renderers: () => ({}),
  slots: () => ({}),
})

const slots = defineSlots<HeadlessTableSlots<TRow>>()
const slotsVersion = shallowRef(0)

onUpdated(() => {
  slotsVersion.value += 1
})

const visibleColumns = computed(() => props.columns.filter(column => column.visible !== false))

function getColumnLabel(column: HeadlessTableColumn<TRow>): string {
  return column.label ?? column.title ?? column.field
}

function getFieldValue(row: TRow, field: string): any {
  if (Object.prototype.hasOwnProperty.call(row, field))
    return row[field]

  return field.split('.').reduce<any>((value, key) => value?.[key], row)
}

function createHeaderScope(
  column: HeadlessTableColumn<TRow>,
  columnIndex: number,
): HeadlessTableHeaderScope<TRow> {
  return {
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
  const scope = createCellScope(row, column, rowIndex, columnIndex, false)
  return column.formatter ? column.formatter(scope) : scope.value
}

function createCellScope(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  rowIndex: number,
  columnIndex: number,
  formatted = true,
): HeadlessTableCellScope<TRow> {
  const scope: HeadlessTableCellScope<TRow> = {
    row,
    column,
    rowIndex,
    columnIndex,
    columns: visibleColumns.value,
    data: props.data,
    index: rowIndex,
    value: getFieldValue(row, column.field),
  }

  if (formatted && column.formatter)
    scope.value = column.formatter(scope)

  return scope
}

function normalizeRenderOptions(config: HeadlessTableRendererConfig): HeadlessTableRendererOptions {
  return typeof config === 'string' ? { name: config } : config
}

function resolveRenderer(config: HeadlessTableRendererConfig): {
  options: HeadlessTableRendererOptions
  renderer?: HeadlessTableRendererDefinition<TRow>
} {
  const options = normalizeRenderOptions(config)
  const localRenderer = Object.prototype.hasOwnProperty.call(props.renderers, options.name)
    ? props.renderers[options.name]
    : undefined
  return {
    options,
    renderer: localRenderer
      ?? headlessTableRenderer.get(options.name) as HeadlessTableRendererDefinition<TRow> | undefined,
  }
}

function renderHeader(column: HeadlessTableColumn<TRow>, columnIndex: number): any {
  void slotsVersion.value
  const scope = createHeaderScope(column, columnIndex)
  const configuredSlot = column.slots?.header

  if (typeof configuredSlot === 'function')
    return (configuredSlot as HeadlessTableHeaderRender<TRow>)(scope)

  if (typeof configuredSlot === 'string' && slots[configuredSlot])
    return slots[configuredSlot]?.(scope)

  if (column.headerRender) {
    const { options, renderer } = resolveRenderer(column.headerRender)
    if (renderer?.renderHeader)
      return renderer.renderHeader(options, scope)
  }

  return getColumnLabel(column)
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

  if (typeof configuredSlot === 'string' && slots[configuredSlot])
    return slots[configuredSlot]?.(scope)

  if (column.cellRender) {
    const { options, renderer } = resolveRenderer(column.cellRender)
    if (renderer?.renderDefault)
      return renderer.renderDefault(options, scope)
  }

  return scope.value
}

function getColumnIndex(column: HeadlessTableColumn<TRow>, index?: number): number {
  return index ?? visibleColumns.value.indexOf(column)
}

const Header = markRaw(defineComponent({
  name: 'HeadlessTableHeader',
  props: {
    column: { type: Object, required: true },
    columnIndex: { type: Number, default: undefined },
  },
  setup(componentProps) {
    return () => renderHeader(
      componentProps.column as HeadlessTableColumn<TRow>,
      getColumnIndex(componentProps.column as HeadlessTableColumn<TRow>, componentProps.columnIndex),
    )
  },
}))

const Cell = markRaw(defineComponent({
  name: 'HeadlessTableCell',
  props: {
    row: { type: Object, required: true },
    column: { type: Object, required: true },
    rowIndex: { type: Number, required: true },
    columnIndex: { type: Number, default: undefined },
  },
  setup(componentProps) {
    return () => renderCell(
      componentProps.row as TRow,
      componentProps.column as HeadlessTableColumn<TRow>,
      componentProps.rowIndex,
      getColumnIndex(componentProps.column as HeadlessTableColumn<TRow>, componentProps.columnIndex),
    )
  },
}))

const Empty = markRaw(defineComponent({
  name: 'HeadlessTableEmpty',
  setup() {
    return () => {
      void slotsVersion.value
      const scope: HeadlessTableEmptyScope<TRow> = {
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
  getColumnLabel,
  Header: TypedHeader,
}))

defineExpose({
  columns: visibleColumns,
  getCellValue,
  getColumnLabel,
})
</script>

<template>
  <slot v-bind="tableScope" />
</template>
