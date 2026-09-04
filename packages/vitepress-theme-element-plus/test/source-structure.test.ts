import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as rootEntry from '../index'
import * as markdownEntry from '../markdown'
import * as nodeEntry from '../node'
import * as repositoryEntry from '../repository'
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
  'content/demo/ElementPlusDocsDemo.vue',
  'content/demo/ElementPlusDocsDemoSource.vue',
  'content/demo/code-fold.ts',
  'content/demo/types.ts',
  'content/repository/providers/gitee.ts',
  'content/repository/providers/github.ts',
  'content/repository/providers/gitlab.ts',
  'content/repository/providers/local.ts',
  'content/repository/providers/yunxiao.ts',
  'markdown/demo.ts',
  'markdown/external-project.ts',
  'markdown/project.ts',
  'markdown/sfc-ts-to-js.ts',
  'markdown/source-links.ts',
  'node/cli.ts',
  'node/content.ts',
  'node/playground-manifests.ts',
  'node/prepare.ts',
  'node/lifecycle/cli.ts',
  'node/lifecycle/prepare.ts',
  'node/lifecycle/runtime.ts',
  'node/project/load-config.ts',
  'node/repository/atomic-write.ts',
  'node/repository/project.ts',
  'project/config.ts',
  'project/types.ts',
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

function declaredRuntimeExports(path: string): string[] {
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || !statement.exportClause)
      return []
    if (!ts.isNamedExports(statement.exportClause))
      return []
    return statement.exportClause.elements
      .filter(element => !element.isTypeOnly)
      .map(element => element.name.text)
  }).sort()
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

  it('preserves the root, repository, and REPL runtime export surfaces', () => {
    expect(Object.keys(rootEntry).sort()).toEqual([
      'ElementPlusDocsApiDocs',
      'ElementPlusDocsApiTable',
      'ElementPlusDocsCommitTimeline',
      'ElementPlusDocsComponentMeta',
      'ElementPlusDocsComponentOverview',
      'ElementPlusDocsContributors',
      'ElementPlusDocsDemo',
      'ElementPlusDocsOverviewCard',
      'ElementPlusDocsOverviewHome',
      'ElementPlusDocsPlayground',
      'ElementPlusDocsTypeCell',
      'consumeElementPlusDocsPlaygroundSession',
      'createComponentPaths',
      'createElementPlusDocsCodeSandboxAdapter',
      'createElementPlusDocsCodeSandboxParameters',
      'createElementPlusDocsCodeSandboxPayload',
      'createElementPlusDocsContent',
      'createElementPlusDocsContentRewrites',
      'createElementPlusDocsExternalProject',
      'createElementPlusDocsPlaygroundActions',
      'createElementPlusDocsPlaygroundRegistry',
      'createElementPlusDocsPlaygroundSession',
      'createElementPlusDocsSessionPlaygroundAdapter',
      'createElementPlusDocsSfcCompiler',
      'createElementPlusDocsStackBlitzAdapter',
      'createElementPlusDocsStackBlitzProject',
      'createElementPlusDocsTheme',
      'createElementPlusPlaygroundAdapter',
      'createElementPlusPlaygroundUrl',
      'createGiteeRepositoryMetadataActions',
      'createGithubRepositoryMetadataActions',
      'createGitlabRepositoryMetadataActions',
      'createRepositoryMetadataProviderRegistry',
      'createYunxiaoRepositoryMetadataActions',
      'defineComponentPackage',
      'defineElementPlusDocs',
      'defineElementPlusDocsProject',
      'defineRepositoryMetadataProvider',
      'elementPlusDocsPlaygroundKinds',
      'elementPlusDocsPlaygroundSessionQuery',
      'elementPlusDocsTheme',
      'openElementPlusDocsCodeSandbox',
      'openElementPlusDocsStackBlitz',
      'renderComponentPage',
      'repositoryMetadataProviderSupports',
      'resolveElementPlusDocsPlaygroundManifest',
      'resolveElementPlusDocsProject',
      'resolveElementPlusDocsProjectRepository',
      'resolveElementPlusDocsRepository',
      'resolveElementPlusDocsRepositoryProvider',
      'resolveRepositoryComponentMeta',
      'resolveRepositoryContributors',
    ])
    expect(Object.keys(repositoryEntry).sort()).toEqual([
      'assertGiteeMetadataSnapshot',
      'assertGithubMetadataSnapshot',
      'assertGitlabMetadataSnapshot',
      'assertLocalMetadataSnapshot',
      'assertYunxiaoMetadataSnapshot',
      'createElementPlusDocsRepositoryRuntime',
      'createGiteeRepositoryMetadataActions',
      'createGithubRepositoryMetadataActions',
      'createGitlabRepositoryMetadataActions',
      'createRepositoryMetadataProviderRegistry',
      'createYunxiaoRepositoryMetadataActions',
      'defineRepositoryMetadataProvider',
      'elementPlusDocsRepositorySnapshotId',
      'giteeMetadataProvider',
      'githubMetadataProvider',
      'gitlabMetadataProvider',
      'isExactGiteeProfileUrl',
      'isExactGithubProfileUrl',
      'isExactGitlabProfileUrl',
      'isTrustedGiteeAvatarUrl',
      'isTrustedGithubAvatarUrl',
      'isTrustedGitlabWebUrl',
      'isTrustedYunxiaoAvatarUrl',
      'localMetadataProvider',
      'repositoryMetadataProviderSupports',
      'repositoryMetadataProviders',
      'resolveElementPlusDocsRepositorySnapshotFile',
      'resolveGitlabWebBaseUrl',
      'resolveRepositoryComponentMeta',
      'resolveRepositoryContributors',
      'resolveRepositoryMetadata',
      'yunxiaoMetadataProvider',
    ])
    expect(declaredRuntimeExports(resolve(sourceRoot, 'repl-entry.ts'))).toEqual([
      'ElementPlusDocsRepl',
      'createElementPlusDocsCdnUrl',
      'createElementPlusDocsCompilerUrl',
      'createElementPlusDocsReplImportMap',
      'createElementPlusDocsReplStore',
      'decodeElementPlusDocsReplState',
      'encodeElementPlusDocsReplState',
      'fetchElementPlusDocsPackageVersions',
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
