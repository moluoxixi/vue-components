export interface RepositoryCommit {
  author: {
    avatarUrl?: string
    login?: string
    name: string
    profileUrl?: string
  }
  date: string
  message: string
  sha: string
  shortSha: string
  url: string
}

export interface RepositoryContributor {
  avatarUrl?: string
  contributions: number
  id: string
  login?: string
  name: string
  profileUrl?: string
}

export interface RepositoryComponentMetadata {
  commits: RepositoryCommit[]
  contributors: RepositoryContributor[]
  openIssueCount?: number
  path: string
}

export interface RepositoryMetadataCapabilities {
  commitHistory: boolean
  contributorProfiles: boolean
  contributors: boolean
  editLinks: boolean
  issueActions: boolean
  issues: boolean
  sourceLinks: boolean
}

export type RepositoryMetadataCapability = keyof RepositoryMetadataCapabilities

export interface RepositoryMetadataProviderIdentity {
  capabilities: Readonly<RepositoryMetadataCapabilities>
  id: string
  platform: string
}

export interface RepositoryMetadata {
  components: Record<string, RepositoryComponentMetadata>
  provider: RepositoryMetadataProviderIdentity
  repository: {
    defaultBranch: string
    headSha: string
  }
}

export interface RepositoryMetadataPayload {
  components: Record<string, RepositoryComponentMetadata>
  repository: RepositoryMetadata['repository']
}

export interface RepositoryMetadataExpectation {
  apiMode?: 'central' | 'region'
  components: Array<{
    name: string
    path: string
  }>
  defaultBranch: string
  owner?: string
  organizationId?: string
  projectPath?: string
  repository?: string
  repositoryId?: string
  repositoryPath?: string
  repositoryUrl?: string
}

export interface RepositoryFileLinkInput {
  defaultBranch: string
  path: string
  repositoryUrl: string
}

export interface RepositorySourceLineLinkInput extends RepositoryFileLinkInput {
  endLine: number
  startLine: number
}

export interface RepositoryIssueLinkInput {
  issueTitlePrefix: string
  repositoryUrl: string
}

export interface RepositoryMetadataProviderActions {
  componentSourceHref?: (input: RepositoryFileLinkInput) => string
  editDocumentationHref?: (input: RepositoryFileLinkInput) => string
  newIssueHref?: (input: RepositoryIssueLinkInput) => string
  openIssuesHref?: (input: RepositoryIssueLinkInput) => string
  sourceLineHref?: (input: RepositorySourceLineLinkInput) => string
}

export interface RepositoryMetadataProviderResolution {
  capabilities?: Partial<RepositoryMetadataCapabilities>
  payload: RepositoryMetadataPayload
}

export interface RepositoryMetadataProvider {
  actions?: Readonly<RepositoryMetadataProviderActions>
  capabilities: Readonly<RepositoryMetadataCapabilities>
  id: string
  platform: string
  resolveSnapshot: (
    snapshot: unknown,
    expectation: RepositoryMetadataExpectation,
  ) => RepositoryMetadataPayload | RepositoryMetadataProviderResolution
  snapshotFile: string
}

export interface RepositoryMetadataProviderRegistry {
  get: (providerId: string) => RepositoryMetadataProvider
  ids: readonly string[]
  resolve: (
    providerId: string,
    snapshot: unknown,
    expectation: RepositoryMetadataExpectation,
  ) => RepositoryMetadata
}
