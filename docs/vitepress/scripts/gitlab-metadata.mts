import type {
  GitlabCommit,
  GitlabComponentMetadata,
  GitlabContributor,
  GitlabIssueSummary,
  GitlabMetadataSnapshot,
} from '../.vitepress/repository/providers/gitlab.ts'
import { createHash } from 'node:crypto'
import {
  isExactGitlabProfileUrl,
  isTrustedGitlabWebUrl,
  resolveGitlabWebBaseUrl,
} from '../.vitepress/repository/providers/gitlab.ts'
import { resolveTrustedApiUrl } from './repository-api-client.mts'

interface GitlabProjectResponse {
  default_branch: string | null
  issues_enabled?: boolean
  path_with_namespace: string
  web_url: string
}

interface GitlabBranchResponse {
  commit: {
    id: string
  }
}

interface GitlabIssueResponse {
  iid: number
  title: string
  web_url: string
}

interface GitlabCommitResponse {
  author_email: string
  author_name: string
  authored_date: string
  id: string
  message: string
  short_id: string
  title: string
  web_url: string
}

interface GitlabContributorProfile {
  avatarUrl: string
  login: string
  name: string
  profileUrl: string
}

export type GitlabAuthenticationMode = 'bearer' | 'private-token'

export interface GitlabComponentSource {
  name: string
  path: string
}

export interface CreateGitlabMetadataOptions {
  apiBaseUrl: string
  authentication: GitlabAuthenticationMode
  components: GitlabComponentSource[]
  contributorProfiles?: Readonly<Record<string, string>>
  defaultBranch: string
  fetchImpl?: typeof fetch
  generatedAt?: string
  issueTitlePrefix: (componentName: string) => string
  projectPath: string
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
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match?.[2] === 'next')
      return match[1]
  }
  return undefined
}

export function resolveGitlabNextPage(response: Response, currentUrl: string): string | undefined {
  const nextPage = response.headers.get('x-next-page')?.trim()
  if (nextPage) {
    const url = new URL(currentUrl)
    url.searchParams.set('page', nextPage)
    return url.toString()
  }
  return nextLink(response.headers.get('link'))
}

class GitlabRequestError extends Error {
  readonly status: number

  constructor(status: number, url: string, rateLimit: string) {
    super(`GitLab request failed (${status}) for ${url}.${rateLimit}`)
    this.name = 'GitlabRequestError'
    this.status = status
  }
}

class GitlabClient {
  private readonly apiBaseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>
  private readonly sleep: (milliseconds: number) => Promise<void>

  constructor(options: CreateGitlabMetadataOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sleep = options.sleep ?? defaultSleep
    this.headers = {
      'Accept': 'application/json',
      'User-Agent': options.userAgent,
    }
    if (options.token) {
      if (options.authentication === 'private-token')
        this.headers['PRIVATE-TOKEN'] = options.token
      else if (options.authentication === 'bearer')
        this.headers.Authorization = `Bearer ${options.token}`
      else
        throw new TypeError(`Unsupported GitLab authentication mode: ${String(options.authentication)}`)
    }
  }

  async get<T>(pathOrUrl: string): Promise<{ data: T, response: Response, url: string }> {
    const url = resolveTrustedApiUrl(this.apiBaseUrl, pathOrUrl, 'GitLab')
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
        throw new Error(`GitLab network request failed for ${url}: ${message}`)
      }
      if (response.ok) {
        return {
          data: await response.json() as T,
          response,
          url,
        }
      }

      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader)
      const hasRetryAfter = retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
      const isRetryable = response.status === 429 || response.status >= 500
      if (isRetryable && attempt < MAX_RETRIES) {
        attempt += 1
        const waitMs = hasRetryAfter
          ? Math.min((retryAfter ?? 0) * 1000, 30_000)
          : 500 * 2 ** (attempt - 1)
        await this.sleep(waitMs)
        continue
      }

      const remaining = response.headers.get('ratelimit-remaining')
      const reset = response.headers.get('ratelimit-reset')
      const rateLimit = remaining === '0' && reset
        ? ` GitLab rate limit resets at ${reset}`
        : ''
      throw new GitlabRequestError(response.status, url, rateLimit)
    }
  }

  async paginate<T>(path: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = path
    const visited = new Set<string>()
    while (next) {
      const pageUrl = resolveTrustedApiUrl(this.apiBaseUrl, next, 'GitLab')
      if (visited.has(pageUrl))
        throw new TypeError('GitLab pagination returned a repeated next page')
      visited.add(pageUrl)
      const { data, response, url } = await this.get<T[]>(pageUrl)
      if (!Array.isArray(data))
        throw new TypeError(`GitLab pagination response is not an array: ${url}`)
      items.push(...data)
      next = resolveGitlabNextPage(response, url)
    }
    return items
  }
}

export function groupGitlabComponentIssues(
  issues: GitlabIssueResponse[],
  components: GitlabComponentSource[],
  issueTitlePrefix: (componentName: string) => string,
): Record<string, GitlabIssueSummary[]> {
  const result = Object.fromEntries(components.map(component => [component.name, []])) as Record<string, GitlabIssueSummary[]>
  const prefixes = components
    .map(component => ({ name: component.name, prefix: issueTitlePrefix(component.name) }))
    .sort((left, right) => right.prefix.length - left.prefix.length)

  for (const issue of issues) {
    const title = issue.title.trimStart()
    const match = prefixes.find(candidate => title.startsWith(candidate.prefix))
    if (!match)
      continue
    result[match.name]?.push({ iid: issue.iid, title: issue.title, url: issue.web_url })
  }
  return result
}

function contributorIdentity(name: string, email: string): string {
  return `${name.trim().toLocaleLowerCase()}\0${email.trim().toLocaleLowerCase()}`
}

function contributorId(name: string, email: string): string {
  return `gitlab:${createHash('sha256').update(contributorIdentity(name, email)).digest('hex')}`
}

function validateContributorProfileMappings(
  mappings: Readonly<Record<string, string>> | undefined,
): ReadonlyMap<string, string> {
  const normalized = new Map<string, string>()
  const contributorIdByUsername = new Map<string, string>()
  for (const [id, configuredUsername] of Object.entries(mappings ?? {})) {
    if (!/^gitlab:[a-f0-9]{64}$/.test(id))
      throw new TypeError(`Invalid GitLab contributor profile id: ${id}`)
    const username = configuredUsername.trim()
    if (!username)
      throw new TypeError(`GitLab contributor profile username is required for ${id}`)
    const existingId = contributorIdByUsername.get(username)
    if (existingId && existingId !== id)
      throw new TypeError(`GitLab contributor profile username ${username} is mapped from multiple identities`)
    contributorIdByUsername.set(username, id)
    normalized.set(id, username)
  }
  return normalized
}

function normalizeContributorProfile(
  value: unknown,
  username: string,
  webBaseUrl: string,
): GitlabContributorProfile {
  if (!Array.isArray(value) || value.length !== 1)
    throw new TypeError(`GitLab user lookup must return exactly one profile for ${username}`)
  const user = value[0]
  if (!isRecord(user)
    || user.username !== username
    || typeof user.name !== 'string'
    || !user.name.trim()
    || typeof user.avatar_url !== 'string'
    || typeof user.web_url !== 'string'
    || !isTrustedGitlabWebUrl(user.avatar_url, webBaseUrl)
    || !isExactGitlabProfileUrl(user.web_url, webBaseUrl, username)) {
    throw new TypeError(`GitLab user profile is invalid for ${username}`)
  }
  return {
    avatarUrl: user.avatar_url,
    login: username,
    name: user.name.trim(),
    profileUrl: user.web_url,
  }
}

async function resolveContributorProfiles(
  client: GitlabClient,
  mappings: ReadonlyMap<string, string>,
  contributorIds: ReadonlySet<string>,
  webBaseUrl: string,
): Promise<ReadonlyMap<string, GitlabContributorProfile>> {
  const relevantMappings = [...mappings].filter(([id]) => contributorIds.has(id))
  for (const id of contributorIds) {
    if (!mappings.has(id))
      throw new TypeError(`GitLab contributor profile mapping is required for ${id}`)
  }
  const profileByUsername = new Map<string, GitlabContributorProfile>()

  await Promise.all([...new Set(relevantMappings.map(([, username]) => username))].map(async (username) => {
    const { data } = await client.get<unknown>(`/users?username=${encodeURIComponent(username)}`)
    profileByUsername.set(username, normalizeContributorProfile(data, username, webBaseUrl))
  }))

  return new Map(relevantMappings.map(([id, username]) => {
    const profile = profileByUsername.get(username)
    if (!profile)
      throw new TypeError(`GitLab contributor profile is missing for ${id}`)
    return [id, profile] as const
  }))
}

function createComponentMetadata(
  source: GitlabComponentSource,
  rawCommits: GitlabCommitResponse[],
  issuesEnabled: boolean,
  issues: GitlabIssueSummary[],
  contributorProfiles: ReadonlyMap<string, GitlabContributorProfile>,
): GitlabComponentMetadata {
  const contributionCounts = new Map<string, GitlabContributor>()
  const commits: GitlabCommit[] = rawCommits.map((rawCommit) => {
    const id = contributorId(rawCommit.author_name, rawCommit.author_email)
    const existing = contributionCounts.get(id)
    const profile = contributorProfiles.get(id)
    if (!profile)
      throw new TypeError(`GitLab commit ${rawCommit.id} has no verified contributor profile`)
    contributionCounts.set(id, {
      ...profile,
      contributions: (existing?.contributions ?? 0) + 1,
      id,
    })
    return {
      author: { ...profile },
      date: rawCommit.authored_date,
      message: firstLine(rawCommit.title || rawCommit.message),
      sha: rawCommit.id,
      shortSha: rawCommit.id.slice(0, 7),
      url: rawCommit.web_url,
    }
  })
  const contributors = [...contributionCounts.values()]
    .sort((left, right) => right.contributions - left.contributions || left.name.localeCompare(right.name))

  return {
    commits,
    contributors,
    ...(issuesEnabled ? { openIssueCount: issues.length, openIssues: issues } : {}),
    path: source.path,
  }
}

export async function createGitlabMetadata(options: CreateGitlabMetadataOptions): Promise<GitlabMetadataSnapshot> {
  const expectedWebBaseUrl = resolveGitlabWebBaseUrl(options.repositoryUrl, options.projectPath).replace(/\/+$/, '')
  const configuredWebBaseUrl = new URL(options.webBaseUrl).toString().replace(/\/+$/, '')
  if (configuredWebBaseUrl !== expectedWebBaseUrl)
    throw new TypeError(`GitLab web base URL mismatch: expected ${expectedWebBaseUrl}`)

  const client = new GitlabClient(options)
  const configuredContributorProfiles = validateContributorProfileMappings(options.contributorProfiles)
  const encodedProject = encodeURIComponent(options.projectPath)
  const projectPath = `/projects/${encodedProject}`
  const { data: project } = await client.get<GitlabProjectResponse>(projectPath)
  const repositoryUrl = options.repositoryUrl.replace(/\/+$/, '')
  if (project.path_with_namespace !== options.projectPath)
    throw new TypeError(`GitLab project path mismatch: expected ${options.projectPath}`)
  if (project.web_url !== repositoryUrl)
    throw new TypeError(`GitLab project web URL mismatch: expected ${repositoryUrl}`)
  if (project.default_branch !== options.defaultBranch)
    throw new TypeError(`GitLab default branch mismatch: expected ${options.defaultBranch}`)

  const { data: branch } = await client.get<GitlabBranchResponse>(
    `${projectPath}/repository/branches/${encodeURIComponent(options.defaultBranch)}`,
  )
  const headSha = branch.commit.id

  const issuesEnabled = project.issues_enabled !== false
  const rawIssues = issuesEnabled
    ? await client.paginate<GitlabIssueResponse>(`${projectPath}/issues?state=opened&scope=all&per_page=100`)
    : []
  const groupedIssues = groupGitlabComponentIssues(rawIssues, options.components, options.issueTitlePrefix)

  const componentCommits = await Promise.all(options.components.map(async (component) => {
    const query = new URLSearchParams({
      path: component.path,
      per_page: '100',
      ref_name: headSha,
    })
    const commits = await client.paginate<GitlabCommitResponse>(`${projectPath}/repository/commits?${query}`)
    return { component, commits }
  }))
  const contributorIds = new Set(componentCommits.flatMap(({ commits }) => (
    commits.map(commit => contributorId(commit.author_name, commit.author_email))
  )))
  const contributorProfiles = await resolveContributorProfiles(
    client,
    configuredContributorProfiles,
    contributorIds,
    options.webBaseUrl,
  )
  const components = Object.fromEntries(componentCommits.map(({ component, commits }) => [
    component.name,
    createComponentMetadata(
      component,
      commits,
      issuesEnabled,
      groupedIssues[component.name] ?? [],
      contributorProfiles,
    ),
  ]))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      defaultBranch: options.defaultBranch,
      headSha,
      issuesEnabled,
      projectPath: options.projectPath,
      webUrl: project.web_url,
    },
    components,
  }
}
