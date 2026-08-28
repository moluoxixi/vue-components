import type { LowCodePageModel } from '@moluoxixi/config-form-designer'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createProjectArchive } from '../export/archive'
import { createPureSourceExport } from '../export/source'
import { normalizeProjectPath } from '../path'
import { createBuiltInWorkspaceProject } from '../templates'

describe('standalone source export', () => {
  it('generates a complete Vue project without ConfigForm runtime imports', async () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-source',
      name: 'Standalone source',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const paths = Object.keys(exported.files)

    expect(paths).toContain('package.json')
    expect(paths).toContain('src/App.vue')
    expect(paths).toContain('src/page.model.json')
    expect(paths).not.toContain('src/form.config.ts')
    expect(paths).not.toContain('src/form.designer.json')

    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content
    const manifest = (exported.files[normalizeProjectPath('package.json')] as { content: string }).content
    expect(app).not.toMatch(/ConfigForm|config-form|form\.config/)
    expect(manifest).not.toMatch(/ConfigForm|config-form|workspace:|catalog:/)
    expect(JSON.parse(manifest).dependencies).toEqual({ vue: expect.any(String) })

    const archive = unzipSync(await createProjectArchive(exported.project))
    expect(Object.keys(archive).map(path => path.split('/').slice(1).join('/')).sort()).toEqual(paths.sort())
    expect(strFromU8(archive[`standalone-source/src/App.vue`]!)).toBe(app)
  })

  it('rejects dynamic model semantics that cannot be represented safely', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-dynamic',
      name: 'Standalone dynamic',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.events = { change: [{ action: 'notify', source: 'workflow' }] }
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    expect(() => createPureSourceExport(project, model, registry)).toThrow('dynamic semantics')
  })
})
