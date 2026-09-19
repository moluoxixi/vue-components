import type { ContractResult, ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  SourceBinaryFile,
  SourceFile,
  SourceFileSetV1,
  SourceLanguage,
  SourceTextFile,
} from '../types'

const LANGUAGES = new Set<SourceLanguage>(['vue', 'typescript', 'json', 'css', 'scss', 'text'])
const FILE_SET_KEYS = ['entry', 'files', 'kind', 'version']
const TEXT_FILE_KEYS = ['content', 'kind', 'language', 'path']
const BINARY_FILE_KEYS = ['contentBase64', 'encoding', 'kind', 'mediaType', 'path']

function diagnostic(code: string, message: string, path?: Array<string | number>): ModelDiagnostic {
  return { code, message, ...(path ? { path } : {}) }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(input).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

export function isSafeSourcePath(path: string): boolean {
  if (
    path.length === 0
    || path.includes('\0')
    || path.includes('\\')
    || path.startsWith('/')
    || /^[A-Za-z]:/.test(path)
  ) {
    return false
  }
  const segments = path.split('/')
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..')
}

function isCanonicalBase64(value: string): boolean {
  return value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}

function readTextFile(input: Record<string, unknown>): SourceTextFile | undefined {
  if (
    !hasExactKeys(input, TEXT_FILE_KEYS)
    || input.kind !== 'text'
    || typeof input.path !== 'string'
    || !isSafeSourcePath(input.path)
    || typeof input.language !== 'string'
    || !LANGUAGES.has(input.language as SourceLanguage)
    || typeof input.content !== 'string'
  ) {
    return undefined
  }
  return input as unknown as SourceTextFile
}

function readBinaryFile(input: Record<string, unknown>): SourceBinaryFile | undefined {
  if (
    !hasExactKeys(input, BINARY_FILE_KEYS)
    || input.kind !== 'binary'
    || typeof input.path !== 'string'
    || !isSafeSourcePath(input.path)
    || typeof input.mediaType !== 'string'
    || input.mediaType.length === 0
    || input.encoding !== 'base64'
    || typeof input.contentBase64 !== 'string'
    || !isCanonicalBase64(input.contentBase64)
  ) {
    return undefined
  }
  return input as unknown as SourceBinaryFile
}

function invalid(message: string, path?: Array<string | number>): ContractResult<SourceFileSetV1> {
  return { success: false, diagnostics: [diagnostic('source_file_set_invalid', message, path)] }
}

export function readSourceFileSet(input: unknown): ContractResult<SourceFileSetV1> {
  if (!isRecord(input))
    return invalid('SourceFileSet must be an object.')
  if (input.version !== 1) {
    return {
      success: false,
      diagnostics: [diagnostic(
        'source_file_set_unsupported_version',
        'SourceFileSet version must be exactly 1.',
        ['version'],
      )],
    }
  }
  if (!hasExactKeys(input, FILE_SET_KEYS))
    return invalid('SourceFileSet contains missing or unsupported fields.')
  if (input.kind !== 'raw-source' && input.kind !== 'config-bindings')
    return invalid('SourceFileSet kind is invalid.', ['kind'])
  if (typeof input.entry !== 'string' || !isSafeSourcePath(input.entry))
    return invalid('SourceFileSet entry must be a safe project-relative path.', ['entry'])
  if (!Array.isArray(input.files))
    return invalid('SourceFileSet files must be an array.', ['files'])

  const files: SourceFile[] = []
  const paths = new Set<string>()
  let previousPath: string | undefined
  for (let index = 0; index < input.files.length; index += 1) {
    const candidate = input.files[index]
    if (!isRecord(candidate))
      return invalid('Source file must be an object.', ['files', index])
    const file = candidate.kind === 'text'
      ? readTextFile(candidate)
      : candidate.kind === 'binary' ? readBinaryFile(candidate) : undefined
    if (!file)
      return invalid('Source file does not match its discriminated variant.', ['files', index])
    if (paths.has(file.path))
      return invalid('Source file paths must be unique.', ['files', index, 'path'])
    if (previousPath !== undefined && previousPath.localeCompare(file.path) >= 0)
      return invalid('Source files must be sorted by path.', ['files', index, 'path'])
    paths.add(file.path)
    previousPath = file.path
    files.push(file)
  }

  const entry = files.find(file => file.path === input.entry)
  if (!entry || entry.kind !== 'text')
    return invalid('SourceFileSet entry must reference an existing text file.', ['entry'])

  return {
    success: true,
    data: {
      version: 1,
      kind: input.kind,
      entry: input.entry,
      files,
    } as SourceFileSetV1,
    diagnostics: [],
  }
}
