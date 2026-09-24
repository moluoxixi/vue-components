// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const mocks = vi.hoisted(() => ({
  controller: undefined as unknown,
  ui: undefined as unknown,
}))

vi.mock('../context', () => ({
  useWorkbenchController: () => mocks.controller,
  useWorkbenchUiStore: () => mocks.ui,
}))

const { useWorkbenchManagementNav } = await import('../use-workbench-management-nav')

const Stub = defineComponent({ setup: () => () => h('div') })

async function mountNav(options: {
  currentProjectId?: string
  initialPath: string
  projectIds?: readonly string[]
  requestOpenProject?: (id: string) => Promise<void>
}) {
  const currentProject = shallowRef<{ id: string } | undefined>(
    options.currentProjectId ? { id: options.currentProjectId } : undefined,
  )
  const projects = ref((options.projectIds ?? []).map(id => ({ id, name: id })))
  const requestOpenProject = vi.fn(async (id: string) => {
    if (options.requestOpenProject)
      return await options.requestOpenProject(id)
    currentProject.value = { id }
  })
  const notify = vi.fn()
  mocks.controller = {
    currentProject,
    projects,
    requestOpenProject,
    workbenchLocale: computed(() => ({
      locale: 'en-US',
      t: (_key: string, fallback: string) => fallback,
    })),
  }
  mocks.ui = { notify }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects', name: 'projects', component: Stub },
      { path: '/projects/:projectId/pages', name: 'project-pages', component: Stub },
      { path: '/projects/:projectId/pages/:pageId/design', name: 'page-design', component: Stub },
    ],
  })
  await router.push(options.initialPath)
  await router.isReady()
  const holder: { nav?: ReturnType<typeof useWorkbenchManagementNav> } = {}
  const Host = defineComponent({
    setup() {
      holder.nav = useWorkbenchManagementNav()
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { global: { plugins: [router] } })
  await flushPromises()
  return { currentProject, nav: () => holder.nav!, notify, projects, requestOpenProject, router, wrapper }
}

describe('workbench management navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the console a route belongs to', async () => {
    const projects = await mountNav({ initialPath: '/projects' })
    expect(projects.nav().active.value).toBe('projects')
    projects.wrapper.unmount()

    const pages = await mountNav({ currentProjectId: 'project-a', initialPath: '/projects/project-a/pages' })
    expect(pages.nav().active.value).toBe('pages')
    pages.wrapper.unmount()

    const designer = await mountNav({
      currentProjectId: 'project-a',
      initialPath: '/projects/project-a/pages/home/design',
    })
    expect(designer.nav().active.value).toBeUndefined()
    designer.wrapper.unmount()
  })

  it('opens page management for the already open project', async () => {
    const harness = await mountNav({ currentProjectId: 'project-a', initialPath: '/projects' })

    await harness.nav().select('pages')
    await flushPromises()

    expect(harness.requestOpenProject).not.toHaveBeenCalled()
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages')
    harness.wrapper.unmount()
  })

  it('falls back to the most recent project when none is open yet', async () => {
    const harness = await mountNav({ initialPath: '/projects', projectIds: ['project-recent', 'project-old'] })

    await harness.nav().select('pages')
    await flushPromises()

    expect(harness.requestOpenProject).toHaveBeenCalledWith('project-recent')
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-recent/pages')
    expect(harness.notify).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('reports an empty workspace instead of navigating to a page list that cannot exist', async () => {
    const harness = await mountNav({ initialPath: '/projects' })

    await harness.nav().select('pages')
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects')
    expect(harness.notify).toHaveBeenCalledOnce()
    expect(String(harness.notify.mock.calls[0]?.[0])).toContain('Create or open a project')
    harness.wrapper.unmount()
  })

  it('keeps the current screen when the project cannot be opened', async () => {
    const harness = await mountNav({
      initialPath: '/projects',
      projectIds: ['project-a'],
      requestOpenProject: async () => {},
    })

    await harness.nav().select('pages')
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects')
    harness.wrapper.unmount()
  })

  it('does nothing when the target console is already active', async () => {
    const harness = await mountNav({ currentProjectId: 'project-a', initialPath: '/projects/project-a/pages' })

    await harness.nav().select('pages')
    await flushPromises()

    expect(harness.requestOpenProject).not.toHaveBeenCalled()
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages')
    harness.wrapper.unmount()
  })

  it('returns to project management from either console', async () => {
    const harness = await mountNav({ currentProjectId: 'project-a', initialPath: '/projects/project-a/pages' })

    await harness.nav().select('projects')
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects')
    harness.wrapper.unmount()
  })
})
