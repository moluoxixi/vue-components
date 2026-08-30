import type { ProjectDocument } from '@moluoxixi/config-form-model'
import {
  createProjectDomainEngine,
  migrateLegacyWorkspaceApplication,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  createBuiltInWorkspaceApplication,
  createBuiltInWorkspacePage,
  legacyApplicationOperationToProjectActions,
  legacyModelOperationToProjectActions,
  projectDocumentToLegacyWorkspaceApplication,
  projectSummaryToLegacyWorkspaceSummary,
} from '..'

const persistence = {
  createdAt: '2026-08-30T00:00:00.000Z',
  repositoryRevision: 4,
  updatedAt: '2026-08-30T01:00:00.000Z',
}

function document(): ProjectDocument {
  const application = createBuiltInWorkspaceApplication('element-profile', {
    createdAt: '2026-08-30T00:00:00.000Z',
    id: 'adapter-project',
    name: 'Adapter project',
  })
  const migrated = migrateLegacyWorkspaceApplication(application, {
    registryLock: {
      adapter: 'element-plus',
      version: '1',
      fingerprint: 'fnv1a:test-registry',
      components: {
        'element.input': { contractVersion: '1', fingerprint: 'fnv1a:input' },
        'element.select': { contractVersion: '1', fingerprint: 'fnv1a:select' },
        'element.switch': { contractVersion: '1', fingerprint: 'fnv1a:switch' },
      },
    },
  })
  if (!migrated.success)
    throw new Error(migrated.diagnostics[0]?.message)
  return migrated.data
}

describe('projectDocument Workbench compatibility boundaries', () => {
  it('projects one normalized snapshot without turning generated files into domain state', () => {
    const source = document()
    const application = projectDocumentToLegacyWorkspaceApplication(source, persistence)

    expect(application.id).toBe(source.id)
    expect(application.revision).toBe(persistence.repositoryRevision)
    expect(application.createdAt).toBe(persistence.createdAt)
    expect(application.updatedAt).toBe(persistence.updatedAt)
    expect(application.pages.map(page => page.id)).toEqual(source.pageOrder)
    expect(application.pages[0]?.model.nodes.map(node => node.id)).toEqual(
      source.pagesById.home?.graph.root.map(item => item.nodeId),
    )
    expect(application.files).toHaveProperty('package.json')
    expect(source).not.toHaveProperty('files')
  })

  it('translates legacy node operations into one ProjectDomainEngine command', () => {
    const source = document()
    const engine = createProjectDomainEngine({ document: source })
    const actions = [
      ...legacyModelOperationToProjectActions('home', {
        type: 'updateNode',
        nodeId: 'profile-name',
        patch: { field: 'fullName', label: 'Full name' },
      }),
      ...legacyModelOperationToProjectActions('home', {
        type: 'duplicate',
        nodeId: 'profile-name',
        target: { parentId: null, index: 1 },
        idMap: { 'profile-name': 'profile-name-copy' },
        fieldMap: { fullName: 'fullNameCopy' },
      }),
    ]
    expect(actions[0]).toMatchObject({
      type: 'node.patch',
      patch: { set: { field: 'fullName', label: 'Full name' } },
    })
    expect(JSON.parse(JSON.stringify(actions))).toEqual(actions)

    const result = engine.execute({
      id: 'legacy-design-command',
      label: 'Legacy design command',
      actions,
    })
    expect(result.changed).toBe(true)
    expect(engine.snapshot.editVersion).toBe(1)
    expect(engine.snapshot.document).not.toHaveProperty('revision')
    expect(engine.snapshot.document.pagesById.home?.graph.root.slice(0, 3).map(item => item.nodeId)).toEqual([
      'profile-name',
      'profile-name-copy',
      'profile-role',
    ])
    expect(engine.snapshot.document.pagesById.home?.graph.nodesById['profile-name-copy']).toMatchObject({
      kind: 'field',
      field: 'fullNameCopy',
      label: 'Full name',
    })
  })

  it('translates page management operations without an application reducer', () => {
    const source = document()
    const engine = createProjectDomainEngine({ document: source })
    const page = createBuiltInWorkspacePage('element-profile', {
      createdAt: persistence.createdAt,
      id: 'settings',
      name: 'Settings',
      route: '/settings',
    })

    const added = engine.execute({
      id: 'add-settings',
      label: 'Add settings',
      actions: legacyApplicationOperationToProjectActions(source, { type: 'add-page', page }),
    })
    expect(added.changed).toBe(true)
    expect(engine.snapshot.document.pageOrder).toEqual(['home', 'settings'])
    expect(engine.snapshot.document.pagesById.settings?.graph.root.map(item => item.nodeId)).toEqual([
      'profile-name',
      'profile-role',
      'profile-active',
    ])

    const projection = projectDocumentToLegacyWorkspaceApplication(engine.snapshot.document, persistence)
    expect(projection.pages.map(item => [item.id, item.route])).toEqual([
      ['home', '/'],
      ['settings', '/settings'],
    ])
    expect(projectSummaryToLegacyWorkspaceSummary({
      id: source.id,
      name: source.name,
      repositoryRevision: persistence.repositoryRevision,
      homePageId: source.homePageId,
      pageCount: source.pageOrder.length,
      registryLock: source.registryLock,
      updatedAt: persistence.updatedAt,
    })).toMatchObject({ adapter: 'element-plus', templateId: 'element-profile' })
  })
})
