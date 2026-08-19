#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository-metadata-expectation.ts'
import { repositoryMetadataProviders } from '../.vitepress/repository-metadata-providers.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const snapshotPath = resolve(scriptDir, '../.vitepress/github-metadata.json')
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
const repositoryMetadataExpectation = repositoryMetadataExpectations.github

const metadata = repositoryMetadataProviders.resolve(
  'github',
  snapshot,
  repositoryMetadataExpectation,
)

console.log(`Validated GitHub metadata for ${documentedComponents.length} components at ${metadata.repository.headSha.slice(0, 7)}.`)
