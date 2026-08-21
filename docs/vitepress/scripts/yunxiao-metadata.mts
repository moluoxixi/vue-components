import type {
  YunxiaoApiMode,
  YunxiaoCommit,
  YunxiaoComponentMetadata,
  YunxiaoContributor,
  YunxiaoContributorProfile,
  YunxiaoMetadataSnapshot,
} from '../.vitepress/yunxiao-metadata-types.ts'
import { createHash } from 'node:crypto'
import { resolveTrustedApiUrl } from './repository-api-client.mts'

interface YunxiaoRepositoryResponse {
  defaultBranch: string
  id: number | string
  pathWithNamespace: string
  webUrl: string
}

interface YunxiaoBranchResponse {
  commit?: { id?: string, sha?: string }
  commitId?: string
}

interface YunxiaoCommitResponse {
  author?: {
    avatarUrl?: string | null
    name?: string | null
    username?: string | null
  } | null
  authorEmail?: string | null
  authorName?: string | null
  authoredDate?: string | null
  committedDate?: string | null
  id?: string
  message?: string | null
  sha?: string
  shortId?: string | null
  title?: string | null
  webUrl: string
}

export interface YunxiaoComponentSource {
  name: string
  path: string
}

export interface CreateYunxiaoMetadataOptions {
  apiBaseUrl: string
  apiMode: YunxiaoApiMode
  components: YunxiaoComponentSource[]
  contributorProfiles?: Readonly<Record<string, YunxiaoContributorProfile>>
  defaultBranch: string
  fetchImpl?: typeof fetch
  generatedAt?: string
  organizationId: string
  repositoryId: string
  repositoryPath: string
  repositoryUrl: string
  sleep?: (milliseconds: number) => Promise<void>
  token: string
  userAgent: string
}

const MAX_RETRIES = 3

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || '(no commit message)'
}

export function yunxiaoRepositoryApiPath(
  mode: YunxiaoApiMode,
  organizationId: string,
  repositoryId: string,
): string {
  const encodedRepository = encodeURIComponent(repositoryId)
  return mode === 'central'
    ? `/oapi/v1/codeup/organizations/${encodeURIComponent(organizationId)}/repositories/${encodedRepository}`
    : `/oapi/v1/codeup/repositories/${encodedRepository}`
}

export function resolveYunxiaoNextPage(response: Response, currentUrl: string): string | undefined {
  const nextPage = response.headers.get('x-next-page')?.trim()
  if (!nextPage)
    return undefined
  const url = new URL(currentUrl)
  // Codeup returns the current page number in x-next-page for the final page.
  if (nextPage === (url.searchParams.get('page') ?? '1'))
    return undefined
  url.searchParams.set('page', nextPage)
  return url.toString()
}

class YunxiaoRequestError extends Error {
  readonly status: number

  constructor(status: number, url: string, rateLimit: string) {
    super(`Yunxiao request failed (${status}) for ${url}.${rateLimit}`)
    this.name = 'YunxiaoRequestError'
    this.status = status
  }
}

class YunxiaoClient {
  private readonly apiBaseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>
  private readonly sleep: (milliseconds: number) => Promise<void>

  constructor(options: CreateYunxiaoMetadataOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? defaultSleep
    this.headers = {
      'Accept': 'application/json',
      'User-Agent': options.userAgent,
      'X-Yunxiao-Token': options.token,
    }
  }

  async get<T>(pathOrUrl: string): Promise<{ data: T, response: Response, url: string }> {
    const url = resolveTrustedApiUrl(this.apiBaseUrl, pathOrUrl, 'Yunxiao')
    let attempt = 0
    while (true) {
      let response: Response
      try {
        response = await this.fetchImpl(url, { headers: this.headers })
      }
      catch (error) {
        if (attempt < MAX_RETRIES) {
          attempt += 1
          await this.sleep(500 * 2 ** (attempt - 1))
          continue
        }
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Yunxiao network request failed for ${url}: ${message}`)
      }
      if (response.ok)
        return { data: await response.json() as T, response, url }

      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader)
      const hasRetryAfter = retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < MAX_RETRIES) {
        attempt += 1
        await this.sleep(hasRetryAfter
          ? Math.min((retryAfter ?? 0) * 1000, 30_000)
          : 500 * 2 ** (attempt - 1))
        continue
      }
      const remaining = response.headers.get('x-ratelimit-remaining')
      const reset = response.headers.get('x-ratelimit-reset')
      const rateLimit = remaining === '0' && reset ? ` Yunxiao rate limit resets at ${reset}` : ''
      throw new YunxiaoRequestError(response.status, url, rateLimit)
    }
  }

  async paginate<T>(path: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = path
    const visited = new Set<string>()
    while (next) {
      const pageUrl = resolveTrustedApiUrl(this.apiBaseUrl, next, 'Yunxiao')
      if (visited.has(pageUrl))
        throw new TypeError('Yunxiao pagination returned a repeated next page')
      visited.add(pageUrl)
      const { data, response, url } = await this.get<T[]>(pageUrl)
      if (!Array.isArray(data))
        throw new TypeError(`Yunxiao pagination response is not an array: ${url}`)
      items.push(...data)
      next = resolveYunxiaoNextPage(response, url)
    }
    return items
  }
}

function commitSha(commit: YunxiaoCommitResponse): string {
  const sha = commit.id ?? commit.sha
  if (!sha || !/^[a-f0-9]{40}$/.test(sha))
    throw new TypeError('Yunxiao commit response is missing a full SHA')
  return sha
}

function branchHead(branch: YunxiaoBranchResponse): string {
  const sha = branch.commit?.id ?? branch.commit?.sha ?? branch.commitId
  if (!sha || !/^[a-f0-9]{40}$/.test(sha))
    throw new TypeError('Yunxiao branch response is missing a full HEAD SHA')
  return sha
}

function contributorId(name: string, email: string): string {
  const identity = `${name.trim().toLocaleLowerCase()}\0${email.trim().toLocaleLowerCase()}`
  return `yunxiao:${createHash('sha256').update(identity).digest('hex')}`
}

function normalizeContributorProfile(
  value: { avatarUrl?: string | null, username?: string | null } | undefined | null,
): YunxiaoContributorProfile | undefined {
  const avatarUrl = value?.avatarUrl?.trim()
  const login = value?.username?.trim()
  if (!avatarUrl || !login)
    return undefined

  try {
    const url = new URL(avatarUrl)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:')
      || url.username
      || url.password
      || url.search
      || url.hash) {
      return undefined
    }
  }
  catch {
    return undefined
  }
  return { avatarUrl, login }
}

function validateContributorProfiles(
  profiles: Readonly<Record<string, YunxiaoContributorProfile>> | undefined,
): ReadonlyMap<string, YunxiaoContributorProfile> {
  const normalized = new Map<string, YunxiaoContributorProfile>()
  for (const [id, profile] of Object.entries(profiles ?? {})) {
    if (!/^yunxiao:[a-f0-9]{64}$/.test(id))
      throw new TypeError(`Invalid Yunxiao contributor profile id: ${id}`)
    const validProfile = normalizeContributorProfile({
      avatarUrl: profile.avatarUrl,
      username: profile.login,
    })
    if (!validProfile)
      throw new TypeError(`Invalid Yunxiao contributor profile for ${id}`)
    normalized.set(id, validProfile)
  }
  return normalized
}

function createComponentMetadata(
  source: YunxiaoComponentSource,
  rawCommits: YunxiaoCommitResponse[],
  configuredProfiles: ReadonlyMap<string, YunxiaoContributorProfile>,
): YunxiaoComponentMetadata {
  const contributorCounts = new Map<string, YunxiaoContributor>()
  const commits: YunxiaoCommit[] = rawCommits.map((rawCommit) => {
    const sha = commitSha(rawCommit)
    const name = rawCommit.author?.name?.trim()
      || rawCommit.authorName?.trim()
      || 'Unknown contributor'
    const id = contributorId(name, rawCommit.authorEmail ?? '')
    const existing = contributorCounts.get(id)
    const profile = normalizeContributorProfile(rawCommit.author)
      ?? configuredProfiles.get(id)
      ?? (existing?.avatarUrl && existing.login
        ? { avatarUrl: existing.avatarUrl, login: existing.login }
        : undefined)
    contributorCounts.set(id, {
      ...(profile ?? {}),
      contributions: (existing?.contributions ?? 0) + 1,
      id,
      name,
    })
    const date = rawCommit.authoredDate ?? rawCommit.committedDate
    if (!date || Number.isNaN(Date.parse(date)))
      throw new TypeError(`Yunxiao commit ${sha} is missing a valid date`)
    return {
      author: { ...(profile ?? {}), name },
      date,
      message: firstLine(rawCommit.title || rawCommit.message || ''),
      sha,
      shortSha: sha.slice(0, 7),
      url: rawCommit.webUrl,
    }
  })
  return {
    commits,
    contributors: [...contributorCounts.values()]
      .sort((left, right) => right.contributions - left.contributions || left.name.localeCompare(right.name)),
    path: source.path,
  }
}

export async function createYunxiaoMetadata(
  options: CreateYunxiaoMetadataOptions,
): Promise<YunxiaoMetadataSnapshot> {
  if (!options.token)
    throw new TypeError('YUNXIAO_TOKEN is required to synchronize Codeup metadata')
  const configuredProfiles = validateContributorProfiles(options.contributorProfiles)
  const client = new YunxiaoClient(options)
  const repositoryPath = yunxiaoRepositoryApiPath(options.apiMode, options.organizationId, options.repositoryId)
  const { data: repository } = await client.get<YunxiaoRepositoryResponse>(repositoryPath)
  const configuredUrl = options.repositoryUrl.replace(/\/+$/, '')
  if (String(repository.id) !== options.repositoryId)
    throw new TypeError(`Yunxiao repository ID mismatch: expected ${options.repositoryId}`)
  if (repository.pathWithNamespace !== options.repositoryPath)
    throw new TypeError(`Yunxiao repository path mismatch: expected ${options.repositoryPath}`)
  if (repository.webUrl !== configuredUrl)
    throw new TypeError(`Yunxiao repository web URL mismatch: expected ${configuredUrl}`)
  if (repository.defaultBranch !== options.defaultBranch)
    throw new TypeError(`Yunxiao default branch mismatch: expected ${options.defaultBranch}`)

  const { data: branch } = await client.get<YunxiaoBranchResponse>(
    `${repositoryPath}/branches/${encodeURIComponent(options.defaultBranch)}`,
  )
  const headSha = branchHead(branch)
  const components = Object.fromEntries(await Promise.all(options.components.map(async (component) => {
    const query = new URLSearchParams({
      page: '1',
      path: component.path,
      perPage: '100',
      refName: headSha,
    })
    const commits = await client.paginate<YunxiaoCommitResponse>(`${repositoryPath}/commits?${query}`)
    return [component.name, createComponentMetadata(component, commits, configuredProfiles)] as const
  })))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      apiMode: options.apiMode,
      defaultBranch: options.defaultBranch,
      headSha,
      organizationId: options.organizationId,
      repositoryId: options.repositoryId,
      repositoryPath: options.repositoryPath,
      webUrl: repository.webUrl,
    },
    components,
  }
}
