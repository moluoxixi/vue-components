#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { repositoryMetadataSelection } from '../.vitepress/repository/selection.ts'

export type SelectedMetadataRunner = (scriptPath: string) => number

const syncScriptByProvider: Readonly<Record<string, string>> = {
  gitee: 'sync-gitee-metadata.mts',
  github: 'sync-github-metadata.mts',
  gitlab: 'sync-gitlab-metadata.mts',
  local: 'sync-local-metadata.mts',
  yunxiao: 'sync-yunxiao-metadata.mts',
}

const defaultRunner: SelectedMetadataRunner = (scriptPath) => {
  const result = spawnSync(process.execPath, [scriptPath], {
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  return result.status ?? 1
}

export function syncSelectedMetadata(
  providerId: string,
  run: SelectedMetadataRunner = defaultRunner,
): number {
  const scriptName = syncScriptByProvider[providerId]
  if (!scriptName)
    throw new TypeError(`No repository metadata sync command for provider: ${providerId}`)
  return run(resolve(import.meta.dirname, scriptName))
}

function main(): void {
  const providerId = repositoryMetadataSelection.providerId
  const exitCode = syncSelectedMetadata(providerId)
  if (exitCode !== 0) {
    process.exitCode = exitCode
    return
  }
  console.log(`Synchronized selected repository metadata provider: ${providerId}.`)
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMainModule) {
  try {
    main()
  }
  catch (error) {
    console.error('Selected repository metadata synchronization failed.')
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  }
}
