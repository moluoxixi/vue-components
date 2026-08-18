export interface GitLocalCommitAuthor {
  name: string
}

export interface GitLocalCommit {
  author: GitLocalCommitAuthor
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface GitLocalContributor {
  contributions: number
  id: string
  name: string
}

export interface GitLocalComponentMetadata {
  commits: GitLocalCommit[]
  contributors: GitLocalContributor[]
  path: string
}

export interface GitLocalMetadataSnapshot {
  schemaVersion: 1
  generatedAt: string
  repository: {
    defaultBranch: string
    headSha: string
    url: string
  }
  components: Record<string, GitLocalComponentMetadata>
}

export interface GitLocalMetadataExpectation {
  defaultBranch: string
  repositoryUrl: string
  components: Array<{
    name: string
    path: string
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function assertMetadata(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new TypeError(`Invalid local Git metadata snapshot: ${message}`)
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: string[], label: string): void {
  const actualKeys = Object.keys(value).sort()
  const allowedKeys = [...expectedKeys].sort()
  assertMetadata(
    JSON.stringify(actualKeys) === JSON.stringify(allowedKeys),
    `${label} contains unsupported or missing fields`,
  )
}

export function assertGitLocalMetadataSnapshot(
  value: unknown,
  expected: GitLocalMetadataExpectation,
): asserts value is GitLocalMetadataSnapshot {
  assertMetadata(isRecord(value), 'root must be an object')
  assertExactKeys(value, ['schemaVersion', 'generatedAt', 'repository', 'components'], 'root')
  assertMetadata(value.schemaVersion === 1, 'unsupported schemaVersion')
  assertMetadata(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), 'generatedAt must be an ISO date')
  assertMetadata(isRecord(value.repository), 'repository must be an object')
  assertExactKeys(value.repository, ['defaultBranch', 'headSha', 'url'], 'repository')
  assertMetadata(value.repository.defaultBranch === expected.defaultBranch, `repository default branch must be ${expected.defaultBranch}`)
  assertMetadata(value.repository.url === expected.repositoryUrl, `repository URL must be ${expected.repositoryUrl}`)
  assertMetadata(typeof value.repository.headSha === 'string' && /^[a-f0-9]{40}$/.test(value.repository.headSha), 'headSha must be a full commit SHA')
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(
    JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames),
    'component keys must exactly match the documentation manifest',
  )

  for (const expectedComponent of expected.components) {
    const rawComponent = value.components[expectedComponent.name]
    assertMetadata(isRecord(rawComponent), `${expectedComponent.name} must be an object`)
    assertExactKeys(rawComponent, ['path', 'commits', 'contributors'], expectedComponent.name)
    assertMetadata(rawComponent.path === expectedComponent.path, `${expectedComponent.name} has an unexpected source path`)
    assertMetadata(Array.isArray(rawComponent.commits), `${expectedComponent.name}.commits must be an array`)
    assertMetadata(Array.isArray(rawComponent.contributors), `${expectedComponent.name}.contributors must be an array`)

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
      assertMetadata(isNonEmptyString(rawCommit.url), `${expectedComponent.name} commit URL is required`)
      assertMetadata(isRecord(rawCommit.author), `${expectedComponent.name} commit author is invalid`)
      assertExactKeys(rawCommit.author, ['name'], `${expectedComponent.name} commit author`)
      assertMetadata(isNonEmptyString(rawCommit.author.name), `${expectedComponent.name} commit author is invalid`)
    }

    const contributorIds = new Set<string>()
    for (const rawContributor of rawComponent.contributors) {
      assertMetadata(isRecord(rawContributor), `${expectedComponent.name} contributor must be an object`)
      assertExactKeys(rawContributor, ['contributions', 'id', 'name'], `${expectedComponent.name} contributor`)
      assertMetadata(isNonEmptyString(rawContributor.id), `${expectedComponent.name} contributor id is required`)
      assertMetadata(!contributorIds.has(rawContributor.id), `${expectedComponent.name} contains duplicate contributor ${rawContributor.id}`)
      contributorIds.add(rawContributor.id)
      assertMetadata(isNonEmptyString(rawContributor.name), `${expectedComponent.name} contributor name is required`)
      assertMetadata(Number.isInteger(rawContributor.contributions) && Number(rawContributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
    }
  }
}
