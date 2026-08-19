#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository-metadata-alias.ts'
import { repositoryMetadataProviders } from '../.vitepress/repository-metadata-providers.ts'
import { repositoryMetadataSelection } from '../.vitepress/repository-metadata-selection.ts'

const snapshotPath = repositoryMetadataSnapshotPath(repositoryMetadataSelection.providerId)
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

const metadata = repositoryMetadataProviders.resolve(
  repositoryMetadataSelection.providerId,
  snapshot,
  repositoryMetadataSelection.expectation,
)

console.log(`Validated selected ${metadata.provider.id} metadata at ${metadata.repository.headSha.slice(0, 7)}.`)
