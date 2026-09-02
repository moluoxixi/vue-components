import type { ProjectPath } from '../types'
import { WorkbenchProjectError } from '../errors'

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const DRIVE_PREFIX = /^[a-z]:/i

function invalidPath(path: string, reason: string): never {
  throw new WorkbenchProjectError(
    'PROJECT_PATH_INVALID',
    `[config-form-workbench] invalid project path "${path}": ${reason}`,
  )
}

export function normalizeProjectPath(input: string): ProjectPath {
  if (typeof input !== 'string' || input.length === 0)
    invalidPath(String(input), 'path must be a non-empty string')
  if (input.includes('\0'))
    invalidPath(input, 'NUL is not allowed')
  if (input.includes('\\'))
    invalidPath(input, 'backslashes are not allowed')
  if (input.startsWith('/') || input.startsWith('//') || DRIVE_PREFIX.test(input))
    invalidPath(input, 'absolute paths are not allowed')
  if (input.endsWith('/'))
    invalidPath(input, 'file paths cannot end with a slash')

  const segments = input.split('/')
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..')
      invalidPath(input, 'empty and relative segments are not allowed')
    if (segment.endsWith('.') || segment.endsWith(' '))
      invalidPath(input, 'segments cannot end with a dot or space')
    if (WINDOWS_RESERVED_NAME.test(segment))
      invalidPath(input, `reserved file name "${segment}" is not allowed`)
  }

  return segments.join('/') as ProjectPath
}

export function assertUniqueProjectPaths(paths: string[]): ProjectPath[] {
  const canonicalPaths = new Set<string>()
  return paths.map((path) => {
    const normalized = normalizeProjectPath(path)
    const canonical = normalized.toLocaleLowerCase('en-US')
    if (canonicalPaths.has(canonical))
      invalidPath(path, 'path conflicts with another file after case normalization')
    canonicalPaths.add(canonical)
    return normalized
  })
}

export function safeProjectSlug(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const slug = normalized || 'config-form-project'
  return WINDOWS_RESERVED_NAME.test(slug) ? `project-${slug}` : slug
}
