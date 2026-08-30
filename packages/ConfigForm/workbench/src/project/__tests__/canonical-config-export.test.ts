import { parse } from '@babel/parser'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import {
  createProjectSnapshot,
  migrateLegacyWorkspaceApplication,
} from '@moluoxixi/config-form-model'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createCanonicalProjectConfigExport } from '../export/config'
import { createCanonicalProjectSourceExport } from '../export/source'
import { normalizeProjectPath, safeProjectSlug } from '../path'
import { createBuiltInWorkspaceApplication } from '../templates'

async function fixture() {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'canonical-config-project',
    name: 'Canonical config project',
  })
  const migrated = migrateLegacyWorkspaceApplication(application, {
    registryLock: adapter.componentRegistry.lock,
  })
  if (!migrated.success)
    throw new Error(migrated.diagnostics[0]?.message ?? 'Migration failed.')
  const result = compileCanonicalProject({
    snapshot: createProjectSnapshot(migrated.data, 4),
    registry: adapter.registrySnapshot,
  })
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message ?? 'Compilation failed.')
  return { adapter, compilation: result.compilation }
}

describe('canonical Config export', () => {
  it('generates a project file and defineField source for every ProjectDocument page', async () => {
    const { adapter, compilation } = await fixture()
    const exported = createCanonicalProjectConfigExport(compilation, adapter.sourceResolver)

    expect(exported.entry).toBe(normalizeProjectPath('project.config.ts'))
    const paths = Object.keys(exported.files).sort()
    expect(paths).toContain('project.config.ts')
    expect(paths.filter(path => path.endsWith('/form.config.ts'))).toHaveLength(
      compilation.snapshot.document.pageOrder.length,
    )

    const pageId = compilation.snapshot.document.pageOrder[0]!
    const pageFile = exported.files[normalizeProjectPath(`pages/${safeProjectSlug(pageId)}/form.config.ts`)]
    expect(pageFile?.kind).toBe('text')
    if (pageFile?.kind !== 'text')
      return
    expect(pageFile.content).toContain('import { defineFields } from \'@moluoxixi/config-form-headless\'')
    expect(pageFile.content).toContain('const { defineField } = defineFields<PageFormValues>()')
    expect(pageFile.content).toContain('defineField({')
    expect(pageFile.content).not.toContain('LowCodePageModel')
    expect(() => parse(pageFile.content, { plugins: ['typescript'], sourceType: 'module' })).not.toThrow()
  })

  it('rejects a source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectConfigExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })
})

describe('canonical standalone Source export', () => {
  it('generates a complete routed Vue project directly from Canonical IR', async () => {
    const { adapter, compilation } = await fixture()
    const exported = createCanonicalProjectSourceExport(compilation, adapter.sourceResolver)
    const paths = Object.keys(exported.files).sort()

    expect(exported.entry).toBe(normalizeProjectPath('src/main.ts'))
    expect(paths).toEqual(expect.arrayContaining([
      'index.html',
      'package.json',
      'src/App.vue',
      'src/main.ts',
      'src/pages/home/Page.vue',
      'src/pages/home/flows.ts',
      'src/router.ts',
      'src/styles.css',
      'src/vite-env.d.ts',
      'tsconfig.json',
      'vite.config.ts',
    ]))
    expect(JSON.stringify(exported.files)).not.toMatch(/LowCodePageModel|WorkspaceApplication|@moluoxixi\/config-form/i)

    const manifest = exported.files[normalizeProjectPath('package.json')]
    expect(manifest?.kind).toBe('text')
    if (manifest?.kind === 'text') {
      expect(JSON.parse(manifest.content).dependencies).toEqual({
        'element-plus': '2.9.1',
        'vue': expect.any(String),
        'vue-router': '4.5.1',
      })
    }

    for (const path of paths.filter(path => path.endsWith('.vue'))) {
      const file = exported.files[normalizeProjectPath(path)]
      expect(file?.kind).toBe('text')
      if (file?.kind === 'text')
        expect(parseSfc(file.content).errors).toEqual([])
    }
  })

  it('rejects a Source resolver from another Registry revision', async () => {
    const { adapter, compilation } = await fixture()
    expect(() => createCanonicalProjectSourceExport(compilation, {
      ...adapter.sourceResolver,
      registryFingerprint: 'fnv1a:stale',
    })).toThrow('does not match the ProjectCompilation Registry identity')
  })
})
