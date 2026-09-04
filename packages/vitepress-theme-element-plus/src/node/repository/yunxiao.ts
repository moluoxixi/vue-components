import type {
  YunxiaoApiMode,
  YunxiaoCommit,
  YunxiaoComponentMetadata,
  YunxiaoContributor,
  YunxiaoMetadataExpectation,
  YunxiaoMetadataSnapshot,
} from '../../content/repository/providers'
import type { AtomicFileSystem } from '../utils'
import { createHash } from 'node:crypto'
import { assertYunxiaoMetadataSnapshot, isTrustedYunxiaoAvatarUrl } from '../../content/repository/providers'
import { writeJsonAtomically } from '../utils'
import { resolveTrustedApiUrl } from './api-client'
import { collectValidateAndWrite, formatRepositorySyncError } from './sync'

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

interface YunxiaoMemberResponse {
  avatarUrl?: string | null
  id?: number | string | null
  name?: string | null
  state?: string | null
  userId?: string | null
  username?: string | null
}

interface YunxiaoContributorProfile {
  avatarUrl: string
  login: string
  name: string
}

export interface YunxiaoComponentSource {
  name: string
  path: string
}

export interface CreateYunxiaoMetadataOptions {
  apiBaseUrl: string
  apiMode: YunxiaoApiMode
  components: YunxiaoComponentSource[]
  contributorAccounts?: Readonly<Record<string, string>>
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

function contributorId(login: string): string {
  return `yunxiao:${createHash('sha256').update(login).digest('hex')}`
}

function contributorIdentityId(commit: YunxiaoCommitResponse, sha: string): string {
  const email = commit.authorEmail?.trim().toLocaleLowerCase()
  const name = commit.authorName?.trim().toLocaleLowerCase()
  if (!email || !name)
    throw new TypeError(`Yunxiao commit ${sha} has no complete Codeup commit identity`)

  return `yunxiao:${createHash('sha256').update(`${name}\0${email}`).digest('hex')}`
}

function validateContributorAccountMappings(
  accounts: Readonly<Record<string, string>> | undefined,
): ReadonlyMap<string, string> {
  const normalized = new Map<string, string>()
  for (const [id, configuredUsername] of Object.entries(accounts ?? {})) {
    const username = configuredUsername.trim()
    if (!/^yunxiao:[a-f0-9]{64}$/.test(id) || !username || username !== configuredUsername)
      throw new TypeError(`Invalid Yunxiao contributor account mapping for ${id}`)
    normalized.set(id, username)
  }
  return normalized
}

function normalizeContributorProfile(
  value: YunxiaoMemberResponse,
  username: string,
): YunxiaoContributorProfile {
  const avatarUrl = value.avatarUrl?.trim()
  const id = String(value.id ?? '').trim()
  const login = value.username?.trim()
  const name = value.name?.trim()
  const userId = value.userId?.trim()
  if (!avatarUrl || !id || login !== username || !name || value.state !== 'active' || !userId)
    throw new TypeError(`Yunxiao Codeup member profile is invalid for ${username}`)

  if (!isTrustedYunxiaoAvatarUrl(avatarUrl))
    throw new TypeError(`Yunxiao Codeup member profile has an untrusted avatar URL for ${username}`)
  return { avatarUrl, login, name }
}

async function resolveContributorProfiles(
  client: YunxiaoClient,
  repositoryPath: string,
  accountMappings: ReadonlyMap<string, string>,
  contributorIdentityIds: ReadonlySet<string>,
): Promise<ReadonlyMap<string, YunxiaoContributorProfile>> {
  if (contributorIdentityIds.size === 0)
    return new Map()

  for (const id of contributorIdentityIds) {
    if (!accountMappings.has(id))
      throw new TypeError(`Yunxiao contributor account mapping is required for ${id}`)
  }

  const query = new URLSearchParams({ page: '1', perPage: '100' })
  const members = await client.paginate<YunxiaoMemberResponse>(`${repositoryPath}/members?${query}`)
  const relevantMappings = [...accountMappings].filter(([id]) => contributorIdentityIds.has(id))
  const profilesByUsername = new Map<string, YunxiaoContributorProfile>()
  for (const username of new Set(relevantMappings.map(([, login]) => login))) {
    const matches = members.filter(member => member.username?.trim() === username)
    if (matches.length !== 1)
      throw new TypeError(`Yunxiao Codeup member lookup must return exactly one profile for ${username}`)
    profilesByUsername.set(username, normalizeContributorProfile(matches[0]!, username))
  }

  return new Map(relevantMappings.map(([id, username]) => {
    const profile = profilesByUsername.get(username)
    if (!profile)
      throw new TypeError(`Yunxiao Codeup member profile is missing for ${id}`)
    return [id, profile] as const
  }))
}

function createComponentMetadata(
  source: YunxiaoComponentSource,
  rawCommits: YunxiaoCommitResponse[],
  profilesByIdentity: ReadonlyMap<string, YunxiaoContributorProfile>,
  profilesByLogin: Map<string, YunxiaoContributorProfile>,
): YunxiaoComponentMetadata {
  const contributorCounts = new Map<string, YunxiaoContributor>()
  const commits: YunxiaoCommit[] = rawCommits.map((rawCommit) => {
    const sha = commitSha(rawCommit)
    const identityId = contributorIdentityId(rawCommit, sha)
    const profile = profilesByIdentity.get(identityId)
    if (!profile)
      throw new TypeError(`Yunxiao commit ${sha} has no verified Codeup member profile`)
    const id = contributorId(profile.login)
    const existingProfile = profilesByLogin.get(profile.login)
    if (existingProfile
      && (existingProfile.avatarUrl !== profile.avatarUrl
        || existingProfile.name !== profile.name)) {
      throw new TypeError(`Yunxiao account profile changed within snapshot for ${profile.login}`)
    }
    profilesByLogin.set(profile.login, profile)
    const existing = contributorCounts.get(id)
    if (existing
      && (existing.avatarUrl !== profile.avatarUrl
        || existing.login !== profile.login
        || existing.name !== profile.name)) {
      throw new TypeError(`Yunxiao account profile changed within snapshot for ${profile.login}`)
    }
    contributorCounts.set(id, {
      ...profile,
      contributions: (existing?.contributions ?? 0) + 1,
      id,
    })
    const date = rawCommit.authoredDate ?? rawCommit.committedDate
    if (!date || Number.isNaN(Date.parse(date)))
      throw new TypeError(`Yunxiao commit ${sha} is missing a valid date`)
    return {
      author: { ...profile },
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
  const accountMappings = validateContributorAccountMappings(options.contributorAccounts)
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
  const componentCommits = await Promise.all(options.components.map(async (component) => {
    const query = new URLSearchParams({
      page: '1',
      path: component.path,
      perPage: '100',
      refName: headSha,
    })
    const commits = await client.paginate<YunxiaoCommitResponse>(`${repositoryPath}/commits?${query}`)
    return { commits, component }
  }))
  const contributorIdentityIds = new Set(componentCommits.flatMap(({ commits }) => (
    commits.map(commit => contributorIdentityId(commit, commitSha(commit)))
  )))
  const profilesByIdentity = await resolveContributorProfiles(
    client,
    repositoryPath,
    accountMappings,
    contributorIdentityIds,
  )
  const profilesByLogin = new Map<string, YunxiaoContributorProfile>()
  const components = Object.fromEntries(componentCommits.map(({ commits, component }) => [
    component.name,
    createComponentMetadata(component, commits, profilesByIdentity, profilesByLogin),
  ]))

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

export function writeYunxiaoMetadataAtomically(
  snapshot: YunxiaoMetadataSnapshot,
  outputPath: string,
  fileSystem?: AtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, outputPath, fileSystem)
}

export function syncYunxiaoMetadata(
  collectSnapshot: () => Promise<YunxiaoMetadataSnapshot>,
  expectation: YunxiaoMetadataExpectation,
  outputPath: string,
): Promise<YunxiaoMetadataSnapshot> {
  return collectValidateAndWrite({
    assertSnapshot: snapshot => assertYunxiaoMetadataSnapshot(snapshot, expectation),
    collectSnapshot,
    outputPath,
  })
}

export function formatYunxiaoSyncError(error: unknown, token?: string): string {
  return formatRepositorySyncError(error, token)
}
