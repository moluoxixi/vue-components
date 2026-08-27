import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createProjectArchive } from '../export/archive'
import { normalizeProjectPath, safeProjectSlug } from '../path'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  createBuiltInWorkspaceProject,
  createWorkspaceTemplateRegistry,
  resetBuiltInWorkspaceProject,
} from '../templates'
import { FIXED_TIME } from './fixtures'

function createProject(templateId: string) {
  return createBuiltInWorkspaceProject(templateId, {
    createdAt: FIXED_TIME,
    id: `${templateId}-fixture`,
    name: `${templateId} fixture`,
  })
}

describe('workspace templates', () => {
  it('registers deterministic Element Plus and Ant Design Vue templates', () => {
    expect([...BUILT_IN_WORKSPACE_TEMPLATES.keys()]).toEqual(['element-profile', 'antd-profile'])

    const element = createProject('element-profile')
    const antd = createProject('antd-profile')
    expect(element.manifest.adapter).toBe('element-plus')
    expect(antd.manifest.adapter).toBe('antd-vue')
    expect(element.files[normalizeProjectPath('src/form.designer.json')]).toMatchObject({
      kind: 'text',
      language: 'json',
    })
    const elementConfig = (element.files[normalizeProjectPath('src/form.config.ts')] as { content: string }).content
    const antdConfig = (antd.files[normalizeProjectPath('src/form.config.ts')] as { content: string }).content
    expect(element.manifest.generatedFormModule).toBe(normalizeProjectPath('src/form.config.ts'))
    expect(antd.manifest.generatedFormModule).toBe(normalizeProjectPath('src/form.config.ts'))
    expect(element.files[normalizeProjectPath('src/form.ts')]).toBeUndefined()
    expect(elementConfig).toContain('defineFields<PageFormValues>()')
    expect(elementConfig).toContain('component: "text"')
    expect(antdConfig).toContain('component: "boolean"')
  })

  it('uses registry versions instead of workspace or catalog protocols', () => {
    for (const templateId of BUILT_IN_WORKSPACE_TEMPLATES.keys()) {
      const project = createProject(templateId)
      const manifest = (project.files[normalizeProjectPath('package.json')] as { content: string }).content
      expect(manifest).not.toMatch(/workspace:|catalog:/)
      expect(JSON.parse(manifest)).toMatchObject({
        packageManager: 'pnpm@10.29.3',
        private: true,
        scripts: { build: expect.stringContaining('vite build') },
      })
    }
  })

  it('rejects duplicate or malformed template ids', () => {
    const template = BUILT_IN_WORKSPACE_TEMPLATES.get('element-profile')!
    expect(() => createWorkspaceTemplateRegistry([template, template])).toThrow('already exists')
    expect(() => createWorkspaceTemplateRegistry([{ ...template, id: '../unsafe' }])).toThrow('invalid template id')
  })

  it('resets a project through a new revision of its original template', () => {
    const project = createProject('element-profile')
    project.files[normalizeProjectPath('src/App.vue')] = { content: 'changed', kind: 'text', language: 'vue' }
    const reset = resetBuiltInWorkspaceProject(project, '2026-08-27T09:00:00.000Z')

    expect(reset.revision).toBe(2)
    expect(reset.updatedAt).toBe('2026-08-27T09:00:00.000Z')
    expect((reset.files[normalizeProjectPath('src/App.vue')] as { content: string }).content).not.toBe('changed')
  })

  it('exports every project file under one safe ZIP root', async () => {
    const project = createProject('element-profile')
    const archive = unzipSync(await createProjectArchive(project))
    const root = safeProjectSlug(project.name)

    expect(Object.keys(archive).sort()).toEqual(
      Object.keys(project.files).map(path => `${root}/${path}`).sort(),
    )
    for (const [path, file] of Object.entries(project.files)) {
      const data = archive[`${root}/${path}`]
      expect(data).toBeDefined()
      if (file.kind === 'text')
        expect(strFromU8(data!)).toBe(file.content)
      else
        expect(data).toEqual(file.content)
    }
  })
})
