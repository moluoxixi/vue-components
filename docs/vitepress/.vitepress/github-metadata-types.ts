export interface GithubContributorProfile {
  login: string
  name: string
  avatarUrl: string
  profileUrl: string
}

export interface GithubComponentContributor {
  login: string
  contributions: number
}

export interface GithubCommitAuthor {
  login?: string
  name: string
  avatarUrl?: string
  profileUrl?: string
}

export interface GithubCommit {
  sha: string
  shortSha: string
  message: string
  date: string
  url: string
  author: GithubCommitAuthor
}

export interface GithubIssueSummary {
  number: number
  title: string
  url: string
}

export interface GithubComponentMetadata {
  path: string
  openIssueCount: number
  openIssues: GithubIssueSummary[]
  contributors: GithubComponentContributor[]
  commits: GithubCommit[]
}

export interface GithubMetadataSnapshot {
  schemaVersion: 1
  generatedAt: string
  repository: {
    owner: string
    name: string
    defaultBranch: string
    headSha: string
    openIssueCount: number
  }
  profiles: Record<string, GithubContributorProfile>
  components: Record<string, GithubComponentMetadata>
}

export interface GithubMetadataExpectation {
  owner: string
  repository: string
  defaultBranch: string
  components: Array<{
    name: string
    path: string
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertMetadata(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new TypeError(`Invalid GitHub metadata snapshot: ${message}`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function assertGithubMetadataSnapshot(
  value: unknown,
  expected: GithubMetadataExpectation,
): asserts value is GithubMetadataSnapshot {
  assertMetadata(isRecord(value), 'root must be an object')
  assertMetadata(value.schemaVersion === 1, 'unsupported schemaVersion')
  assertMetadata(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), 'generatedAt must be an ISO date')
  assertMetadata(isRecord(value.repository), 'repository must be an object')

  const repository = value.repository
  assertMetadata(repository.owner === expected.owner, `repository owner must be ${expected.owner}`)
  assertMetadata(repository.name === expected.repository, `repository name must be ${expected.repository}`)
  assertMetadata(repository.defaultBranch === expected.defaultBranch, `defaultBranch must be ${expected.defaultBranch}`)
  assertMetadata(typeof repository.headSha === 'string' && /^[a-f0-9]{40}$/.test(repository.headSha), 'headSha must be a full commit SHA')
  assertMetadata(Number.isInteger(repository.openIssueCount) && Number(repository.openIssueCount) >= 0, 'repository openIssueCount must be a non-negative integer')
  assertMetadata(isRecord(value.profiles), 'profiles must be an object')
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(
    JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames),
    'component keys must exactly match the documentation manifest',
  )

  for (const [login, rawProfile] of Object.entries(value.profiles)) {
    assertMetadata(isRecord(rawProfile), `profile ${login} must be an object`)
    assertMetadata(rawProfile.login === login, `profile ${login} has a mismatched login`)
    assertMetadata(isNonEmptyString(rawProfile.name), `profile ${login} requires a name`)
    assertMetadata(isNonEmptyString(rawProfile.avatarUrl), `profile ${login} requires an avatarUrl`)
    assertMetadata(isNonEmptyString(rawProfile.profileUrl), `profile ${login} requires a profileUrl`)
  }

  for (const expectedComponent of expected.components) {
    const rawComponent = value.components[expectedComponent.name]
    assertMetadata(isRecord(rawComponent), `${expectedComponent.name} must be an object`)
    assertMetadata(rawComponent.path === expectedComponent.path, `${expectedComponent.name} has an unexpected source path`)
    assertMetadata(Array.isArray(rawComponent.openIssues), `${expectedComponent.name}.openIssues must be an array`)
    assertMetadata(Number.isInteger(rawComponent.openIssueCount), `${expectedComponent.name}.openIssueCount must be an integer`)
    assertMetadata(rawComponent.openIssueCount === rawComponent.openIssues.length, `${expectedComponent.name}.openIssueCount must match openIssues`)
    assertMetadata(Array.isArray(rawComponent.contributors), `${expectedComponent.name}.contributors must be an array`)
    assertMetadata(Array.isArray(rawComponent.commits), `${expectedComponent.name}.commits must be an array`)

    for (const rawIssue of rawComponent.openIssues) {
      assertMetadata(isRecord(rawIssue), `${expectedComponent.name} issue must be an object`)
      assertMetadata(Number.isInteger(rawIssue.number) && Number(rawIssue.number) > 0, `${expectedComponent.name} issue number is invalid`)
      assertMetadata(isNonEmptyString(rawIssue.title), `${expectedComponent.name} issue title is required`)
      assertMetadata(isNonEmptyString(rawIssue.url), `${expectedComponent.name} issue URL is required`)
    }

    for (const rawContributor of rawComponent.contributors) {
      assertMetadata(isRecord(rawContributor), `${expectedComponent.name} contributor must be an object`)
      assertMetadata(isNonEmptyString(rawContributor.login), `${expectedComponent.name} contributor login is required`)
      assertMetadata(Number.isInteger(rawContributor.contributions) && Number(rawContributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
      assertMetadata(isRecord(value.profiles[rawContributor.login]), `${expectedComponent.name} contributor ${rawContributor.login} has no profile`)
    }

    const commitShas = new Set<string>()
    for (const rawCommit of rawComponent.commits) {
      assertMetadata(isRecord(rawCommit), `${expectedComponent.name} commit must be an object`)
      assertMetadata(typeof rawCommit.sha === 'string' && /^[a-f0-9]{40}$/.test(rawCommit.sha), `${expectedComponent.name} commit SHA is invalid`)
      assertMetadata(rawCommit.shortSha === rawCommit.sha.slice(0, 7), `${expectedComponent.name} short SHA is invalid`)
      assertMetadata(!commitShas.has(rawCommit.sha), `${expectedComponent.name} contains duplicate commit ${rawCommit.sha}`)
      commitShas.add(rawCommit.sha)
      assertMetadata(isNonEmptyString(rawCommit.message), `${expectedComponent.name} commit message is required`)
      assertMetadata(
        isNonEmptyString(rawCommit.date) && !Number.isNaN(Date.parse(rawCommit.date)),
        `${expectedComponent.name} commit date must be an ISO date`,
      )
      assertMetadata(isNonEmptyString(rawCommit.url), `${expectedComponent.name} commit URL is required`)
      assertMetadata(isRecord(rawCommit.author) && isNonEmptyString(rawCommit.author.name), `${expectedComponent.name} commit author is invalid`)
    }
  }
}
