import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { applyProjectTransaction, createComponentContractRegistry, createProjectSnapshot } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createStudioNode, createStudioProject, generateProjectSource, getStudioCatalog, getStudioPreset } from '..'

describe('portable Studio SDK', () => {
  it.each(['element-plus', 'antd-vue'] as const)('creates, edits, compiles and generates without a browser for %s', async (preset) => {
    expect(typeof window).toBe('undefined')
    const project = createStudioProject({ id: 'portable-project', name: 'Account', preset })
    const before = JSON.stringify(project)
    const prefix = preset === 'element-plus' ? 'element' : 'antd'
    const grid = createStudioNode({ preset, component: `${prefix}.grid`, id: 'layout' })
    const field = createStudioNode({ preset, component: `${prefix}.input`, id: 'name', field: 'name', label: '姓名', props: { placeholder: '输入姓名' } })
    const registry = createComponentContractRegistry(getStudioCatalog(preset).materials.map(material => material.contract), { adapter: preset, version: '1' })
    const edited = applyProjectTransaction(project, { id: 'fields', label: 'Add name', operations: [
      { type: 'node.insert', surfaceId: 'home', subgraph: grid, target: { parentId: null } },
      { type: 'node.insert', surfaceId: 'home', subgraph: field, target: { parentId: 'layout', slot: 'default' } },
    ] }, { registry })
    if (!edited.success)
      throw new Error(JSON.stringify(edited.diagnostics))
    expect(JSON.stringify(project)).toBe(before)
    expect(compileCanonicalProject({ snapshot: createProjectSnapshot(edited.document, 0), registry: getStudioPreset(preset).registry }).success).toBe(true)
    const source = await generateProjectSource({ project: edited.document, preset })
    expect(source.success).toBe(true)
    if (source.success) {
      const page = source.data.files.find(file => file.path === 'src/surfaces/home/Surface.vue')
      expect(page?.kind === 'text' && page.content).toContain('姓名')
      expect(source.data.files.find(file => file.path === 'package.json')).not.toEqual(expect.objectContaining({ content: expect.stringContaining('@moluoxixi/config-form') }))
    }
  })
  it.each(['element-plus', 'antd-vue'] as const)('can generate every built-in template with preset %s', async (preset) => {
    for (const template of getStudioCatalog(preset).templates) {
      const project = createStudioProject({ id: `project-${template.id}`, name: template.name, preset, templateId: template.id })
      const result = await generateProjectSource({ project, preset, surfaceId: template.surface.id })
      expect(result.success, JSON.stringify(result.diagnostics)).toBe(true)
    }
  })
  it('rejects unknown materials, incompatible templates and duplicated asset identities', () => {
    expect(() => createStudioNode({ preset: 'element-plus', component: 'antd.input', id: 'field' })).toThrow('Unknown component')
    expect(() => createStudioNode({ preset: 'element-plus', component: 'element.input', id: 'field' })).toThrow('field name')
    expect(() => createStudioProject({ id: 'project', name: 'P', preset: 'element-plus', templateId: 'antd-profile' })).toThrow('not available')
    const project = createStudioProject({ id: 'project', name: 'P', preset: 'element-plus' })
    expect(() => createStudioProject({ id: 'project', name: 'P', preset: 'element-plus', surfaces: [project.surfacesById.home!, project.surfacesById.home!] })).toThrow('unique')
  })

  it('uses explicit fields for distinct object and array scopes', () => {
    const first = createStudioNode({ preset: 'element-plus', component: 'element.object-group', id: 'billing', field: 'billing' })
    const second = createStudioNode({ preset: 'element-plus', component: 'element.object-group', id: 'shipping', field: 'shipping' })
    const items = createStudioNode({ preset: 'antd-vue', component: 'antd.array-subform', id: 'lines', field: 'lines' })
    expect(first.nodesById.billing).toMatchObject({ valueScope: { field: 'billing' } })
    expect(second.nodesById.shipping).toMatchObject({ valueScope: { field: 'shipping' } })
    expect(items.nodesById.lines).toMatchObject({ valueScope: { field: 'lines' } })
  })
})
