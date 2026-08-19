export interface GitlabCommit {
  author: {
    name: string
  }
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface GitlabContributor {
  contributions: number
  id: string
  name: string
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
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(
    JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames),
    'component keys must exactly match the documentation manifest',
  )

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
        assertMetadata(rawIssue.url.startsWith(`${repository.webUrl}/-/issues/`), `${expectedComponent.name} issue URL must belong to the configured project`)
      }
    }

    const contributorIds = new Set<string>()
    for (const rawContributor of rawComponent.contributors) {
      assertMetadata(isRecord(rawContributor), `${expectedComponent.name} contributor must be an object`)
      assertExactKeys(rawContributor, ['contributions', 'id', 'name'], `${expectedComponent.name} contributor`)
      assertMetadata(isNonEmptyString(rawContributor.id) && rawContributor.id.startsWith('gitlab:'), `${expectedComponent.name} contributor id is invalid`)
      assertMetadata(!contributorIds.has(rawContributor.id), `${expectedComponent.name} contains duplicate contributor ${rawContributor.id}`)
      contributorIds.add(rawContributor.id)
      assertMetadata(isNonEmptyString(rawContributor.name), `${expectedComponent.name} contributor name is required`)
      assertMetadata(Number.isInteger(rawContributor.contributions) && Number(rawContributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
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
      assertMetadata(rawCommit.url.startsWith(`${repository.webUrl}/-/commit/`), `${expectedComponent.name} commit URL must belong to the configured project`)
      assertMetadata(isRecord(rawCommit.author), `${expectedComponent.name} commit author must be an object`)
      assertExactKeys(rawCommit.author, ['name'], `${expectedComponent.name} commit author`)
      assertMetadata(isNonEmptyString(rawCommit.author.name), `${expectedComponent.name} commit author is invalid`)
    }
  }
}
