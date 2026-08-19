#!/usr/bin/env node

import type { GitlabMetadataSnapshot } from '../.vitepress/gitlab-metadata-types.ts'
import type { AtomicFileSystem } from './atomic-metadata-write.mts'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { docsSite } from '../.vitepress/docs-site.ts'
import { assertGitlabMetadataSnapshot } from '../.vitepress/gitlab-metadata-types.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository-metadata-expectation.ts'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-metadata-write.mts'
import { createGitlabMetadata } from './gitlab-metadata.mts'

export function writeGitlabMetadataAtomically(
  snapshot: GitlabMetadataSnapshot,
  outputPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, outputPath, fileSystem)
}

export function formatGitlabSyncError(error: unknown, token?: string): string {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return token ? message.replaceAll(token, '[REDACTED]') : message
}

async function main(): Promise<void> {
  const expectation = repositoryMetadataExpectations.gitlab
  const config = docsSite.repositories.gitlab
  const token = process.env.GITLAB_TOKEN
  const snapshot = await createGitlabMetadata({
    apiBaseUrl: config.apiBaseUrl,
    components: expectation.components,
    defaultBranch: expectation.defaultBranch,
    issueTitlePrefix: config.issueTitlePrefix,
    projectPath: expectation.projectPath,
    repositoryUrl: expectation.repositoryUrl,
    token,
    userAgent: config.userAgent,
  })
  assertGitlabMetadataSnapshot(snapshot, expectation)

  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const outputPath = resolve(scriptDir, '../.vitepress/gitlab-metadata.json')
  writeGitlabMetadataAtomically(snapshot, outputPath)
  console.log(`Synced GitLab metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('GitLab metadata sync failed; the previous snapshot was preserved.')
    console.error(formatGitlabSyncError(error, process.env.GITLAB_TOKEN))
    process.exitCode = 1
  })
}
