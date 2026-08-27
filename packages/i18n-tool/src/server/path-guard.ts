import { lstat, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { I18nToolError } from './error'

function normalizeForComparison(value: string): string {
  const normalized = resolve(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isInside(root: string, target: string): boolean {
  const relativePath = relative(normalizeForComparison(root), normalizeForComparison(target))
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

async function exists(value: string): Promise<boolean> {
  try {
    await lstat(value)
    return true
  }
  catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
      ? false
      : Promise.reject(error)
  }
}

/** Resolve the nearest existing ancestor, then reattach an uncreated tail. */
export async function canonicalPath(value: string): Promise<string> {
  const absolute = resolve(value)
  const tail: string[] = []
  let current = absolute
  while (!(await exists(current))) {
    const parent = dirname(current)
    if (parent === current)
      throw new I18nToolError('PATH_OUTSIDE_ROOT', 'Unable to resolve a canonical filesystem path.', 403)
    tail.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)))
    current = parent
  }
  return resolve(await realpath(current), ...tail)
}

export interface PathGuard {
  canonicalRoot: string
  resolve: (relativePath: string, options?: { allowMissing?: boolean }) => Promise<string>
}

async function assertNoSymlinkSegments(root: string, target: string): Promise<void> {
  const relativePath = relative(root, target)
  let current = root
  for (const segment of relativePath.split(/[\\/]/).filter(Boolean)) {
    current = resolve(current, segment)
    if (!(await exists(current)))
      break
    if ((await lstat(current)).isSymbolicLink())
      throw new I18nToolError('SYMLINK_ESCAPE', 'Symbolic links are not allowed in locale resource paths.', 403)
  }
}

export async function createPathGuard(root: string): Promise<PathGuard> {
  const lexicalRoot = resolve(root)
  const canonicalRoot = await canonicalPath(lexicalRoot)
  return {
    canonicalRoot,
    async resolve(relativePath, options = {}) {
      if (!relativePath || isAbsolute(relativePath))
        throw new I18nToolError('PATH_OUTSIDE_ROOT', 'Locale resource paths must be non-empty and relative.', 403)
      const lexicalTarget = resolve(lexicalRoot, relativePath)
      if (!isInside(lexicalRoot, lexicalTarget))
        throw new I18nToolError('PATH_OUTSIDE_ROOT', 'Locale resource path leaves the configured root.', 403)
      const canonicalTarget = await canonicalPath(lexicalTarget)
      if (!isInside(canonicalRoot, canonicalTarget))
        throw new I18nToolError('SYMLINK_ESCAPE', 'Locale resource path resolves outside the configured root.', 403)
      await assertNoSymlinkSegments(lexicalRoot, lexicalTarget)
      if (!options.allowMissing && !(await exists(lexicalTarget)))
        throw new I18nToolError('RESOURCE_NOT_FOUND', 'Locale resource does not exist.', 404)
      return lexicalTarget
    },
  }
}
