#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { docsSite } from '../.vitepress/docs-site.ts'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository-metadata-alias.ts'
import { repositoryMetadataExpectation } from '../.vitepress/repository-metadata-expectation.ts'
import { repositoryMetadataProviders } from '../.vitepress/repository-metadata-providers.ts'

const provider = repositoryMetadataProviders.get(docsSite.metadataProvider)
const snapshotPath = repositoryMetadataSnapshotPath(provider.id)
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

const metadata = repositoryMetadataProviders.resolve(
  provider.id,
  snapshot,
  repositoryMetadataExpectation,
)

console.log(`Validated selected ${metadata.provider.id} metadata at ${metadata.repository.headSha.slice(0, 7)}.`)
