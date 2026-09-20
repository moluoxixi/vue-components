import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { SourceBinaryFile } from '@moluoxixi/config-form-source/generator'
import type { BuildExportSnapshotInput, ExportArtifact } from '../index'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  buildExportSnapshot,
  createExportSession,
  createSourceArchive,
  isExportSnapshotStale,
  resolveExportSnapshotPath,
  sourceFileBytes,
} from '../export'
import { createBuiltInProjectFixture } from './fixtures'

async function fixture(name = 'Customer app'): Promise<BuildExportSnapshotInput> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const document = createBuiltInProjectFixture('element-profile', {
    id: 'customer-app',
    name,
  }, adapter.componentRegistry.lock)
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(document, 8),
    registry: adapter.registrySnapshot,
  })
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Compilation failed.')
  return {
    bindingResolver: adapter.sourceBindingResolver,
    compilation: result.compilation,
    componentResolver: adapter.sourceComponentResolver,
    resourceReader: {
      async readEmbedded() {
        return { success: true, data: new Uint8Array(), diagnostics: [] }
      },
    },
  }
}

function expectReady<T>(artifact: ExportArtifact<T>): T {
  expect(artifact.status).toBe('ready')
  if (artifact.status !== 'ready')
    throw new Error(artifact.diagnostics.map(item => item.message).join('; '))
  return artifact.fileSet
}

describe('export snapshot', () => {
  it('builds frozen raw Vue and ConfigForm binding file sets from one compilation', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot(input)

    expect(snapshot.compilation).toBe(input.compilation)
    expect(input.componentResolver).not.toHaveProperty('resolveConfigFormBinding')
    expect(input.bindingResolver).not.toHaveProperty('resolveComponent')
    const rawSource = expectReady(snapshot.rawSource)
    const configBindings = expectReady(snapshot.configBindings)
    expect(rawSource).toMatchObject({ version: 1, kind: 'raw-source', entry: 'src/main.ts' })
    expect(configBindings).toMatchObject({ version: 1, kind: 'config-bindings', entry: 'src/bindings.ts' })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.rawSource)).toBe(true)
    expect(Object.isFrozen(snapshot.configBindings)).toBe(true)
    expect(Object.isFrozen(rawSource.files)).toBe(true)
    expect(Object.isFrozen(configBindings.files)).toBe(true)
    expect(rawSource.files.every(Object.isFrozen)).toBe(true)
    expect(configBindings.files.every(Object.isFrozen)).toBe(true)
  })

  it('keeps raw Vue ready when ConfigForm binding generation fails', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot({
      ...input,
      bindingResolver: {
        resolveConfigFormBinding: () => ({ success: false, reason: 'binding unavailable' }),
      },
    })

    expect(snapshot.rawSource.status).toBe('ready')
    expect(snapshot.configBindings).toMatchObject({ status: 'failed' })
    if (snapshot.configBindings.status === 'failed') {
      expect(snapshot.configBindings.diagnostics[0]?.message).toContain('binding unavailable')
      expect(Object.isFrozen(snapshot.configBindings.diagnostics)).toBe(true)
    }
  })

  it('keeps ConfigForm bindings ready when Raw Vue generation fails', async () => {
    const input = await fixture()
    const resolveComponent = input.componentResolver.resolveComponent
    let rejectNextResolution = true
    const snapshot = await buildExportSnapshot({
      ...input,
      componentResolver: {
        ...input.componentResolver,
        resolveComponent(request) {
          if (rejectNextResolution) {
            rejectNextResolution = false
            return { success: false, reason: 'raw component unavailable' }
          }
          return resolveComponent(request)
        },
      },
    })

    expect(snapshot.rawSource).toMatchObject({ status: 'failed' })
    if (snapshot.rawSource.status === 'failed')
      expect(snapshot.rawSource.diagnostics[0]?.message).toContain('raw component unavailable')
    expect(snapshot.configBindings.status).toBe('ready')
  })

  it('detects compilation drift without replacing pinned content', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot(input)
    const next = await fixture('Changed customer app')

    expect(isExportSnapshotStale(snapshot, input.compilation)).toBe(false)
    expect(isExportSnapshotStale(snapshot, next.compilation)).toBe(true)
    expect(isExportSnapshotStale(snapshot, undefined)).toBe(true)
  })

  it('treats committed and draft compilation origins as snapshot identity', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot(input)
    const revised = {
      ...input.compilation,
      origin: { editVersion: 9, kind: 'committed' as const },
    } as ProjectCompilation
    const draft = {
      ...input.compilation,
      origin: { baseEditVersion: 8, draftId: 'draft-a', kind: 'draft' as const },
    } as ProjectCompilation
    const otherDraft = {
      ...draft,
      origin: { baseEditVersion: 8, draftId: 'draft-b', kind: 'draft' as const },
    } as ProjectCompilation
    const draftSnapshot = await buildExportSnapshot({ ...input, compilation: draft })

    expect(isExportSnapshotStale(snapshot, revised)).toBe(true)
    expect(isExportSnapshotStale(draftSnapshot, draft)).toBe(false)
    expect(isExportSnapshotStale(draftSnapshot, otherDraft)).toBe(true)
  })

  it('decodes canonical binary files into fresh archive bytes', async () => {
    const file: SourceBinaryFile = Object.freeze({
      kind: 'binary',
      path: 'assets/payload.bin',
      mediaType: 'application/octet-stream',
      encoding: 'base64',
      contentBase64: 'AH//',
    })
    const exposed = sourceFileBytes(file)
    exposed[1] = 1

    expect([...sourceFileBytes(file)]).toEqual([0, 127, 255])
    const archive = unzipSync(await createSourceArchive({
      files: [file],
      name: 'Binary snapshot',
    }))
    expect([...archive['binary-snapshot/assets/payload.bin']!]).toEqual([0, 127, 255])
  })

  it('feeds frozen raw-source bytes to the archive', async () => {
    const snapshot = await buildExportSnapshot(await fixture())
    const rawSource = expectReady(snapshot.rawSource)
    const page = rawSource.files.find(file => file.path === 'src/surfaces/home/Surface.vue')
    expect(page?.kind).toBe('text')
    if (page?.kind !== 'text')
      return

    const archive = unzipSync(await createSourceArchive({
      files: rawSource.files,
      name: snapshot.compilation.ir.name,
    }))
    expect(strFromU8(archive['customer-app/src/surfaces/home/Surface.vue']!)).toBe(page.content)
  })

  it('uses preferred, entry, first text, then first file fallback order', async () => {
    const snapshot = await buildExportSnapshot(await fixture())
    const rawSource = expectReady(snapshot.rawSource)
    expect(resolveExportSnapshotPath(rawSource, 'package.json')).toBe('package.json')
    expect(resolveExportSnapshotPath(rawSource, 'missing.txt')).toBe(rawSource.entry)
  })

  it('keeps the last complete snapshot when refresh fails', async () => {
    const first = await fixture()
    const next = await fixture('Changed customer app')
    let current: ProjectCompilation | undefined = first.compilation
    let capture: BuildExportSnapshotInput | undefined = first
    let fail = false
    const session = createExportSession({
      capture: () => capture,
      currentCompilation: () => current,
      async build(input) {
        if (fail)
          throw new Error('generator failed')
        return await buildExportSnapshot(input)
      },
    })

    const opened = await session.refresh()
    expect(opened.success).toBe(true)
    const pinned = session.state.snapshot
    current = next.compilation
    capture = next
    session.sync()
    expect(session.state.stale).toBe(true)

    fail = true
    const failed = await session.refresh()
    expect(failed).toMatchObject({ success: false, error: 'generator failed' })
    expect(session.state.snapshot).toBe(pinned)
    expect(session.state.stale).toBe(true)
  })
})
