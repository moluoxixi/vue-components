#!/usr/bin/env node

import type { GitlabMetadataExpectation, GitlabMetadataSnapshot } from '../.vitepress/repository/providers/gitlab.ts'
import type { AtomicFileSystem } from './atomic-metadata-write.mts'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/catalog/component-manifest.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository/expectation.ts'
import { repositoryMetadataSnapshotPath } from '../.vitepress/repository/generated-snapshot.ts'
import { assertGitlabMetadataSnapshot } from '../.vitepress/repository/providers/gitlab.ts'
import { docsSite } from '../.vitepress/site/docs-site.ts'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-metadata-write.mts'
import { createGitlabMetadata } from './gitlab-metadata.mts'

export function writeGitlabMetadataAtomically(
  snapshot: GitlabMetadataSnapshot,
  outputPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, outputPath, fileSystem)
}

export async function syncGitlabMetadata(
  collectSnapshot: () => Promise<GitlabMetadataSnapshot>,
  expectation: GitlabMetadataExpectation,
  outputPath: string,
): Promise<GitlabMetadataSnapshot> {
  const snapshot = await collectSnapshot()
  assertGitlabMetadataSnapshot(snapshot, expectation)
  writeGitlabMetadataAtomically(snapshot, outputPath)
  return snapshot
}

export function formatGitlabSyncError(error: unknown, token?: string): string {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return token ? message.replaceAll(token, '[REDACTED]') : message
}

async function main(): Promise<void> {
  const expectation = repositoryMetadataExpectations.gitlab
  const config = docsSite.repositories.gitlab
  const token = process.env.GITLAB_TOKEN
  const outputPath = repositoryMetadataSnapshotPath('gitlab')
  const snapshot = await syncGitlabMetadata(() => createGitlabMetadata({
    apiBaseUrl: config.apiBaseUrl,
    authentication: config.authentication,
    components: expectation.components,
    contributorProfiles: config.contributorProfiles,
    defaultBranch: expectation.defaultBranch,
    issueTitlePrefix: config.issueTitlePrefix,
    projectPath: expectation.projectPath,
    repositoryUrl: expectation.repositoryUrl,
    token,
    userAgent: config.userAgent,
    webBaseUrl: config.webBaseUrl,
  }), expectation, outputPath)
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
