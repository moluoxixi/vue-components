export type YunxiaoApiMode = 'central' | 'region'

export interface YunxiaoCommit {
  author: { name: string }
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface YunxiaoContributor {
  contributions: number
  id: string
  name: string
}

export interface YunxiaoComponentMetadata {
  commits: YunxiaoCommit[]
  contributors: YunxiaoContributor[]
  path: string
}

export interface YunxiaoMetadataSnapshot {
  schemaVersion: 1
  generatedAt: string
  repository: {
    apiMode: YunxiaoApiMode
    defaultBranch: string
    headSha: string
    organizationId: string
    repositoryId: string
    repositoryPath: string
    webUrl: string
  }
  components: Record<string, YunxiaoComponentMetadata>
}

export interface YunxiaoMetadataExpectation {
  apiMode: YunxiaoApiMode
  components: Array<{ name: string, path: string }>
  defaultBranch: string
  organizationId: string
  repositoryId: string
  repositoryPath: string
  repositoryUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function assertMetadata(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new TypeError(`Invalid Yunxiao metadata snapshot: ${message}`)
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
    throw new TypeError(`Invalid Yunxiao metadata snapshot: ${label} must be a URL`)
  }
}

export function assertYunxiaoMetadataSnapshot(
  value: unknown,
  expected: YunxiaoMetadataExpectation,
): asserts value is YunxiaoMetadataSnapshot {
  assertMetadata(
    ![
      expected.organizationId,
      expected.repositoryId,
      expected.repositoryPath,
      expected.repositoryUrl,
    ].some(field => field.includes('configure-yunxiao')),
    'provider configuration is still a placeholder',
  )
  assertMetadata(isRecord(value), 'root must be an object')
  assertExactKeys(value, ['schemaVersion', 'generatedAt', 'repository', 'components'], 'root')
  assertMetadata(value.schemaVersion === 1, 'unsupported schemaVersion')
  assertMetadata(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), 'generatedAt must be an ISO date')
  assertMetadata(isRecord(value.repository), 'repository must be an object')
  assertExactKeys(value.repository, [
    'apiMode',
    'defaultBranch',
    'headSha',
    'organizationId',
    'repositoryId',
    'repositoryPath',
    'webUrl',
  ], 'repository')
  const repository = value.repository
  assertMetadata(repository.apiMode === expected.apiMode, `apiMode must be ${expected.apiMode}`)
  assertMetadata(repository.organizationId === expected.organizationId, `organizationId must be ${expected.organizationId}`)
  assertMetadata(repository.repositoryId === expected.repositoryId, `repositoryId must be ${expected.repositoryId}`)
  assertMetadata(repository.repositoryPath === expected.repositoryPath, `repositoryPath must be ${expected.repositoryPath}`)
  assertMetadata(repository.defaultBranch === expected.defaultBranch, `defaultBranch must be ${expected.defaultBranch}`)
  assertMetadata(repository.webUrl === expected.repositoryUrl.replace(/\/+$/, ''), `repository webUrl must be ${expected.repositoryUrl.replace(/\/+$/, '')}`)
  assertMetadata(typeof repository.headSha === 'string' && /^[a-f0-9]{40}$/.test(repository.headSha), 'headSha must be a full commit SHA')
  assertMetadata(repository.headSha !== '0'.repeat(40), 'headSha cannot be the placeholder SHA')
  assertHttpUrl(repository.webUrl, 'repository webUrl')
  assertMetadata(isRecord(value.components), 'components must be an object')

  const expectedNames = expected.components.map(component => component.name).sort()
  assertMetadata(JSON.stringify(Object.keys(value.components).sort()) === JSON.stringify(expectedNames), 'component keys must exactly match the documentation manifest')
  for (const expectedComponent of expected.components) {
    const component = value.components[expectedComponent.name]
    assertMetadata(isRecord(component), `${expectedComponent.name} must be an object`)
    assertExactKeys(component, ['commits', 'contributors', 'path'], expectedComponent.name)
    assertMetadata(component.path === expectedComponent.path, `${expectedComponent.name} has an unexpected source path`)
    assertMetadata(Array.isArray(component.commits), `${expectedComponent.name}.commits must be an array`)
    assertMetadata(Array.isArray(component.contributors), `${expectedComponent.name}.contributors must be an array`)

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
      assertMetadata(isRecord(commit.author), `${expectedComponent.name} commit author must be an object`)
      assertExactKeys(commit.author, ['name'], `${expectedComponent.name} commit author`)
      assertMetadata(isNonEmptyString(commit.author.name), `${expectedComponent.name} commit author is invalid`)
    }

    const contributorIds = new Set<string>()
    for (const contributor of component.contributors) {
      assertMetadata(isRecord(contributor), `${expectedComponent.name} contributor must be an object`)
      assertExactKeys(contributor, ['contributions', 'id', 'name'], `${expectedComponent.name} contributor`)
      assertMetadata(isNonEmptyString(contributor.id) && contributor.id.startsWith('yunxiao:'), `${expectedComponent.name} contributor id is invalid`)
      assertMetadata(!contributorIds.has(contributor.id), `${expectedComponent.name} contains duplicate contributor ${contributor.id}`)
      contributorIds.add(contributor.id)
      assertMetadata(isNonEmptyString(contributor.name), `${expectedComponent.name} contributor name is required`)
      assertMetadata(Number.isInteger(contributor.contributions) && Number(contributor.contributions) > 0, `${expectedComponent.name} contribution count is invalid`)
    }
  }
}
