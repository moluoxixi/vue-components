import type {
  GitlabCommit,
  GitlabComponentMetadata,
  GitlabContributor,
  GitlabIssueSummary,
  GitlabMetadataSnapshot,
} from '../.vitepress/gitlab-metadata-types.ts'
import { createHash } from 'node:crypto'
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

export interface GitlabComponentSource {
  name: string
  path: string
}

export interface CreateGitlabMetadataOptions {
  apiBaseUrl: string
  components: GitlabComponentSource[]
  defaultBranch: string
  fetchImpl?: typeof fetch
  generatedAt?: string
  issueTitlePrefix: (componentName: string) => string
  projectPath: string
  repositoryUrl: string
  sleep?: (milliseconds: number) => Promise<void>
  token?: string
  userAgent: string
}

const MAX_RETRIES = 3

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || '(no commit message)'
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
    if (options.token)
      this.headers['PRIVATE-TOKEN'] = options.token
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

function contributorId(name: string, email: string): string {
  const identity = `${name.trim().toLocaleLowerCase()}\0${email.trim().toLocaleLowerCase()}`
  return `gitlab:${createHash('sha256').update(identity).digest('hex')}`
}

function createComponentMetadata(
  source: GitlabComponentSource,
  rawCommits: GitlabCommitResponse[],
  issuesEnabled: boolean,
  issues: GitlabIssueSummary[],
): GitlabComponentMetadata {
  const contributionCounts = new Map<string, GitlabContributor>()
  const commits: GitlabCommit[] = rawCommits.map((rawCommit) => {
    const id = contributorId(rawCommit.author_name, rawCommit.author_email)
    const existing = contributionCounts.get(id)
    contributionCounts.set(id, {
      contributions: (existing?.contributions ?? 0) + 1,
      id,
      name: rawCommit.author_name.trim() || 'Unknown contributor',
    })
    return {
      author: { name: rawCommit.author_name.trim() || 'Unknown contributor' },
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
  const client = new GitlabClient(options)
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

  let issuesEnabled = project.issues_enabled !== false
  let rawIssues: GitlabIssueResponse[] = []
  if (issuesEnabled) {
    try {
      rawIssues = await client.paginate<GitlabIssueResponse>(`${projectPath}/issues?state=opened&scope=all&per_page=100`)
      issuesEnabled = true
    }
    catch (error) {
      if (error instanceof GitlabRequestError && error.status === 404)
        issuesEnabled = false
      else
        throw error
    }
  }
  const groupedIssues = groupGitlabComponentIssues(rawIssues, options.components, options.issueTitlePrefix)

  const components = Object.fromEntries(await Promise.all(options.components.map(async (component) => {
    const query = new URLSearchParams({
      path: component.path,
      per_page: '100',
      ref_name: headSha,
    })
    const commits = await client.paginate<GitlabCommitResponse>(`${projectPath}/repository/commits?${query}`)
    return [
      component.name,
      createComponentMetadata(component, commits, issuesEnabled, groupedIssues[component.name] ?? []),
    ] as const
  })))

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
