import type {
  RepositoryMetadataCapabilities,
  RepositoryMetadataCapability,
  RepositoryMetadataPayload,
  RepositoryMetadataProvider,
  RepositoryMetadataProviderActions,
  RepositoryMetadataProviderIdentity,
  RepositoryMetadataProviderRegistry,
  RepositoryMetadataProviderResolution,
} from './types'

const capabilityNames = [
  'commitHistory',
  'contributorProfiles',
  'contributors',
  'editLinks',
  'issueActions',
  'issues',
  'sourceLinks',
] as const satisfies readonly RepositoryMetadataCapability[]

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

function isProviderResolution(
  value: RepositoryMetadataPayload | RepositoryMetadataProviderResolution,
): value is RepositoryMetadataProviderResolution {
  return 'payload' in value
}

function resolveCapabilities(
  provider: RepositoryMetadataProvider,
  overrides: Partial<RepositoryMetadataCapabilities> | undefined,
): RepositoryMetadataCapabilities {
  const capabilities = {} as RepositoryMetadataCapabilities
  for (const capability of capabilityNames) {
    const configured = provider.capabilities[capability]
    const override = overrides?.[capability]
    if (override === true && !configured) {
      throw new TypeError(
        `Repository metadata provider "${provider.id}" snapshot cannot enable capability "${capability}"`,
      )
    }
    capabilities[capability] = override ?? configured
  }
  return capabilities
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
    ids: Object.freeze([...providersById.keys()]),
    resolve(providerId, snapshot, expectation) {
      const provider = get(providerId)
      const resolved = provider.resolveSnapshot(snapshot, expectation)
      const payload = isProviderResolution(resolved) ? resolved.payload : resolved
      const capabilities = resolveCapabilities(
        provider,
        isProviderResolution(resolved) ? resolved.capabilities : undefined,
      )
      return {
        ...applyCapabilityPolicy(payload, capabilities),
        provider: {
          capabilities: Object.freeze(capabilities),
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
