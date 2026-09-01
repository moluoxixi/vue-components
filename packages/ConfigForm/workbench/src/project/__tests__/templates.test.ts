import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createWorkspaceArchive } from '../export/archive'
import { normalizeProjectPath } from '../path'
import {
  BUILT_IN_PROJECT_TEMPLATES,
  createBuiltInProject,
  createBuiltInProjectPage,
  createProjectTemplateRegistry,
} from '../templates'
import { createRegistryLockFixture } from './fixtures'

function createProject(templateId: 'antd-profile' | 'element-profile') {
  const adapter = templateId === 'element-profile' ? 'element-plus' : 'antd-vue'
  return createBuiltInProject(templateId, {
    id: `${templateId}-fixture`,
    name: `${templateId} fixture`,
  }, createRegistryLockFixture(adapter))
}

describe('project templates', () => {
  it('registers deterministic Element Plus and Ant Design Vue templates', () => {
    expect([...BUILT_IN_PROJECT_TEMPLATES.keys()]).toEqual(['element-profile', 'antd-profile'])

    const element = createProject('element-profile')
    const antd = createProject('antd-profile')
    expect(element.registryLock.adapter).toBe('element-plus')
    expect(antd.registryLock.adapter).toBe('antd-vue')
    expect(element).toMatchObject({
      schemaVersion: 4,
      id: 'element-profile-fixture',
      homePageId: 'home',
      pageOrder: ['home'],
    })
    expect(element.pagesById.home?.graph).toMatchObject({
      version: 2,
      form: {
        responsive: {
          mobile: { columns: 1, fieldSpan: 1 },
          tablet: { columns: 12, fieldSpan: 12 },
        },
      },
    })
    expect(Object.values(element.pagesById.home!.graph.nodesById)).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'element.input', events: {}, bindings: {} }),
    ]))
    expect(Object.keys(element.pagesById.home!.graph.nodesById)).toEqual([
      'profile-name',
      'profile-role',
      'profile-active',
    ])
    expect(Object.values(element.pagesById.home!.graph.nodesById).map(node =>
      node.kind === 'field' ? node.field : undefined)).toEqual(['name', 'role', 'active'])
    expect(Object.values(antd.pagesById.home!.graph.nodesById)).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'antd.switch' }),
    ]))
  })

  it('creates standalone normalized pages without project metadata', () => {
    const page = createBuiltInProjectPage('element-profile', {
      id: 'settings',
      name: 'Settings',
      route: '/settings',
    })

    expect(page).toMatchObject({ id: 'settings', name: 'Settings', route: '/settings' })
    expect(page.graph.root.map(item => item.nodeId)).toEqual(['profile-name', 'profile-role', 'profile-active'])
    expect(Object.values(page.graph.nodesById).map(node =>
      node.kind === 'field' ? node.field : undefined)).toEqual(['name', 'role', 'active'])
    expect(page).not.toHaveProperty('registryLock')
  })

  it('rejects duplicate or malformed template ids', () => {
    const template = BUILT_IN_PROJECT_TEMPLATES.get('element-profile')!
    expect(() => createProjectTemplateRegistry([template, template])).toThrow('already exists')
    expect(() => createProjectTemplateRegistry([{ ...template, id: '../unsafe' }])).toThrow('invalid template id')
  })

  it('archives an explicit readonly generated file set under one safe root', async () => {
    const entry = normalizeProjectPath('src/main.ts')
    const archive = unzipSync(await createWorkspaceArchive({
      name: 'Element profile fixture',
      files: {
        [entry]: { content: 'export {}\n', kind: 'text', language: 'typescript' },
      },
    }))

    expect(Object.keys(archive)).toEqual(['element-profile-fixture/src/main.ts'])
    expect(strFromU8(archive['element-profile-fixture/src/main.ts']!)).toBe('export {}\n')
  })
})
