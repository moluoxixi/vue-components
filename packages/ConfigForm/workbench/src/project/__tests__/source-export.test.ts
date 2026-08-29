import type { LowCodePageModel } from '@moluoxixi/config-form-designer'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { parse as parseSfc } from '@vue/compiler-sfc'
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

  it('projects JSON-only flows into standalone source without ConfigForm dependencies', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-flow',
      name: 'Standalone flow',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.flows = [{
      version: 1,
      id: 'submit-flow',
      name: 'Submit flow',
      trigger: { kind: 'form.submit' },
      nodes: [
        { id: 'trigger', type: 'trigger' },
        { id: 'end', type: 'end' },
      ],
      edges: [{ id: 'next', source: 'trigger', target: 'end', condition: 'next' }],
    }]
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const flows = (exported.files[normalizeProjectPath('src/flows.ts')] as { content: string }).content
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content
    expect(flows).toContain('submit-flow')
    expect(flows).toContain('runFlows')
    expect(flows).toContain('concurrency?: \'latest\' | \'queue\' | \'ignore\'')
    expect(flows).toContain('activeRuns')
    expect(flows).toContain('flow.errorPolicy?.onError === \'end\'')
    expect(flows).toContain('setProps')
    expect(flows).toContain('setState')
    expect(flows).toContain('effect.kind === \'validate\'')
    expect(app).toContain('import { getFlowProjection, runFlows, type FlowTrigger } from \'./flows\'')
    expect(app).toContain('runTrigger({ kind: \'page.mount\' })')
    expect(app).toContain('@change=\'runFieldChange(')
    expect(app).toContain('fieldProps["name"]')
    expect(app).toContain('fieldStates["name"]')
    expect(app).not.toMatch(/ConfigForm|config-form|form\.config/)
  })

  it('rejects malformed flows before generating a source project', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-invalid-flow',
      name: 'Standalone invalid flow',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.flows = [null] as never
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    expect(() => createPureSourceExport(project, model, registry)).toThrow('Flow must be a JSON object')
  })

  it('preserves explicit null field defaults in the generated model', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-null-default',
      name: 'Standalone null default',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.defaultValue = null
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content

    expect(app).toContain('"name": null')
  })

  it('escapes HTML-sensitive JSON values so generated Vue SFCs remain parseable', () => {
    const project = createBuiltInWorkspaceProject('element-profile', {
      createdAt: '2026-08-27T08:00:00.000Z',
      id: 'standalone-script-value',
      name: 'Standalone script value',
    })
    const model = JSON.parse((project.files[normalizeProjectPath('src/form.designer.json')] as { content: string }).content) as LowCodePageModel
    model.nodes[0]!.defaultValue = '</script>'
    const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())
    const exported = createPureSourceExport(project, model, registry)
    const app = (exported.files[normalizeProjectPath('src/App.vue')] as { content: string }).content

    expect(app).toContain('"name": "\\u003c/script\\u003e"')
    expect(parseSfc(app).errors).toEqual([])
  })
})
