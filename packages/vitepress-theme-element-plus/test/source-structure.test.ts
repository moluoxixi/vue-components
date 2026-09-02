import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as markdownEntry from '../markdown'
import * as nodeEntry from '../node'
import * as repositoryNodeEntry from '../repository-node'
import * as repositoryFeature from '../src/node/repository'

function sourceEntries(feature: 'markdown' | 'node') {
  return readdirSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', feature), {
    withFileTypes: true,
  })
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(packageRoot, 'src')

const removedFlatModules = [
  'markdown/demo.ts',
  'markdown/external-project.ts',
  'markdown/project.ts',
  'markdown/sfc-ts-to-js.ts',
  'markdown/source-links.ts',
  'node/cli.ts',
  'node/content.ts',
  'node/playground-manifests.ts',
  'node/prepare.ts',
  'node/repository/atomic-write.ts',
  'node/repository/project.ts',
] as const

function collectDirectories(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.name === '__tests__')
      return []
    const path = resolve(directory, entry.name)
    return [path, ...collectDirectories(path)]
  })
}

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.name.endsWith('.ts') || entry.name.endsWith('.vue')
        ? [path]
        : []
  })
}

describe('theme source responsibilities', () => {
  it.each(['markdown', 'node'] as const)('keeps the %s feature root limited to its barrel', (feature) => {
    const entries = sourceEntries(feature)
    expect(entries.filter(entry => entry.isFile()).map(entry => entry.name)).toEqual(['index.ts'])
    const missingBarrels = collectDirectories(resolve(sourceRoot, feature))
      .filter(directory => !existsSync(resolve(directory, 'index.ts')))
      .map(directory => relative(sourceRoot, directory).replaceAll('\\', '/'))
    expect(missingBarrels).toEqual([])
  })

  it('does not restore removed flat modules or imports', () => {
    expect(removedFlatModules.filter(path => existsSync(resolve(sourceRoot, path))))
      .toEqual([])

    const forbiddenImport = /(?:from\s+|import\()['"][^'"]*(?:(?:markdown\/(?:external-project|sfc-ts-to-js|source-links)|node\/(?:cli|playground-manifests|prepare)|node\/repository\/(?:atomic-write|project))(?:\.ts)?|(?:markdown\/(?:demo|project)|node\/content)\.ts)['"]/g
    const importHits = collectTypeScriptFiles(packageRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(forbiddenImport)].map(match => (
        `${relative(packageRoot, path).replaceAll('\\', '/')}: ${match[0]}`
      ))
    })

    expect(importHits).toEqual([])
  })

  it('preserves the public node and markdown export surfaces', () => {
    expect(Object.keys(nodeEntry).sort()).toEqual([
      'elementPlusDocsContentRoot',
      'synchronizeElementPlusDocsContent',
      'watchElementPlusDocsContent',
    ])
    expect(Object.keys(markdownEntry).sort()).toEqual([
      'collectElementPlusDocsDemos',
      'createElementPlusDocsDemoId',
      'elementPlusDocsProjectMarkdownPlugin',
      'formatSfcTypeScript',
      'sfcTs2js',
    ])
  })

  it('keeps repository internals scoped while preserving the public Node aggregation', () => {
    expect(Object.keys(repositoryNodeEntry).sort()).toEqual([
      'ElementPlusDocsPrepareError',
      'collectValidateAndWrite',
      'createGiteeMetadata',
      'createGithubMetadata',
      'createGitlabMetadata',
      'createLocalMetadata',
      'createYunxiaoMetadata',
      'defaultAtomicFileSystem',
      'elementPlusDocsPlaygroundManifestsPath',
      'formatGiteeSyncError',
      'formatGithubSyncError',
      'formatGitlabSyncError',
      'formatRepositorySyncError',
      'formatYunxiaoSyncError',
      'groupComponentIssues',
      'groupGiteeComponentIssues',
      'groupGitlabComponentIssues',
      'isPrepareLockProcessRunning',
      'loadElementPlusDocsProject',
      'parseGitLog',
      'parseNextLink',
      'prepareElementPlusDocs',
      'readElementPlusDocsPlaygroundManifests',
      'resolveGiteeNextPage',
      'resolveGitlabNextPage',
      'resolveTrustedApiUrl',
      'resolveYunxiaoNextPage',
      'syncGiteeMetadata',
      'syncGithubMetadata',
      'syncGitlabMetadata',
      'syncYunxiaoMetadata',
      'synchronizeElementPlusDocsPlaygroundManifests',
      'synchronizeElementPlusDocsRepository',
      'validateElementPlusDocsRepository',
      'writeGiteeMetadataAtomically',
      'writeGithubMetadataAtomically',
      'writeGitlabMetadataAtomically',
      'writeJsonAtomically',
      'writeLocalMetadata',
      'writeYunxiaoMetadataAtomically',
      'yunxiaoRepositoryApiPath',
    ])

    expect(repositoryFeature).not.toHaveProperty('prepareElementPlusDocs')
    expect(repositoryFeature).not.toHaveProperty('readElementPlusDocsPlaygroundManifests')
    expect(repositoryFeature).not.toHaveProperty('loadElementPlusDocsProject')
    expect(repositoryFeature).not.toHaveProperty('writeJsonAtomically')
  })
})
