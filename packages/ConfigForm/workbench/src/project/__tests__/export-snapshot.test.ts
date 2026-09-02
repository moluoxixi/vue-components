import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { BuildExportSnapshotInput } from '../index'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { normalizeProjectPath } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { buildExportSnapshot, createExportFileSet, createExportSession, createWorkspaceArchive, isExportSnapshotStale, resolveExportSnapshotPath } from '../export'
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
  return { compilation: result.compilation, resolver: adapter.sourceResolver }
}

describe('export snapshot', () => {
  it('builds frozen Source and Config file sets from one compilation', async () => {
    const input = await fixture()
    const snapshot = buildExportSnapshot(input)

    expect(snapshot.compilation).toBe(input.compilation)
    expect(snapshot.generatorVersion).toBe('1.0.0')
    expect(snapshot.source.entry).toBe(normalizeProjectPath('src/main.ts'))
    expect(snapshot.config.entry).toBe(normalizeProjectPath('project.config.ts'))
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.source.files)).toBe(true)
    expect(Object.isFrozen(snapshot.config.files)).toBe(true)
  })

  it('detects compilation drift without replacing pinned content', async () => {
    const input = await fixture()
    const snapshot = buildExportSnapshot(input)
    const next = await fixture('Changed customer app')

    expect(isExportSnapshotStale(snapshot, input.compilation)).toBe(false)
    expect(isExportSnapshotStale(snapshot, next.compilation)).toBe(true)
    expect(isExportSnapshotStale(snapshot, undefined)).toBe(true)
  })

  it('treats compilation origin and generator version as snapshot identity', async () => {
    const input = await fixture()
    const snapshot = buildExportSnapshot(input)
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
    const draftSnapshot = buildExportSnapshot({ ...input, compilation: draft })
    const nextGeneratorSnapshot = buildExportSnapshot({ ...input, generatorVersion: '2.0.0' })

    expect(isExportSnapshotStale(snapshot, revised)).toBe(true)
    expect(isExportSnapshotStale(draftSnapshot, draft)).toBe(false)
    expect(isExportSnapshotStale(draftSnapshot, otherDraft)).toBe(true)
    expect(isExportSnapshotStale(nextGeneratorSnapshot, input.compilation)).toBe(true)
    expect(isExportSnapshotStale(nextGeneratorSnapshot, input.compilation, '2.0.0')).toBe(false)
  })

  it('does not expose mutable retained binary bytes', async () => {
    const path = normalizeProjectPath('assets/payload.bin')
    const source = new Uint8Array([0, 127, 255])
    const fileSet = createExportFileSet(path, {
      [path]: { content: source, kind: 'binary' },
    })
    source[0] = 42

    const file = fileSet.files[path]
    expect(file?.kind).toBe('binary')
    if (file?.kind !== 'binary')
      return
    expect([...file.content]).toEqual([0, 127, 255])
    const exposed = file.content
    exposed[1] = 1
    expect([...file.content]).toEqual([0, 127, 255])
    expect(Object.isFrozen(file)).toBe(true)

    const archive = unzipSync(await createWorkspaceArchive({
      files: fileSet.files,
      name: 'Binary snapshot',
    }))
    expect([...archive['binary-snapshot/assets/payload.bin']!]).toEqual([0, 127, 255])
  })

  it('feeds frozen Source bytes to the archive', async () => {
    const snapshot = buildExportSnapshot(await fixture())
    const pagePath = normalizeProjectPath('src/pages/home/Page.vue')
    const page = snapshot.source.files[pagePath]
    expect(page?.kind).toBe('text')
    if (page?.kind !== 'text')
      return

    const archive = unzipSync(await createWorkspaceArchive({
      files: snapshot.source.files,
      name: snapshot.compilation.ir.name,
    }))
    expect(strFromU8(archive['customer-app/src/pages/home/Page.vue']!)).toBe(page.content)
  })

  it('uses preferred, entry, first text, then first file fallback order', async () => {
    const snapshot = buildExportSnapshot(await fixture())
    const preferred = normalizeProjectPath('package.json')
    expect(resolveExportSnapshotPath(snapshot.source, preferred)).toBe(preferred)
    expect(resolveExportSnapshotPath(snapshot.source, normalizeProjectPath('missing.txt'))).toBe(snapshot.source.entry)
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
      build(input) {
        if (fail)
          throw new Error('generator failed')
        return buildExportSnapshot(input)
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
    let generatorVersion = '1.0.0'
    const session = createExportSession({
      capture: () => input,
      currentCompilation: () => input.compilation,
      currentGeneratorVersion: () => generatorVersion,
    })

    expect((await session.refresh()).success).toBe(true)
    expect(session.state.stale).toBe(false)
    generatorVersion = '1.1.0'
    expect(session.sync().stale).toBe(true)
  })
})
