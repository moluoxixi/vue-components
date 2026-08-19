// @vitest-environment node

import type { YunxiaoMetadataSnapshot } from '../../.vitepress/yunxiao-metadata-types'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatYunxiaoSyncError,
  writeYunxiaoMetadataAtomically,
} from '../sync-yunxiao-metadata.mts'
import {
  createYunxiaoMetadata,
  resolveYunxiaoNextPage,
  yunxiaoRepositoryApiPath,
} from '../yunxiao-metadata.mts'

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
    apiBaseUrl: 'https://openapi-rdc.test',
    apiMode: 'central' as const,
    components: [{ name: 'CopyText', path: 'packages/components/src/CopyText' }],
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

  it('sends the PAT header, pins HEAD, paginates commits, and aggregates contributors without email', async () => {
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
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    const snapshot = await createYunxiaoMetadata(options(fetchImpl))

    expect(requests.some(url => url.includes(`refName=${headSha}`))).toBe(true)
    expect(requests.some(url => url.includes('path=packages%2Fcomponents%2Fsrc%2FCopyText'))).toBe(true)
    expect(snapshot.components.CopyText?.commits).toHaveLength(2)
    expect(snapshot.components.CopyText?.contributors).toEqual([{
      contributions: 2,
      id: expect.stringMatching(/^yunxiao:[a-f0-9]{64}$/),
      name: 'Alice Example',
    }])
    expect(JSON.stringify(snapshot)).not.toContain('alice@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('yunxiao-secret-token')
    expect(snapshot.components.CopyText).not.toHaveProperty('openIssueCount')
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
        return jsonResponse([], { headers: { 'x-next-page': '1' } })
      }
      throw new Error(`Unexpected Yunxiao request: ${url}`)
    }

    await expect(createYunxiaoMetadata(options(fetchImpl)))
      .rejects
      .toThrow('Yunxiao pagination returned a repeated next page')
    expect(commitRequests).toBe(1)
  })

  it('resolves x-next-page pagination without changing other query parameters', () => {
    expect(resolveYunxiaoNextPage(
      jsonResponse([], { headers: { 'x-next-page': '2' } }),
      'https://openapi-rdc.test/commits?refName=abc&page=1&perPage=100',
    )).toBe('https://openapi-rdc.test/commits?refName=abc&page=2&perPage=100')
    expect(resolveYunxiaoNextPage(jsonResponse([]), 'https://openapi-rdc.test/commits?page=1')).toBeUndefined()
  })

  it('redacts sync errors and preserves the previous snapshot on atomic failure', () => {
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
    expect(formatYunxiaoSyncError(new Error('yunxiao-secret-token'), 'yunxiao-secret-token')).toContain('[REDACTED]')
  })
})
