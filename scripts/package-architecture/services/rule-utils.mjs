import { existsSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import {
  isWithinDirectory,
  SOURCE_MODULE_EXTENSIONS,
} from '../utils/index.mjs'

export const RESPONSIBILITY_DIRECTORIES = new Set([
  'adapters',
  'components',
  'composables',
  'constants',
  'defaults',
  'errors',
  'features',
  'interactions',
  'materials',
  'options',
  'protocol',
  'readonly',
  'registries',
  'schemas',
  'services',
  'state',
  'style',
  'styles',
  'types',
  'utils',
  'validation',
])

export function diagnostic(rule, path, packagePath, message, owners) {
  return {
    rule,
    path,
    package: packagePath,
    message,
    ...(owners?.length ? { owners: [...owners].sort() } : {}),
  }
}

export function isProductionModule(file) {
  const normalized = file.replaceAll('\\', '/')
  return SOURCE_MODULE_EXTENSIONS.includes(extname(file))
    && !normalized.includes('/__tests__/')
    && !/\.(?:spec|test)\.[cm]?[jt]sx?$/u.test(file)
    && !file.endsWith('.d.ts')
}

export function isExplicitFeatureDirectory(directory) {
  return basename(dirname(directory)) === 'features'
}

function isArchitecturalFeatureDirectory(directory, sourceRoot) {
  if (isExplicitFeatureDirectory(directory))
    return true
  if (RESPONSIBILITY_DIRECTORIES.has(basename(directory)))
    return false
  if (!existsSync(resolve(directory, 'index.ts')))
    return false
  let parent = dirname(directory)
  while (parent !== sourceRoot && isWithinDirectory(parent, sourceRoot)) {
    const name = basename(parent)
    if (name === 'features')
      return true
    if (RESPONSIBILITY_DIRECTORIES.has(name))
      return false
    parent = dirname(parent)
  }
  return true
}

export function nearestArchitecturalFeatureRoot(file, sourceRoot) {
  let directory = dirname(file)
  while (directory !== sourceRoot && isWithinDirectory(directory, sourceRoot)) {
    if (isArchitecturalFeatureDirectory(directory, sourceRoot))
      return directory
    directory = dirname(directory)
  }
  return undefined
}

export function nearestResponsibilityDirectory(file, sourceRoot) {
  let directory = dirname(file)
  while (directory !== sourceRoot && isWithinDirectory(directory, sourceRoot)) {
    if (RESPONSIBILITY_DIRECTORIES.has(basename(directory)))
      return directory
    directory = dirname(directory)
  }
  return undefined
}
