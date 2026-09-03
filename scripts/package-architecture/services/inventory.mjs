import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { parse } from 'yaml'
import {
  IGNORED_DIRECTORY_NAMES,
  normalizeRepositoryPath,
} from '../utils/index.mjs'

const PACKAGE_DISCOVERY_IGNORED_DIRECTORY_NAMES = new Set([
  ...IGNORED_DIRECTORY_NAMES,
  '__fixtures__',
  '__tests__',
  'e2e',
  'fixture',
  'fixtures',
  'test',
  'tests',
])

function expandWorkspacePattern(repositoryRoot, pattern) {
  const segments = pattern.replaceAll('\\', '/').split('/')
  let candidates = [repositoryRoot]
  for (const segment of segments) {
    candidates = candidates.flatMap((directory) => {
      if (segment !== '*')
        return [resolve(directory, segment)]
      if (!existsSync(directory))
        return []
      return readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => resolve(directory, entry.name))
    })
  }
  return candidates
}

function discoverPackageRoots(directory) {
  if (!existsSync(directory) || PACKAGE_DISCOVERY_IGNORED_DIRECTORY_NAMES.has(basename(directory)))
    return []
  const roots = existsSync(resolve(directory, 'package.json')) ? [directory] : []
  return [...roots, ...readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || PACKAGE_DISCOVERY_IGNORED_DIRECTORY_NAMES.has(entry.name))
      return []
    return discoverPackageRoots(resolve(directory, entry.name))
  })]
}

export function collectPackageInventory(repositoryRoot) {
  const workspace = parse(readFileSync(resolve(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8'))
  const packagesRoot = resolve(repositoryRoot, 'packages')
  const explicitWorkspaceRoots = (workspace.packages ?? [])
    .filter(pattern => pattern === 'packages/*' || pattern.startsWith('packages/'))
    .flatMap(pattern => expandWorkspacePattern(repositoryRoot, pattern))
  const roots = [...new Set([
    ...discoverPackageRoots(packagesRoot),
    ...explicitWorkspaceRoots,
  ])]
    .filter(root => existsSync(resolve(root, 'package.json')))
    .sort()

  return roots.map((root) => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    return {
      manifest,
      name: manifest.name,
      relativeRoot: normalizeRepositoryPath(repositoryRoot, root),
      root,
      rootEntry: resolve(root, 'index.ts'),
      sourceRoot: resolve(root, 'src'),
      sourceRootEntry: resolve(root, 'src/index.ts'),
    }
  })
}
