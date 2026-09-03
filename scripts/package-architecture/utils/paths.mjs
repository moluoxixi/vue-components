import { existsSync, readdirSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'

export const SOURCE_MODULE_EXTENSIONS = ['.ts', '.tsx', '.vue', '.mts', '.cts']
export const IGNORED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.git',
  '.nuxt',
  '.output',
  '.turbo',
  '.vite',
  'cache',
  'coverage',
  'dist',
  'node_modules',
  'third-party',
])

export function normalizeRepositoryPath(repositoryRoot, path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/')
}

export function walkFiles(directory, predicate = () => true) {
  if (!existsSync(directory))
    return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory())
      return IGNORED_DIRECTORY_NAMES.has(entry.name) ? [] : walkFiles(path, predicate)
    return entry.isFile() && predicate(path) ? [path] : []
  })
}

export function walkDirectories(directory) {
  if (!existsSync(directory))
    return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || IGNORED_DIRECTORY_NAMES.has(entry.name) || entry.name.startsWith('__'))
      return []
    const path = resolve(directory, entry.name)
    return [path, ...walkDirectories(path)]
  })
}

export function isWithinDirectory(path, directory) {
  const candidate = relative(directory, path)
  return candidate === '' || (!candidate.startsWith('..') && !candidate.includes(':'))
}

export function resolveRelativeModule(importer, specifier) {
  if (!specifier.startsWith('.'))
    return undefined
  const cleanSpecifier = specifier.split(/[?#]/u, 1)[0]
  const base = resolve(dirname(importer), cleanSpecifier)
  const extension = extname(base)
  const candidates = extension
    ? [
        base,
        ...(extension === '.js' || extension === '.mjs' || extension === '.cjs'
          ? SOURCE_MODULE_EXTENSIONS.map(sourceExtension => base.slice(0, -extension.length) + sourceExtension)
          : []),
      ]
    : [
        ...SOURCE_MODULE_EXTENSIONS.map(sourceExtension => base + sourceExtension),
        ...SOURCE_MODULE_EXTENSIONS.map(sourceExtension => resolve(base, `index${sourceExtension}`)),
      ]
  return candidates.find(candidate => existsSync(candidate))
}
