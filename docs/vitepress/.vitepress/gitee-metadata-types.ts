export interface GiteeCommit {
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

export interface GiteeContributor {
  avatarUrl: string
  contributions: number
  id: string
  login: string
  name: string
  profileUrl: string
}

export interface GiteeIssueSummary {
  number: string
  title: string
  url: string
}

export interface GiteeComponentMetadata {
  commits: GiteeCommit[]
  contributors: GiteeContributor[]
  openIssueCount?: number
  openIssues?: GiteeIssueSummary[]
  path: string
}

export interface GiteeMetadataSnapshot {
  schemaVersion: 1
  generatedAt: string
  repository: {
    defaultBranch: string
    fullName: string
    headSha: string
    issuesEnabled: boolean
    webUrl: string
  }
  components: Record<string, GiteeComponentMetadata>
}

export interface GiteeMetadataExpectation {
  components: Array<{ name: string, path: string }>
  defaultBranch: string
  owner: string
  repository: string
  repositoryUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertMetadata(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new TypeError(`Invalid Gitee metadata snapshot: ${message}`)
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
  try {
    const url = new URL(value)
    assertMetadata(url.protocol === 'https:' || url.protocol === 'http:', `${label} must use HTTP or HTTPS`)
  }
  catch {
    throw new TypeError(`Invalid Gitee metadata snapshot: ${label} must be a URL`)
  }
}

export function isTrustedGiteeAvatarUrl(value: string, webBaseUrl: string): boolean {
  try {
    const avatar = new URL(value)
    const base = new URL(webBaseUrl)
    return avatar.protocol === 'https:'
      && (avatar.hostname === base.hostname || avatar.hostname.endsWith(`.${base.hostname}`))
      && avatar.username === ''
      && avatar.password === ''
      && avatar.search === ''
      && avatar.hash === ''
  }
  catch {
    return false
  }
}

export function isExactGiteeProfileUrl(value: string, webBaseUrl: string, login: string): boolean {
  try {
    const profile = new URL(value)
    const base = new URL(webBaseUrl)
    return profile.origin === base.origin
      && profile.pathname.replace(/\/+$/, '') === `/${encodeURIComponent(login)}`
      && profile.username === ''
      && profile.password === ''
      && profile.search === ''
      && profile.hash === ''
  }
  catch {
    return false
  }
}

export function assertGiteeMetadataSnapshot(
  value: unknown,
  expected: GiteeMetadataExpectation,
): asserts value is GiteeMetadataSnapshot {
  assertMetadata(isRecord(value), 'root must be an object')
  assertExactKeys(value, ['schemaVersion', 'generatedAt', 'repository', 'components'], 'root')
  assertMetadata(value.schemaVersion === 1, 'unsupported schemaVersion')
  assertMetadata(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), 'generatedAt must be an ISO date')
  assertMetadata(isRecord(value.repository), 'repository must be an object')
  assertExactKeys(value.repository, ['defaultBranch', 'fullName', 'headSha', 'issuesEnabled', 'webUrl'], 'repository')

  const repository = value.repository
  const expectedUrl = expected.repositoryUrl.replace(/\/+$/, '')
  const expectedFullName = `${expected.owner}/${expected.repository}`
  assertMetadata(repository.fullName === expectedFullName, `repository fullName must be ${expectedFullName}`)
  assertMetadata(repository.defaultBranch === expected.defaultBranch, `repository defaultBranch must be ${expected.defaultBranch}`)
  assertMetadata(repository.webUrl === expectedUrl, `repository webUrl must be ${expectedUrl}`)
  assertMetadata(typeof repository.headSha === 'string' && /^[a-f0-9]{40}$/.test(repository.headSha), 'headSha must be a full commit SHA')
  assertMetadata(typeof repository.issuesEnabled === 'boolean', 'issuesEnabled must be a boolean')
  assertHttpUrl(repository.webUrl, 'repository webUrl')
  const webBaseUrl = new URL(repository.webUrl as string).origin
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames), 'component keys must exactly match the documentation manifest')
  const contributorLoginsById = new Map<string, string>()
  const contributorProfilesByLogin = new Map<string, Record<string, unknown>>()

  for (const expectedComponent of expected.components) {
    const component = value.components[expectedComponent.name]
    assertMetadata(isRecord(component), `${expectedComponent.name} must be an object`)
    assertExactKeys(
      component,
      repository.issuesEnabled
        ? ['commits', 'contributors', 'openIssueCount', 'openIssues', 'path']
        : ['commits', 'contributors', 'path'],
      expectedComponent.name,
    )
    assertMetadata(component.path === expectedComponent.path, `${expectedComponent.name} has an unexpected source path`)
    assertMetadata(Array.isArray(component.commits), `${expectedComponent.name}.commits must be an array`)
    assertMetadata(Array.isArray(component.contributors), `${expectedComponent.name}.contributors must be an array`)

    if (repository.issuesEnabled) {
      assertMetadata(Array.isArray(component.openIssues), `${expectedComponent.name}.openIssues must be an array`)
      assertMetadata(Number.isInteger(component.openIssueCount), `${expectedComponent.name}.openIssueCount must be an integer`)
      assertMetadata(component.openIssueCount === component.openIssues.length, `${expectedComponent.name}.openIssueCount must match openIssues`)
      for (const issue of component.openIssues) {
        assertMetadata(isRecord(issue), `${expectedComponent.name} issue must be an object`)
        assertExactKeys(issue, ['number', 'title', 'url'], `${expectedComponent.name} issue`)
        assertMetadata(isNonEmptyString(issue.number), `${expectedComponent.name} issue number is required`)
        assertMetadata(isNonEmptyString(issue.title), `${expectedComponent.name} issue title is required`)
        assertHttpUrl(issue.url, `${expectedComponent.name} issue URL`)
        assertMetadata(issue.url.startsWith(`${repository.webUrl}/issues/`), `${expectedComponent.name} issue URL must belong to the configured repository`)
      }
    }

    const contributorIds = new Set<string>()
    const contributorsByLogin = new Map<string, Record<string, unknown>>()
    for (const contributor of component.contributors) {
      assertMetadata(isRecord(contributor), `${expectedComponent.name} contributor must be an object`)
      assertExactKeys(
        contributor,
        ['avatarUrl', 'contributions', 'id', 'login', 'name', 'profileUrl'],
        `${expectedComponent.name} contributor`,
      )
      assertMetadata(isNonEmptyString(contributor.id) && /^gitee:[1-9]\d*$/.test(contributor.id), `${expectedComponent.name} contributor id is invalid`)
      assertMetadata(!contributorIds.has(contributor.id), `${expectedComponent.name} contains duplicate contributor ${contributor.id}`)
      contributorIds.add(contributor.id)
      assertMetadata(isNonEmptyString(contributor.name), `${expectedComponent.name} contributor name is required`)
      assertMetadata(Number.isInteger(contributor.contributions) && Number(contributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
      assertMetadata(isNonEmptyString(contributor.login), `${expectedComponent.name} contributor login is required`)
      assertMetadata(!contributorsByLogin.has(contributor.login), `${expectedComponent.name} contains duplicate contributor login ${contributor.login}`)
      assertHttpUrl(contributor.avatarUrl, `${expectedComponent.name} contributor avatarUrl`)
      assertHttpUrl(contributor.profileUrl, `${expectedComponent.name} contributor profileUrl`)
      assertMetadata(
        isTrustedGiteeAvatarUrl(contributor.avatarUrl, webBaseUrl),
        `${expectedComponent.name} contributor avatarUrl must belong to Gitee`,
      )
      assertMetadata(
        isExactGiteeProfileUrl(contributor.profileUrl, webBaseUrl, contributor.login),
        `${expectedComponent.name} contributor profileUrl must match its Gitee login`,
      )
      const existingLogin = contributorLoginsById.get(contributor.id)
      assertMetadata(
        existingLogin === undefined || existingLogin === contributor.login,
        `Gitee contributor id ${contributor.id} must remain bound to one login`,
      )
      contributorLoginsById.set(contributor.id, contributor.login)
      const existingProfile = contributorProfilesByLogin.get(contributor.login)
      if (existingProfile) {
        assertMetadata(
          contributor.id === existingProfile.id
          && contributor.avatarUrl === existingProfile.avatarUrl
          && contributor.name === existingProfile.name
          && contributor.profileUrl === existingProfile.profileUrl,
          `Gitee contributor profile must remain consistent across components for ${contributor.login}`,
        )
      }
      else {
        contributorProfilesByLogin.set(contributor.login, contributor)
      }
      contributorsByLogin.set(contributor.login, contributor)
    }

    const commitShas = new Set<string>()
    for (const commit of component.commits) {
      assertMetadata(isRecord(commit), `${expectedComponent.name} commit must be an object`)
      assertExactKeys(commit, ['author', 'date', 'message', 'sha', 'shortSha', 'url'], `${expectedComponent.name} commit`)
      assertMetadata(typeof commit.sha === 'string' && /^[a-f0-9]{40}$/.test(commit.sha), `${expectedComponent.name} commit SHA is invalid`)
      assertMetadata(commit.shortSha === commit.sha.slice(0, 7), `${expectedComponent.name} short SHA is invalid`)
      assertMetadata(!commitShas.has(commit.sha), `${expectedComponent.name} contains duplicate commit ${commit.sha}`)
      commitShas.add(commit.sha)
      assertMetadata(isNonEmptyString(commit.message), `${expectedComponent.name} commit message is required`)
      assertMetadata(isNonEmptyString(commit.date) && !Number.isNaN(Date.parse(commit.date)), `${expectedComponent.name} commit date must be an ISO date`)
      assertHttpUrl(commit.url, `${expectedComponent.name} commit URL`)
      assertMetadata(commit.url.startsWith(`${repository.webUrl}/commit/`), `${expectedComponent.name} commit URL must belong to the configured repository`)
      assertMetadata(isRecord(commit.author), `${expectedComponent.name} commit author must be an object`)
      assertExactKeys(commit.author, ['avatarUrl', 'login', 'name', 'profileUrl'], `${expectedComponent.name} commit author`)
      assertMetadata(isNonEmptyString(commit.author.login), `${expectedComponent.name} commit author login is required`)
      const contributor = contributorsByLogin.get(commit.author.login)
      assertMetadata(contributor, `${expectedComponent.name} commit author has no matching contributor`)
      assertMetadata(
        commit.author.avatarUrl === contributor.avatarUrl
        && commit.author.name === contributor.name
        && commit.author.profileUrl === contributor.profileUrl,
        `${expectedComponent.name} commit author must match its Gitee contributor profile`,
      )
    }
  }
}
