import { repositoryMetadataSnapshotPath as resolveSnapshotPath } from '../site/generated-paths.ts'
import { repositoryMetadataProviders } from './providers/index.ts'

export const repositoryMetadataSnapshotId = 'virtual:moluoxixi-repository-metadata-snapshot'

export function repositoryMetadataSnapshotPath(providerId: string): string {
  const provider = repositoryMetadataProviders.get(providerId)
  return resolveSnapshotPath(provider.snapshotFile)
}
