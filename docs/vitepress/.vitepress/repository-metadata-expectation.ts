import type { RepositoryMetadataExpectation } from './repository-metadata-types.ts'
import { documentedComponents } from './component-manifest.ts'
import { componentSourcePath, docsSite } from './docs-site.ts'

export const repositoryMetadataExpectation = {
  components: documentedComponents.map(component => ({
    name: component.name,
    path: componentSourcePath(component.name),
  })),
  defaultBranch: docsSite.repository.defaultBranch,
  owner: docsSite.repository.owner,
  repository: docsSite.repository.name,
  repositoryUrl: docsSite.repository.url,
} satisfies RepositoryMetadataExpectation
