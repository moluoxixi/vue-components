import { documentedComponents } from './component-manifest'
import { componentSourcePath, docsSite } from './docs-site'
import { assertGithubMetadataSnapshot } from './github-metadata-types'
import snapshot from './github-metadata.json'

const rawSnapshot: unknown = snapshot
assertGithubMetadataSnapshot(rawSnapshot, {
  owner: docsSite.repository.owner,
  repository: docsSite.repository.name,
  defaultBranch: docsSite.repository.defaultBranch,
  components: documentedComponents.map(component => ({
    name: component.name,
    path: componentSourcePath(component.name),
  })),
})

export const githubMetadata = rawSnapshot

export function getComponentGithubMetadata(componentName: string) {
  const metadata = githubMetadata.components[componentName]
  if (!metadata)
    throw new Error(`Missing validated GitHub metadata for ${componentName}`)
  return metadata
}
