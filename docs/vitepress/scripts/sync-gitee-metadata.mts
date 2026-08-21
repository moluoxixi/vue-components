#!/usr/bin/env node

import type { GiteeMetadataExpectation, GiteeMetadataSnapshot } from '../.vitepress/gitee-metadata-types.ts'
import type { AtomicFileSystem } from './atomic-metadata-write.mts'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { docsSite } from '../.vitepress/docs-site.ts'
import { assertGiteeMetadataSnapshot } from '../.vitepress/gitee-metadata-types.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository-metadata-expectation.ts'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-metadata-write.mts'
import { createGiteeMetadata } from './gitee-metadata.mts'

export function writeGiteeMetadataAtomically(
  snapshot: GiteeMetadataSnapshot,
  outputPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, outputPath, fileSystem)
}

export async function syncGiteeMetadata(
  collectSnapshot: () => Promise<GiteeMetadataSnapshot>,
  expectation: GiteeMetadataExpectation,
  outputPath: string,
): Promise<GiteeMetadataSnapshot> {
  const snapshot = await collectSnapshot()
  assertGiteeMetadataSnapshot(snapshot, expectation)
  writeGiteeMetadataAtomically(snapshot, outputPath)
  return snapshot
}

export function formatGiteeSyncError(error: unknown, token?: string): string {
  let message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  if (!token)
    return message

  const queryEncodedToken = new URLSearchParams({ access_token: token })
    .toString()
    .slice('access_token='.length)
  for (const secret of new Set([token, encodeURIComponent(token), queryEncodedToken]))
    message = message.replaceAll(secret, '[REDACTED]')
  return message
}

async function main(): Promise<void> {
  const expectation = repositoryMetadataExpectations.gitee
  const config = docsSite.repositories.gitee
  const token = process.env.GITEE_TOKEN
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const outputPath = resolve(scriptDir, '../.vitepress/gitee-metadata.json')
  const snapshot = await syncGiteeMetadata(() => createGiteeMetadata({
    apiBaseUrl: config.apiBaseUrl,
    components: expectation.components,
    defaultBranch: expectation.defaultBranch,
    issueTitlePrefix: config.issueTitlePrefix,
    owner: expectation.owner,
    repository: expectation.repository,
    repositoryUrl: expectation.repositoryUrl,
    token,
    userAgent: config.userAgent,
    webBaseUrl: config.webBaseUrl,
  }), expectation, outputPath)
  console.log(`Synced Gitee metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('Gitee metadata sync failed; the previous snapshot was preserved.')
    console.error(formatGiteeSyncError(error, process.env.GITEE_TOKEN))
    process.exitCode = 1
  })
}
