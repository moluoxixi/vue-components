#!/usr/bin/env node

import type { Buffer } from 'node:buffer'
import type { SpawnSyncReturns } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { closeSync, openSync, unlinkSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { docsSite } from '../.vitepress/site/docs-site.ts'
import {
  docsGeneratedPrepareLockPath,
  docsGeneratedRepositoryDirectory,
  docsRoot,
  ensureDocsGeneratedDirectories,
} from '../.vitepress/site/generated-paths.ts'

interface PrepareCommand {
  args: string[]
  command: string
  details?: string
  name: string
}

export interface PrepareCommandResult {
  error?: Error
  exitCode: number
}

export interface PrepareDocsOptions {
  log?: (message: string) => void
  now?: () => number
  providerId?: string
  run?: (command: PrepareCommand) => PrepareCommandResult
}

export class PrepareDocsError extends Error {
  public readonly exitCode: number
  public readonly step: string

  constructor(
    step: string,
    exitCode: number,
    options?: ErrorOptions,
  ) {
    super(`Documentation preparation failed at "${step}" with exit code ${exitCode}.`, options)
    this.step = step
    this.exitCode = exitCode
  }
}

function acquirePrepareLock(): () => void {
  ensureDocsGeneratedDirectories()
  let descriptor: number
  try {
    descriptor = openSync(docsGeneratedPrepareLockPath, 'wx')
  }
  catch (error) {
    throw new PrepareDocsError('prepare lock', 1, { cause: error })
  }
  return () => {
    closeSync(descriptor)
    unlinkSync(docsGeneratedPrepareLockPath)
  }
}

function pnpmCommand(args: string[]): Pick<PrepareCommand, 'args' | 'command'> {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...args],
    }
  }
  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args,
  }
}

function nodeScript(scriptName: string): Pick<PrepareCommand, 'args' | 'command'> {
  return {
    command: process.execPath,
    args: [resolve(import.meta.dirname, scriptName)],
  }
}

function defaultRun(command: PrepareCommand): PrepareCommandResult {
  const result: SpawnSyncReturns<Buffer> = spawnSync(command.command, command.args, {
    cwd: docsRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  return {
    error: result.error,
    exitCode: result.status ?? 1,
  }
}

function formatLog(
  state: 'FAIL' | 'OK' | 'START',
  command: Pick<PrepareCommand, 'details' | 'name'>,
  duration?: number,
  exitCode?: number,
): string {
  const fields = [
    `[docs:prepare] ${state}`,
    command.name,
    duration === undefined ? undefined : `duration=${Math.max(0, Math.round(duration))}ms`,
    exitCode === undefined ? undefined : `exitCode=${exitCode}`,
    command.details,
  ]
  return fields.filter(Boolean).join(' ')
}

export function prepareDocs(options: PrepareDocsOptions = {}): void {
  const log = options.log ?? console.log
  const now = options.now ?? Date.now
  const run = options.run ?? defaultRun
  const providerId = options.providerId ?? docsSite.metadataProvider
  const repositoryPath = relative(docsRoot, docsGeneratedRepositoryDirectory).replaceAll('\\', '/')
  let releaseLock: (() => void) | undefined
  try {
    releaseLock = acquirePrepareLock()
  }
  catch (error) {
    log(formatLog('FAIL', { name: 'prepare lock' }, 0, 1))
    throw error
  }
  const commands: PrepareCommand[] = [
    { name: 'workspace dependencies', ...pnpmCommand(['run', 'build:workspace-packages']) },
    { name: 'component routes', ...nodeScript('generate-component-routes.mts') },
    { name: 'utility routes', ...nodeScript('generate-utility-routes.mts') },
    { name: 'API contracts', ...nodeScript('extract-api.mts') },
    {
      name: 'selected provider sync',
      details: `provider=${providerId} path=${repositoryPath}`,
      ...nodeScript('sync-selected-metadata.mts'),
    },
    {
      name: 'selected snapshot validation',
      details: `provider=${providerId} path=${repositoryPath}`,
      ...nodeScript('validate-selected-metadata.mts'),
    },
  ]

  try {
    for (const command of commands) {
      log(formatLog('START', command))
      const startedAt = now()
      const result = run(command)
      const duration = now() - startedAt
      if (result.exitCode !== 0 || result.error) {
        log(formatLog('FAIL', command, duration, result.exitCode))
        throw new PrepareDocsError(command.name, result.exitCode || 1, result.error
          ? { cause: result.error }
          : undefined)
      }
      log(formatLog('OK', command, duration))
    }
  }
  finally {
    releaseLock?.()
  }

  const complete = { name: 'preparation complete', details: `provider=${providerId}` }
  log(formatLog('START', complete))
  log(formatLog('OK', complete, 0))
}

function main(): void {
  try {
    prepareDocs()
  }
  catch (error) {
    if (!(error instanceof PrepareDocsError))
      console.error(error instanceof Error ? error.stack : error)
    process.exitCode = error instanceof PrepareDocsError ? error.exitCode : 1
  }
}

const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isMainModule)
  main()
