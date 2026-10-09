import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import type { DatasetCellKind, DatasetTableColumn } from '../types'

export function datasetCellKind(value: ModelJsonValue | undefined): DatasetCellKind {
  if (value === undefined)
    return 'missing'
  if (value === null)
    return 'null'
  if (Array.isArray(value))
    return 'array'
  if (typeof value === 'object')
    return 'object'
  return typeof value === 'string' ? 'text' : typeof value === 'number' ? 'number' : 'boolean'
}

export function formatDatasetCell(value: ModelJsonValue | undefined, pretty = false): string {
  if (value === undefined)
    return ''
  return typeof value === 'object' ? JSON.stringify(value, null, pretty ? 2 : undefined) : String(value)
}

/** Text stays text, including identifiers with leading zeroes. */
export function parseDatasetCell(input: string, previous: ModelJsonValue | undefined): ModelJsonValue {
  if (typeof previous === 'number') {
    if (!input.trim() || !Number.isFinite(Number(input)))
      throw new TypeError('Enter a finite number')
    return Number(input)
  }
  if (typeof previous === 'boolean' || typeof previous === 'object') {
    const parsed: ModelJsonValue = JSON.parse(input)
    if (typeof previous === 'boolean' && typeof parsed !== 'boolean')
      throw new TypeError('Expected true or false')
    return parsed
  }
  return input
}

/** Inspect a bounded sample so opening large datasets does not size every cell. */
export function describeDatasetColumns(rows: readonly ModelJsonObject[]): DatasetTableColumn[] {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
  const sample = rows.slice(0, 100)
  return keys.map((key) => {
    const values = sample.map(row => row[key])
    const kinds = [...new Set(values.map(datasetCellKind).filter(kind => kind !== 'null' && kind !== 'missing'))]
    const kind = kinds.length > 1 ? 'mixed' : kinds[0] ?? (values.includes(null) ? 'null' : 'missing')
    const length = Math.max(key.length, ...values.map(value => [...formatDatasetCell(value).slice(0, 100)]
      .reduce((width, char) => width + (char.codePointAt(0)! > 127 ? 2 : 1), 0)))
    const minimum = kind === 'number' || kind === 'boolean' ? 132 : 160
    return { key, kind, width: Math.min(320, Math.max(minimum, length * 7 + 48)) }
  })
}

/** Null and missing values remain at the end in either direction. */
export function compareDatasetCells(
  left: ModelJsonValue | undefined,
  right: ModelJsonValue | undefined,
  direction: 'ascending' | 'descending',
  locale: string,
): number {
  if (left == null || right == null)
    return left == null ? (right == null ? 0 : 1) : -1
  const comparison = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : formatDatasetCell(left).localeCompare(formatDatasetCell(right), locale)
  return direction === 'ascending' ? comparison : -comparison
}
