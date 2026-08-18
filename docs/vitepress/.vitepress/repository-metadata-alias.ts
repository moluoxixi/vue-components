import { fileURLToPath } from 'node:url'
import { repositoryMetadataProviders } from './repository-metadata-providers.ts'

export const repositoryMetadataSnapshotId = 'virtual:moluoxixi-repository-metadata-snapshot'

export function repositoryMetadataSnapshotPath(providerId: string): string {
  const provider = repositoryMetadataProviders.get(providerId)
  return fileURLToPath(new URL(`./${provider.snapshotFile}`, import.meta.url))
}
