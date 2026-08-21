// @vitest-environment node

import type { GithubMetadataExpectation, GithubMetadataSnapshot } from '../../.vitepress/github-metadata-types'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { documentedComponentNames } from '../../.vitepress/component-manifest'
import { componentSourcePath, docsSite } from '../../.vitepress/docs-site'
import { assertGithubMetadataSnapshot } from '../../.vitepress/github-metadata-types'
import snapshot from '../../.vitepress/github-metadata.json'
import { createGithubMetadata, groupComponentIssues, parseNextLink } from '../github-metadata.mts'
import { formatGithubSyncError, syncGithubMetadata, writeGithubMetadataAtomically } from '../sync-github-metadata.mts'

const headSha = 'a'.repeat(40)
const temporaryDirectories: string[] = []

function githubResponse(data: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function createGithubFetch(
  includeAnonymous = false,
  aliceProfileName: string | null = 'Alice',
): { fetchImpl: typeof fetch, requests: string[] } {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push(url)
    expect(new Headers(init?.headers).get('user-agent')).toBe('docs-metadata-test')

    if (url.endsWith('/git/ref/heads/main'))
      return githubResponse({ object: { sha: headSha } })
    if (url.includes('/issues?')) {
      return githubResponse([
        { number: 1, title: '[CopyText] first issue', html_url: 'https://github.com/owner/repository/issues/1' },
        { number: 2, title: '[CopyText] pull request', html_url: 'https://github.com/owner/repository/pull/2', pull_request: {} },
      ], { link: '<https://api.github.com/issues-page-2>; rel="next"' })
    }
    if (url.endsWith('/issues-page-2'))
      return githubResponse([{ number: 3, title: '[CopyText] second issue', html_url: 'https://github.com/owner/repository/issues/3' }])
    if (url.includes('/commits?')) {
      expect(url).toContain(`sha=${headSha}`)
      expect(url).toContain('path=packages%2Fcomponents%2Fsrc%2FCopyText')
      return githubResponse([{
        sha: '1'.repeat(40),
        html_url: `https://github.com/owner/repository/commit/${'1'.repeat(40)}`,
        author: { login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/alice', type: 'User' },
        commit: {
          message: 'feat: add copy\n\nbody',
          author: { name: 'Alice Git', date: null },
          committer: { name: 'Alice Committer', date: '2026-08-01T00:00:00Z' },
        },
      }], { link: '<https://api.github.com/commits-page-2>; rel="next"' })
    }
    if (url.endsWith('/commits-page-2')) {
      return githubResponse([
        {
          sha: '2'.repeat(40),
          html_url: `https://github.com/owner/repository/commit/${'2'.repeat(40)}`,
          author: { login: 'release[bot]', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4', html_url: 'https://github.com/release%5Bbot%5D', type: 'Bot' },
          commit: { message: 'chore: release', author: { name: 'Release Bot', date: '2026-08-02T00:00:00Z' }, committer: null },
        },
        ...(includeAnonymous
          ? [{
              sha: '3'.repeat(40),
              html_url: `https://github.com/owner/repository/commit/${'3'.repeat(40)}`,
              author: null,
              commit: { message: 'docs: anonymous', author: { name: 'Local Author', date: '2026-08-03T00:00:00Z' }, committer: null },
            }]
          : []),
      ])
    }
    if (url.endsWith('/users/alice'))
      return githubResponse({ login: 'alice', name: aliceProfileName, avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/alice', type: 'User' })
    if (url.endsWith('/users/release%5Bbot%5D'))
      return githubResponse({ login: 'release[bot]', name: 'Release Bot', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4', html_url: 'https://github.com/release%5Bbot%5D', type: 'Bot' })

    throw new Error(`Unexpected GitHub request: ${url}`)
  }
  return { fetchImpl, requests }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('gitHub documentation metadata', () => {
  it('covers every documented component with component-scoped history', () => {
    const profiles = snapshot.profiles as GithubMetadataSnapshot['profiles']
    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.repository.headSha).toMatch(/^[a-f0-9]{40}$/)
    expect(Object.keys(snapshot.components).sort()).toEqual([...documentedComponentNames].sort())

    for (const [name, component] of Object.entries(snapshot.components)) {
      expect(component.path).toBe(componentSourcePath(name))
      expect(component.commits.length, name).toBeGreaterThan(0)
      expect(new Set(component.commits.map(commit => commit.sha)).size).toBe(component.commits.length)
      expect(component.contributors.length, name).toBeGreaterThan(0)
      component.contributors.forEach((contributor) => {
        expect(Object.hasOwn(profiles, contributor.login), `${name}: ${contributor.login}`).toBe(true)
        expect(contributor.contributions).toBeGreaterThan(0)
      })
      component.commits.forEach((commit) => {
        expect(commit.author).toEqual(profiles[commit.author.login])
      })
    }
  })

  it('stores display-safe GitHub profiles and commit links', () => {
    for (const profile of Object.values(snapshot.profiles)) {
      expect(profile.avatarUrl).toMatch(/^https:\/\/avatars\.githubusercontent\.com\//)
      expect(new URL(profile.avatarUrl).search).toBe('')
      expect(profile.profileUrl).toBe(`https://github.com/${profile.login}`)
      expect(profile.name.trim()).not.toBe('')
    }

    for (const component of Object.values(snapshot.components)) {
      component.commits.forEach((commit) => {
        expect(commit.url).toMatch(/^https:\/\/github\.com\/moluoxixi\/vue-components\/commit\//)
        expect(commit.shortSha).toBe(commit.sha.slice(0, 7))
        expect(commit.message.trim()).not.toBe('')
      })
    }
  })

  it('attributes open issues by exact component prefix and excludes pull requests', () => {
    const grouped = groupComponentIssues([
      { number: 1, title: '[CopyText] broken state', html_url: 'https://example.test/1' },
      { number: 2, title: '[Copy] unrelated prefix', html_url: 'https://example.test/2' },
      { number: 3, title: '[CopyText] pull request', html_url: 'https://example.test/3', pull_request: {} },
    ], [{ name: 'CopyText', path: 'packages/components/src/CopyText' }], name => `[${name}]`)

    expect(grouped.CopyText).toEqual([{
      number: 1,
      title: '[CopyText] broken state',
      url: 'https://example.test/1',
    }])
  })

  it('follows only the next pagination link', () => {
    expect(parseNextLink('<https://api.github.com/items?page=2>; rel="next", <https://api.github.com/items?page=4>; rel="last"'))
      .toBe('https://api.github.com/items?page=2')
    expect(parseNextLink('<https://api.github.com/items?page=1>; rel="prev"')).toBeUndefined()
    expect(parseNextLink(null)).toBeUndefined()
  })

  it('paginates component data, pins the configured branch, and applies contributor policy', async () => {
    const { fetchImpl, requests } = createGithubFetch()
    const metadata = await createGithubMetadata({
      owner: 'owner',
      repository: 'repository',
      defaultBranch: 'main',
      components: [{ name: 'CopyText', path: componentSourcePath('CopyText') }],
      issueTitlePrefix: name => `[${name}]`,
      excludeBotsFromContributors: true,
      userAgent: 'docs-metadata-test',
      generatedAt: '2026-08-04T00:00:00.000Z',
      fetchImpl,
    })

    expect(metadata.repository).toMatchObject({ defaultBranch: 'main', headSha, openIssueCount: 2 })
    expect(metadata.components.CopyText?.openIssueCount).toBe(2)
    expect(metadata.components.CopyText?.commits.map(commit => commit.author.name)).toEqual(['Alice', 'Release Bot'])
    expect(metadata.profiles.alice?.avatarUrl).toBe('https://avatars.githubusercontent.com/u/1')
    expect(metadata.components.CopyText?.commits[0]?.author.avatarUrl).toBe('https://avatars.githubusercontent.com/u/1')
    expect(metadata.components.CopyText?.commits[0]?.date).toBe('2026-08-01T00:00:00Z')
    expect(metadata.components.CopyText?.contributors).toEqual([{ login: 'alice', contributions: 1 }])
    expect(requests.filter(url => url.includes('issues-page-2'))).toHaveLength(1)
    expect(requests.filter(url => url.includes('commits-page-2'))).toHaveLength(1)
  })

  it('rejects commits without a provider-associated GitHub account', async () => {
    const { fetchImpl } = createGithubFetch(true)
    await expect(createGithubMetadata({
      owner: 'owner',
      repository: 'repository',
      defaultBranch: 'main',
      components: [{ name: 'CopyText', path: componentSourcePath('CopyText') }],
      issueTitlePrefix: name => `[${name}]`,
      excludeBotsFromContributors: true,
      userAgent: 'docs-metadata-test',
      fetchImpl,
    })).rejects.toThrow('has no associated GitHub account')
  })

  it('rejects a GitHub user profile without a provider display name', async () => {
    const { fetchImpl } = createGithubFetch(false, null)
    await expect(createGithubMetadata({
      owner: 'owner',
      repository: 'repository',
      defaultBranch: 'main',
      components: [{ name: 'CopyText', path: componentSourcePath('CopyText') }],
      issueTitlePrefix: name => `[${name}]`,
      excludeBotsFromContributors: true,
      userAgent: 'docs-metadata-test',
      fetchImpl,
    })).rejects.toThrow('GitHub user profile mismatch for alice')
  })

  it('rejects incomplete snapshots before documentation rendering', () => {
    const invalid = structuredClone(snapshot) as Record<string, any>
    delete invalid.components.CopyText

    expect(() => assertGithubMetadataSnapshot(invalid, {
      owner: docsSite.repositories.github.owner,
      repository: docsSite.repositories.github.name,
      defaultBranch: docsSite.repositories.github.defaultBranch,
      components: documentedComponentNames.map(name => ({ name, path: componentSourcePath(name) })),
    })).toThrow('component keys must exactly match the documentation manifest')
  })

  it('rejects snapshots from another branch or without valid commit dates', () => {
    const expectation = {
      owner: docsSite.repositories.github.owner,
      repository: docsSite.repositories.github.name,
      defaultBranch: docsSite.repositories.github.defaultBranch,
      components: documentedComponentNames.map(name => ({ name, path: componentSourcePath(name) })),
    }
    const wrongBranch = structuredClone(snapshot) as Record<string, any>
    wrongBranch.repository.defaultBranch = 'release'
    expect(() => assertGithubMetadataSnapshot(wrongBranch, expectation)).toThrow('defaultBranch must be main')

    const missingDate = structuredClone(snapshot) as Record<string, any>
    missingDate.components.CopyText.commits[0].date = ''
    expect(() => assertGithubMetadataSnapshot(missingDate, expectation)).toThrow('commit date must be an ISO date')

    const partialAuthor = structuredClone(snapshot) as Record<string, any>
    delete partialAuthor.components.CopyText.commits[0].author.avatarUrl
    expect(() => assertGithubMetadataSnapshot(partialAuthor, expectation))
      .toThrow('commit author contains unsupported or missing fields')

    const queryBearingAvatar = structuredClone(snapshot) as Record<string, any>
    queryBearingAvatar.profiles[Object.keys(queryBearingAvatar.profiles)[0]].avatarUrl += '?token=secret'
    expect(() => assertGithubMetadataSnapshot(queryBearingAvatar, expectation))
      .toThrow('has an untrusted avatarUrl')
  })

  it('redacts tokens and preserves the previous snapshot when collection, validation, or atomic replacement fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'moluoxixi-github-metadata-'))
    temporaryDirectories.push(directory)
    const outputPath = join(directory, 'github-metadata.json')
    writeFileSync(outputPath, '{"preserved":true}\n', 'utf8')

    expect(() => writeGithubMetadataAtomically(
      { repository: { headSha } } as GithubMetadataSnapshot,
      outputPath,
      {
        writeFileSync,
        renameSync: () => { throw new Error('rename failed') },
        rmSync,
      },
    )).toThrow('rename failed')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(readdirSync(directory)).toEqual(['github-metadata.json'])

    const expectation: GithubMetadataExpectation = {
      components: documentedComponentNames.map(name => ({ name, path: componentSourcePath(name) })),
      defaultBranch: docsSite.repositories.github.defaultBranch,
      owner: docsSite.repositories.github.owner,
      repository: docsSite.repositories.github.name,
    }
    await expect(syncGithubMetadata(
      async () => { throw new Error('simulated GitHub API failure') },
      expectation,
      outputPath,
    )).rejects.toThrow('simulated GitHub API failure')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    await expect(syncGithubMetadata(
      async () => ({}) as GithubMetadataSnapshot,
      expectation,
      outputPath,
    )).rejects.toThrow('root contains unsupported or missing fields')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')

    const secret = 'github-secret-token'
    expect(formatGithubSyncError(new Error(`request failed: ${secret}`), secret)).toContain('[REDACTED]')
    expect(formatGithubSyncError(new Error(`request failed: ${secret}`), secret)).not.toContain(secret)
  })
})
