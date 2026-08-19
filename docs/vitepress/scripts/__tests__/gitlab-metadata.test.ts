// @vitest-environment node

import type { GitlabMetadataSnapshot } from '../../.vitepress/gitlab-metadata-types'
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
  writeGitlabMetadataAtomically,
} from '../sync-gitlab-metadata.mts'

const temporaryDirectories: string[] = []
const headSha = 'a'.repeat(40)

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
    components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
    defaultBranch: 'main',
    fetchImpl,
    generatedAt: '2026-08-19T00:00:00.000Z',
    issueTitlePrefix: (name: string) => `[${name}]`,
    projectPath: 'group/subgroup/project',
    repositoryUrl: 'https://gitlab.test/group/subgroup/project',
    token: 'gitlab-secret-token',
    userAgent: 'gitlab-metadata-test',
  }
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
      contributions: 2,
      id: expect.stringMatching(/^gitlab:[a-f0-9]{64}$/),
      name: 'Alice Example',
    }])
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('gitlab-secret-token')
  })

  it('detects disabled Issues from a 404 probe and omits issue data', async () => {
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
      throw new Error(`Unexpected GitLab request: ${url}`)
    }

    const snapshot = await createGitlabMetadata(gitlabOptions(fetchImpl))

    expect(snapshot.repository.issuesEnabled).toBe(false)
    expect(snapshot.components.CopyText).not.toHaveProperty('openIssueCount')
    expect(snapshot.components.CopyText).not.toHaveProperty('openIssues')
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

  it('redacts tokens and preserves the previous snapshot when atomic replacement fails', () => {
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

    const secret = 'gitlab-secret-token'
    expect(formatGitlabSyncError(new Error(`request failed: ${secret}`), secret)).not.toContain(secret)
    expect(formatGitlabSyncError(new Error(`request failed: ${secret}`), secret)).toContain('[REDACTED]')
  })
})
