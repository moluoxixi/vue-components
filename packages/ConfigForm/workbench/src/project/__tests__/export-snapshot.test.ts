import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { BuildExportSnapshotInput } from '../index'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot, migrateLegacyWorkspaceApplication } from '@moluoxixi/config-form-model'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createWorkspaceArchive } from '../export/archive'
import {
  buildExportSnapshot,
  createExportSession,
  isExportSnapshotStale,
  resolveExportSnapshotPath,
} from '../export/snapshot'
import { normalizeProjectPath } from '../path'
import { createBuiltInWorkspaceApplication } from '../templates'

async function fixture(name = 'Customer app'): Promise<BuildExportSnapshotInput> {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'customer-app',
    name,
  })
  const migrated = migrateLegacyWorkspaceApplication(application, {
    registryLock: adapter.componentRegistry.lock,
  })
  if (!migrated.success)
    throw new Error(migrated.diagnostics[0]?.message ?? 'Migration failed.')
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(migrated.data, 8),
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
})
