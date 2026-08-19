#!/usr/bin/env node

import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { docsSite } from '../.vitepress/docs-site.ts'
import { assertGithubMetadataSnapshot } from '../.vitepress/github-metadata-types.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository-metadata-expectation.ts'
import { writeJsonAtomically } from './atomic-metadata-write.mts'
import { createGithubMetadata } from './github-metadata.mts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(scriptDir, '../.vitepress/github-metadata.json')

async function main(): Promise<void> {
  const repositoryMetadataExpectation = repositoryMetadataExpectations.github
  const snapshot = await createGithubMetadata({
    owner: repositoryMetadataExpectation.owner,
    repository: repositoryMetadataExpectation.repository,
    defaultBranch: repositoryMetadataExpectation.defaultBranch,
    components: repositoryMetadataExpectation.components,
    issueTitlePrefix: docsSite.repositories.github.issueTitlePrefix,
    excludeBotsFromContributors: docsSite.github.excludeBotsFromContributors,
    userAgent: docsSite.github.userAgent,
    token: process.env.GITHUB_TOKEN,
  })

  assertGithubMetadataSnapshot(snapshot, repositoryMetadataExpectation)

  writeJsonAtomically(snapshot, outputPath)
  console.log(`Synced GitHub metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

main().catch((error: unknown) => {
  console.error('GitHub metadata sync failed; the previous snapshot was preserved.')
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
