import { describe, expect, it } from 'vitest'
import {
  applyWorkspaceApplicationOperation,
  commitWorkspaceApplication,
  duplicateWorkspacePage,
  migrateWorkspaceProjectToApplication,
  nextWorkspacePageId,
  nextWorkspacePageRoute,
  parseWorkspaceApplication,
} from '../application'
import { createProjectFixture, NEXT_TIME } from './fixtures'

describe('workspace application schema and migration', () => {
  it('migrates a legacy project into one deterministic home page', () => {
    const legacy = createProjectFixture()
    const application = migrateWorkspaceProjectToApplication(legacy)

    expect(application).toMatchObject({
      homePageId: 'home',
      id: legacy.id,
      revision: legacy.revision,
      schemaVersion: 2,
    })
    expect(application.pages).toEqual([
      expect.objectContaining({ id: 'home', name: legacy.name, route: '/' }),
    ])
    expect(migrateWorkspaceProjectToApplication(legacy)).toEqual(application)
  })

  it('rejects duplicate routes, missing home pages, and empty page collections', () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    expect(() => parseWorkspaceApplication({
      ...application,
      pages: [application.pages[0], { ...application.pages[0], id: 'other' }],
    })).toThrow('duplicate page route')
    expect(() => parseWorkspaceApplication({ ...application, homePageId: 'missing' })).toThrow('does not exist')
    expect(() => parseWorkspaceApplication({ ...application, pages: [] })).toThrow('workspace application is invalid')
  })

  it('commits application revisions without changing identity', () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    const renamed = { ...application, name: 'Renamed application' }
    const committed = commitWorkspaceApplication(application, 1, renamed, NEXT_TIME)

    expect(committed).toMatchObject({ id: application.id, name: 'Renamed application', revision: 2, updatedAt: NEXT_TIME })
    expect(() => commitWorkspaceApplication(application, 0, renamed, NEXT_TIME)).toThrow('changed from revision 0 to 1')
  })
})

describe('workspace application operations', () => {
  it('adds, renames, moves, routes, and removes pages atomically', () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    const source = application.pages[0]!
    const page = duplicateWorkspacePage(source, { id: 'settings', name: 'Settings', route: '/settings' })
    let next = applyWorkspaceApplicationOperation(application, { type: 'add-page', page })
    next = applyWorkspaceApplicationOperation(next, { type: 'rename-page', pageId: 'settings', name: 'Account settings' })
    next = applyWorkspaceApplicationOperation(next, { type: 'set-page-route', pageId: 'settings', route: '/account' })
    next = applyWorkspaceApplicationOperation(next, { type: 'set-home-page', pageId: 'settings' })
    next = applyWorkspaceApplicationOperation(next, { type: 'move-page', pageId: 'settings', index: 0 })

    expect(next.pages.map(item => item.id)).toEqual(['settings', 'home'])
    expect(next.pages[0]).toMatchObject({ name: 'Account settings', route: '/account' })
    expect(next.pages[0]!.model.name).toBe('Account settings')
    expect(next.homePageId).toBe('settings')

    next = applyWorkspaceApplicationOperation(next, { type: 'remove-page', pageId: 'settings' })
    expect(next.pages.map(item => item.id)).toEqual(['home'])
    expect(next.homePageId).toBe('home')
    expect(() => applyWorkspaceApplicationOperation(next, { type: 'remove-page', pageId: 'home' })).toThrow('last page')
  })

  it('duplicates every nested node identity and preserves the source page', () => {
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    const source = application.pages[0]!
    source.model.nodes = [{
      id: 'layout',
      bindings: {},
      children: [],
      component: 'element.flex',
      events: {},
      kind: 'container',
      props: {},
      slots: {
        default: [{
          id: 'field',
          bindings: {},
          children: [],
          component: 'element.input',
          events: {},
          field: 'name',
          kind: 'field',
          props: {},
          slots: {},
        }],
      },
    }]

    const copy = duplicateWorkspacePage(source, { id: 'copy', name: 'Copy', route: '/copy' })
    expect(copy.model.nodes[0]!.id).toBe('copy-node-1')
    expect(copy.model.nodes[0]!.slots.default![0]!.id).toBe('copy-node-2')
    expect(source.model.nodes[0]!.id).toBe('layout')
  })

  it('creates deterministic unique page ids and routes', () => {
    let application = migrateWorkspaceProjectToApplication(createProjectFixture())
    const source = application.pages[0]!
    application = applyWorkspaceApplicationOperation(application, {
      type: 'add-page',
      page: duplicateWorkspacePage(source, { id: 'settings', name: 'Settings', route: '/settings' }),
    })
    expect(nextWorkspacePageId(application, 'Settings')).toBe('settings-2')
    expect(nextWorkspacePageRoute(application, 'Settings')).toBe('/settings-2')
  })
})
