#!/usr/bin/env node

import type { GithubMetadataExpectation, GithubMetadataSnapshot } from '../.vitepress/repository/providers/github.ts'
import type { AtomicFileSystem } from './atomic-metadata-write.mts'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/catalog/component-manifest.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository/expectation.ts'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository/generated-snapshot.ts'
import { assertGithubMetadataSnapshot } from '../.vitepress/repository/providers/github.ts'
import { docsSite } from '../.vitepress/site/docs-site.ts'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-metadata-write.mts'
import { createGithubMetadata } from './github-metadata.mts'

const outputPath = repositoryMetadataSnapshotPath('github')

export function writeGithubMetadataAtomically(
  snapshot: GithubMetadataSnapshot,
  targetPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, targetPath, fileSystem)
}

export async function syncGithubMetadata(
  collectSnapshot: () => Promise<GithubMetadataSnapshot>,
  expectation: GithubMetadataExpectation,
  targetPath: string,
): Promise<GithubMetadataSnapshot> {
  const snapshot = await collectSnapshot()
  assertGithubMetadataSnapshot(snapshot, expectation)
  writeGithubMetadataAtomically(snapshot, targetPath)
  return snapshot
}

export function formatGithubSyncError(error: unknown, token?: string): string {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return token ? message.replaceAll(token, '[REDACTED]') : message
}

async function main(): Promise<void> {
  const repositoryMetadataExpectation = repositoryMetadataExpectations.github
  const snapshot = await syncGithubMetadata(() => createGithubMetadata({
    owner: repositoryMetadataExpectation.owner,
    repository: repositoryMetadataExpectation.repository,
    defaultBranch: repositoryMetadataExpectation.defaultBranch,
    components: repositoryMetadataExpectation.components,
    issueTitlePrefix: docsSite.repositories.github.issueTitlePrefix,
    excludeBotsFromContributors: docsSite.github.excludeBotsFromContributors,
    userAgent: docsSite.github.userAgent,
    token: process.env.GITHUB_TOKEN,
  }), repositoryMetadataExpectation, outputPath)
  console.log(`Synced GitHub metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('GitHub metadata sync failed; the previous snapshot was preserved.')
    console.error(formatGithubSyncError(error, process.env.GITHUB_TOKEN))
    process.exitCode = 1
  })
}
