#!/usr/bin/env node

import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { componentSourcePath, docsSite } from '../.vitepress/docs-site.ts'
import { assertGithubMetadataSnapshot } from '../.vitepress/github-metadata-types.ts'
import { createGithubMetadata } from './github-metadata.mts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(scriptDir, '../.vitepress/github-metadata.json')
const temporaryPath = `${outputPath}.tmp`

async function main(): Promise<void> {
  const snapshot = await createGithubMetadata({
    owner: docsSite.repository.owner,
    repository: docsSite.repository.name,
    defaultBranch: docsSite.repository.defaultBranch,
    components: documentedComponents.map(component => ({
      name: component.name,
      path: componentSourcePath(component.name),
    })),
    issueTitlePrefix: docsSite.github.issueTitlePrefix,
    excludeBotsFromContributors: docsSite.github.excludeBotsFromContributors,
    userAgent: docsSite.github.userAgent,
    token: process.env.GITHUB_TOKEN,
  })

  assertGithubMetadataSnapshot(snapshot, {
    owner: docsSite.repository.owner,
    repository: docsSite.repository.name,
    defaultBranch: docsSite.repository.defaultBranch,
    components: documentedComponents.map(component => ({
      name: component.name,
      path: componentSourcePath(component.name),
    })),
  })

  writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  renameSync(temporaryPath, outputPath)
  console.log(`Synced GitHub metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

main().catch((error: unknown) => {
  rmSync(temporaryPath, { force: true })
  console.error('GitHub metadata sync failed; the previous snapshot was preserved.')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
