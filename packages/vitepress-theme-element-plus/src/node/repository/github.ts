import type {
  GithubCommit,
  GithubComponentMetadata,
  GithubContributorProfile,
  GithubIssueSummary,
  GithubMetadataExpectation,
  GithubMetadataSnapshot,
} from '../../content/repository/providers/github'
import type { AtomicFileSystem } from './atomic-write'
import {
  assertGithubMetadataSnapshot,
  isExactGithubProfileUrl,
  isTrustedGithubAvatarUrl,
} from '../../content/repository/providers/github'
import { resolveTrustedApiUrl } from './api-client'
import { writeJsonAtomically } from './atomic-write'
import { collectValidateAndWrite, formatRepositorySyncError } from './sync'

interface GithubRefResponse {
  object: { sha: string }
}

interface GithubUserReference {
  login: string
  avatar_url: string
  html_url: string
  type: string
}

interface GithubUserResponse extends GithubUserReference {
  name: string | null
}

interface GithubIssueResponse {
  number: number
  title: string
  html_url: string
  pull_request?: unknown
}

interface GithubCommitResponse {
  sha: string
  html_url: string
  author: GithubUserReference | null
  commit: {
    message: string
    author: {
      name: string
      date: string | null
    } | null
    committer: {
      name: string
      date: string | null
    } | null
  }
}

export interface GithubComponentSource {
  name: string
  path: string
}

export interface CreateGithubMetadataOptions {
  owner: string
  repository: string
  defaultBranch: string
  components: GithubComponentSource[]
  issueTitlePrefix: (componentName: string) => string
  excludeBotsFromContributors: boolean
  userAgent: string
  token?: string
  fetchImpl?: typeof fetch
  generatedAt?: string
}

const API_ROOT = 'https://api.github.com'
const API_VERSION = '2022-11-28'
const MAX_RETRIES = 3

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || '(no commit message)'
}

function isBot(user: GithubUserReference): boolean {
  return user.type === 'Bot' || user.login.endsWith('[bot]')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeGithubProfile(value: unknown, expectedLogin: string): GithubContributorProfile {
  const isBotProfile = isRecord(value)
    && typeof value.type === 'string'
    && (value.type === 'Bot' || expectedLogin.endsWith('[bot]'))
  if (!isRecord(value)
    || value.login !== expectedLogin
    || typeof value.avatar_url !== 'string'
    || typeof value.html_url !== 'string'
    || (value.name === null && !isBotProfile)
    || (value.name !== null && (typeof value.name !== 'string' || !value.name.trim()))) {
    throw new TypeError(`GitHub user profile mismatch for ${expectedLogin}`)
  }
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : expectedLogin
  let avatarUrl: string
  try {
    const normalizedAvatarUrl = new URL(value.avatar_url)
    normalizedAvatarUrl.search = ''
    avatarUrl = normalizedAvatarUrl.toString()
  }
  catch {
    throw new TypeError(`GitHub user profile has an untrusted avatar for ${expectedLogin}`)
  }
  if (!isTrustedGithubAvatarUrl(avatarUrl))
    throw new TypeError(`GitHub user profile has an untrusted avatar for ${expectedLogin}`)
  if (!isExactGithubProfileUrl(value.html_url, expectedLogin))
    throw new TypeError(`GitHub user profile URL mismatch for ${expectedLogin}`)
  return {
    avatarUrl,
    login: expectedLogin,
    name,
    profileUrl: value.html_url,
  }
}

export function parseNextLink(linkHeader: string | null): string | undefined {
  if (!linkHeader)
    return undefined

  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match?.[2] === 'next')
      return match[1]
  }
  return undefined
}

class GithubClient {
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>

  constructor(fetchImpl: typeof fetch, userAgent: string, token?: string) {
    this.fetchImpl = fetchImpl
    this.headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': userAgent,
      'X-GitHub-Api-Version': API_VERSION,
    }
    if (token)
      this.headers.Authorization = `Bearer ${token}`
  }

  async get<T>(pathOrUrl: string): Promise<{ data: T, response: Response }> {
    const url = resolveTrustedApiUrl(API_ROOT, pathOrUrl, 'GitHub')
    let attempt = 0

    while (true) {
      const response = await this.fetchImpl(url, { headers: this.headers })
      if (response.ok) {
        return {
          data: await response.json() as T,
          response,
        }
      }

      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfter = retryAfterHeader === null ? undefined : Number(retryAfterHeader)
      const hasRetryAfter = retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
      const isRetryable = response.status === 429
        || response.status >= 500
        || (response.status === 403 && hasRetryAfter)
      if (isRetryable && attempt < MAX_RETRIES) {
        attempt += 1
        const waitMs = hasRetryAfter
          ? Math.min((retryAfter ?? 0) * 1000, 30_000)
          : 500 * 2 ** (attempt - 1)
        await delay(waitMs)
        continue
      }

      const remaining = response.headers.get('x-ratelimit-remaining')
      const reset = response.headers.get('x-ratelimit-reset')
      const rateLimit = remaining === '0' && reset
        ? ` GitHub rate limit resets at ${new Date(Number(reset) * 1000).toISOString()}.`
        : ''
      throw new Error(`GitHub request failed (${response.status}) for ${url}.${rateLimit}`)
    }
  }

  async paginate<T>(path: string): Promise<T[]> {
    const items: T[] = []
    let next: string | undefined = path

    while (next) {
      const { data, response } = await this.get<T[]>(next)
      if (!Array.isArray(data))
        throw new TypeError(`GitHub pagination response is not an array: ${next}`)
      items.push(...data)
      next = parseNextLink(response.headers.get('link'))
    }

    return items
  }
}

export function groupComponentIssues(
  issues: GithubIssueResponse[],
  components: GithubComponentSource[],
  issueTitlePrefix: (componentName: string) => string,
): Record<string, GithubIssueSummary[]> {
  const result = Object.fromEntries(components.map(component => [component.name, []])) as Record<string, GithubIssueSummary[]>
  const prefixes = components
    .map(component => ({ name: component.name, prefix: issueTitlePrefix(component.name) }))
    .sort((left, right) => right.prefix.length - left.prefix.length)

  for (const issue of issues) {
    if (issue.pull_request)
      continue
    const title = issue.title.trimStart()
    const match = prefixes.find(candidate => title.startsWith(candidate.prefix))
    if (!match)
      continue
    result[match.name]?.push({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
    })
  }

  return result
}

function createComponentMetadata(
  source: GithubComponentSource,
  rawCommits: GithubCommitResponse[],
  profiles: Record<string, GithubContributorProfile>,
  issues: GithubIssueSummary[],
  excludeBotsFromContributors: boolean,
): GithubComponentMetadata {
  const contributionCounts = new Map<string, number>()
  const commits: GithubCommit[] = rawCommits.map((rawCommit) => {
    const githubAuthor = rawCommit.author
    if (!githubAuthor || !githubAuthor.login.trim())
      throw new TypeError(`GitHub commit ${rawCommit.sha} has no associated GitHub account`)
    const profile = profiles[githubAuthor.login]
    if (!profile)
      throw new TypeError(`GitHub commit ${rawCommit.sha} has no verified profile for ${githubAuthor.login}`)
    if (!excludeBotsFromContributors || !isBot(githubAuthor))
      contributionCounts.set(githubAuthor.login, (contributionCounts.get(githubAuthor.login) ?? 0) + 1)

    const commitDate = rawCommit.commit.author?.date ?? rawCommit.commit.committer?.date ?? ''
    return {
      sha: rawCommit.sha,
      shortSha: rawCommit.sha.slice(0, 7),
      message: firstLine(rawCommit.commit.message),
      date: commitDate,
      url: rawCommit.html_url,
      author: { ...profile },
    }
  })

  const contributors = Array.from(contributionCounts, ([login, contributions]) => ({ login, contributions }))
    .sort((left, right) => right.contributions - left.contributions || left.login.localeCompare(right.login))

  return {
    path: source.path,
    openIssueCount: issues.length,
    openIssues: issues,
    contributors,
    commits,
  }
}

export async function createGithubMetadata(options: CreateGithubMetadataOptions): Promise<GithubMetadataSnapshot> {
  const client = new GithubClient(options.fetchImpl ?? fetch, options.userAgent, options.token)
  const repositoryPath = `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`
  const defaultBranch = options.defaultBranch
  const { data: branchRef } = await client.get<GithubRefResponse>(
    `${repositoryPath}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
  )
  const headSha = branchRef.object.sha

  const rawIssues = await client.paginate<GithubIssueResponse>(`${repositoryPath}/issues?state=open&per_page=100`)
  const openIssues = rawIssues.filter(issue => !issue.pull_request)
  const groupedIssues = groupComponentIssues(openIssues, options.components, options.issueTitlePrefix)

  const commitsByComponent = new Map<string, GithubCommitResponse[]>()
  const githubUsers = new Map<string, GithubUserReference>()
  for (const component of options.components) {
    const query = new URLSearchParams({
      sha: headSha,
      path: component.path,
      per_page: '100',
    })
    const commits = await client.paginate<GithubCommitResponse>(`${repositoryPath}/commits?${query}`)
    commitsByComponent.set(component.name, commits)
    for (const commit of commits) {
      if (!commit.author || !commit.author.login.trim())
        throw new TypeError(`GitHub commit ${commit.sha} has no associated GitHub account`)
      githubUsers.set(commit.author.login, commit.author)
    }
  }

  const profiles: Record<string, GithubContributorProfile> = {}
  for (const login of Array.from(githubUsers.keys()).sort()) {
    const { data: user } = await client.get<GithubUserResponse>(`/users/${encodeURIComponent(login)}`)
    profiles[login] = normalizeGithubProfile(user, login)
  }

  const components = Object.fromEntries(options.components.map(component => [
    component.name,
    createComponentMetadata(
      component,
      commitsByComponent.get(component.name) ?? [],
      profiles,
      groupedIssues[component.name] ?? [],
      options.excludeBotsFromContributors,
    ),
  ]))

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      owner: options.owner,
      name: options.repository,
      defaultBranch,
      headSha,
      openIssueCount: openIssues.length,
    },
    profiles,
    components,
  }
}

export function writeGithubMetadataAtomically(
  snapshot: GithubMetadataSnapshot,
  targetPath: string,
  fileSystem?: AtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, targetPath, fileSystem)
}

export function syncGithubMetadata(
  collectSnapshot: () => Promise<GithubMetadataSnapshot>,
  expectation: GithubMetadataExpectation,
  targetPath: string,
): Promise<GithubMetadataSnapshot> {
  return collectValidateAndWrite({
    assertSnapshot: snapshot => assertGithubMetadataSnapshot(snapshot, expectation),
    collectSnapshot,
    outputPath: targetPath,
  })
}

export function formatGithubSyncError(error: unknown, token?: string): string {
  return formatRepositorySyncError(error, token)
}
