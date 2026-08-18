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
  components: Array<{
    name: string
    path: string
  }>
  defaultBranch: string
  owner?: string
  repository?: string
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

export interface RepositoryMetadataProvider {
  actions?: Readonly<RepositoryMetadataProviderActions>
  capabilities: Readonly<RepositoryMetadataCapabilities>
  id: string
  platform: string
  resolveSnapshot: (
    snapshot: unknown,
    expectation: RepositoryMetadataExpectation,
  ) => RepositoryMetadataPayload
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

function assertCapabilityAction(
  provider: RepositoryMetadataProvider,
  capability: 'editLinks' | 'issueActions' | 'sourceLinks',
  actionNames: Array<keyof RepositoryMetadataProviderActions>,
): void {
  const hasAllActions = actionNames.every(action => typeof provider.actions?.[action] === 'function')
  if (provider.capabilities[capability] !== hasAllActions) {
    throw new TypeError(
      `Repository metadata provider "${provider.id}" capability "${capability}" does not match its actions`,
    )
  }
}

export function defineRepositoryMetadataProvider<T extends RepositoryMetadataProvider>(provider: T): T {
  if (!provider.id.trim())
    throw new TypeError('Repository metadata provider id is required')
  if (!provider.platform.trim())
    throw new TypeError(`Repository metadata provider "${provider.id}" platform is required`)
  if (!provider.snapshotFile.trim() || provider.snapshotFile.includes('/') || provider.snapshotFile.includes('\\'))
    throw new TypeError(`Repository metadata provider "${provider.id}" snapshotFile must be a file name`)

  assertCapabilityAction(provider, 'sourceLinks', ['componentSourceHref', 'sourceLineHref'])
  assertCapabilityAction(provider, 'editLinks', ['editDocumentationHref'])
  assertCapabilityAction(provider, 'issueActions', ['newIssueHref', 'openIssuesHref'])
  return provider
}

function applyCapabilityPolicy(
  payload: RepositoryMetadataPayload,
  capabilities: RepositoryMetadataCapabilities,
): RepositoryMetadataPayload {
  return {
    ...payload,
    components: Object.fromEntries(Object.entries(payload.components).map(([name, component]) => [name, {
      ...component,
      commits: capabilities.commitHistory ? component.commits : [],
      contributors: capabilities.contributors
        ? component.contributors.map((contributor) => {
            if (capabilities.contributorProfiles)
              return contributor
            const { avatarUrl: _avatarUrl, login: _login, profileUrl: _profileUrl, ...identity } = contributor
            return identity
          })
        : [],
      ...(capabilities.issues && component.openIssueCount !== undefined
        ? { openIssueCount: component.openIssueCount }
        : { openIssueCount: undefined }),
    }])),
  }
}

export function createRepositoryMetadataProviderRegistry(
  providers: readonly RepositoryMetadataProvider[],
): RepositoryMetadataProviderRegistry {
  const providersById = new Map<string, RepositoryMetadataProvider>()
  for (const provider of providers) {
    const definedProvider = defineRepositoryMetadataProvider(provider)
    if (providersById.has(definedProvider.id))
      throw new TypeError(`Duplicate repository metadata provider: ${definedProvider.id}`)
    providersById.set(definedProvider.id, definedProvider)
  }

  const get = (providerId: string): RepositoryMetadataProvider => {
    const provider = providersById.get(providerId)
    if (!provider)
      throw new TypeError(`Unsupported repository metadata provider: ${providerId}`)
    return provider
  }

  return {
    get,
    ids: [...providersById.keys()],
    resolve(providerId, snapshot, expectation) {
      const provider = get(providerId)
      const payload = applyCapabilityPolicy(
        provider.resolveSnapshot(snapshot, expectation),
        provider.capabilities,
      )
      return {
        ...payload,
        provider: {
          capabilities: provider.capabilities,
          id: provider.id,
          platform: provider.platform,
        },
      }
    },
  }
}

export function repositoryMetadataProviderSupports(
  provider: Pick<RepositoryMetadataProviderIdentity, 'capabilities'>,
  capability: RepositoryMetadataCapability,
): boolean {
  return provider.capabilities[capability]
}
