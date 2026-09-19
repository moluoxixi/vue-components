import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { SourceBinaryFile } from '@moluoxixi/config-form-source/generator'
import type { BuildExportSnapshotInput } from '../index'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import {
  buildExportSnapshot,
  CONFIG_FORM_EXPORT_GENERATOR_VERSION,
  createExportSession,
  createWorkspaceArchive,
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
    compilation: result.compilation,
    providerResolver: adapter.sourceProviderResolver,
    resourceReader: {
      async readEmbedded() {
        return { success: true, data: new Uint8Array(), diagnostics: [] }
      },
    },
  }
}

describe('export snapshot', () => {
  it('builds frozen raw Vue and ConfigForm binding file sets from one compilation', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot(input)

    expect(snapshot.compilation).toBe(input.compilation)
    expect(snapshot.generatorVersion).toBe(CONFIG_FORM_EXPORT_GENERATOR_VERSION)
    expect(snapshot.generatorVersion).toBe('source-file-set-v1')
    expect(snapshot.rawSource).toMatchObject({ kind: 'raw-source', entry: 'src/main.ts' })
    expect(snapshot.configBindings).toMatchObject({ kind: 'config-bindings', entry: 'src/main.ts' })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.rawSource.files)).toBe(true)
    expect(Object.isFrozen(snapshot.configBindings.files)).toBe(true)
    expect(snapshot.rawSource.files.every(Object.isFrozen)).toBe(true)
    expect(snapshot.configBindings.files.every(Object.isFrozen)).toBe(true)
  })

  it('detects compilation drift without replacing pinned content', async () => {
    const input = await fixture()
    const snapshot = await buildExportSnapshot(input)
    const next = await fixture('Changed customer app')

    expect(isExportSnapshotStale(snapshot, input.compilation)).toBe(false)
    expect(isExportSnapshotStale(snapshot, next.compilation)).toBe(true)
    expect(isExportSnapshotStale(snapshot, undefined)).toBe(true)
  })

  it('treats compilation origin and generator version as snapshot identity', async () => {
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
    const nextGeneratorSnapshot = await buildExportSnapshot({ ...input, generatorVersion: '999.0.0' })

    expect(isExportSnapshotStale(snapshot, revised)).toBe(true)
    expect(isExportSnapshotStale(draftSnapshot, draft)).toBe(false)
    expect(isExportSnapshotStale(draftSnapshot, otherDraft)).toBe(true)
    expect(isExportSnapshotStale(nextGeneratorSnapshot, input.compilation)).toBe(true)
    expect(isExportSnapshotStale(nextGeneratorSnapshot, input.compilation, '999.0.0')).toBe(false)
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
    const archive = unzipSync(await createWorkspaceArchive({
      files: [file],
      name: 'Binary snapshot',
    }))
    expect([...archive['binary-snapshot/assets/payload.bin']!]).toEqual([0, 127, 255])
  })

  it('feeds frozen raw-source bytes to the archive', async () => {
    const snapshot = await buildExportSnapshot(await fixture())
    const page = snapshot.rawSource.files.find(file => file.path === 'src/surfaces/home/Surface.vue')
    expect(page?.kind).toBe('text')
    if (page?.kind !== 'text')
      return

    const archive = unzipSync(await createWorkspaceArchive({
      files: snapshot.rawSource.files,
      name: snapshot.compilation.ir.name,
    }))
    expect(strFromU8(archive['customer-app/src/surfaces/home/Surface.vue']!)).toBe(page.content)
  })

  it('uses preferred, entry, first text, then first file fallback order', async () => {
    const snapshot = await buildExportSnapshot(await fixture())
    expect(resolveExportSnapshotPath(snapshot.rawSource, 'package.json')).toBe('package.json')
    expect(resolveExportSnapshotPath(snapshot.rawSource, 'missing.txt')).toBe(snapshot.rawSource.entry)
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

  it('marks a pinned session stale when its generator changes', async () => {
    const input = await fixture()
    let generatorVersion: string = CONFIG_FORM_EXPORT_GENERATOR_VERSION
    const session = createExportSession({
      capture: () => input,
      currentCompilation: () => input.compilation,
      currentGeneratorVersion: () => generatorVersion,
    })

    expect((await session.refresh()).success).toBe(true)
    expect(session.state.stale).toBe(false)
    generatorVersion = '999.0.0'
    expect(session.sync().stale).toBe(true)
  })
})
