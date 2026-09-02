// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const docsRoot = fileURLToPath(new URL('../..', import.meta.url))
const vitepressRoot = join(docsRoot, '.vitepress')

const featureRoots = [
  'catalog',
  'site',
  'theme',
] as const

const removedFlatModules = [
  'catalog/component-manifest.ts',
  'catalog/docs-i18n.ts',
  'catalog/utility-manifest.ts',
  'site/auto-loaders.ts',
  'site/docs-site.ts',
  'site/generated-paths.ts',
  'site/repository-config.ts',
  'site/repository.ts',
  'theme/content.ts',
  'theme/content.test.ts',
] as const

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.name.endsWith('.ts') || entry.name.endsWith('.mts')
        ? [path]
        : []
  })
}

function collectResponsibilityDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name === '__tests__')
      return []
    const path = join(directory, entry.name)
    return [path, ...collectResponsibilityDirectories(path)]
  })
}

describe('documentation source architecture', () => {
  it('keeps feature roots limited to barrels and responsibility directories', () => {
    const unexpectedFiles = featureRoots.flatMap((root) => {
      const directory = join(vitepressRoot, root)
      return readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name !== 'index.ts')
        .map(entry => `${root}/${entry.name}`)
    })

    expect(unexpectedFiles).toEqual([])
  })

  it('gives every responsibility directory a local barrel', () => {
    const missingBarrels = featureRoots.flatMap((root) => {
      const directory = join(vitepressRoot, root)
      return collectResponsibilityDirectories(directory)
        .filter(path => !existsSync(join(path, 'index.ts')))
        .map(path => relative(vitepressRoot, path).replaceAll('\\', '/'))
    })

    expect(missingBarrels).toEqual([])
  })

  it('does not restore removed flat modules or imports', () => {
    expect(removedFlatModules.filter(path => existsSync(join(vitepressRoot, path))))
      .toEqual([])

    const forbiddenImport = /from\s+['"][^'"]*(?:catalog\/(?:component-manifest|docs-i18n|utility-manifest)|site\/(?:auto-loaders|docs-site|generated-paths|repository-config)|theme\/content)(?:\.ts)?['"]/g
    const importHits = collectTypeScriptFiles(docsRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(forbiddenImport)].map(match => (
        `${relative(docsRoot, path).replaceAll('\\', '/')}: ${match[0]}`
      ))
    })

    expect(importHits).toEqual([])
  })
})
