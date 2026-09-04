import type { Buffer } from 'node:buffer'
import type { SpawnSyncReturns } from 'node:child_process'
import type { ElementPlusDocsPrepareCommand } from '../../../project'
import type { LoadedElementPlusDocsProject } from '../../project'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { resolveElementPlusDocsProjectRepository } from '../../../project'
import { synchronizeElementPlusDocsContent } from '../../content'
import { synchronizeElementPlusDocsPlaygroundManifests } from '../../playground'
import { synchronizeElementPlusDocsRepository, validateElementPlusDocsRepository } from '../../repository'

export class ElementPlusDocsPrepareError extends Error {
  readonly exitCode: number
  readonly step: string

  constructor(step: string, exitCode: number, options?: ErrorOptions) {
    super(`Documentation preparation failed at "${step}" with exit code ${exitCode}.`, options)
    this.exitCode = exitCode
    this.step = step
  }
}

export interface ElementPlusDocsPrepareOptions {
  environment?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
  lockFileSystem?: PrepareLockFileSystem
  log?: (message: string) => void
  now?: () => number
  providerOverride?: string
  runCommand?: (command: ElementPlusDocsPrepareCommand, docsRoot: string) => number
  synchronizeRepository?: typeof synchronizeElementPlusDocsRepository
  synchronizeContent?: typeof synchronizeElementPlusDocsContent
  synchronizePlaygroundManifests?: typeof synchronizeElementPlusDocsPlaygroundManifests
  validateRepository?: typeof validateElementPlusDocsRepository
}

interface PrepareLockFileSystem {
  close: (descriptor: number) => void
  isProcessRunning: (pid: number) => boolean
  makeDirectory: (path: string) => void
  open: (path: string) => number
  read: (path: string) => string
  removeIfContent: (path: string, expectedContent: string) => boolean
  write: (descriptor: number, content: string) => void
}

export function isPrepareLockProcessRunning(
  pid: number,
  kill: (pid: number, signal: 0) => boolean = process.kill.bind(process),
): boolean {
  try {
    kill(pid, 0)
    return true
  }
  catch (error) {
    return errorCode(error) !== 'ESRCH'
  }
}

const defaultPrepareLockFileSystem: PrepareLockFileSystem = {
  close: closeSync,
  isProcessRunning: isPrepareLockProcessRunning,
  makeDirectory: path => mkdirSync(path, { recursive: true }),
  open: path => openSync(path, 'wx'),
  read: path => readFileSync(path, 'utf8'),
  removeIfContent: (path, expectedContent) => {
    try {
      if (readFileSync(path, 'utf8') !== expectedContent)
        return false
      unlinkSync(path)
      return true
    }
    catch {
      return false
    }
  },
  write: writeFileSync,
}

function removeIncompletePrepareLock(
  fileSystem: PrepareLockFileSystem,
  lockPath: string,
  ownerContent: string,
): void {
  try {
    const currentContent = fileSystem.read(lockPath)
    if (ownerContent.startsWith(currentContent))
      fileSystem.removeIfContent(lockPath, currentContent)
  }
  catch {
    // Preserve the acquisition failure and leave unverifiable lock state untouched.
  }
}

interface PrepareLockOwner {
  pid: number
  startedAt: string
  token: string
}

function lockOwner(content: string): PrepareLockOwner | undefined {
  try {
    const value = JSON.parse(content) as Partial<PrepareLockOwner>
    if (
      !Number.isSafeInteger(value.pid)
      || Number(value.pid) <= 0
      || typeof value.startedAt !== 'string'
      || !Number.isFinite(Date.parse(value.startedAt))
      || typeof value.token !== 'string'
      || value.token.length === 0
    ) {
      return undefined
    }
    return { pid: Number(value.pid), startedAt: value.startedAt, token: value.token }
  }
  catch {
    return undefined
  }
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as NodeJS.ErrnoException).code)
    : undefined
}

function formatLog(
  state: 'FAIL' | 'OK' | 'START',
  name: string,
  duration?: number,
  details?: string,
  exitCode?: number,
): string {
  return [
    `[docs:prepare] ${state}`,
    name,
    duration === undefined ? undefined : `duration=${Math.max(0, Math.round(duration))}ms`,
    exitCode === undefined ? undefined : `exitCode=${exitCode}`,
    details,
  ].filter(Boolean).join(' ')
}

function commandExecutable(command: ElementPlusDocsPrepareCommand): { args: string[], executable: string } {
  const args = [...(command.args ?? [])]
  if (command.command === 'node')
    return { args, executable: process.execPath }
  if (command.command === 'pnpm' && process.env.npm_execpath) {
    return {
      args: [process.env.npm_execpath, ...args],
      executable: process.execPath,
    }
  }
  if (command.command === 'pnpm') {
    const bundledPnpmCli = resolve(dirname(process.execPath), 'node_modules/pnpm/bin/pnpm.mjs')
    if (existsSync(bundledPnpmCli))
      return { args: [bundledPnpmCli, ...args], executable: process.execPath }
    if (process.platform === 'win32') {
      return {
        args: ['/d', '/s', '/c', 'pnpm', ...args],
        executable: process.env.ComSpec ?? 'cmd.exe',
      }
    }
  }
  return { args, executable: command.command }
}

function defaultRunCommand(command: ElementPlusDocsPrepareCommand, docsRoot: string): number {
  const executable = commandExecutable(command)
  const result: SpawnSyncReturns<Buffer> = spawnSync(executable.executable, executable.args, {
    cwd: command.cwd ? resolve(docsRoot, command.cwd) : docsRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error)
    throw result.error
  return result.status ?? 1
}

function acquirePrepareLock(
  generatedRoot: string,
  fileSystem: PrepareLockFileSystem,
): () => void {
  fileSystem.makeDirectory(resolve(generatedRoot, 'api'))
  fileSystem.makeDirectory(resolve(generatedRoot, 'content'))
  fileSystem.makeDirectory(resolve(generatedRoot, 'markdown'))
  fileSystem.makeDirectory(resolve(generatedRoot, 'repository'))
  fileSystem.makeDirectory(resolve(generatedRoot, 'types'))
  const lockPath = resolve(generatedRoot, 'prepare.lock')
  const ownerContent = `${JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    token: randomUUID(),
  })}\n`
  let descriptor: number | undefined
  try {
    try {
      descriptor = fileSystem.open(lockPath)
    }
    catch (error) {
      if (errorCode(error) !== 'EEXIST')
        throw error
      const staleContent = fileSystem.read(lockPath)
      const owner = lockOwner(staleContent)
      if (!owner || fileSystem.isProcessRunning(owner.pid))
        throw error
      if (!fileSystem.removeIfContent(lockPath, staleContent))
        throw error
      descriptor = fileSystem.open(lockPath)
    }
    fileSystem.write(descriptor, ownerContent)
  }
  catch (error) {
    if (descriptor !== undefined) {
      try {
        fileSystem.close(descriptor)
      }
      catch {
        // Preserve the acquisition failure; ownership-checked cleanup still follows.
      }
      removeIncompletePrepareLock(fileSystem, lockPath, ownerContent)
    }
    throw new ElementPlusDocsPrepareError('prepare lock', 1, { cause: error })
  }
  return () => {
    try {
      fileSystem.close(descriptor)
    }
    finally {
      fileSystem.removeIfContent(lockPath, ownerContent)
    }
  }
}

export async function prepareElementPlusDocs(
  loaded: LoadedElementPlusDocsProject,
  options: ElementPlusDocsPrepareOptions = {},
): Promise<void> {
  const log = options.log ?? (message => process.stdout.write(`${message}\n`))
  const now = options.now ?? Date.now
  const environment = options.environment ?? process.env
  environment.ELEMENT_PLUS_DOCS_DOCS_ROOT = loaded.docsRoot
  environment.ELEMENT_PLUS_DOCS_PROJECT_ROOT = loaded.projectRoot
  const providerOverride = options.providerOverride
    ?? environment.VITE_DOCS_REPOSITORY_METADATA_PROVIDER
  const repository = resolveElementPlusDocsProjectRepository(loaded.project, providerOverride)
  const repositoryPath = relative(loaded.docsRoot, resolve(loaded.generatedRoot, 'repository')).replaceAll('\\', '/')
  let releaseLock: (() => void) | undefined
  try {
    releaseLock = acquirePrepareLock(
      loaded.generatedRoot,
      options.lockFileSystem ?? defaultPrepareLockFileSystem,
    )
  }
  catch (error) {
    log(formatLog('FAIL', 'prepare lock', 0, undefined, 1))
    throw error
  }

  const runStep = async (name: string, action: () => Promise<void> | void, details?: string) => {
    log(formatLog('START', name, undefined, details))
    const startedAt = now()
    try {
      await action()
      log(formatLog('OK', name, now() - startedAt, details))
    }
    catch (error) {
      const exitCode = error instanceof ElementPlusDocsPrepareError ? error.exitCode : 1
      log(formatLog('FAIL', name, now() - startedAt, details, exitCode))
      throw error instanceof ElementPlusDocsPrepareError
        ? error
        : new ElementPlusDocsPrepareError(name, exitCode, { cause: error })
    }
  }

  try {
    await runStep('runtime content', () => {
      environment.ELEMENT_PLUS_DOCS_CONTENT_ROOT
        = (options.synchronizeContent ?? synchronizeElementPlusDocsContent)({
          docsRoot: loaded.docsRoot,
          generatedRoot: loaded.generatedRoot,
          project: loaded.project,
          projectRoot: loaded.projectRoot,
        })
    }, `path=${relative(loaded.docsRoot, resolve(loaded.generatedRoot, 'content')).replaceAll('\\', '/')}`)
    for (const command of loaded.project.prepare?.commands ?? []) {
      await runStep(command.name, () => {
        const exitCode = (options.runCommand ?? defaultRunCommand)(command, loaded.docsRoot)
        if (exitCode !== 0)
          throw new ElementPlusDocsPrepareError(command.name, exitCode)
      })
    }
    await runStep('playground manifests', async () => {
      environment.ELEMENT_PLUS_DOCS_PLAYGROUND_MANIFESTS_PATH
        = await (options.synchronizePlaygroundManifests ?? synchronizeElementPlusDocsPlaygroundManifests)(
          loaded.project,
          loaded.generatedRoot,
        )
    }, `path=${relative(loaded.docsRoot, resolve(loaded.generatedRoot, 'markdown')).replaceAll('\\', '/')}`)
    const details = `provider=${repository.provider} path=${repositoryPath}`
    await runStep('selected provider sync', async () => {
      const result = await (options.synchronizeRepository ?? synchronizeElementPlusDocsRepository)({
        environment,
        fetchImpl: options.fetchImpl,
        generatedRoot: loaded.generatedRoot,
        project: loaded.project,
        projectRoot: loaded.projectRoot,
        providerOverride: repository.provider,
      })
      environment.ELEMENT_PLUS_DOCS_REPOSITORY_SNAPSHOT_PATH = result.outputPath
    }, details)
    await runStep('selected snapshot validation', () => {
      const metadata = (options.validateRepository ?? validateElementPlusDocsRepository)({
        environment,
        generatedRoot: loaded.generatedRoot,
        project: loaded.project,
        projectRoot: loaded.projectRoot,
        providerOverride: repository.provider,
      })
      environment.VITE_DOCS_REPOSITORY_DEFAULT_BRANCH = metadata.repository.defaultBranch
    }, details)
  }
  finally {
    releaseLock?.()
  }

  log(formatLog('OK', 'preparation complete', 0, `provider=${repository.provider}`))
}
