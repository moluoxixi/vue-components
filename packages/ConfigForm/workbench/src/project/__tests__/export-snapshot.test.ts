import type { ProjectPath, WorkspaceFile } from '../types'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createWorkspaceArchive } from '../export/archive'
import {
  createExportSnapshot,
  isExportSnapshotStale,
  resolveExportSnapshotPath,
} from '../export/snapshot'
import { normalizeProjectPath } from '../path'

function createSnapshot(files?: Record<ProjectPath, WorkspaceFile>, entry = normalizeProjectPath('src/App.vue')) {
  return createExportSnapshot({
    applicationId: 'customer-app',
    applicationName: 'Customer app',
    applicationRevision: 3,
    entry,
    files: files ?? {
      [normalizeProjectPath('src/App.vue')]: { content: '<template />', kind: 'text', language: 'vue' },
    },
    modelRevision: 8,
    revisionKey: 'customer-app:home:8',
  })
}

describe('export snapshot', () => {
  it('clones files and detects revision drift without replacing content', () => {
    const source = { content: '<template />', kind: 'text' as const, language: 'vue' }
    const snapshot = createSnapshot({ [normalizeProjectPath('src/App.vue')]: source })
    source.content = 'changed'

    expect(snapshot.files[normalizeProjectPath('src/App.vue')]).toMatchObject({ content: '<template />' })
    expect(isExportSnapshotStale(snapshot, 'customer-app', 'customer-app:home:8')).toBe(false)
    expect(isExportSnapshotStale(snapshot, 'customer-app', 'customer-app:home:9')).toBe(true)
    expect(isExportSnapshotStale(snapshot, 'other-app', 'customer-app:home:8')).toBe(true)
  })

  it('feeds the frozen snapshot bytes to the archive', async () => {
    const source = { content: '<template>snapshot</template>', kind: 'text' as const, language: 'vue' }
    const snapshot = createSnapshot({ [normalizeProjectPath('src/App.vue')]: source })
    source.content = '<template>new design</template>'
    const archive = unzipSync(await createWorkspaceArchive({
      files: snapshot.files,
      name: snapshot.applicationName,
    }))

    expect(strFromU8(archive['customer-app/src/App.vue']!)).toBe('<template>snapshot</template>')
  })

  it('uses preferred, entry, first text, then first file fallback order', () => {
    const readme = normalizeProjectPath('README.md')
    const logo = normalizeProjectPath('assets/logo.png')
    const files = {
      [logo]: { content: new Uint8Array([1]), kind: 'binary' as const },
      [readme]: { content: 'read me', kind: 'text' as const },
    }
    const snapshot = createSnapshot(files, readme)

    expect(resolveExportSnapshotPath(snapshot, logo)).toBe(logo)
    expect(resolveExportSnapshotPath(snapshot, normalizeProjectPath('missing.txt'))).toBe(readme)
  })

  it('rejects a missing entry', () => {
    expect(() => createSnapshot({
      [normalizeProjectPath('README.md')]: { content: '', kind: 'text' },
    })).toThrow('does not exist')
  })
})
