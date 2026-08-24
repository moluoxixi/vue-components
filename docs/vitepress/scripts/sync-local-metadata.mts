#!/usr/bin/env node

import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/catalog/component-manifest.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository/expectation.ts'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository/generated-snapshot.ts'
import { docsSite } from '../.vitepress/site/docs-site.ts'
import { createLocalMetadata, writeLocalMetadata } from './local-metadata.mts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '../../..')
const outputPath = repositoryMetadataSnapshotPath('local')
const repository = docsSite.repositories.local
const components = repositoryMetadataExpectations.local.components

try {
  const snapshot = createLocalMetadata({
    components,
    defaultBranch: repository.defaultBranch,
    repositoryRoot,
    repositoryUrl: repository.url,
  })

  writeLocalMetadata({
    expectation: {
      components,
      defaultBranch: repository.defaultBranch,
      repositoryUrl: repository.url,
    },
    outputPath,
    snapshot,
  })

  console.log(`Synced local Git metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}
catch (error) {
  console.error('Local Git metadata sync failed; the previous snapshot was preserved.')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
