#!/usr/bin/env node

import type { YunxiaoMetadataSnapshot } from '../.vitepress/yunxiao-metadata-types.ts'
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

export function formatYunxiaoSyncError(error: unknown, token?: string): string {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  return token ? message.replaceAll(token, '[REDACTED]') : message
}

async function main(): Promise<void> {
  const expectation = repositoryMetadataExpectations.yunxiao
  const config = docsSite.repositories.yunxiao
  const token = process.env.YUNXIAO_TOKEN ?? ''
  const snapshot = await createYunxiaoMetadata({
    apiBaseUrl: config.apiBaseUrl,
    apiMode: expectation.apiMode,
    components: expectation.components,
    contributorProfiles: config.contributorProfiles,
    defaultBranch: expectation.defaultBranch,
    organizationId: expectation.organizationId,
    repositoryId: expectation.repositoryId,
    repositoryPath: expectation.repositoryPath,
    repositoryUrl: expectation.repositoryUrl,
    token,
    userAgent: config.userAgent,
  })
  assertYunxiaoMetadataSnapshot(snapshot, expectation)
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  writeYunxiaoMetadataAtomically(snapshot, resolve(scriptDir, '../.vitepress/yunxiao-metadata.json'))
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
