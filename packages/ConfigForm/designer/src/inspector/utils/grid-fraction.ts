import type { InspectorGridFraction } from '../types'

export function resolveInspectorGridFraction(span: number, columns: number): InspectorGridFraction {
  const normalizedColumns = positiveInteger(columns)
  const normalizedSpan = Math.min(normalizedColumns, positiveInteger(span))
  const divisor = greatestCommonDivisor(normalizedSpan, normalizedColumns)
  const fraction = normalizedSpan === normalizedColumns
    ? '100%'
    : `${normalizedSpan / divisor}/${normalizedColumns / divisor}`
  return {
    columns: normalizedColumns,
    fraction,
    label: `${normalizedSpan} / ${normalizedColumns} · ${fraction}`,
    span: normalizedSpan,
  }
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1
}

function greatestCommonDivisor(left: number, right: number): number {
  let first = left
  let second = right
  while (second !== 0)
    [first, second] = [second, first % second]
  return first
}
