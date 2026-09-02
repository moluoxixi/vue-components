// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponentPackage, defineElementPlusDocsProject, resolveElementPlusDocsProject } from '../../index'
import {
  ElementPlusDocsPrepareError,
  isPrepareLockProcessRunning,
  prepareElementPlusDocs,
} from '../../src/node/lifecycle'

const temporaryDirectories: string[] = []

function loadedProject() {
  const docsRoot = mkdtempSync(resolve(tmpdir(), 'element-plus-docs-prepare-'))
  temporaryDirectories.push(docsRoot)
  mkdirSync(resolve(docsRoot, 'content'), { recursive: true })
  writeFileSync(resolve(docsRoot, 'content/index.md'), '# Fixture\n')
  const project = resolveElementPlusDocsProject(defineElementPlusDocsProject({
    documentation: {
      componentsRoute: 'components',
      defaultLocale: 'en-US',
      locales: {
        'en-US': {
          label: 'English',
          pathPrefix: '',
          sourceDirectory: 'content',
          sourceDoc: 'docs/index.md',
        },
      },
    },
    repository: {
      provider: 'github',
      url: 'https://github.com/fixture/components',
      defaultBranch: 'main',
    },
    packages: {
      components: defineComponentPackage({
        name: '@fixture/components',
        root: 'packages/components',
        componentSource: name => `packages/components/src/${name}`,
        load: async () => ({}),
      }),
    },
    components: [{
      id: 'fixture',
      title: 'Fixture',
      description: 'Fixture',
      items: [{
        name: 'FixtureComponent',
        sidebarText: 'FixtureComponent',
        description: 'Fixture',
        icon: 'fixture',
      }],
    }],
    prepare: {
      commands: [
        { name: 'component routes', command: 'node', args: ['routes.mts'] },
        { name: 'API contracts', command: 'node', args: ['api.mts'] },
      ],
    },
  }))
  return {
    configPath: resolve(docsRoot, 'element-plus-docs.config.ts'),
    docsRoot,
    generatedRoot: resolve(docsRoot, '.generated'),
    project,
    projectRoot: docsRoot,
  }
}

const metadata = {
  components: {},
  provider: {
    capabilities: {
      commitHistory: true,
      contributorProfiles: true,
      contributors: true,
      editLinks: true,
      issueActions: true,
      issues: true,
      sourceLinks: true,
    },
    id: 'github',
    platform: 'github',
  },
  repository: { defaultBranch: 'main', headSha: 'a'.repeat(40) },
} as const

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('element-plus-docs prepare', () => {
  it('logs commands, selected synchronization, validation, and completion in order', async () => {
    const loaded = loadedProject()
    const messages: string[] = []
    const commands: string[] = []
    const synchronizeRepository = vi.fn(async () => ({
      metadata,
      outputPath: resolve(loaded.generatedRoot, 'repository/github.json'),
      repository: { provider: 'github' } as never,
      snapshot: {},
    }))
    const synchronizePlaygroundManifests = vi.fn(async () => (
      resolve(loaded.generatedRoot, 'markdown/playground-manifests.json')
    ))
    const validateRepository = vi.fn(() => metadata)

    await prepareElementPlusDocs(loaded, {
      log: message => messages.push(message),
      now: (() => {
        let value = 0
        return () => value += 5
      })(),
      runCommand(command) {
        commands.push(command.name)
        return 0
      },
      synchronizeRepository,
      synchronizePlaygroundManifests,
      validateRepository,
    })

    expect(commands).toEqual(['component routes', 'API contracts'])
    expect(synchronizeRepository).toHaveBeenCalledOnce()
    expect(synchronizePlaygroundManifests).toHaveBeenCalledOnce()
    expect(validateRepository).toHaveBeenCalledOnce()
    expect(messages.join('\n')).toContain('[docs:prepare] START component routes')
    expect(messages.join('\n')).toContain('[docs:prepare] START runtime content path=.generated/content')
    expect(messages.join('\n').indexOf('runtime content'))
      .toBeLessThan(messages.join('\n').indexOf('component routes'))
    expect(messages.join('\n')).toContain('playground manifests')
    expect(messages.join('\n').indexOf('playground manifests'))
      .toBeLessThan(messages.join('\n').indexOf('selected provider sync'))
    expect(messages.join('\n')).toContain('selected provider sync')
    expect(messages.join('\n')).toContain('provider=github path=.generated/repository')
    expect(messages.at(-1)).toContain('[docs:prepare] OK preparation complete')
  })

  it('fails fast with the child exit code and does not synchronize', async () => {
    const loaded = loadedProject()
    const synchronizeRepository = vi.fn()
    await expect(prepareElementPlusDocs(loaded, {
      runCommand: () => 7,
      synchronizeRepository,
    })).rejects.toMatchObject({ exitCode: 7, step: 'component routes' })
    expect(synchronizeRepository).not.toHaveBeenCalled()
    expect(existsSync(resolve(loaded.generatedRoot, 'prepare.lock'))).toBe(false)
  })

  it('stops after a provider synchronization failure and preserves the previous snapshot', async () => {
    const loaded = loadedProject()
    const repositoryDirectory = resolve(loaded.generatedRoot, 'repository')
    const snapshotPath = resolve(repositoryDirectory, 'github.json')
    mkdirSync(repositoryDirectory, { recursive: true })
    writeFileSync(snapshotPath, '{"previous":true}\n')
    const previousSnapshot = readFileSync(snapshotPath)
    const messages: string[] = []
    const synchronizePlaygroundManifests = vi.fn(async () => (
      resolve(loaded.generatedRoot, 'markdown/playground-manifests.json')
    ))
    const synchronizeRepository = vi.fn(async () => {
      throw new Error('provider unavailable')
    })
    const validateRepository = vi.fn()

    await expect(prepareElementPlusDocs(loaded, {
      log: message => messages.push(message),
      runCommand: () => 0,
      synchronizePlaygroundManifests,
      synchronizeRepository,
      validateRepository,
    })).rejects.toMatchObject({ exitCode: 1, step: 'selected provider sync' })

    expect(synchronizePlaygroundManifests).toHaveBeenCalledOnce()
    expect(validateRepository).not.toHaveBeenCalled()
    expect(readFileSync(snapshotPath)).toEqual(previousSnapshot)
    expect(existsSync(resolve(loaded.generatedRoot, 'prepare.lock'))).toBe(false)
    expect(messages.some(message => message.includes('OK preparation complete'))).toBe(false)
  })

  it('stops after Playground manifest synchronization fails and releases the prepare lock', async () => {
    const loaded = loadedProject()
    const messages: string[] = []
    const synchronizePlaygroundManifests = vi.fn(async () => {
      throw new Error('manifest unavailable')
    })
    const synchronizeRepository = vi.fn()
    const validateRepository = vi.fn()

    await expect(prepareElementPlusDocs(loaded, {
      log: message => messages.push(message),
      runCommand: () => 0,
      synchronizePlaygroundManifests,
      synchronizeRepository,
      validateRepository,
    })).rejects.toMatchObject({ exitCode: 1, step: 'playground manifests' })

    expect(synchronizePlaygroundManifests).toHaveBeenCalledOnce()
    expect(synchronizeRepository).not.toHaveBeenCalled()
    expect(validateRepository).not.toHaveBeenCalled()
    expect(existsSync(resolve(loaded.generatedRoot, 'prepare.lock'))).toBe(false)
    expect(messages.some(message => message.includes('OK preparation complete'))).toBe(false)
  })

  it('stops after selected snapshot validation fails and releases the prepare lock', async () => {
    const loaded = loadedProject()
    const messages: string[] = []
    const synchronizePlaygroundManifests = vi.fn(async () => (
      resolve(loaded.generatedRoot, 'markdown/playground-manifests.json')
    ))
    const synchronizeRepository = vi.fn(async () => ({
      metadata,
      outputPath: resolve(loaded.generatedRoot, 'repository/github.json'),
      repository: { provider: 'github' } as never,
      snapshot: {},
    }))
    const validateRepository = vi.fn(() => {
      throw new Error('snapshot invalid')
    })

    await expect(prepareElementPlusDocs(loaded, {
      log: message => messages.push(message),
      runCommand: () => 0,
      synchronizePlaygroundManifests,
      synchronizeRepository,
      validateRepository,
    })).rejects.toMatchObject({ exitCode: 1, step: 'selected snapshot validation' })

    expect(synchronizePlaygroundManifests).toHaveBeenCalledOnce()
    expect(synchronizeRepository).toHaveBeenCalledOnce()
    expect(validateRepository).toHaveBeenCalledOnce()
    expect(existsSync(resolve(loaded.generatedRoot, 'prepare.lock'))).toBe(false)
    expect(messages.some(message => message.includes('OK preparation complete'))).toBe(false)
  })

  it('rejects a concurrent prepare lock visibly', async () => {
    const loaded = loadedProject()
    mkdirSync(loaded.generatedRoot, { recursive: true })
    writeFileSync(resolve(loaded.generatedRoot, 'prepare.lock'), `${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      token: 'live-owner',
    })}\n`)
    const messages: string[] = []

    await expect(prepareElementPlusDocs(loaded, {
      log: message => messages.push(message),
    })).rejects.toBeInstanceOf(ElementPlusDocsPrepareError)
    expect(messages).toEqual([
      '[docs:prepare] FAIL prepare lock duration=0ms exitCode=1',
    ])
    expect(existsSync(resolve(loaded.generatedRoot, 'prepare.lock'))).toBe(true)
  })

  it('treats access-denied process probes as running and only ESRCH as exited', () => {
    const failure = (code: string) => () => {
      throw Object.assign(new Error(code), { code })
    }

    expect(isPrepareLockProcessRunning(123, failure('EPERM'))).toBe(true)
    expect(isPrepareLockProcessRunning(123, failure('EINVAL'))).toBe(true)
    expect(isPrepareLockProcessRunning(123, failure('ESRCH'))).toBe(false)
    expect(isPrepareLockProcessRunning(123, () => true)).toBe(true)
  })

  it('fails closed without deleting a malformed prepare lock', async () => {
    const loaded = loadedProject()
    const lockPath = resolve(loaded.generatedRoot, 'prepare.lock')
    mkdirSync(loaded.generatedRoot, { recursive: true })
    writeFileSync(lockPath, '{not-json}\n')

    await expect(
      prepareElementPlusDocs(loaded),
    ).rejects.toMatchObject({ exitCode: 1, step: 'prepare lock' })

    expect(readFileSync(lockPath, 'utf8')).toBe('{not-json}\n')
  })

  it('removes a prepare lock after its owner process has exited', async () => {
    const loaded = loadedProject()
    const lockPath = resolve(loaded.generatedRoot, 'prepare.lock')
    const events: string[] = []
    let occupied = true
    const staleContent = `${JSON.stringify({
      pid: 12345,
      startedAt: '2026-09-02T00:00:00.000Z',
      token: 'stale-owner',
    })}\n`
    let currentContent = staleContent

    await prepareElementPlusDocs(loaded, {
      lockFileSystem: {
        close: descriptor => events.push(`close:${descriptor}`),
        isProcessRunning: (pid) => {
          events.push(`process:${pid}`)
          return false
        },
        makeDirectory: () => {},
        open: () => {
          events.push('open')
          if (occupied)
            throw Object.assign(new Error('occupied'), { code: 'EEXIST' })
          return 42
        },
        read: (path) => {
          events.push(`read:${path}`)
          return currentContent
        },
        removeIfContent: (path, expectedContent) => {
          events.push(`remove-owned:${path}`)
          if (currentContent !== expectedContent)
            return false
          occupied = false
          currentContent = ''
          return true
        },
        write: (descriptor, content) => {
          events.push(`write:${descriptor}`)
          currentContent = content
        },
      },
      runCommand: () => 0,
      synchronizePlaygroundManifests: async () => resolve(loaded.generatedRoot, 'markdown/playground-manifests.json'),
      synchronizeRepository: async () => ({
        metadata,
        outputPath: resolve(loaded.generatedRoot, 'repository/github.json'),
        repository: { provider: 'github' } as never,
        snapshot: {},
      }),
      validateRepository: () => metadata,
    })

    expect(events).toEqual([
      'open',
      `read:${lockPath}`,
      'process:12345',
      `remove-owned:${lockPath}`,
      'open',
      'write:42',
      'close:42',
      `remove-owned:${lockPath}`,
    ])
  })

  it('fails closed when a stale lock is replaced before removal', async () => {
    const loaded = loadedProject()
    const staleContent = `${JSON.stringify({
      pid: 12345,
      startedAt: '2026-09-02T00:00:00.000Z',
      token: 'stale-owner',
    })}\n`
    const events: string[] = []

    await expect(prepareElementPlusDocs(loaded, {
      lockFileSystem: {
        close: () => events.push('close'),
        isProcessRunning: () => false,
        makeDirectory: () => {},
        open: () => {
          events.push('open')
          throw Object.assign(new Error('occupied'), { code: 'EEXIST' })
        },
        read: () => staleContent,
        removeIfContent: () => {
          events.push('remove-owned')
          return false
        },
        write: () => events.push('write'),
      },
    })).rejects.toMatchObject({ exitCode: 1, step: 'prepare lock' })

    expect(events).toEqual(['open', 'remove-owned'])
  })

  it('does not remove a successor lock during release', async () => {
    const loaded = loadedProject()
    let currentContent = ''
    let acquiredContent = ''
    const events: string[] = []

    await prepareElementPlusDocs(loaded, {
      lockFileSystem: {
        close: descriptor => events.push(`close:${descriptor}`),
        isProcessRunning: () => true,
        makeDirectory: () => {},
        open: () => 42,
        read: () => currentContent,
        removeIfContent: (_path, expectedContent) => {
          events.push('remove-owned')
          if (currentContent !== expectedContent)
            return false
          currentContent = ''
          return true
        },
        write: (_descriptor, content) => {
          acquiredContent = content
          currentContent = content
        },
      },
      runCommand: () => {
        currentContent = `${JSON.stringify({
          pid: 54321,
          startedAt: '2026-09-02T01:00:00.000Z',
          token: 'successor-owner',
        })}\n`
        return 0
      },
      synchronizePlaygroundManifests: async () => resolve(loaded.generatedRoot, 'markdown/playground-manifests.json'),
      synchronizeRepository: async () => ({
        metadata,
        outputPath: resolve(loaded.generatedRoot, 'repository/github.json'),
        repository: { provider: 'github' } as never,
        snapshot: {},
      }),
      validateRepository: () => metadata,
    })

    expect(acquiredContent).toContain(`"pid":${process.pid}`)
    expect(currentContent).toContain('successor-owner')
    expect(events).toEqual(['close:42', 'remove-owned'])
  })

  it('removes a partially written lock when writing its owner payload fails', async () => {
    const loaded = loadedProject()
    const closedDescriptors: number[] = []
    const lockPath = resolve(loaded.generatedRoot, 'prepare.lock')
    let currentContent = ''
    const removedPaths: string[] = []

    await expect(prepareElementPlusDocs(loaded, {
      lockFileSystem: {
        close: descriptor => closedDescriptors.push(descriptor),
        isProcessRunning: () => true,
        makeDirectory: () => {},
        open: () => 41,
        read: () => currentContent,
        removeIfContent: (path, expectedContent) => {
          if (currentContent !== expectedContent)
            return false
          currentContent = ''
          removedPaths.push(path)
          return true
        },
        write: (_descriptor, content) => {
          currentContent = content.slice(0, 12)
          throw new Error('lock payload unavailable')
        },
      },
    })).rejects.toMatchObject({ exitCode: 1, step: 'prepare lock' })

    expect(closedDescriptors).toEqual([41])
    expect(removedPaths).toEqual([lockPath])
    expect(currentContent).toBe('')
  })

  it('does not remove a successor lock when writing its owner payload fails', async () => {
    const loaded = loadedProject()
    const successorContent = `${JSON.stringify({
      pid: 54321,
      startedAt: '2026-09-02T01:00:00.000Z',
      token: 'successor-owner',
    })}\n`
    let currentContent = ''
    const removeIfContent = vi.fn(() => false)

    await expect(prepareElementPlusDocs(loaded, {
      lockFileSystem: {
        close: () => {},
        isProcessRunning: () => true,
        makeDirectory: () => {},
        open: () => 41,
        read: () => currentContent,
        removeIfContent,
        write: () => {
          currentContent = successorContent
          throw new Error('lock payload unavailable')
        },
      },
    })).rejects.toMatchObject({ exitCode: 1, step: 'prepare lock' })

    expect(removeIfContent).not.toHaveBeenCalled()
    expect(currentContent).toBe(successorContent)
  })
})
