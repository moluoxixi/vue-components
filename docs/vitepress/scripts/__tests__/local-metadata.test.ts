// @vitest-environment node

import type { LocalMetadataSnapshot } from '../../.vitepress/local-metadata-types'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createLocalMetadata, stageLocalMetadata, writeLocalMetadata } from '../local-metadata.mts'

const temporaryDirectories: string[] = []

function createTemporaryDirectory(name: string): string {
  const directory = mkdtempSync(join(tmpdir(), name))
  temporaryDirectories.push(directory)
  return directory
}

function git(repositoryRoot: string, args: string[], environment: Record<string, string> = {}): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function commitFile(options: {
  content: string
  date: string
  email: string
  message: string
  name: string
  path: string
  repositoryRoot: string
}): void {
  const filePath = join(options.repositoryRoot, options.path)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, options.content, 'utf8')
  git(options.repositoryRoot, ['add', '--', options.path])
  git(options.repositoryRoot, ['commit', '--no-gpg-sign', '-m', options.message], {
    GIT_AUTHOR_DATE: options.date,
    GIT_AUTHOR_EMAIL: options.email,
    GIT_AUTHOR_NAME: options.name,
    GIT_COMMITTER_DATE: options.date,
    GIT_COMMITTER_EMAIL: options.email,
    GIT_COMMITTER_NAME: options.name,
  })
}

function createFixtureRepository(): string {
  const repositoryRoot = createTemporaryDirectory('moluoxixi-local-metadata-')
  git(repositoryRoot, ['init', '--initial-branch=main'])
  commitFile({
    content: 'first\n',
    date: '2026-08-01T01:00:00Z',
    email: 'alice@example.test',
    message: 'feat: 初始 CopyText | source',
    name: 'Alice Example',
    path: 'packages/components/src/CopyText/index.ts',
    repositoryRoot,
  })
  commitFile({
    content: 'other\n',
    date: '2026-08-02T01:00:00Z',
    email: 'bob@example.test',
    message: 'feat: unrelated component',
    name: 'Bob Example',
    path: 'packages/components/src/Other/index.ts',
    repositoryRoot,
  })
  commitFile({
    content: 'second\n',
    date: '2026-08-03T01:00:00Z',
    email: 'alice@example.test',
    message: 'fix: CopyText handles symbols & Unicode',
    name: 'Alice Example',
    path: 'packages/components/src/CopyText/index.ts',
    repositoryRoot,
  })
  return repositoryRoot
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('local Git documentation metadata', () => {
  it('scopes commits by component and aggregates contributors without exposing email', () => {
    const repositoryRoot = createFixtureRepository()
    const snapshot = createLocalMetadata({
      components: [
        { name: 'CopyText', path: 'packages/components/src/CopyText' },
        { name: 'Other', path: 'packages/components/src/Other' },
      ],
      defaultBranch: 'main',
      generatedAt: '2026-08-04T00:00:00.000Z',
      repositoryRoot,
      repositoryUrl: 'https://github.test/example/repository/',
    })

    expect(snapshot.repository.defaultBranch).toBe('main')
    expect(snapshot.repository.url).toBe('https://github.test/example/repository')
    expect(snapshot.components.CopyText?.commits.map(commit => commit.message)).toEqual([
      'fix: CopyText handles symbols & Unicode',
      'feat: 初始 CopyText | source',
    ])
    expect(snapshot.components.CopyText?.contributors).toEqual([{
      contributions: 2,
      id: expect.stringMatching(/^git:[a-f0-9]{20}$/),
      name: 'Alice Example',
    }])
    expect(snapshot.components.Other?.commits).toHaveLength(1)
    expect(JSON.stringify(snapshot)).not.toContain('example.test')
    expect(snapshot.components.CopyText?.commits.every(commit => commit.url.endsWith(commit.sha))).toBe(true)
  })

  it('rejects shallow repositories instead of publishing partial history', () => {
    const sourceRoot = createFixtureRepository()
    const cloneRoot = createTemporaryDirectory('moluoxixi-local-metadata-shallow-')
    git(cloneRoot, ['clone', '--depth=1', '--no-local', pathToFileURL(sourceRoot).href, '.'])

    expect(() => createLocalMetadata({
      components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
      defaultBranch: 'main',
      repositoryRoot: cloneRoot,
      repositoryUrl: 'https://github.test/example/repository',
    })).toThrow('requires complete history')
  })

  it('scans the configured default branch instead of the checked-out branch', () => {
    const repositoryRoot = createFixtureRepository()
    const mainHead = git(repositoryRoot, ['rev-parse', 'main']).trim()
    git(repositoryRoot, ['switch', '-c', 'feature/local-metadata'])
    commitFile({
      content: 'feature-only\n',
      date: '2026-08-04T01:00:00Z',
      email: 'feature@example.test',
      message: 'feat: feature-only CopyText change',
      name: 'Feature Author',
      path: 'packages/components/src/CopyText/index.ts',
      repositoryRoot,
    })

    const snapshot = createLocalMetadata({
      components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
      defaultBranch: 'main',
      repositoryRoot,
      repositoryUrl: 'https://github.test/example/repository',
    })

    expect(snapshot.repository.headSha).toBe(mainHead)
    expect(snapshot.components.CopyText?.commits.map(commit => commit.message)).not.toContain('feat: feature-only CopyText change')
  })

  it('preserves an existing snapshot when validation fails', () => {
    const outputDirectory = createTemporaryDirectory('moluoxixi-local-metadata-write-')
    const outputPath = join(outputDirectory, 'local-metadata.json')
    writeFileSync(outputPath, '{"preserved":true}\n', 'utf8')

    const invalidSnapshot = {
      schemaVersion: 1,
      generatedAt: 'invalid',
      repository: { defaultBranch: 'main', headSha: 'invalid', url: 'https://github.test/example/repository' },
      components: {},
    } as unknown as LocalMetadataSnapshot

    expect(() => writeLocalMetadata({
      expectation: {
        components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
        defaultBranch: 'main',
        repositoryUrl: 'https://github.test/example/repository',
      },
      outputPath,
      snapshot: invalidSnapshot,
    })).toThrow('Invalid local Git metadata snapshot')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(readdirSync(outputDirectory)).toEqual(['local-metadata.json'])
  })

  it('atomically replaces an existing valid snapshot', () => {
    const repositoryRoot = createFixtureRepository()
    const outputDirectory = createTemporaryDirectory('moluoxixi-local-metadata-replace-')
    const outputPath = join(outputDirectory, 'local-metadata.json')
    writeFileSync(outputPath, '{"stale":true}\n', 'utf8')

    const components = [{ name: 'CopyText', path: 'packages/components/src/CopyText' }]
    const snapshot = createLocalMetadata({
      components,
      defaultBranch: 'main',
      generatedAt: '2026-08-04T00:00:00.000Z',
      repositoryRoot,
      repositoryUrl: 'https://github.test/example/repository',
    })

    writeLocalMetadata({
      expectation: {
        components,
        defaultBranch: 'main',
        repositoryUrl: 'https://github.test/example/repository',
      },
      outputPath,
      snapshot,
    })

    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(snapshot)
    expect(readdirSync(outputDirectory)).toEqual(['local-metadata.json'])
  })

  it('stages only the local metadata snapshot without disturbing the existing index', () => {
    const repositoryRoot = createFixtureRepository()
    const outputPath = join(repositoryRoot, 'docs/vitepress/.vitepress/local-metadata.json')
    const unrelatedPath = join(repositoryRoot, 'unrelated.txt')
    const existingStagedPath = 'packages/components/src/Other/index.ts'
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, '{"snapshot":true}\n', 'utf8')
    writeFileSync(unrelatedPath, 'leave unstaged\n', 'utf8')
    writeFileSync(join(repositoryRoot, existingStagedPath), 'already staged\n', 'utf8')
    git(repositoryRoot, ['add', '--', existingStagedPath])

    stageLocalMetadata({ outputPath, repositoryRoot })

    expect(git(repositoryRoot, ['diff', '--cached', '--name-only']).trim().split(/\r?\n/).sort()).toEqual([
      'docs/vitepress/.vitepress/local-metadata.json',
      existingStagedPath,
    ].sort())
    expect(git(repositoryRoot, ['status', '--short', '--', 'unrelated.txt'])).toBe('?? unrelated.txt\n')
  })
})
