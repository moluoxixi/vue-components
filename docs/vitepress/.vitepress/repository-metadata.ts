import selectedSnapshot from 'virtual:moluoxixi-repository-metadata-snapshot'
import { documentedComponents } from './component-manifest'
import { componentSourcePath, docsSite } from './docs-site'
import { resolveRepositoryMetadata } from './repository-metadata-types'

export const repositoryMetadata = resolveRepositoryMetadata({
  expectation: {
    components: documentedComponents.map(component => ({
      name: component.name,
      path: componentSourcePath(component.name),
    })),
    defaultBranch: docsSite.repository.defaultBranch,
    owner: docsSite.repository.owner,
    repository: docsSite.repository.name,
    repositoryUrl: docsSite.repository.url,
  },
  githubSnapshot: docsSite.metadataSource === 'github' ? selectedSnapshot : undefined,
  gitLocalSnapshot: docsSite.metadataSource === 'git-local' ? selectedSnapshot : undefined,
  source: docsSite.metadataSource,
})

export function getComponentRepositoryMetadata(componentName: string) {
  const metadata = repositoryMetadata.components[componentName]
  if (!metadata)
    throw new Error(`Missing validated ${repositoryMetadata.source} metadata for ${componentName}`)
  return metadata
}
