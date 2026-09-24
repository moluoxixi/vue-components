// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  createWorkbenchRouter,
  hasWorkbenchPage,
  isProjectRouteName,
  pageCreatePath,
  pageDesignPath,
  projectCreatePath,
  projectPagesPath,
  projectsPath,
  readWorkbenchRouteTarget,
  shouldBlockProjectSwitch,
  WORKBENCH_PATHS,
  WORKBENCH_ROUTES,
} from '..'

const StubScreen = defineComponent({ setup: () => () => null })

/**
 * The real path/name/redirect table with stub screens: these tests own routing
 * behaviour, not the workspace screens that the production table lazy-loads.
 */
function createResolvingRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: WORKBENCH_ROUTES.map(route => ('component' in route && route.component
      ? { ...route, component: StubScreen }
      : route)),
  })
}

describe('workbench router', () => {
  it('publishes hash deep links so a static host needs no rewrite rule', () => {
    const router = createWorkbenchRouter()
    expect(router.resolve('/projects').href).toMatch(/#\/projects$/)
  })

  it('resolves every workspace screen to its own named route', async () => {
    const router = createResolvingRouter()

    await router.push('/')
    expect(router.currentRoute.value.name).toBe('projects')

    await router.push(projectsPath())
    expect(router.currentRoute.value.name).toBe('projects')

    await router.push(projectCreatePath('template'))
    expect(router.currentRoute.value.name).toBe('project-create')

    await router.push(projectCreatePath('json'))
    expect(router.currentRoute.value.name).toBe('project-import')

    await router.push(projectPagesPath('project-a'))
    expect(router.currentRoute.value.name).toBe('project-pages')
    expect(router.currentRoute.value.params.projectId).toBe('project-a')

    await router.push(pageCreatePath('project-a'))
    expect(router.currentRoute.value.name).toBe('page-create')

    await router.push(pageDesignPath('project-a', 'page-b'))
    expect(router.currentRoute.value.name).toBe('page-design')
    expect(router.currentRoute.value.params).toMatchObject({
      pageId: 'page-b',
      projectId: 'project-a',
    })
  })

  it('keeps the form designer page-scoped instead of project-scoped', () => {
    expect(WORKBENCH_PATHS.pageDesign).toBe('/projects/:projectId/pages/:pageId/design')
    expect(pageDesignPath('project-a', 'page-b')).toBe('/projects/project-a/pages/page-b/design')
    expect(WORKBENCH_ROUTES.map(route => String(route.name ?? ''))).not.toContain('project-design')
  })

  it('redirects the root and unknown deep links back to the projects list', async () => {
    const router = createResolvingRouter()
    await router.push('/projects/project-a/pages/page-b/design/deep/extra')
    expect(router.currentRoute.value.name).toBe('projects')
    expect(router.currentRoute.value.path).toBe(WORKBENCH_PATHS.projects)
  })

  it('builds paths that round-trip through the route table', async () => {
    const router = createResolvingRouter()
    await router.push(pageDesignPath('project a', 'page/b'))
    const target = readWorkbenchRouteTarget(router.currentRoute.value)
    expect(target).toEqual({ pageId: 'page/b', projectId: 'project a' })
  })

  it('treats only project-scoped screens as projects', () => {
    expect(isProjectRouteName('project-pages')).toBe(true)
    expect(isProjectRouteName('page-create')).toBe(true)
    expect(isProjectRouteName('page-design')).toBe(true)
    expect(isProjectRouteName('projects')).toBe(false)
    expect(isProjectRouteName('project-create')).toBe(false)
    expect(isProjectRouteName(undefined)).toBe(false)
    expect(isProjectRouteName(Symbol('route'))).toBe(false)
  })

  it('returns an empty target for routes without project parameters', async () => {
    const router = createResolvingRouter()
    await router.push('/projects/new')
    expect(readWorkbenchRouteTarget(router.currentRoute.value)).toEqual({})
  })

  it('ignores malformed route parameters instead of opening a broken workspace', () => {
    expect(readWorkbenchRouteTarget({ params: { projectId: '', pageId: [] } })).toEqual({})
    expect(readWorkbenchRouteTarget({ params: { projectId: ['project-a', 'project-b'], pageId: ['page-a'] } }))
      .toEqual({ pageId: 'page-a', projectId: 'project-a' })
  })
})

describe('workbench route page resolution', () => {
  it('accepts a page the project still has', () => {
    expect(hasWorkbenchPage({ surfacesById: { home: {}, detail: {} } }, 'detail')).toBe(true)
  })

  it('rejects a page the project no longer has', () => {
    expect(hasWorkbenchPage({ surfacesById: { home: {} } }, 'removed')).toBe(false)
    expect(hasWorkbenchPage({ surfacesById: {} }, 'removed')).toBe(false)
  })
})

describe('workbench project switch guard', () => {
  it('refuses to switch projects while the open project has unsaved work', () => {
    expect(shouldBlockProjectSwitch({
      hasUnsavedChanges: true,
      openProjectId: 'project-a',
      targetProjectId: 'project-b',
    })).toBe(true)
  })

  it('allows staying inside the open project and returning to the projects list', () => {
    expect(shouldBlockProjectSwitch({
      hasUnsavedChanges: true,
      openProjectId: 'project-a',
      targetProjectId: 'project-a',
    })).toBe(false)
    expect(shouldBlockProjectSwitch({
      hasUnsavedChanges: true,
      openProjectId: 'project-a',
      targetProjectId: undefined,
    })).toBe(false)
  })

  it('allows switching when nothing is dirty or nothing is open', () => {
    expect(shouldBlockProjectSwitch({
      hasUnsavedChanges: false,
      openProjectId: 'project-a',
      targetProjectId: 'project-b',
    })).toBe(false)
    expect(shouldBlockProjectSwitch({
      hasUnsavedChanges: true,
      openProjectId: undefined,
      targetProjectId: 'project-b',
    })).toBe(false)
  })
})
