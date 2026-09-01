import type { ConfigImportDiagnostic } from './types'

export const MAX_IMPORT_SOURCE_BYTES = 2 * 1024 * 1024
export const MAX_IMPORT_DEPTH = 64
export const MAX_IMPORT_ARRAY_LENGTH = 4096
export const MAX_IMPORT_STRUCTURE_ENTRIES = 100000
export const MAX_IMPORT_PAGES = 128
export const MAX_IMPORT_NODES = 4096

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function diagnostic(
  code: ConfigImportDiagnostic['code'],
  message: string,
  path = '$',
): ConfigImportDiagnostic {
  return { code, message, path }
}

export function appendConfigImportPath(parent: string, key: string | number): string {
  if (typeof key === 'number')
    return `${parent}[${key}]`
  return /^[a-z_$][\w$]*$/i.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`
}

export function importSourceByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength
}

export function parseConfigImportSource(source: string):
  | { success: true, value: unknown }
  | { success: false, diagnostics: ConfigImportDiagnostic[] } {
  const bytes = importSourceByteLength(source)
  if (bytes > MAX_IMPORT_SOURCE_BYTES) {
    return {
      success: false,
      diagnostics: [diagnostic(
        'IMPORT_SOURCE_TOO_LARGE',
        `JSON source is ${bytes} bytes; the limit is ${MAX_IMPORT_SOURCE_BYTES} bytes.`,
      )],
    }
  }
  try {
    return { success: true, value: JSON.parse(source) as unknown }
  }
  catch {
    return {
      success: false,
      diagnostics: [diagnostic('IMPORT_JSON_INVALID', 'The source is not valid JSON.')],
    }
  }
}

export function guardConfigImportValue(value: unknown): ConfigImportDiagnostic[] {
  const stack: Array<{ depth: number, path: string, value: unknown }> = [{ depth: 0, path: '$', value }]
  let entries = 0

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.depth > MAX_IMPORT_DEPTH) {
      return [diagnostic(
        'IMPORT_DEPTH_LIMIT_EXCEEDED',
        `JSON structure exceeds the maximum depth of ${MAX_IMPORT_DEPTH}.`,
        current.path,
      )]
    }
    if (
      current.value === null
      || typeof current.value === 'string'
      || typeof current.value === 'boolean'
    ) {
      continue
    }
    if (typeof current.value === 'number') {
      if (!Number.isFinite(current.value))
        return [diagnostic('IMPORT_VALUE_UNSAFE', 'JSON numbers must be finite.', current.path)]
      continue
    }
    if (typeof current.value !== 'object')
      return [diagnostic('IMPORT_VALUE_UNSAFE', 'The payload contains a non-JSON value.', current.path)]

    if (Array.isArray(current.value)) {
      if (current.value.length > MAX_IMPORT_ARRAY_LENGTH) {
        return [diagnostic(
          'IMPORT_ARRAY_LIMIT_EXCEEDED',
          `Array contains ${current.value.length} items; the limit is ${MAX_IMPORT_ARRAY_LENGTH}.`,
          current.path,
        )]
      }
      entries += current.value.length
      if (entries > MAX_IMPORT_STRUCTURE_ENTRIES) {
        return [diagnostic(
          'IMPORT_STRUCTURE_LIMIT_EXCEEDED',
          `JSON structure exceeds the ${MAX_IMPORT_STRUCTURE_ENTRIES}-entry limit.`,
          current.path,
        )]
      }
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          depth: current.depth + 1,
          path: appendConfigImportPath(current.path, index),
          value: current.value[index],
        })
      }
      continue
    }

    const keys = Object.keys(current.value)
    entries += keys.length
    if (entries > MAX_IMPORT_STRUCTURE_ENTRIES) {
      return [diagnostic(
        'IMPORT_STRUCTURE_LIMIT_EXCEEDED',
        `JSON structure exceeds the ${MAX_IMPORT_STRUCTURE_ENTRIES}-entry limit.`,
        current.path,
      )]
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!
      const path = appendConfigImportPath(current.path, key)
      if (UNSAFE_KEYS.has(key))
        return [diagnostic('IMPORT_UNSAFE_KEY', `Unsafe object key is not allowed: ${key}.`, path)]
      stack.push({
        depth: current.depth + 1,
        path,
        value: (current.value as Record<string, unknown>)[key],
      })
    }
  }

  return []
}
