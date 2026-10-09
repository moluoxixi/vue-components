import type { DeepReadonly, ModelJsonObject } from '@moluoxixi/config-form-model'
import { createDatasetFromRows } from '@moluoxixi/config-form-model'

/** Explicit ingestion, separate from strict versioned dataset transfer readers. */
export function parseDatasetIngest(text: string, format: 'csv' | 'json'): ModelJsonObject[] {
  const rows = format === 'json' ? JSON.parse(text) : parseCsv(text)
  const parsed = createDatasetFromRows({ id: 'ingest-preview', name: 'Ingest preview', rows })
  if (!parsed.success)
    throw new TypeError(parsed.diagnostics[0]?.message ?? 'Invalid dataset rows')
  return parsed.data.rows
}

function parseCsv(text: string): ModelJsonObject[] {
  const records: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  let closed = false
  const source = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          value += '"'
          index++
        }
        else {
          quoted = false
          closed = true
        }
      }
      else {
        value += char
      }
      continue
    }
    if (char === '"') {
      if (value || closed)
        throw new TypeError(`Invalid quote at character ${index + 1}`)
      quoted = true
    }
    else if (char === ',' || char === '\n' || char === '\r') {
      row.push(value)
      value = ''
      closed = false
      if (char !== ',') {
        if (char === '\r' && source[index + 1] === '\n')
          index++
        records.push(row)
        row = []
      }
    }
    else {
      if (closed)
        throw new TypeError(`Unexpected text after a quoted cell at character ${index + 1}`)
      value += char
    }
  }
  if (quoted)
    throw new TypeError('Unterminated quoted CSV cell')
  if (value || row.length || closed) {
    row.push(value)
    records.push(row)
  }
  const headers = records.shift()?.map(header => header.trim()) ?? []
  if (
    !headers.length
    || headers.some(header => !header || ['__proto__', 'prototype', 'constructor'].includes(header))
    || new Set(headers).size !== headers.length
  ) {
    throw new TypeError('CSV headers must be non-empty, unique, safe names')
  }
  return records
    .filter(record => record.length !== 1 || record[0] !== '')
    .map((record, index) => {
      if (record.length !== headers.length)
        throw new TypeError(`CSV row ${index + 2} has ${record.length} cells; expected ${headers.length}`)
      // CSV cells remain text, preserving identifiers and leading zeroes.
      return Object.fromEntries(headers.map((header, index) => [header, record[index]!]))
    })
}

export function collectDatasetPaths(rows: readonly DeepReadonly<ModelJsonObject>[]): string[][] {
  const paths = new Map<string, string[]>()
  function visit(value: unknown, prefix: string[], depth: number): void {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 8)
      return
    for (const [key, item] of Object.entries(value)) {
      const path = [...prefix, key]
      paths.set(JSON.stringify(path), path)
      visit(item, path, depth + 1)
    }
  }
  rows.slice(0, 100).forEach(row => visit(row, [], 0))
  return [...paths.values()]
}
