import type {
  GiteeCommit,
  GiteeComponentMetadata,
  GiteeContributor,
  GiteeIssueSummary,
  GiteeMetadataSnapshot,
} from '../.vitepress/repository/providers/gitee.ts'
import {
  isExactGiteeProfileUrl,
  isTrustedGiteeAvatarUrl,
} from '../.vitepress/repository/providers/gitee.ts'
import { resolveTrustedApiUrl } from './repository-api-client.mts'

interface GiteeAccountResponse {
  id: number
  avatar_url: string
  html_url: string
  login: string
  name?: string | null
}

interface GiteeRepositoryResponse {
  default_branch: string
  full_name: string
  has_issues: boolean
}

interface GiteeBranchResponse {
  commit: { sha: string }
}

interface GiteeIssueResponse {
  html_url: string
  number: string
  title: string
}

interface GiteeCommitResponse {
  author?: GiteeAccountResponse | null
  commit: {
    author?: { date?: string | null, email?: string | null, name?: string | null } | null
    committer?: { date?: string | null, email?: string | null, name?: string | null } | null
    message: string
  }
  html_url: string
  sha: string
}

export interface GiteeComponentSource {
  name: string
  path: string
}

export interface CreateGiteeMetadataOptions {
  apiBaseUrl: string
  components: GiteeComponentSource[]
  defaultBranch: string
  fetchImpl?: typeof fetch
  generatedAt?: string
  issueTitlePrefix: (componentName: string) => string
  owner: string
  repository: string
  repositoryUrl: string
  sleep?: (milliseconds: number) => Promise<void>
  token?: string
  userAgent: string
  webBaseUrl: string
}

const MAX_RETRIES = 3

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || '(no commit message)'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader)
    return undefined
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel=['"]([^'"]+)['"]/)
    if (match?.[2] === 'next')
      return match[1]
  }
  return undefined
}

export function resolveGiteeNextPage(response: Response): string | undefined {
  return nextLink(response.headers.get('link'))
}

function redactGiteeUrl(value: string): string {
  const url = new URL(value)
  if (url.searchParams.has('access_token'))
    url.searchParams.set('access_token', '[REDACTED]')
  return url.toString()
}

class GiteeRequestError extends Error {
  readonly status: number

  constructor(status: number, url: string, rateLimit: string) {
    super(`Gitee request failed (${status}) for ${redactGiteeUrl(url)}.${rateLimit}`)
    this.name = 'GiteeRequestError'
    this.status = status
  }
}

class GiteeClient {
  private readonly apiBaseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly token?: string

  constructor(options: CreateGiteeMetadataOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? defaultSleep
    this.token = options.token
    this.headers = {
      'Accept': 'application/json',
      'User-Agent': options.userAgent,
    }
  }

  async get<T>(pathOrUrl: string): Promise<{ data: T, response: Response, url: string }> {
    const url = new URL(resolveTrustedApiUrl(this.apiBaseUrl, pathOrUrl, 'Gitee'))
    if (this.token && !url.searchParams.has('access_token'))
      url.searchParams.set('access_token', this.token)
    const requestUrl = url.toString()
    let attempt = 0

    while (true) {
      let response: Response
      try {
        response = await this.fetchImpl(requestUrl, { headers: this.headers })
      }
      catch (error) {
        if (attempt < MAX_RETRIES) {
          attempt += 1
          await this.sleep(500 * 2 ** (attempt - 1))
          continue
        }
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Gitee network request failed for ${redactGiteeUrl(requestUrl)}: ${message}`)
      }
      if (response.ok) {
        return { data: await response.json() as T, response, url: requestUrl }
      }

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
      const rateLimit = remaining === '0' && reset ? ` Gitee rate limit resets at ${reset}` : ''
      throw new GiteeRequestError(response.status, requestUrl, rateLimit)
    }
  }

  async paginate<T>(path: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = path
    const visited = new Set<string>()
    while (next) {
      const pageUrl = resolveTrustedApiUrl(this.apiBaseUrl, next, 'Gitee')
      if (visited.has(pageUrl))
        throw new TypeError('Gitee pagination returned a repeated next page')
      visited.add(pageUrl)
      const { data, response, url } = await this.get<T[]>(pageUrl)
      if (!Array.isArray(data))
        throw new TypeError(`Gitee pagination response is not an array: ${redactGiteeUrl(url)}`)
      items.push(...data)
      next = resolveGiteeNextPage(response)
    }
    return items
  }
}

export function groupGiteeComponentIssues(
  issues: GiteeIssueResponse[],
  components: GiteeComponentSource[],
  issueTitlePrefix: (componentName: string) => string,
): Record<string, GiteeIssueSummary[]> {
  const result = Object.fromEntries(components.map(component => [component.name, []])) as Record<string, GiteeIssueSummary[]>
  const prefixes = components
    .map(component => ({ name: component.name, prefix: issueTitlePrefix(component.name) }))
    .sort((left, right) => right.prefix.length - left.prefix.length)
  for (const issue of issues) {
    const match = prefixes.find(candidate => issue.title.trimStart().startsWith(candidate.prefix))
    if (match)
      result[match.name]?.push({ number: issue.number, title: issue.title, url: issue.html_url })
  }
  return result
}

function commitAccount(value: unknown, sha: string): Pick<GiteeAccountResponse, 'id' | 'login'> {
  if (!isRecord(value)
    || !Number.isInteger(value.id)
    || Number(value.id) <= 0
    || typeof value.login !== 'string'
    || !value.login.trim()) {
    throw new TypeError(`Gitee commit ${sha} has no associated Gitee account`)
  }
  return { id: Number(value.id), login: value.login }
}

function verifiedAccount(
  value: unknown,
  expected: Pick<GiteeAccountResponse, 'id' | 'login'>,
  webBaseUrl: string,
): Omit<GiteeContributor, 'contributions'> {
  if (!isRecord(value)
    || value.id !== expected.id
    || value.login !== expected.login
    || typeof value.name !== 'string'
    || !value.name.trim()
    || typeof value.avatar_url !== 'string'
    || typeof value.html_url !== 'string') {
    throw new TypeError(`Gitee user profile mismatch for ${expected.login}`)
  }
  if (!isTrustedGiteeAvatarUrl(value.avatar_url, webBaseUrl))
    throw new TypeError(`Gitee user profile has an untrusted avatar for ${expected.login}`)
  if (!isExactGiteeProfileUrl(value.html_url, webBaseUrl, expected.login))
    throw new TypeError(`Gitee user profile URL mismatch for ${expected.login}`)
  return {
    avatarUrl: value.avatar_url,
    id: `gitee:${expected.id}`,
    login: expected.login,
    name: value.name.trim(),
    profileUrl: value.html_url,
  }
}

function createComponentMetadata(
  source: GiteeComponentSource,
  rawCommits: GiteeCommitResponse[],
  issuesEnabled: boolean,
  issues: GiteeIssueSummary[],
  profiles: ReadonlyMap<number, Omit<GiteeContributor, 'contributions'>>,
): GiteeComponentMetadata {
  const contributionCounts = new Map<string, GiteeContributor>()
  const commits: GiteeCommit[] = rawCommits.map((rawCommit) => {
    const account = commitAccount(rawCommit.author, rawCommit.sha)
    const profile = profiles.get(account.id)
    if (!profile || profile.login !== account.login)
      throw new TypeError(`Gitee commit ${rawCommit.sha} has no verified profile for ${account.login}`)
    const gitAuthor = rawCommit.commit.author ?? rawCommit.commit.committer
    const existing = contributionCounts.get(profile.id)
    contributionCounts.set(profile.id, {
      ...profile,
      contributions: (existing?.contributions ?? 0) + 1,
    })
    const date = gitAuthor?.date
    if (!date || Number.isNaN(Date.parse(date)))
      throw new TypeError(`Gitee commit ${rawCommit.sha} is missing a valid date`)
    return {
      author: {
        avatarUrl: profile.avatarUrl,
        login: profile.login,
        name: profile.name,
        profileUrl: profile.profileUrl,
      },
      date,
      message: firstLine(rawCommit.commit.message),
      sha: rawCommit.sha,
      shortSha: rawCommit.sha.slice(0, 7),
      url: rawCommit.html_url,
    }
  })

  return {
    commits,
    contributors: [...contributionCounts.values()]
      .sort((left, right) => right.contributions - left.contributions || left.name.localeCompare(right.name)),
    ...(issuesEnabled ? { openIssueCount: issues.length, openIssues: issues } : {}),
    path: source.path,
  }
}

export async function createGiteeMetadata(options: CreateGiteeMetadataOptions): Promise<GiteeMetadataSnapshot> {
  const client = new GiteeClient(options)
  const repositoryPath = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`
  const { data: repository } = await client.get<GiteeRepositoryResponse>(repositoryPath)
  const fullName = `${options.owner}/${options.repository}`
  if (repository.full_name !== fullName)
    throw new TypeError(`Gitee repository identity mismatch: expected ${fullName}`)
  if (repository.default_branch !== options.defaultBranch)
    throw new TypeError(`Gitee default branch mismatch: expected ${options.defaultBranch}`)

  const { data: branch } = await client.get<GiteeBranchResponse>(
    `${repositoryPath}/branches/${encodeURIComponent(options.defaultBranch)}`,
  )
  const headSha = branch.commit.sha
  const issuesEnabled = repository.has_issues
  const rawIssues = issuesEnabled
    ? await client.paginate<GiteeIssueResponse>(`${repositoryPath}/issues?state=open&page=1&per_page=100`)
    : []
  const groupedIssues = groupGiteeComponentIssues(rawIssues, options.components, options.issueTitlePrefix)

  const componentCommits = await Promise.all(options.components.map(async (component) => {
    const query = new URLSearchParams({
      page: '1',
      path: component.path,
      per_page: '100',
      sha: headSha,
    })
    const commits = await client.paginate<GiteeCommitResponse>(`${repositoryPath}/commits?${query}`)
    return { component, commits }
  }))
  const accounts = new Map<number, Pick<GiteeAccountResponse, 'id' | 'login'>>()
  for (const { commits } of componentCommits) {
    for (const commit of commits) {
      const account = commitAccount(commit.author, commit.sha)
      const existing = accounts.get(account.id)
      if (existing && existing.login !== account.login)
        throw new TypeError(`Gitee account ${account.id} has inconsistent logins`)
      accounts.set(account.id, account)
    }
  }
  const profiles = new Map<number, Omit<GiteeContributor, 'contributions'>>()
  await Promise.all([...accounts.values()].map(async (account) => {
    const { data } = await client.get<unknown>(`/users/${encodeURIComponent(account.login)}`)
    profiles.set(account.id, verifiedAccount(data, account, options.webBaseUrl))
  }))
  const components = Object.fromEntries(componentCommits.map(({ component, commits }) => [
    component.name,
    createComponentMetadata(
      component,
      commits,
      issuesEnabled,
      groupedIssues[component.name] ?? [],
      profiles,
    ),
  ]))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      defaultBranch: options.defaultBranch,
      fullName,
      headSha,
      issuesEnabled,
      webUrl: options.repositoryUrl.replace(/\/+$/, ''),
    },
    components,
  }
}
