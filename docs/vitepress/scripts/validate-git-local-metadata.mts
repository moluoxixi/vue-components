#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { componentSourcePath, docsSite } from '../.vitepress/docs-site.ts'
import { assertGitLocalMetadataSnapshot } from '../.vitepress/git-local-metadata-types.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const snapshotPath = resolve(scriptDir, '../.vitepress/git-local-metadata.json')
const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))

assertGitLocalMetadataSnapshot(snapshot, {
  components: documentedComponents.map(component => ({
    name: component.name,
    path: componentSourcePath(component.name),
  })),
  defaultBranch: docsSite.repository.defaultBranch,
  repositoryUrl: docsSite.repository.url,
})

console.log(`Validated local Git metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
