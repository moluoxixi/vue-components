export interface GitlabCommit {
  author: {
    avatarUrl: string
    login: string
    name: string
    profileUrl: string
  }
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface GitlabContributor {
  avatarUrl: string
  contributions: number
  id: string
  login: string
  name: string
  profileUrl: string
}

export interface GitlabIssueSummary {
  iid: number
  title: string
  url: string
}

export interface GitlabComponentMetadata {
  commits: GitlabCommit[]
  contributors: GitlabContributor[]
  openIssueCount?: number
  openIssues?: GitlabIssueSummary[]
  path: string
}

export interface GitlabMetadataSnapshot {
  schemaVersion: 1
  generatedAt: string
  repository: {
    defaultBranch: string
    headSha: string
    issuesEnabled: boolean
    projectPath: string
    webUrl: string
  }
  components: Record<string, GitlabComponentMetadata>
}

export interface GitlabMetadataExpectation {
  components: Array<{
    name: string
    path: string
  }>
  defaultBranch: string
  projectPath: string
  repositoryUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertMetadata(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new TypeError(`Invalid GitLab metadata snapshot: ${message}`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function assertExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  assertMetadata(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} contains unsupported or missing fields`,
  )
}

function assertHttpUrl(value: unknown, label: string): asserts value is string {
  assertMetadata(isNonEmptyString(value), `${label} must be a URL`)
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new TypeError(`Invalid GitLab metadata snapshot: ${label} must be a URL`)
  }
  assertMetadata(url.protocol === 'https:' || url.protocol === 'http:', `${label} must use HTTP or HTTPS`)
}

function normalizedUrlPath(value: URL): string {
  return value.pathname.replace(/\/+$/, '')
}

export function isTrustedGitlabWebUrl(value: string, webBaseUrl: string): boolean {
  let candidate: URL
  let base: URL
  try {
    candidate = new URL(value)
    base = new URL(webBaseUrl)
  }
  catch {
    return false
  }

  const basePath = normalizedUrlPath(base)
  const candidatePath = normalizedUrlPath(candidate)
  return candidate.origin === base.origin
    && candidate.username === ''
    && candidate.password === ''
    && candidate.search === ''
    && candidate.hash === ''
    && (basePath === '' || candidatePath === basePath || candidatePath.startsWith(`${basePath}/`))
}

export function isExactGitlabProfileUrl(value: string, webBaseUrl: string, login: string): boolean {
  if (!isTrustedGitlabWebUrl(value, webBaseUrl))
    return false
  const base = new URL(webBaseUrl)
  const profile = new URL(value)
  const expectedPath = `${normalizedUrlPath(base)}/${encodeURIComponent(login)}`
  return normalizedUrlPath(profile) === expectedPath && profile.search === ''
}

export function resolveGitlabWebBaseUrl(repositoryUrl: string, projectPath: string): string {
  const repository = new URL(repositoryUrl)
  const repositorySegments = repository.pathname.split('/').filter(Boolean)
  const projectSegments = projectPath.split('/').filter(Boolean)
  if (repositorySegments.length < projectSegments.length)
    throw new TypeError('GitLab repository URL must include the configured projectPath')

  const projectOffset = repositorySegments.length - projectSegments.length
  for (let index = 0; index < projectSegments.length; index += 1) {
    let repositorySegment = repositorySegments[projectOffset + index] ?? ''
    try {
      repositorySegment = decodeURIComponent(repositorySegment)
    }
    catch {
      // The exact segment comparison below rejects malformed encoding.
    }
    if (repositorySegment !== projectSegments[index])
      throw new TypeError('GitLab repository URL must include the configured projectPath')
  }

  repository.pathname = projectOffset === 0
    ? '/'
    : `/${repositorySegments.slice(0, projectOffset).join('/')}`
  repository.search = ''
  repository.hash = ''
  return repository.toString()
}

function assertIssueDetailUrl(issueUrl: string, repositoryUrl: string, iid: number, label: string): void {
  const issue = new URL(issueUrl)
  const repository = new URL(repositoryUrl)
  const repositoryPath = repository.pathname.replace(/\/+$/, '')
  const acceptedPaths = new Set([
    `${repositoryPath}/-/issues/${iid}`,
    `${repositoryPath}/-/work_items/${iid}`,
  ])

  assertMetadata(
    issue.origin === repository.origin
    && acceptedPaths.has(issue.pathname)
    && issue.search === ''
    && issue.hash === '',
    `${label} must be an Issue detail URL for the configured project and iid`,
  )
}

function assertCommitDetailUrl(commitUrl: string, repositoryUrl: string, sha: string, label: string): void {
  const commit = new URL(commitUrl)
  const repository = new URL(repositoryUrl)
  const repositoryPath = repository.pathname.replace(/\/+$/, '')

  assertMetadata(
    commit.origin === repository.origin
    && commit.pathname === `${repositoryPath}/-/commit/${sha}`
    && commit.search === ''
    && commit.hash === '',
    `${label} must be a commit detail URL for the configured project and SHA`,
  )
}

export function assertGitlabMetadataSnapshot(
  value: unknown,
  expected: GitlabMetadataExpectation,
): asserts value is GitlabMetadataSnapshot {
  assertMetadata(isRecord(value), 'root must be an object')
  assertExactKeys(value, ['schemaVersion', 'generatedAt', 'repository', 'components'], 'root')
  assertMetadata(value.schemaVersion === 1, 'unsupported schemaVersion')
  assertMetadata(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), 'generatedAt must be an ISO date')
  assertMetadata(isRecord(value.repository), 'repository must be an object')
  assertExactKeys(
    value.repository,
    ['defaultBranch', 'headSha', 'issuesEnabled', 'projectPath', 'webUrl'],
    'repository',
  )

  const repository = value.repository
  const expectedRepositoryUrl = expected.repositoryUrl.replace(/\/+$/, '')
  assertMetadata(repository.projectPath === expected.projectPath, `projectPath must be ${expected.projectPath}`)
  assertMetadata(repository.defaultBranch === expected.defaultBranch, `defaultBranch must be ${expected.defaultBranch}`)
  assertMetadata(repository.webUrl === expectedRepositoryUrl, `repository webUrl must be ${expectedRepositoryUrl}`)
  assertMetadata(typeof repository.headSha === 'string' && /^[a-f0-9]{40}$/.test(repository.headSha), 'headSha must be a full commit SHA')
  assertMetadata(typeof repository.issuesEnabled === 'boolean', 'issuesEnabled must be a boolean')
  assertHttpUrl(repository.webUrl, 'repository webUrl')
  let webBaseUrl: string
  try {
    webBaseUrl = resolveGitlabWebBaseUrl(repository.webUrl as string, expected.projectPath)
  }
  catch {
    throw new TypeError('Invalid GitLab metadata snapshot: repository webUrl must include projectPath')
  }
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(
    JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames),
    'component keys must exactly match the documentation manifest',
  )
  const contributorLoginsById = new Map<string, string>()
  const contributorProfilesByLogin = new Map<string, Record<string, unknown>>()

  for (const expectedComponent of expected.components) {
    const rawComponent = value.components[expectedComponent.name]
    assertMetadata(isRecord(rawComponent), `${expectedComponent.name} must be an object`)
    assertExactKeys(
      rawComponent,
      repository.issuesEnabled
        ? ['commits', 'contributors', 'openIssueCount', 'openIssues', 'path']
        : ['commits', 'contributors', 'path'],
      expectedComponent.name,
    )
    assertMetadata(rawComponent.path === expectedComponent.path, `${expectedComponent.name} has an unexpected source path`)
    assertMetadata(Array.isArray(rawComponent.commits), `${expectedComponent.name}.commits must be an array`)
    assertMetadata(Array.isArray(rawComponent.contributors), `${expectedComponent.name}.contributors must be an array`)

    if (repository.issuesEnabled) {
      assertMetadata(Array.isArray(rawComponent.openIssues), `${expectedComponent.name}.openIssues must be an array`)
      assertMetadata(Number.isInteger(rawComponent.openIssueCount), `${expectedComponent.name}.openIssueCount must be an integer`)
      assertMetadata(rawComponent.openIssueCount === rawComponent.openIssues.length, `${expectedComponent.name}.openIssueCount must match openIssues`)
      for (const rawIssue of rawComponent.openIssues) {
        assertMetadata(isRecord(rawIssue), `${expectedComponent.name} issue must be an object`)
        assertExactKeys(rawIssue, ['iid', 'title', 'url'], `${expectedComponent.name} issue`)
        assertMetadata(Number.isInteger(rawIssue.iid) && Number(rawIssue.iid) > 0, `${expectedComponent.name} issue iid is invalid`)
        assertMetadata(isNonEmptyString(rawIssue.title), `${expectedComponent.name} issue title is required`)
        assertHttpUrl(rawIssue.url, `${expectedComponent.name} issue URL`)
        assertIssueDetailUrl(
          rawIssue.url,
          repository.webUrl as string,
          Number(rawIssue.iid),
          `${expectedComponent.name} issue URL`,
        )
      }
    }

    const contributorIds = new Set<string>()
    const contributorsByLogin = new Map<string, Record<string, unknown>>()
    for (const rawContributor of rawComponent.contributors) {
      assertMetadata(isRecord(rawContributor), `${expectedComponent.name} contributor must be an object`)
      assertExactKeys(
        rawContributor,
        ['avatarUrl', 'contributions', 'id', 'login', 'name', 'profileUrl'],
        `${expectedComponent.name} contributor`,
      )
      assertMetadata(isNonEmptyString(rawContributor.id) && /^gitlab:[a-f0-9]{64}$/.test(rawContributor.id), `${expectedComponent.name} contributor id is invalid`)
      assertMetadata(!contributorIds.has(rawContributor.id), `${expectedComponent.name} contains duplicate contributor ${rawContributor.id}`)
      contributorIds.add(rawContributor.id)
      assertMetadata(isNonEmptyString(rawContributor.name), `${expectedComponent.name} contributor name is required`)
      assertMetadata(Number.isInteger(rawContributor.contributions) && Number(rawContributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
      assertMetadata(isNonEmptyString(rawContributor.login), `${expectedComponent.name} contributor login is required`)
      const existingLogin = contributorLoginsById.get(rawContributor.id)
      assertMetadata(
        existingLogin === undefined || existingLogin === rawContributor.login,
        `GitLab contributor ${rawContributor.id} must remain bound to login ${existingLogin} across components`,
      )
      contributorLoginsById.set(rawContributor.id, rawContributor.login)
      assertMetadata(!contributorsByLogin.has(rawContributor.login), `${expectedComponent.name} contains duplicate contributor login ${rawContributor.login}`)
      assertHttpUrl(rawContributor.avatarUrl, `${expectedComponent.name} contributor avatar URL`)
      assertHttpUrl(rawContributor.profileUrl, `${expectedComponent.name} contributor profile URL`)
      assertMetadata(
        isTrustedGitlabWebUrl(rawContributor.avatarUrl, webBaseUrl),
        `${expectedComponent.name} contributor avatar URL must belong to the configured GitLab instance`,
      )
      assertMetadata(
        isExactGitlabProfileUrl(rawContributor.profileUrl, webBaseUrl, rawContributor.login),
        `${expectedComponent.name} contributor profile URL must match its GitLab login`,
      )
      const existingProfile = contributorProfilesByLogin.get(rawContributor.login)
      if (existingProfile) {
        assertMetadata(
          rawContributor.avatarUrl === existingProfile.avatarUrl
          && rawContributor.name === existingProfile.name
          && rawContributor.profileUrl === existingProfile.profileUrl,
          `GitLab contributor profile must remain consistent across components for ${rawContributor.login}`,
        )
      }
      else {
        contributorProfilesByLogin.set(rawContributor.login, rawContributor)
      }
      contributorsByLogin.set(rawContributor.login, rawContributor)
    }

    const commitShas = new Set<string>()
    for (const rawCommit of rawComponent.commits) {
      assertMetadata(isRecord(rawCommit), `${expectedComponent.name} commit must be an object`)
      assertExactKeys(rawCommit, ['author', 'date', 'message', 'sha', 'shortSha', 'url'], `${expectedComponent.name} commit`)
      assertMetadata(typeof rawCommit.sha === 'string' && /^[a-f0-9]{40}$/.test(rawCommit.sha), `${expectedComponent.name} commit SHA is invalid`)
      assertMetadata(rawCommit.shortSha === rawCommit.sha.slice(0, 7), `${expectedComponent.name} short SHA is invalid`)
      assertMetadata(!commitShas.has(rawCommit.sha), `${expectedComponent.name} contains duplicate commit ${rawCommit.sha}`)
      commitShas.add(rawCommit.sha)
      assertMetadata(isNonEmptyString(rawCommit.message), `${expectedComponent.name} commit message is required`)
      assertMetadata(isNonEmptyString(rawCommit.date) && !Number.isNaN(Date.parse(rawCommit.date)), `${expectedComponent.name} commit date must be an ISO date`)
      assertHttpUrl(rawCommit.url, `${expectedComponent.name} commit URL`)
      assertCommitDetailUrl(
        rawCommit.url,
        repository.webUrl as string,
        rawCommit.sha,
        `${expectedComponent.name} commit URL`,
      )
      assertMetadata(isRecord(rawCommit.author), `${expectedComponent.name} commit author must be an object`)
      assertExactKeys(rawCommit.author, ['avatarUrl', 'login', 'name', 'profileUrl'], `${expectedComponent.name} commit author`)
      assertMetadata(isNonEmptyString(rawCommit.author.login), `${expectedComponent.name} commit author login is required`)
      const contributor = contributorsByLogin.get(rawCommit.author.login)
      assertMetadata(contributor, `${expectedComponent.name} commit author has no matching contributor`)
      assertMetadata(
        rawCommit.author.avatarUrl === contributor.avatarUrl
        && rawCommit.author.name === contributor.name
        && rawCommit.author.profileUrl === contributor.profileUrl,
        `${expectedComponent.name} commit author must match its GitLab contributor profile`,
      )
    }
  }
}
