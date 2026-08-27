import { mkdir, readdir, readFile, rename as renameFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPathGuard,
  scanWorkspace,
  writeTextAtomically,
} from '../server'
import { testConfig } from './server-helpers'

const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = resolve(tmpdir(), `i18n-tool-fs-${crypto.randomUUID()}`)
  temporaryDirectories.push(directory)
  await mkdir(directory, { recursive: true })
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('path guard and scanning', () => {
  it('scans only configured JSON resources and returns relative identities', async () => {
    const root = await temporaryDirectory()
    await mkdir(resolve(root, 'locales'), { recursive: true })
    await writeFile(resolve(root, 'locales/en-US.json'), '{"hello":"Hello"}\n')
    await writeFile(resolve(root, 'locales/zh-CN.json'), '{"hello":""}\n')
    await writeFile(resolve(root, 'locales/ignored.txt'), 'ignored')

    const config = testConfig(root)
    const snapshot = await scanWorkspace(config, await createPathGuard(root))
    expect(snapshot.wire.resources.map(resource => resource.relativePath)).toEqual([
      'locales/en-US.json',
      'locales/zh-CN.json',
    ])
    expect(snapshot.wire.gaps['zh-CN']).toEqual({ empty: 1, existing: 0, missing: 0 })
    expect(JSON.stringify(snapshot.wire)).not.toContain(root)
  })

  it('rejects traversal, sibling-prefix paths and symbolic links', async () => {
    const root = await temporaryDirectory()
    const sibling = `${root}-other`
    temporaryDirectories.push(sibling)
    await mkdir(resolve(root, 'locales'), { recursive: true })
    await mkdir(sibling, { recursive: true })
    await writeFile(resolve(sibling, 'outside.json'), '{}')
    const guard = await createPathGuard(root)

    await expect(guard.resolve('../outside.json', { allowMissing: true })).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_ROOT',
    })
    await expect(guard.resolve(resolve(sibling, 'outside.json'))).rejects.toMatchObject({
      code: 'PATH_OUTSIDE_ROOT',
    })

    await symlink(sibling, resolve(root, 'locales/link'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(scanWorkspace(testConfig(root), guard)).rejects.toMatchObject({ code: 'SYMLINK_ESCAPE' })
  })

  it('enforces file and byte limits during discovery and before reading', async () => {
    const root = await temporaryDirectory()
    await mkdir(resolve(root, 'locales'), { recursive: true })
    await writeFile(resolve(root, 'locales/en-US.json'), JSON.stringify({ value: 'x'.repeat(2_000) }))
    await writeFile(resolve(root, 'locales/zh-CN.json'), '{}')
    const guard = await createPathGuard(root)

    await expect(scanWorkspace(testConfig(root, { limits: { files: 1 } }), guard))
      .rejects
      .toMatchObject({ code: 'LIMIT_EXCEEDED' })
    await expect(scanWorkspace(testConfig(root, { limits: { totalBytes: 1_024 } }), guard))
      .rejects
      .toMatchObject({ code: 'LIMIT_EXCEEDED' })
  })
})

describe('atomic writer', () => {
  it('creates and replaces files without leaving temporary files', async () => {
    const root = await temporaryDirectory()
    const target = resolve(root, 'locales/zh-CN.json')
    await writeTextAtomically(target, '{"hello":"你好"}\n')
    await writeTextAtomically(target, '{"hello":"您好"}\n')

    expect(await readFile(target, 'utf8')).toBe('{"hello":"您好"}\n')
    expect((await readdir(resolve(root, 'locales'))).filter(file => file.endsWith('.tmp'))).toEqual([])
  })

  it('preserves the old file and cleans temporary state after rename failure', async () => {
    const root = await temporaryDirectory()
    const target = resolve(root, 'locales/zh-CN.json')
    await mkdir(resolve(root, 'locales'), { recursive: true })
    await writeFile(target, 'old')
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('failed'), { code: 'EIO' })
    }) as unknown as typeof import('node:fs/promises').rename

    await expect(writeTextAtomically(target, 'new', { rename })).rejects.toMatchObject({ code: 'WRITE_FAILED' })
    expect(await readFile(target, 'utf8')).toBe('old')
    expect((await readdir(resolve(root, 'locales'))).filter(file => file.endsWith('.tmp'))).toEqual([])
  })

  it('revalidates paths and retries transient rename locks', async () => {
    const root = await temporaryDirectory()
    const target = resolve(root, 'locales/zh-CN.json')
    const validateTarget = vi.fn(async () => {})
    let attempts = 0
    const rename: typeof renameFile = async (source, destination) => {
      attempts += 1
      if (attempts < 3)
        throw Object.assign(new Error('locked'), { code: 'EPERM' })
      await renameFile(source, destination)
    }

    await writeTextAtomically(target, 'written', { rename, validateTarget })
    expect(attempts).toBe(3)
    expect(validateTarget.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(await readFile(target, 'utf8')).toBe('written')
  })

  it('reports a temporary cleanup failure explicitly', async () => {
    const root = await temporaryDirectory()
    const target = resolve(root, 'locales/zh-CN.json')
    const rename = vi.fn(async () => {
      throw Object.assign(new Error('rename failed'), { code: 'EIO' })
    }) as unknown as typeof renameFile
    const remove = vi.fn(async () => {
      throw Object.assign(new Error('cleanup failed'), { code: 'EIO' })
    }) as unknown as typeof rm

    await expect(writeTextAtomically(target, 'new', { remove, rename }))
      .rejects
      .toThrow(/cleanup could not complete/)
  })
})
