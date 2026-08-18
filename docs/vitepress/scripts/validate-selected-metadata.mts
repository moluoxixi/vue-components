#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { componentSourcePath, docsSite } from '../.vitepress/docs-site.ts'
import { resolveRepositoryMetadata } from '../.vitepress/repository-metadata-types.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const snapshotFile = docsSite.metadataSource === 'github'
  ? 'github-metadata.json'
  : 'git-local-metadata.json'
const snapshotPath = resolve(scriptDir, `../.vitepress/${snapshotFile}`)
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

const metadata = resolveRepositoryMetadata({
  expectation: {
    components: documentedComponents.map(component => ({
      name: component.name,
      path: componentSourcePath(component.name),
    })),
    defaultBranch: docsSite.repository.defaultBranch,
    owner: docsSite.repository.owner,
    repository: docsSite.repository.name,
    repositoryUrl: docsSite.repository.url,
  },
  githubSnapshot: docsSite.metadataSource === 'github' ? snapshot : undefined,
  gitLocalSnapshot: docsSite.metadataSource === 'git-local' ? snapshot : undefined,
  source: docsSite.metadataSource,
})

console.log(`Validated selected ${metadata.source} metadata at ${metadata.repository.headSha.slice(0, 7)}.`)
