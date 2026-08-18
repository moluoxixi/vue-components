import selectedSnapshot from 'virtual:moluoxixi-repository-metadata-snapshot'
import { docsSite } from './docs-site'
import { repositoryMetadataExpectation } from './repository-metadata-expectation'
import { repositoryMetadataProviders } from './repository-metadata-providers'

export const configuredRepositoryMetadataProvider = repositoryMetadataProviders.get(
  docsSite.metadataProvider,
)

export const repositoryMetadata = repositoryMetadataProviders.resolve(
  configuredRepositoryMetadataProvider.id,
  selectedSnapshot,
  repositoryMetadataExpectation,
)

export function getComponentRepositoryMetadata(componentName: string) {
  const metadata = repositoryMetadata.components[componentName]
  if (!metadata)
    throw new Error(`Missing validated ${repositoryMetadata.provider.id} metadata for ${componentName}`)
  return metadata
}
