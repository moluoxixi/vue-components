// @vitest-environment node

import type { YunxiaoMetadataExpectation, YunxiaoMetadataSnapshot } from '../../.vitepress/repository/providers/yunxiao'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatYunxiaoSyncError,
  syncYunxiaoMetadata,
  writeYunxiaoMetadataAtomically,
} from '../sync-yunxiao-metadata.mts'
import {
  createYunxiaoMetadata,
  resolveYunxiaoNextPage,
  yunxiaoRepositoryApiPath,
} from '../yunxiao-metadata.mts'

const temporaryDirectories: string[] = []
const headSha = 'a'.repeat(40)
const aliceAvatarUrl = 'https://tcs-devops.aliyuncs.com/thumbnail/alice/w/200/h/200'

function contributorIdentityId(name: string, email: string): string {
  const identity = `${name.trim().toLocaleLowerCase()}\0${email.trim().toLocaleLowerCase()}`
  return `yunxiao:${createHash('sha256').update(identity).digest('hex')}`
}

const aliceIdentityId = contributorIdentityId('Alice Example', 'alice@example.test')

function contributorId(login: string): string {
  return `yunxiao:${createHash('sha256').update(login).digest('hex')}`
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

function options(fetchImpl: typeof fetch) {
  return {
    apiBaseUrl: 'https://openapi-rdc.test',
    apiMode: 'central' as const,
    components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
    contributorAccounts: { [aliceIdentityId]: 'alice' },
    defaultBranch: 'main',
    fetchImpl,
    generatedAt: '2026-08-19T00:00:00.000Z',
    organizationId: 'organization-1',
    repositoryId: '1001',
    repositoryPath: 'group/project',
    repositoryUrl: 'https://codeup.test/group/project',
    token: 'yunxiao-secret-token',
    userAgent: 'yunxiao-metadata-test',
  }
}

function memberFixtureFetch(
  memberResponse: unknown | Response,
): { fetchImpl: typeof fetch, requests: string[] } {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    if (url.endsWith('/organizations/organization-1/repositories/1001')) {
      return jsonResponse({
        defaultBranch: 'main',
        id: 1001,
        pathWithNamespace: 'group/project',
        webUrl: 'https://codeup.test/group/project',
      })
    }
    if (url.endsWith('/branches/main'))
      return jsonResponse({ commit: { id: headSha } })
    if (url.includes('/commits?')) {
      return jsonResponse([{
        authorEmail: 'alice@example.test',
        authorName: 'Alice Example',
        authoredDate: '2026-08-18T00:00:00.000Z',
        id: '3'.repeat(40),
        title: 'feat: strict member profile',
        webUrl: `https://codeup.test/group/project/commit/${'3'.repeat(40)}`,
      }])
    }
    if (url.includes('/members?'))
      return memberResponse instanceof Response ? memberResponse : jsonResponse(memberResponse)
    throw new Error(`Unexpected Yunxiao request: ${url}`)
  }
  return { fetchImpl, requests }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('yunxiao Codeup documentation metadata', () => {
  it('builds distinct central and region repository API paths', () => {
    expect(yunxiaoRepositoryApiPath('central', 'org/one', 'group/project')).toBe(
      '/oapi/v1/codeup/organizations/org%2Fone/repositories/group%2Fproject',
    )
    expect(yunxiaoRepositoryApiPath('region', 'ignored', 'group/project')).toBe(
      '/oapi/v1/codeup/repositories/group%2Fproject',
    )
  })

  it('resolves a reviewed commit identity through the Codeup members API without persisting email', async () => {
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      requests.push(url)
      const headers = new Headers(init?.headers)
      expect(headers.get('x-yunxiao-token')).toBe('yunxiao-secret-token')
      expect(headers.get('user-agent')).toBe('yunxiao-metadata-test')

      if (url.endsWith('/organizations/organization-1/repositories/1001')) {
        return jsonResponse({
          defaultBranch: 'main',
          id: 1001,
          pathWithNamespace: 'group/project',
          webUrl: 'https://codeup.test/group/project',
        })
      }
      if (url.endsWith('/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/commits?') && !url.includes('page=2')) {
        return jsonResponse([{
          authorEmail: 'alice@example.test',
          authorName: 'Alice Example',
          authoredDate: '2026-08-18T00:00:00.000Z',
          id: '1'.repeat(40),
          title: 'feat: add copy',
          webUrl: `https://codeup.test/group/project/commit/${'1'.repeat(40)}`,
        }], { headers: { 'x-next-page': '2' } })
      }
      if (url.includes('/commits?') && url.includes('page=2')) {
        return jsonResponse([{
          authorEmail: 'alice@example.test',
          authorName: 'Alice Example',
          committedDate: '2026-08-17T00:00:00.000Z',
          message: 'fix: copy state',
          sha: '2'.repeat(40),
          webUrl: `https://codeup.test/group/project/commit/${'2'.repeat(40)}`,
        }])
      }
      if (url.includes('/members?') && url.includes('page=2')) {
        return jsonResponse([{
          avatarUrl: aliceAvatarUrl,
          id: 101,
          name: 'Alice Example',
          state: 'active',
          userId: 'user-alice',
          username: 'alice',
        }])
      }
      if (url.includes('/members?')) {
        return jsonResponse([{
          avatarUrl: 'https://tcs-devops.aliyuncs.com/thumbnail/bob/w/200/h/200',
          id: 102,
          name: 'Bob Example',
          state: 'active',
          userId: 'user-bob',
          username: 'bob',
        }], { headers: { 'x-next-page': '2' } })
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    const aliceId = contributorId('alice')
    const snapshot = await createYunxiaoMetadata(options(fetchImpl))

    expect(requests.some(url => url.includes(`refName=${headSha}`))).toBe(true)
    expect(requests.some(url => url.includes('path=packages%2Fcomponents%2Fsrc%2FCopyText'))).toBe(true)
    expect(requests.filter(url => url.includes('/members?'))).toEqual([
      'https://openapi-rdc.test/oapi/v1/codeup/organizations/organization-1/repositories/1001/members?page=1&perPage=100',
      'https://openapi-rdc.test/oapi/v1/codeup/organizations/organization-1/repositories/1001/members?page=2&perPage=100',
    ])
    expect(snapshot.components.CopyText?.commits).toHaveLength(2)
    expect(snapshot.components.CopyText?.contributors).toEqual([{
      avatarUrl: aliceAvatarUrl,
      contributions: 2,
      id: aliceId,
      login: 'alice',
      name: 'Alice Example',
    }])
    expect(snapshot.components.CopyText?.commits.map(commit => commit.author)).toEqual([
      {
        avatarUrl: aliceAvatarUrl,
        login: 'alice',
        name: 'Alice Example',
      },
      {
        avatarUrl: aliceAvatarUrl,
        login: 'alice',
        name: 'Alice Example',
      },
    ])
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('yunxiao-secret-token')
    expect(snapshot.components.CopyText).not.toHaveProperty('openIssueCount')
  })

  it('reuses one verified Codeup member profile across components', async () => {
    let memberRequests = 0
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/organizations/organization-1/repositories/1001')) {
        return jsonResponse({
          defaultBranch: 'main',
          id: 1001,
          pathWithNamespace: 'group/project',
          webUrl: 'https://codeup.test/group/project',
        })
      }
      if (url.endsWith('/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/commits?')) {
        const isSecondComponent = url.includes('path=packages%2Fcomponents%2Fsrc%2FSecond')
        const sha = (isSecondComponent ? '2' : '1').repeat(40)
        return jsonResponse([{
          authorEmail: 'alice@example.test',
          authorName: 'Alice Example',
          authoredDate: '2026-08-18T00:00:00.000Z',
          id: sha,
          title: 'feat: strict profile',
          webUrl: `https://codeup.test/group/project/commit/${sha}`,
        }])
      }
      if (url.includes('/members?')) {
        memberRequests += 1
        return jsonResponse([{
          avatarUrl: aliceAvatarUrl,
          id: 101,
          name: 'Alice Current Profile',
          state: 'active',
          userId: 'user-alice',
          username: 'alice',
        }])
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    const snapshot = await createYunxiaoMetadata({
      ...options(fetchImpl),
      components: [
        { name: 'CopyText', path: 'packages/components/src/CopyText' },
        { name: 'Second', path: 'packages/components/src/Second' },
      ],
    })

    expect(memberRequests).toBe(1)
    expect(snapshot.components.CopyText?.contributors[0]?.name).toBe('Alice Current Profile')
    expect(snapshot.components.Second?.commits[0]?.author.name).toBe('Alice Current Profile')
  })

  it('requires a PAT and retries transient API responses', async () => {
    const neverFetch = vi.fn<typeof fetch>()
    await expect(createYunxiaoMetadata({ ...options(neverFetch), token: '' }))
      .rejects
      .toThrow('YUNXIAO_TOKEN is required')
    expect(neverFetch).not.toHaveBeenCalled()

    let attempts = 0
    const sleep = vi.fn(async () => {})
    const fetchImpl: typeof fetch = async () => {
      attempts += 1
      return jsonResponse({}, { status: attempts === 1 ? 429 : 401, headers: { 'retry-after': '0.01' } })
    }
    await expect(createYunxiaoMetadata({ ...options(fetchImpl), sleep })).rejects.not.toThrow('yunxiao-secret-token')
    expect(attempts).toBe(2)
    expect(sleep).toHaveBeenCalledWith(10)
  })

  it('rejects an incomplete commit identity instead of guessing a Codeup account', async () => {
    for (const identity of [
      { authorName: 'Alice Example' },
      { authorEmail: 'alice@example.test' },
    ]) {
      const fetchImpl: typeof fetch = async (input) => {
        const url = String(input)
        if (url.endsWith('/organizations/organization-1/repositories/1001')) {
          return jsonResponse({
            defaultBranch: 'main',
            id: 1001,
            pathWithNamespace: 'group/project',
            webUrl: 'https://codeup.test/group/project',
          })
        }
        if (url.endsWith('/branches/main'))
          return jsonResponse({ commit: { id: headSha } })
        if (url.includes('/commits?')) {
          return jsonResponse([{
            ...identity,
            authoredDate: '2026-08-18T00:00:00.000Z',
            id: '3'.repeat(40),
            title: 'feat: incomplete profile',
            webUrl: `https://codeup.test/group/project/commit/${'3'.repeat(40)}`,
          }])
        }
        throw new Error(`Unexpected Yunxiao request: ${url}`)
      }

      await expect(createYunxiaoMetadata(options(fetchImpl)))
        .rejects
        .toThrow('has no complete Codeup commit identity')
    }
  })

  it('requires an explicit reviewed account mapping before querying Codeup members', async () => {
    const requests: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      requests.push(url)
      if (url.endsWith('/organizations/organization-1/repositories/1001')) {
        return jsonResponse({
          defaultBranch: 'main',
          id: 1001,
          pathWithNamespace: 'group/project',
          webUrl: 'https://codeup.test/group/project',
        })
      }
      if (url.endsWith('/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/commits?')) {
        return jsonResponse([{
          authorEmail: 'alice@example.test',
          authorName: 'Alice Example',
          authoredDate: '2026-08-18T00:00:00.000Z',
          id: '3'.repeat(40),
          title: 'feat: mapped profile',
          webUrl: `https://codeup.test/group/project/commit/${'3'.repeat(40)}`,
        }])
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    await expect(createYunxiaoMetadata({
      ...options(fetchImpl),
      contributorAccounts: {},
    })).rejects.toThrow(`Yunxiao contributor account mapping is required for ${aliceIdentityId}`)
    expect(requests.some(url => url.includes('/members?'))).toBe(false)
  })

  it('rejects invalid account mappings before making API requests', async () => {
    const neverFetch = vi.fn<typeof fetch>()
    await expect(createYunxiaoMetadata({
      ...options(neverFetch),
      contributorAccounts: { invalid: 'alice' },
    })).rejects.toThrow('Invalid Yunxiao contributor account mapping')
    expect(neverFetch).not.toHaveBeenCalled()
  })

  it('rejects avatar URLs outside the Yunxiao provider boundary', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/organizations/organization-1/repositories/1001')) {
        return jsonResponse({
          defaultBranch: 'main',
          id: 1001,
          pathWithNamespace: 'group/project',
          webUrl: 'https://codeup.test/group/project',
        })
      }
      if (url.endsWith('/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/commits?')) {
        return jsonResponse([{
          authorEmail: 'alice@example.test',
          authorName: 'Alice Example',
          authoredDate: '2026-08-18T00:00:00.000Z',
          id: '3'.repeat(40),
          title: 'feat: unsafe avatar',
          webUrl: `https://codeup.test/group/project/commit/${'3'.repeat(40)}`,
        }])
      }
      if (url.includes('/members?')) {
        return jsonResponse([{
          avatarUrl: 'https://attacker.example/avatar.png',
          id: 101,
          name: 'Alice Example',
          state: 'active',
          userId: 'user-alice',
          username: 'alice',
        }])
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    await expect(createYunxiaoMetadata(options(fetchImpl)))
      .rejects
      .toThrow('has an untrusted avatar URL for alice')
  })

  it('rejects zero or ambiguous Codeup member matches for the reviewed username', async () => {
    for (const members of [
      [],
      [
        { avatarUrl: aliceAvatarUrl, id: 101, name: 'Different Account', state: 'active', userId: 'user-other', username: 'other' },
      ],
      [
        { avatarUrl: aliceAvatarUrl, id: 101, name: 'Alice One', state: 'active', userId: 'user-1', username: 'alice' },
        { avatarUrl: aliceAvatarUrl, id: 102, name: 'Alice Two', state: 'active', userId: 'user-2', username: 'alice' },
      ],
    ]) {
      const fetchImpl: typeof fetch = async (input) => {
        const url = String(input)
        if (url.endsWith('/organizations/organization-1/repositories/1001')) {
          return jsonResponse({
            defaultBranch: 'main',
            id: 1001,
            pathWithNamespace: 'group/project',
            webUrl: 'https://codeup.test/group/project',
          })
        }
        if (url.endsWith('/branches/main'))
          return jsonResponse({ commit: { id: headSha } })
        if (url.includes('/commits?')) {
          return jsonResponse([{
            authorEmail: 'alice@example.test',
            authorName: 'Alice Example',
            authoredDate: '2026-08-18T00:00:00.000Z',
            id: '4'.repeat(40),
            title: 'feat: strict member lookup',
            webUrl: `https://codeup.test/group/project/commit/${'4'.repeat(40)}`,
          }])
        }
        if (url.includes('/members?'))
          return jsonResponse(members)
        throw new Error(`Unexpected Yunxiao request: ${url}`)
      }

      await expect(createYunxiaoMetadata(options(fetchImpl)))
        .rejects
        .toThrow('Codeup member lookup must return exactly one profile for alice')
    }
  })

  it('fails synchronization when the Codeup token cannot read repository members', async () => {
    const fixture = memberFixtureFetch(jsonResponse({}, { status: 403 }))

    await expect(createYunxiaoMetadata(options(fixture.fetchImpl)))
      .rejects
      .toThrow('Yunxiao request failed (403)')
    expect(fixture.requests.at(-1)).toBe(
      'https://openapi-rdc.test/oapi/v1/codeup/organizations/organization-1/repositories/1001/members?page=1&perPage=100',
    )
  })

  it.each([
    ['inactive account', { avatarUrl: aliceAvatarUrl, id: 101, name: 'Alice Example', state: 'blocked', userId: 'user-alice', username: 'alice' }],
    ['missing member ID', { avatarUrl: aliceAvatarUrl, name: 'Alice Example', state: 'active', userId: 'user-alice', username: 'alice' }],
    ['missing user ID', { avatarUrl: aliceAvatarUrl, id: 101, name: 'Alice Example', state: 'active', username: 'alice' }],
    ['missing avatar', { id: 101, name: 'Alice Example', state: 'active', userId: 'user-alice', username: 'alice' }],
    ['missing name', { avatarUrl: aliceAvatarUrl, id: 101, state: 'active', userId: 'user-alice', username: 'alice' }],
  ])('rejects an invalid Codeup member profile: %s', async (_label, member) => {
    const fixture = memberFixtureFetch([member])

    await expect(createYunxiaoMetadata(options(fixture.fetchImpl)))
      .rejects
      .toThrow('Yunxiao Codeup member profile is invalid for alice')
  })

  it('retries network failures with a bounded exponential delay', async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('socket reset')
    })

    await expect(createYunxiaoMetadata({ ...options(fetchImpl), sleep }))
      .rejects
      .toThrow('Yunxiao network request failed')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls).toEqual([[500], [1000], [2000]])
  })

  it('rejects repeated pagination pages before requesting them again', async () => {
    let commitRequests = 0
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/organizations/organization-1/repositories/1001')) {
        return jsonResponse({
          defaultBranch: 'main',
          id: 1001,
          pathWithNamespace: 'group/project',
          webUrl: 'https://codeup.test/group/project',
        })
      }
      if (url.endsWith('/branches/main'))
        return jsonResponse({ commit: { id: headSha } })
      if (url.includes('/commits?')) {
        commitRequests += 1
        return url.includes('page=2')
          ? jsonResponse([], { headers: { 'x-next-page': '1' } })
          : jsonResponse([], { headers: { 'x-next-page': '2' } })
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    await expect(createYunxiaoMetadata(options(fetchImpl)))
      .rejects
      .toThrow('Yunxiao pagination returned a repeated next page')
    expect(commitRequests).toBe(2)
  })

  it('resolves x-next-page pagination without changing other query parameters', () => {
    expect(resolveYunxiaoNextPage(
      jsonResponse([], { headers: { 'x-next-page': '2' } }),
      'https://openapi-rdc.test/commits?refName=abc&page=1&perPage=100',
    )).toBe('https://openapi-rdc.test/commits?refName=abc&page=2&perPage=100')
    expect(resolveYunxiaoNextPage(
      jsonResponse([], { headers: { 'x-next-page': '1' } }),
      'https://openapi-rdc.test/commits?refName=abc&page=1&perPage=100',
    )).toBeUndefined()
    expect(resolveYunxiaoNextPage(jsonResponse([]), 'https://openapi-rdc.test/commits?page=1')).toBeUndefined()
  })

  it('redacts sync errors and preserves the previous snapshot on collection, validation, or atomic failure', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'moluoxixi-yunxiao-metadata-'))
    temporaryDirectories.push(directory)
    const outputPath = join(directory, 'yunxiao-metadata.json')
    writeFileSync(outputPath, '{"preserved":true}\n', 'utf8')
    const snapshot = { repository: { headSha } } as YunxiaoMetadataSnapshot

    expect(() => writeYunxiaoMetadataAtomically(snapshot, outputPath, {
      writeFileSync,
      renameSync: () => { throw new Error('rename failed') },
      rmSync,
    })).toThrow('rename failed')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(readdirSync(directory)).toEqual(['yunxiao-metadata.json'])

    const expectation: YunxiaoMetadataExpectation = {
      apiMode: 'central',
      components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
      defaultBranch: 'main',
      organizationId: 'organization-1',
      repositoryId: '1001',
      repositoryPath: 'group/project',
      repositoryUrl: 'https://codeup.test/group/project',
    }
    await expect(syncYunxiaoMetadata(
      async () => { throw new Error('simulated Yunxiao API failure') },
      expectation,
      outputPath,
    )).rejects.toThrow('simulated Yunxiao API failure')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    await expect(syncYunxiaoMetadata(
      async () => ({}) as YunxiaoMetadataSnapshot,
      expectation,
      outputPath,
    )).rejects.toThrow('root contains unsupported or missing fields')
    expect(readFileSync(outputPath, 'utf8')).toBe('{"preserved":true}\n')
    expect(formatYunxiaoSyncError(new Error('yunxiao-secret-token'), 'yunxiao-secret-token')).toContain('[REDACTED]')
  })
})
