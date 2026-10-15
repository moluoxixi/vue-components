import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createStudioProject } from '@moluoxixi/config-form-studio'
import { describe, expect, it } from 'vitest'
import { openFileProjectRepository } from '../src/services/file-repository'
import { cleanup, temporaryWorkspace } from './helpers'

describe('durable file repository', () => {
  it('retains resource bytes, version labels, timestamps and idempotent receipts after reopening', async () => {
    const root = await temporaryWorkspace()
    const repository = await openFileProjectRepository(root)
    cleanup(() => repository.dispose())
    const document = createStudioProject({ id: 'account', name: 'Account', preset: 'element-plus' })
    const bytes = Buffer.from('embedded asset')
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    document.resources.logo = { id: 'logo', name: 'Logo', kind: 'embedded', fileName: 'logo.txt', mediaType: 'text/plain', contentHash: hash, byteLength: bytes.length }
    const created = await repository.create({ document, embeddedContents: [{ resourceId: 'logo', contentHash: hash, bytes }] })
    const commit = { id: document.id, commandId: 'rename', expectedRepositoryRevision: 0, document: { ...document, name: 'Renamed' }, metadata: { source: 'manual' as const } }
    const saved = await repository.commit(commit)
    await repository.setVersionLabel({ projectId: document.id, revision: 1, label: 'Ready', expectedRepositoryRevision: 1 })
    await repository.pruneVersions(document.id)
    const versions = await repository.listVersions(document.id)
    await repository.dispose()
    const reopened = await openFileProjectRepository(root)
    cleanup(() => reopened.dispose())
    expect(await reopened.get(document.id)).toEqual(saved.project)
    expect(await reopened.getVersion(document.id, 0)).toEqual(created)
    expect(await reopened.listVersions(document.id)).toEqual(versions)
    expect(await reopened.readEmbedded({ projectId: document.id, resourceId: 'logo', contentHash: hash })).toEqual(Uint8Array.from(bytes))
    expect(await reopened.commit(commit)).toEqual({ ...saved, replayed: true })
  })
  it('serializes competing writers, rejects stale revisions and mismatched repeated commands', async () => {
    const root = await temporaryWorkspace()
    const repository = await openFileProjectRepository(root)
    cleanup(() => repository.dispose())
    const document = createStudioProject({ id: 'shared', name: 'Shared', preset: 'antd-vue' })
    await repository.create({ document, embeddedContents: [] })
    const edit = (commandId: string) => ({ id: document.id, commandId, expectedRepositoryRevision: 0, document: { ...document, name: commandId }, metadata: { source: 'manual' as const } })
    const results = await Promise.allSettled([repository.commit(edit('a')), repository.commit(edit('b'))])
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected'])
    expect(results[1]).toMatchObject({ reason: { code: 'PROJECT_REVISION_CONFLICT' } })
    await expect(repository.commit({ ...edit('a'), document: { ...document, name: 'different' } })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_COMMAND_REUSED' })
    await expect(openFileProjectRepository(root)).rejects.toThrow('active local service')
  })
  it('rolls back a disk publication failure and rejects corrupt journals', async () => {
    const root = await temporaryWorkspace()
    const repository = await openFileProjectRepository(root)
    cleanup(() => repository.dispose())
    const document = createStudioProject({ id: 'rollback', name: 'Original', preset: 'element-plus' })
    const original = await repository.create({ document, embeddedContents: [] })
    const file = join(root, '.configform', 'workspace.json')
    await rename(file, `${file}.backup`)
    await mkdir(file)
    await expect(repository.commit({ id: document.id, commandId: 'failure', expectedRepositoryRevision: 0, document: { ...document, name: 'Unsaved' }, metadata: { source: 'manual' } })).rejects.toBeDefined()
    expect(await repository.get(document.id)).toEqual(original)
    await rm(file, { recursive: true })
    await rename(`${file}.backup`, file)
    expect(JSON.parse(await readFile(file, 'utf8')).entries).toHaveLength(1)
    await repository.dispose()
    await writeFile(file, '{bad')
    await expect(openFileProjectRepository(root)).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })
})
