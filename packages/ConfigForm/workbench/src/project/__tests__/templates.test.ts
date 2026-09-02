import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { normalizeProjectPath } from '..'
import { createWorkspaceArchive } from '../export'
import {
  getBuiltInTemplateSeed,
  instantiateTemplatePage,
  parseProjectTemplateSeed,
} from '../templates'
import { createBuiltInProjectFixture, createRegistryLockFixture } from './fixtures'

function createProject(templateId: 'antd-profile' | 'element-profile') {
  const adapter = templateId === 'element-profile' ? 'element-plus' : 'antd-vue'
  return createBuiltInProjectFixture(templateId, {
    id: `${templateId}-fixture`,
    name: `${templateId} fixture`,
  }, createRegistryLockFixture(adapter))
}

describe('project templates', () => {
  it('creates deterministic Element Plus and Ant Design Vue template fixtures', () => {
    const element = createProject('element-profile')
    const antd = createProject('antd-profile')
    expect(element.registryLock.adapter).toBe('element-plus')
    expect(antd.registryLock.adapter).toBe('antd-vue')
    expect(element).toMatchObject({
      version: 4,
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
      'profile-name-node-1',
      'profile-role-node-2',
      'profile-active-node-3',
    ])
    expect(Object.values(element.pagesById.home!.graph.nodesById).map(node =>
      node.kind === 'field' ? node.field : undefined)).toEqual([
      'name-field-4',
      'role-field-5',
      'active-field-6',
    ])
    expect(Object.values(antd.pagesById.home!.graph.nodesById)).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: 'antd.switch' }),
    ]))
  })

  it('creates standalone normalized pages without project metadata', () => {
    const seed = getBuiltInTemplateSeed('element-profile')
    const parsed = seed && parseProjectTemplateSeed(seed, 'built-in')
    if (!parsed || 'code' in parsed)
      throw new Error(parsed?.message ?? 'Template not found.')
    const page = instantiateTemplatePage({ providerId: 'built-in', ...parsed }, {
      id: 'settings',
      identityFactory: { create: (_kind, source) => source },
      name: 'Settings',
      route: '/settings',
    })

    expect(page).toMatchObject({ id: 'settings', name: 'Settings', route: '/settings' })
    expect(page.graph.root.map(item => item.nodeId)).toEqual(['profile-name', 'profile-role', 'profile-active'])
    expect(Object.values(page.graph.nodesById).map(node =>
      node.kind === 'field' ? node.field : undefined)).toEqual(['name', 'role', 'active'])
    expect(page).not.toHaveProperty('registryLock')
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
