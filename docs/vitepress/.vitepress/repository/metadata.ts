import selectedSnapshot from 'virtual:moluoxixi-repository-metadata-snapshot'
import { repositoryMetadataProviders } from './providers'
import { repositoryMetadataSelection } from './selection'

export const configuredRepositoryMetadataProvider = repositoryMetadataSelection.provider

export const repositoryMetadata = repositoryMetadataProviders.resolve(
  configuredRepositoryMetadataProvider.id,
  selectedSnapshot,
  repositoryMetadataSelection.expectation,
)

export const configuredRepositoryMetadataContentProvider = {
  actions: configuredRepositoryMetadataProvider.actions,
  capabilities: repositoryMetadata.provider.capabilities,
}

export function getComponentRepositoryMetadata(componentName: string) {
  const metadata = repositoryMetadata.components[componentName]
  if (!metadata)
    throw new Error(`Missing validated ${repositoryMetadata.provider.id} metadata for ${componentName}`)
  return metadata
}
