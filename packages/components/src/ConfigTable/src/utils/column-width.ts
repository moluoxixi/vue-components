import type { ConfigTableColumn, ConfigTableColumnWidthState } from '../types'

export interface ConfigTableColumnWidthOptions {
  defaultColumnWidth: number
  minColumnWidth?: number
  maxColumnWidth?: number
}

export function parseConfigTableColumnWidth(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? value : undefined

  if (typeof value !== 'string')
    return undefined

  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i)
  if (!match)
    return undefined

  const width = Number(match[1])
  return Number.isFinite(width) && width > 0 ? width : undefined
}

export function getConfigTableColumnId(column: ConfigTableColumn, columnIndex = 0): string {
  return column.id ?? column.field ?? `column-${columnIndex}`
}

function clampColumnWidth(width: number, options: ConfigTableColumnWidthOptions): number {
  const min = parseConfigTableColumnWidth(options.minColumnWidth)
  const max = parseConfigTableColumnWidth(options.maxColumnWidth)
  const lowerBound = min == null ? width : Math.max(width, min)
  return max == null ? lowerBound : Math.min(lowerBound, Math.max(max, min ?? 0))
}

export function getConfigTableColumnMinWidth(column: ConfigTableColumn): number | undefined {
  return parseConfigTableColumnWidth(column.minWidth ?? column.columnProps?.minWidth)
}

export function getConfigTableColumnWidth(
  column: ConfigTableColumn,
  columnIndex: number,
  columnWidths: ConfigTableColumnWidthState = {},
  options: ConfigTableColumnWidthOptions,
): number {
  const columnId = getConfigTableColumnId(column, columnIndex)
  const candidates: unknown[] = [
    columnWidths[columnId],
    column.width,
    column.columnProps?.width,
    column.minWidth,
    column.columnProps?.minWidth,
    options.defaultColumnWidth,
  ]

  for (const candidate of candidates) {
    const width = parseConfigTableColumnWidth(candidate)
    if (width != null)
      return clampColumnWidth(width, options)
  }

  return clampColumnWidth(160, options)
}
