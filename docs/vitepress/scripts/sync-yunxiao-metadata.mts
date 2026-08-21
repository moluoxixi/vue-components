#!/usr/bin/env node

import type { YunxiaoMetadataExpectation, YunxiaoMetadataSnapshot } from '../.vitepress/yunxiao-metadata-types.ts'
import type { AtomicFileSystem } from './atomic-metadata-write.mts'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { documentedComponents } from '../.vitepress/component-manifest.ts'
import { docsSite } from '../.vitepress/docs-site.ts'
import { repositoryMetadataExpectations } from '../.vitepress/repository-metadata-expectation.ts'
import { assertYunxiaoMetadataSnapshot } from '../.vitepress/yunxiao-metadata-types.ts'
import { defaultAtomicFileSystem, writeJsonAtomically } from './atomic-metadata-write.mts'
import { createYunxiaoMetadata } from './yunxiao-metadata.mts'

export function writeYunxiaoMetadataAtomically(
  snapshot: YunxiaoMetadataSnapshot,
  outputPath: string,
  fileSystem: AtomicFileSystem = defaultAtomicFileSystem,
): void {
  writeJsonAtomically(snapshot, outputPath, fileSystem)
}

export async function syncYunxiaoMetadata(
  collectSnapshot: () => Promise<YunxiaoMetadataSnapshot>,
  expectation: YunxiaoMetadataExpectation,
  outputPath: string,
): Promise<YunxiaoMetadataSnapshot> {
  const snapshot = await collectSnapshot()
  assertYunxiaoMetadataSnapshot(snapshot, expectation)
  writeYunxiaoMetadataAtomically(snapshot, outputPath)
  return snapshot
}

export function formatYunxiaoSyncError(error: unknown, token?: string): string {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return token ? message.replaceAll(token, '[REDACTED]') : message
}

async function main(): Promise<void> {
  const expectation = repositoryMetadataExpectations.yunxiao
  const config = docsSite.repositories.yunxiao
  const token = process.env.YUNXIAO_TOKEN ?? ''
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const outputPath = resolve(scriptDir, '../.vitepress/yunxiao-metadata.json')
  const snapshot = await syncYunxiaoMetadata(() => createYunxiaoMetadata({
    apiBaseUrl: config.apiBaseUrl,
    apiMode: expectation.apiMode,
    components: expectation.components,
    contributorAccounts: config.contributorAccounts,
    defaultBranch: expectation.defaultBranch,
    organizationId: expectation.organizationId,
    repositoryId: expectation.repositoryId,
    repositoryPath: expectation.repositoryPath,
    repositoryUrl: expectation.repositoryUrl,
    token,
    userAgent: config.userAgent,
  }), expectation, outputPath)
  console.log(`Synced Yunxiao metadata for ${documentedComponents.length} components at ${snapshot.repository.headSha.slice(0, 7)}.`)
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('Yunxiao metadata sync failed; the previous snapshot was preserved.')
    console.error(formatYunxiaoSyncError(error, process.env.YUNXIAO_TOKEN))
    process.exitCode = 1
  })
}
