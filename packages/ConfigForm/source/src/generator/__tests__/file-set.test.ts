import { describe, expect, it } from 'vitest'
import { readSourceFileSet } from '..'

const validFileSet = {
  kind: 'raw-source',
  version: 1,
  entry: 'src/main.ts',
  files: [
    { kind: 'text', path: 'src/main.ts', language: 'typescript', content: 'export {}\n' },
    { kind: 'binary', path: 'src/assets/logo.png', mediaType: 'image/png', encoding: 'base64', contentBase64: 'aGVsbG8=' },
  ].sort((left, right) => left.path.localeCompare(right.path)),
} as const

describe('readSourceFileSet', () => {
  it('accepts the exact current discriminated file set', () => {
    expect(readSourceFileSet(validFileSet)).toEqual({
      success: true,
      data: validFileSet,
      diagnostics: [],
    })
  })

  it.each([0, 2, undefined, '1'])('rejects unsupported version %j', (version) => {
    const input = { ...validFileSet, version }
    const result = readSourceFileSet(input)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.diagnostics[0]?.code).toBe('source_file_set_unsupported_version')
  })

  it.each([
    ['duplicate path', { ...validFileSet, files: [validFileSet.files[0], validFileSet.files[0]] }],
    ['absolute path', { ...validFileSet, entry: '/src/main.ts', files: [{ ...validFileSet.files[1], path: '/src/main.ts' }] }],
    ['drive path', { ...validFileSet, entry: 'C:/src/main.ts', files: [{ ...validFileSet.files[1], path: 'C:/src/main.ts' }] }],
    ['parent segment', { ...validFileSet, entry: '../main.ts', files: [{ ...validFileSet.files[1], path: '../main.ts' }] }],
    ['NUL path', { ...validFileSet, entry: 'src/\0main.ts', files: [{ ...validFileSet.files[1], path: 'src/\0main.ts' }] }],
    ['unsorted files', { ...validFileSet, files: [...validFileSet.files].reverse() }],
    ['missing entry', { ...validFileSet, entry: 'src/missing.ts' }],
    ['binary entry', { ...validFileSet, entry: validFileSet.files[0].path, files: [...validFileSet.files].reverse() }],
    ['text with binary field', { ...validFileSet, files: [{ ...validFileSet.files[1], contentBase64: 'aGVsbG8=' }] }],
    ['binary with text field', { ...validFileSet, files: [{ ...validFileSet.files[0], content: 'x' }] }],
  ])('rejects %s', (_name, input) => {
    const result = readSourceFileSet(input)
    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.diagnostics[0]?.code).toBe('source_file_set_invalid')
  })
})
