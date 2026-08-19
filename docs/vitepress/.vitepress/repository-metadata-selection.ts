import type {
  RepositoryMetadataExpectation,
  RepositoryMetadataProvider,
  RepositoryMetadataProviderRegistry,
} from './repository-metadata-types.ts'
import { docsSite } from './docs-site.ts'
import { repositoryMetadataExpectations } from './repository-metadata-expectation.ts'
import { repositoryMetadataProviders } from './repository-metadata-providers.ts'

export interface DocsRepositoryConfiguration {
  defaultBranch: string
  issueTitlePrefix?: (componentName: string) => string
  url: string
}

export interface DocsRepositoryMetadataSelection {
  expectation: RepositoryMetadataExpectation
  provider: RepositoryMetadataProvider
  providerId: string
  repository: DocsRepositoryConfiguration
  snapshotFile: string
}

export function selectRepositoryMetadataConfiguration(
  providerId: string,
  repositories: Readonly<Record<string, DocsRepositoryConfiguration>>,
  expectations: Readonly<Record<string, RepositoryMetadataExpectation>>,
  providers: RepositoryMetadataProviderRegistry,
): DocsRepositoryMetadataSelection {
  const provider = providers.get(providerId)
  const repository = repositories[provider.id]
  const expectation = expectations[provider.id]
  if (!repository)
    throw new TypeError(`Missing repository configuration for provider: ${provider.id}`)
  if (!expectation)
    throw new TypeError(`Missing repository metadata expectation for provider: ${provider.id}`)
  if (expectation.defaultBranch !== repository.defaultBranch)
    throw new TypeError(`Repository metadata provider "${provider.id}" has mismatched default branches`)
  if (expectation.repositoryUrl?.replace(/\/+$/, '') !== repository.url.replace(/\/+$/, ''))
    throw new TypeError(`Repository metadata provider "${provider.id}" has mismatched repository URLs`)
  if (provider.capabilities.issueActions && !repository.issueTitlePrefix)
    throw new TypeError(`Repository metadata provider "${provider.id}" requires an issue title prefix`)

  return Object.freeze({
    expectation,
    provider,
    providerId: provider.id,
    repository,
    snapshotFile: provider.snapshotFile,
  })
}

export function createRepositoryMetadataActionInput(
  selection: DocsRepositoryMetadataSelection,
  componentName: string,
) {
  return {
    defaultBranch: selection.repository.defaultBranch,
    issueTitlePrefix: selection.repository.issueTitlePrefix?.(componentName) ?? '',
    repositoryUrl: selection.repository.url,
  }
}

export const repositoryMetadataSelection = selectRepositoryMetadataConfiguration(
  docsSite.metadataProvider,
  docsSite.repositories,
  repositoryMetadataExpectations,
  repositoryMetadataProviders,
)
