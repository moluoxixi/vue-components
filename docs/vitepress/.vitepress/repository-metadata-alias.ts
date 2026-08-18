import type { RepositoryMetadataSource } from './docs-site'
import { fileURLToPath } from 'node:url'

export const repositoryMetadataSnapshotId = 'virtual:moluoxixi-repository-metadata-snapshot'

export function repositoryMetadataSnapshotPath(source: RepositoryMetadataSource): string {
  if (source === 'github')
    return fileURLToPath(new URL('./github-metadata.json', import.meta.url))
  if (source === 'git-local')
    return fileURLToPath(new URL('./git-local-metadata.json', import.meta.url))
  throw new TypeError(`Unsupported repository metadata source: ${String(source)}`)
}
