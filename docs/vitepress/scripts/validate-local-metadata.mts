#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { repositoryMetadataExpectation } from '../.vitepress/repository-metadata-expectation.ts'
import { repositoryMetadataProviders } from '../.vitepress/repository-metadata-providers.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const snapshotPath = resolve(scriptDir, '../.vitepress/local-metadata.json')
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

const metadata = repositoryMetadataProviders.resolve(
  'local',
  snapshot,
  repositoryMetadataExpectation,
)

console.log(`Validated local Git metadata for ${documentedComponents.length} components at ${metadata.repository.headSha.slice(0, 7)}.`)
