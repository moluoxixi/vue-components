// @vitest-environment node

import type { GiteeMetadataExpectation, GiteeMetadataSnapshot } from '../../repository'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGiteeMetadata,
  formatGiteeSyncError,
  groupGiteeComponentIssues,
  resolveGiteeNextPage,
  syncGiteeMetadata,
  writeGiteeMetadataAtomically,
} from '../../src/node/repository'

const temporaryDirectories: string[] = []
const headSha = 'a'.repeat(40)

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

function options(fetchImpl: typeof fetch) {
  return {
    apiBaseUrl: 'https://gitee.test/api/v5',
    components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
    defaultBranch: 'main',
    fetchImpl,
    generatedAt: '2026-08-19T00:00:00.000Z',
    issueTitlePrefix: (name: string) => `[${name}]`,
    owner: 'group',
    repository: 'project',
    repositoryUrl: 'https://gitee.test/group/project',
    token: 'gitee-secret-token',
    userAgent: 'gitee-metadata-test',
    webBaseUrl: 'https://gitee.test',
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('gitee documentation metadata', () => {
  it('paginates component data, pins HEAD, preserves verified profiles, and never serializes email', async () => {
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      requests.push(url)
      expect(new URL(url).searchParams.get('access_token')).toBe('gitee-secret-token')
      expect(new Headers(init?.headers).get('user-agent')).toBe('gitee-metadata-test')

      if (url.includes('/repos/group/project?'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: true })
      if (url.includes('/branches/main?'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.includes('/issues?') && !url.includes('page=2')) {
        return jsonResponse([
          { html_url: 'https://gitee.test/group/project/issues/A1', number: 'A1', title: '[CopyText] first' },
          { html_url: 'https://gitee.test/group/project/issues/B2', number: 'B2', title: '[Other] ignored' },
        ], { headers: { link: '<https://gitee.test/api/v5/repos/group/project/issues?state=open&page=2&per_page=100>; rel=\'next\'' } })
      }
      if (url.includes('/issues?') && url.includes('page=2'))
        return jsonResponse([{ html_url: 'https://gitee.test/group/project/issues/C3', number: 'C3', title: '[CopyText] second' }])
      if (url.includes('/commits?')) {
        return jsonResponse([{
          author: {
            avatar_url: 'https://gitee.test/avatar.png',
            html_url: 'https://gitee.test/alice',
            id: 101,
            login: 'alice',
            name: 'Alice Account',
          },
          commit: {
            author: { date: '2026-08-18T00:00:00.000Z', email: 'alice@example.test', name: 'Alice Git' },
            message: 'feat: add copy\n\nbody',
          },
          html_url: `https://gitee.test/group/project/commit/${'1'.repeat(40)}`,
          sha: '1'.repeat(40),
        }])
      }
      if (url.includes('/users/alice?')) {
        return jsonResponse({
          avatar_url: 'https://gitee.test/avatar.png',
          html_url: 'https://gitee.test/alice',
          id: 101,
          login: 'alice',
          name: 'Alice Account',
        })
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }

    const snapshot = await createGiteeMetadata(options(fetchImpl))

    expect(requests.some(url => url.includes(`sha=${headSha}`))).toBe(true)
    expect(requests.some(url => url.includes('path=packages%2Fcomponents%2Fsrc%2FCopyText'))).toBe(true)
    expect(snapshot.components.CopyText?.openIssueCount).toBe(2)
    expect(snapshot.components.CopyText?.contributors).toEqual([{
      avatarUrl: 'https://gitee.test/avatar.png',
      contributions: 1,
      id: 'gitee:101',
      login: 'alice',
      name: 'Alice Account',
      profileUrl: 'https://gitee.test/alice',
    }])
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('gitee-secret-token')
  })

  it('rejects anonymous Git identities instead of falling back to local author data', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('/repos/group/project?'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: false })
      if (url.includes('/branches/main?'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.includes('/commits?')) {
        return jsonResponse([{
          author: null,
          commit: { author: { date: '2026-08-18T00:00:00.000Z', email: 'private@example.test', name: 'Local Author' }, message: 'docs: update' },
          html_url: `https://gitee.test/group/project/commit/${'2'.repeat(40)}`,
          sha: '2'.repeat(40),
        }])
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }

    await expect(createGiteeMetadata(options(fetchImpl)))
      .rejects
      .toThrow('has no associated Gitee account')
  })

  it('retries transient responses and redacts token-bearing error URLs', async () => {
    const sleep = vi.fn(async () => {})
    let attempts = 0
    const failingFetch: typeof fetch = async () => {
      attempts += 1
      if (attempts < 3)
        return jsonResponse({}, { status: attempts === 1 ? 429 : 503, headers: { 'retry-after': attempts === 1 ? '0.01' : '' } })
      return jsonResponse({}, { status: 401, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'soon' } })
    }

    await expect(createGiteeMetadata({ ...options(failingFetch), sleep })).rejects.not.toThrow('gitee-secret-token')
    expect(attempts).toBe(3)
    expect(sleep).toHaveBeenCalledWith(10)
  })

  it('retries network failures and redacts every token encoding', async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('socket reset')
    })

    await expect(createGiteeMetadata({ ...options(fetchImpl), sleep }))
      .rejects
      .toThrow('Gitee network request failed')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls).toEqual([[500], [1000], [2000]])

    const token = 'secret +/token'
    const encodedToken = encodeURIComponent(token)
    const queryEncodedToken = new URLSearchParams({ access_token: token })
      .toString()
      .slice('access_token='.length)
    const formatted = formatGiteeSyncError(
      new Error(`${token} ${encodedToken} ${queryEncodedToken}`),
      token,
    )
    expect(formatted).not.toContain(token)
    expect(formatted).not.toContain(encodedToken)
    expect(formatted).not.toContain(queryEncodedToken)
  })

  it('rejects repeated pagination pages even when requests carry a token', async () => {
    let commitRequests = 0
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/repos/group/project'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: false })
      if (url.pathname.endsWith('/branches/main'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.pathname.endsWith('/commits')) {
        commitRequests += 1
        url.searchParams.delete('access_token')
        return jsonResponse([], { headers: { link: `<${url}>; rel='next'` } })
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }

    await expect(createGiteeMetadata(options(fetchImpl)))
      .rejects
      .toThrow('Gitee pagination returned a repeated next page')
    expect(commitRequests).toBe(1)
  })

  it('falls back to the committer date and rejects commits without any valid date', async () => {
    const responseForCommit = (commit: object): typeof fetch => async (input) => {
      const url = String(input)
      if (url.includes('/repos/group/project?'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: false })
      if (url.includes('/branches/main?'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.includes('/commits?'))
        return jsonResponse([commit])
      if (url.includes('/users/committer?')) {
        return jsonResponse({
          avatar_url: 'https://gitee.test/assets/no_portrait.png',
          html_url: 'https://gitee.test/committer',
          id: 303,
          login: 'committer',
          name: 'Committer',
        })
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }
    const baseCommit = {
      author: {
        avatar_url: 'https://gitee.test/assets/no_portrait.png',
        html_url: 'https://gitee.test/committer',
        id: 303,
        login: 'committer',
        name: 'Committer',
      },
      html_url: `https://gitee.test/group/project/commit/${'3'.repeat(40)}`,
      sha: '3'.repeat(40),
    }
    const withCommitterDate = await createGiteeMetadata(options(responseForCommit({
      ...baseCommit,
      commit: {
        author: null,
        committer: { date: '2026-08-18T00:00:00.000Z', email: '', name: 'Committer' },
        message: 'docs: fallback date',
      },
    })))
    expect(withCommitterDate.components.CopyText?.commits[0]?.date).toBe('2026-08-18T00:00:00.000Z')
    expect(withCommitterDate.components.CopyText?.commits[0]?.author.avatarUrl)
      .toBe('https://gitee.test/assets/no_portrait.png')

    await expect(createGiteeMetadata(options(responseForCommit({
      ...baseCommit,
      commit: { author: null, committer: { email: '', name: 'Committer' }, message: 'invalid' },
    })))).rejects.toThrow('is missing a valid date')
  })

  it('rejects a user lookup that resolves to a different Gitee account', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('/repos/group/project?'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: false })
      if (url.includes('/branches/main?'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.includes('/commits?')) {
        return jsonResponse([{
          author: { id: 101, login: 'alice' },
          commit: { author: { date: '2026-08-18T00:00:00.000Z' }, message: 'feat: strict account' },
          html_url: `https://gitee.test/group/project/commit/${'4'.repeat(40)}`,
          sha: '4'.repeat(40),
        }])
      }
      if (url.includes('/users/alice?')) {
        return jsonResponse({
          avatar_url: 'https://gitee.test/bob.png',
          html_url: 'https://gitee.test/bob',
          id: 202,
          login: 'bob',
          name: 'Bob',
        })
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }

    await expect(createGiteeMetadata(options(fetchImpl)))
      .rejects
      .toThrow('Gitee user profile mismatch for alice')
  })

  it('rejects a Gitee user profile without a provider display name', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('/repos/group/project?'))
        return jsonResponse({ default_branch: 'main', full_name: 'group/project', has_issues: false })
      if (url.includes('/branches/main?'))
        return jsonResponse({ commit: { sha: headSha } })
      if (url.includes('/commits?')) {
        return jsonResponse([{
          author: { id: 101, login: 'alice' },
          commit: { author: { date: '2026-08-18T00:00:00.000Z' }, message: 'feat: strict account' },
          html_url: `https://gitee.test/group/project/commit/${'5'.repeat(40)}`,
          sha: '5'.repeat(40),
        }])
      }
      if (url.includes('/users/alice?')) {
        return jsonResponse({
          avatar_url: 'https://gitee.test/alice.png',
          html_url: 'https://gitee.test/alice',
          id: 101,
          login: 'alice',
          name: null,
        })
      }
      throw new Error(`Unexpected Gitee request: ${url}`)
    }

    await expect(createGiteeMetadata(options(fetchImpl)))
      .rejects
      .toThrow('Gitee user profile mismatch for alice')
  })

  it('groups exact prefixes and follows the Gitee Link header', () => {
    expect(groupGiteeComponentIssues([
      { html_url: 'https://example.test/1', number: 'A1', title: '[CopyText] match' },
      { html_url: 'https://example.test/2', number: 'A2', title: '[Copy] ignored' },
    ], [{ name: 'CopyText', path: 'src/CopyText' }], name => `[${name}]`)).toEqual({
      CopyText: [{ number: 'A1', title: '[CopyText] match', url: 'https://example.test/1' }],
    })
    expect(resolveGiteeNextPage(jsonResponse([], {
      headers: { link: '<https://gitee.test/items?page=2>; rel=\'next\', <https://gitee.test/items?page=3>; rel=\'last\'' },
    }))).toBe('https://gitee.test/items?page=2')
  })

  it('redacts sync errors and preserves the previous snapshot on collection, validation, or atomic failure', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'moluoxixi-gitee-metadata-'))
    temporaryDirectories.push(directory)
    const outputPath = join(directory, 'gitee-metadata.json')
    writeFileSync(outputPath, '{"preserved":true}\n', 'utf8')
    const snapshot = { repository: { headSha } } as GiteeMetadataSnapshot

    expect(() => writeGiteeMetadataAtomically(snapshot, outputPath, {
      writeFileSync,
      renameSync: () => { throw new Error('rename failed') },
      rmSync,
    })).toThrow('rename failed')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(readdirSync(directory)).toEqual(['gitee-metadata.json'])

    const expectation: GiteeMetadataExpectation = {
      components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
      defaultBranch: 'main',
      owner: 'group',
      repository: 'project',
      repositoryUrl: 'https://gitee.test/group/project',
    }
    await expect(syncGiteeMetadata(
      async () => { throw new Error('simulated Gitee API failure') },
      expectation,
      outputPath,
    )).rejects.toThrow('simulated Gitee API failure')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    await expect(syncGiteeMetadata(
      async () => ({}) as GiteeMetadataSnapshot,
      expectation,
      outputPath,
    )).rejects.toThrow('root contains unsupported or missing fields')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')

    expect(formatGiteeSyncError(new Error('gitee-secret-token'), 'gitee-secret-token')).toContain('[REDACTED]')
  })
})
