#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { componentSourcePath, docsSite } from '../.vitepress/docs-site.ts'
import { assertGithubMetadataSnapshot } from '../.vitepress/github-metadata-types.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const snapshotPath = resolve(scriptDir, '../.vitepress/github-metadata.json')
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

assertGithubMetadataSnapshot(snapshot, {
  owner: docsSite.repository.owner,
  repository: docsSite.repository.name,
  defaultBranch: docsSite.repository.defaultBranch,
  components: documentedComponents.map(component => ({
    name: component.name,
    path: componentSourcePath(component.name),
  })),
})

console.log(`Validated GitHub metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
