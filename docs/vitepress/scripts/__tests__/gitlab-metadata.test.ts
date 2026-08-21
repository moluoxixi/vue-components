// @vitest-environment node

import type { GitlabMetadataExpectation, GitlabMetadataSnapshot } from '../../.vitepress/gitlab-metadata-types'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGitlabMetadata,
  groupGitlabComponentIssues,
  resolveGitlabNextPage,
} from '../gitlab-metadata.mts'
import {
  formatGitlabSyncError,
  syncGitlabMetadata,
  writeGitlabMetadataAtomically,
} from '../sync-gitlab-metadata.mts'

const temporaryDirectories: string[] = []
const headSha = 'a'.repeat(40)
const aliceContributorId = 'gitlab:198824072b3907f74c7cf2250bf3e2fc74f0295bdbb4de5537aef58cabe31e20'

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

function gitlabOptions(fetchImpl: typeof fetch) {
  return {
    apiBaseUrl: 'https://gitlab.test/api/v4',
    authentication: 'private-token' as const,
    components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
    contributorProfiles: { [aliceContributorId]: 'alice' },
    defaultBranch: 'main',
    fetchImpl,
    generatedAt: '2026-08-19T00:00:00.000Z',
    issueTitlePrefix: (name: string) => `[${name}]`,
    projectPath: 'group/subgroup/project',
    repositoryUrl: 'https://gitlab.test/group/subgroup/project',
    token: 'gitlab-secret-token',
    userAgent: 'gitlab-metadata-test',
    webBaseUrl: 'https://gitlab.test',
  }
}

function contributorFixtureFetch(
  userResponse: unknown | Response,
  repositoryUrl = 'https://gitlab.test/group/subgroup/project',
): { fetchImpl: typeof fetch, requests: string[] } {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith('/projects/group%2Fsubgroup%2Fproject')) {
      return jsonResponse({
        default_branch: 'main',
        issues_enabled: false,
        path_with_namespace: 'group/subgroup/project',
        web_url: repositoryUrl,
      })
    }
    if (url.endsWith('/repository/branches/main'))
      return jsonResponse({ commit: { id: headSha } })
    if (url.includes('/repository/commits?')) {
      return jsonResponse([{
        author_email: 'alice@example.test',
        author_name: 'Alice Example',
        authored_date: '2026-08-18T00:00:00.000Z',
        id: '1'.repeat(40),
        message: 'feat: add copy',
        short_id: '1'.repeat(8),
        title: 'feat: add copy',
        web_url: `${repositoryUrl}/-/commit/${'1'.repeat(40)}`,
      }])
    }
    if (url.includes('/users?username=alice'))
      return userResponse instanceof Response ? userResponse : jsonResponse(userResponse)
    throw new Error(`Unexpected GitLab request: ${url}`)
  }
  return { fetchImpl, requests }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('gitLab documentation metadata', () => {
  it('uses subgroup-safe API paths, token headers, both pagination forms, and email-free contributors', async () => {
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      requests.push(url)
      const headers = new Headers(init?.headers)
      expect(headers.get('private-token')).toBe('gitlab-secret-token')
      expect(headers.get('user-agent')).toBe('gitlab-metadata-test')

      if (url.endsWith('/projects/group%2Fsubgroup%2Fproject')) {
        return jsonResponse({
          default_branch: 'main',
          path_with_namespace: 'group/subgroup/project',
          web_url: 'https://gitlab.test/group/subgroup/project',
        })
      }
      if (url.endsWith('/repository/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/issues?') && !url.includes('page=2')) {
        return jsonResponse([
          { iid: 1, title: '[CopyText] first', web_url: 'https://gitlab.test/group/subgroup/project/-/work_items/1' },
          { iid: 2, title: '[Other] ignored', web_url: 'https://gitlab.test/group/subgroup/project/-/issues/2' },
        ], { headers: { 'x-next-page': '2' } })
      }
      if (url.includes('/issues?') && url.includes('page=2')) {
        return jsonResponse([
          { iid: 3, title: '[CopyText] second', web_url: 'https://gitlab.test/group/subgroup/project/-/issues/3' },
        ])
      }
      if (url.includes('/repository/commits?') && !url.includes('page=2')) {
        return jsonResponse([{
          author_email: 'alice@example.test',
          author_name: 'Alice Example',
          authored_date: '2026-08-18T00:00:00.000Z',
          id: '1'.repeat(40),
          message: 'feat: add copy\n\nbody',
          short_id: '1'.repeat(8),
          title: 'feat: add copy',
          web_url: `https://gitlab.test/group/subgroup/project/-/commit/${'1'.repeat(40)}`,
        }], {
          headers: {
            link: `<https://gitlab.test/api/v4/projects/group%2Fsubgroup%2Fproject/repository/commits?page=2>; rel="next"`,
          },
        })
      }
      if (url.includes('/repository/commits?page=2')) {
        return jsonResponse([{
          author_email: 'alice@example.test',
          author_name: 'Alice Example',
          authored_date: '2026-08-17T00:00:00.000Z',
          id: '2'.repeat(40),
          message: 'fix: copy state',
          short_id: '2'.repeat(8),
          title: 'fix: copy state',
          web_url: `https://gitlab.test/group/subgroup/project/-/commit/${'2'.repeat(40)}`,
        }])
      }
      if (url.includes('/users?username=alice')) {
        return jsonResponse([{
          avatar_url: 'https://gitlab.test/uploads/alice.png',
          name: 'Alice Account',
          username: 'alice',
          web_url: 'https://gitlab.test/alice',
        }])
      }
      throw new Error(`Unexpected GitLab request: ${url}`)
    }

    const snapshot = await createGitlabMetadata(gitlabOptions(fetchImpl))

    expect(requests[0]).toBe('https://gitlab.test/api/v4/projects/group%2Fsubgroup%2Fproject')
    expect(requests.some(url => url.includes(`ref_name=${headSha}`))).toBe(true)
    expect(requests.some(url => url.includes('path=packages%2Fcomponents%2Fsrc%2FCopyText'))).toBe(true)
    expect(snapshot.repository).toMatchObject({ headSha, issuesEnabled: true })
    expect(snapshot.components.CopyText?.openIssueCount).toBe(2)
    expect(snapshot.components.CopyText?.openIssues?.[0]?.url).toBe(
      'https://gitlab.test/group/subgroup/project/-/work_items/1',
    )
    expect(snapshot.components.CopyText?.commits).toHaveLength(2)
    expect(snapshot.components.CopyText?.contributors).toEqual([{
      avatarUrl: 'https://gitlab.test/uploads/alice.png',
      contributions: 2,
      id: aliceContributorId,
      login: 'alice',
      name: 'Alice Account',
      profileUrl: 'https://gitlab.test/alice',
    }])
    expect(snapshot.components.CopyText?.commits.every(commit => (
      commit.author.login === 'alice'
      && commit.author.profileUrl === 'https://gitlab.test/alice'
    ))).toBe(true)
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('gitlab-secret-token')
  })

  it('enriches only an explicitly mapped contributor through one exact username lookup', async () => {
    const { fetchImpl, requests } = contributorFixtureFetch([{
      avatar_url: 'https://gitlab.test/uploads/alice.png',
      name: 'Alice Account',
      username: 'alice',
      web_url: 'https://gitlab.test/alice',
    }])

    const snapshot = await createGitlabMetadata({
      ...gitlabOptions(fetchImpl),
      contributorProfiles: { [aliceContributorId]: 'alice' },
    })

    expect(snapshot.components.CopyText?.contributors).toEqual([{
      avatarUrl: 'https://gitlab.test/uploads/alice.png',
      contributions: 1,
      id: aliceContributorId,
      login: 'alice',
      name: 'Alice Account',
      profileUrl: 'https://gitlab.test/alice',
    }])
    expect(snapshot.components.CopyText?.commits[0]?.author).toEqual({
      avatarUrl: 'https://gitlab.test/uploads/alice.png',
      login: 'alice',
      name: 'Alice Account',
      profileUrl: 'https://gitlab.test/alice',
    })
    expect(requests.filter(url => url.includes('/users?username=alice'))).toHaveLength(1)
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
  })

  it.each([
    ['missing account', []],
    ['ambiguous account', [
      { avatar_url: 'https://gitlab.test/uploads/alice-1.png', name: 'Alice One', username: 'alice', web_url: 'https://gitlab.test/alice' },
      { avatar_url: 'https://gitlab.test/uploads/alice-2.png', name: 'Alice Two', username: 'alice', web_url: 'https://gitlab.test/alice' },
    ]],
    ['mismatched username', [
      { avatar_url: 'https://gitlab.test/uploads/alice.png', name: 'Alice', username: 'other', web_url: 'https://gitlab.test/other' },
    ]],
    ['cross-origin avatar', [
      { avatar_url: 'https://avatars.example.test/alice.png', name: 'Alice', username: 'alice', web_url: 'https://gitlab.test/alice' },
    ]],
    ['credential-bearing avatar URL', [
      { avatar_url: 'https://gitlab.test/uploads/alice.png?private_token=secret', name: 'Alice', username: 'alice', web_url: 'https://gitlab.test/alice' },
    ]],
    ['cross-origin profile', [
      { avatar_url: 'https://gitlab.test/uploads/alice.png', name: 'Alice', username: 'alice', web_url: 'https://example.test/alice' },
    ]],
  ])('rejects synchronization for a %s', async (_label, userResponse) => {
    const { fetchImpl } = contributorFixtureFetch(userResponse)
    await expect(createGitlabMetadata(gitlabOptions(fetchImpl))).rejects.toThrow()
  })

  it('rejects unavailable contributor lookup instead of downgrading it', async () => {
    const { fetchImpl } = contributorFixtureFetch(jsonResponse({}, { status: 403 }))
    await expect(createGitlabMetadata(gitlabOptions(fetchImpl)))
      .rejects
      .toThrow('GitLab request failed (403)')
  })

  it('rejects commits without an explicit reviewed identity mapping', async () => {
    const fixture = contributorFixtureFetch([])
    await expect(createGitlabMetadata({
      ...gitlabOptions(fixture.fetchImpl),
      contributorProfiles: {},
    })).rejects.toThrow(`GitLab contributor profile mapping is required for ${aliceContributorId}`)
  })

  it('rejects two opaque commit identities mapped to one GitLab account', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(createGitlabMetadata({
      ...gitlabOptions(fetchImpl),
      contributorProfiles: {
        [aliceContributorId]: 'alice',
        [`gitlab:${'b'.repeat(64)}`]: 'alice',
      },
    })).rejects.toThrow('GitLab contributor profile username alice is mapped from multiple identities')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([401, 403])('fails project synchronization on HTTP %s instead of downgrading it', async (status) => {
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      requests.push(String(input))
      return jsonResponse({}, { status })
    }

    await expect(createGitlabMetadata(gitlabOptions(fetchImpl))).rejects.toThrow(`GitLab request failed (${status})`)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain('/projects/group%2Fsubgroup%2Fproject')
  })

  it('rejects a web base URL that does not match the configured project origin and path', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({}))

    await expect(createGitlabMetadata({
      ...gitlabOptions(fetchImpl),
      webBaseUrl: 'https://other-gitlab.test',
    })).rejects.toThrow('GitLab web base URL mismatch')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('supports a private self-managed instance under a relative path with Bearer authentication', async () => {
    const repositoryUrl = 'https://gitlab.test/gitlab/group/subgroup/project'
    const fixture = contributorFixtureFetch([{
      avatar_url: 'https://gitlab.test/gitlab/uploads/alice.png',
      name: 'Alice Account',
      username: 'alice',
      web_url: 'https://gitlab.test/gitlab/alice',
    }], repositoryUrl)
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer gitlab-secret-token')
      return fixture.fetchImpl(input, init)
    }

    const snapshot = await createGitlabMetadata({
      ...gitlabOptions(fetchImpl),
      apiBaseUrl: 'https://gitlab.test/gitlab/api/v4',
      authentication: 'bearer',
      contributorProfiles: { [aliceContributorId]: 'alice' },
      repositoryUrl,
      webBaseUrl: 'https://gitlab.test/gitlab',
    })

    expect(fixture.requests.every(url => url.startsWith('https://gitlab.test/gitlab/api/v4/'))).toBe(true)
    expect(snapshot.repository.webUrl).toBe(repositoryUrl)
    expect(snapshot.components.CopyText?.contributors[0]?.profileUrl).toBe('https://gitlab.test/gitlab/alice')
  })

  it('treats an Issues API 404 as synchronization failure instead of unsupported capability', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/projects/group%2Fsubgroup%2Fproject')) {
        return jsonResponse({
          default_branch: 'main',
          path_with_namespace: 'group/subgroup/project',
          web_url: 'https://gitlab.test/group/subgroup/project',
        })
      }
      if (url.endsWith('/repository/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/issues?'))
        return jsonResponse({}, { status: 404 })
      if (url.includes('/repository/commits?'))
        return jsonResponse([])
      if (url.includes('/repository/contributors?'))
        return jsonResponse([])
      throw new Error(`Unexpected GitLab request: ${url}`)
    }

    await expect(createGitlabMetadata(gitlabOptions(fetchImpl)))
      .rejects
      .toThrow('GitLab request failed (404)')
  })

  it('retries 429 and 5xx responses with bounded Retry-After handling', async () => {
    const sleep = vi.fn(async () => {})
    let projectAttempts = 0
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/projects/group%2Fsubgroup%2Fproject')) {
        projectAttempts += 1
        if (projectAttempts === 1)
          return jsonResponse({}, { status: 429, headers: { 'retry-after': '0.01' } })
        if (projectAttempts === 2)
          return jsonResponse({}, { status: 503 })
        return jsonResponse({
          default_branch: 'main',
          issues_enabled: false,
          path_with_namespace: 'group/subgroup/project',
          web_url: 'https://gitlab.test/group/subgroup/project',
        })
      }
      if (url.endsWith('/repository/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/repository/commits?'))
        return jsonResponse([])
      if (url.includes('/repository/contributors?'))
        return jsonResponse([])
      throw new Error(`Unexpected GitLab request: ${url}`)
    }

    await createGitlabMetadata({ ...gitlabOptions(fetchImpl), sleep })

    expect(projectAttempts).toBe(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 10)
    expect(sleep).toHaveBeenNthCalledWith(2, 1000)
  })

  it('retries network failures with a bounded exponential delay', async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('socket reset')
    })

    await expect(createGitlabMetadata({ ...gitlabOptions(fetchImpl), sleep }))
      .rejects
      .toThrow('GitLab network request failed')

    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls).toEqual([[500], [1000], [2000]])
  })

  it('rejects repeated pagination pages before requesting them again', async () => {
    let commitRequests = 0
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/projects/group%2Fsubgroup%2Fproject')) {
        return jsonResponse({
          default_branch: 'main',
          issues_enabled: false,
          path_with_namespace: 'group/subgroup/project',
          web_url: 'https://gitlab.test/group/subgroup/project',
        })
      }
      if (url.endsWith('/repository/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/repository/commits?')) {
        commitRequests += 1
        return jsonResponse([], { headers: { 'x-next-page': '1' } })
      }
      if (url.includes('/repository/contributors?'))
        return jsonResponse([])
      throw new Error(`Unexpected GitLab request: ${url}`)
    }

    await expect(createGitlabMetadata(gitlabOptions(fetchImpl)))
      .rejects
      .toThrow('GitLab pagination returned a repeated next page')
    expect(commitRequests).toBe(2)
  })

  it('groups only exact component issue prefixes and resolves pagination headers', () => {
    expect(groupGitlabComponentIssues([
      { iid: 1, title: '[CopyText] match', web_url: 'https://example.test/1' },
      { iid: 2, title: '[Copy] ignored', web_url: 'https://example.test/2' },
    ], [{ name: 'CopyText', path: 'src/CopyText' }], name => `[${name}]`)).toEqual({
      CopyText: [{ iid: 1, title: '[CopyText] match', url: 'https://example.test/1' }],
    })

    const currentUrl = 'https://gitlab.test/api/v4/items?page=1'
    expect(resolveGitlabNextPage(jsonResponse([], { headers: { 'x-next-page': '2' } }), currentUrl))
      .toBe('https://gitlab.test/api/v4/items?page=2')
    expect(resolveGitlabNextPage(jsonResponse([], {
      headers: { link: '<https://gitlab.test/api/v4/items?page=3>; rel="next"' },
    }), currentUrl)).toBe('https://gitlab.test/api/v4/items?page=3')
  })

  it('redacts tokens and preserves the previous snapshot when collection, validation, or atomic replacement fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'moluoxixi-gitlab-metadata-'))
    temporaryDirectories.push(directory)
    const outputPath = join(directory, 'gitlab-metadata.json')
    writeFileSync(outputPath, '{"preserved":true}\n', 'utf8')
    const snapshot = { repository: { headSha } } as GitlabMetadataSnapshot

    expect(() => writeGitlabMetadataAtomically(snapshot, outputPath, {
      writeFileSync,
      renameSync: () => {
        throw new Error('rename failed')
      },
      rmSync,
    })).toThrow('rename failed')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(readdirSync(directory)).toEqual(['gitlab-metadata.json'])

    const expectation: GitlabMetadataExpectation = {
      components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
      defaultBranch: 'main',
      projectPath: 'group/subgroup/project',
      repositoryUrl: 'https://gitlab.test/group/subgroup/project',
    }
    await expect(syncGitlabMetadata(
      async () => { throw new Error('simulated GitLab API failure') },
      expectation,
      outputPath,
    )).rejects.toThrow('simulated GitLab API failure')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    await expect(syncGitlabMetadata(
      async () => ({}) as GitlabMetadataSnapshot,
      expectation,
      outputPath,
    )).rejects.toThrow('root contains unsupported or missing fields')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')

    const secret = 'gitlab-secret-token'
    expect(formatGitlabSyncError(new Error(`request failed: ${secret}`), secret)).not.toContain(secret)
    expect(formatGitlabSyncError(new Error(`request failed: ${secret}`), secret)).toContain('[REDACTED]')
  })
})
