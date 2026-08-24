import type {
  RepositoryMetadata,
  RepositoryMetadataExpectation,
} from '../.vitepress/repository/types.ts'
import { readFileSync } from 'node:fs'
import { repositoryMetadataExpectations } from '../.vitepress/repository/expectation.ts'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository/generated-snapshot.ts'
import { repositoryMetadataProviders } from '../.vitepress/repository/providers/index.ts'

export function validateRepositoryMetadataSnapshot(
  providerId: string,
  snapshot: unknown,
  expectations: Readonly<Record<string, RepositoryMetadataExpectation>> = repositoryMetadataExpectations,
): RepositoryMetadata {
  const expectation = expectations[providerId]
  if (!expectation)
    throw new TypeError(`Missing repository metadata expectation for provider: ${providerId}`)
  return repositoryMetadataProviders.resolve(providerId, snapshot, expectation)
}

export function readAndValidateRepositoryMetadata(
  providerId: string,
): RepositoryMetadata {
  const snapshotPath = repositoryMetadataSnapshotPath(providerId)
  const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  return validateRepositoryMetadataSnapshot(providerId, snapshot)
}
