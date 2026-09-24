// @vitest-environment happy-dom

import type { WorkbenchController, WorkbenchUiStore } from '../../types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useWorkbenchRouteSync } from '../use-workbench-route-sync'

interface FakeProject {
  readonly homeSurfaceId: string
  readonly id: string
  readonly surfaceOrder: readonly string[]
  readonly surfacesById: Record<string, { id: string }>
}

function createFakeProject(id: string, surfaces: readonly string[]): FakeProject {
  return {
    homeSurfaceId: surfaces[0]!,
    id,
    surfaceOrder: surfaces,
    surfacesById: Object.fromEntries(surfaces.map(surfaceId => [surfaceId, { id: surfaceId }])),
  }
}

const Stub = defineComponent({ setup: () => () => h('div') })

async function createHarness(options: {
  documents?: readonly FakeProject[]
  initialPath: string
  initialized?: boolean
}) {
  const documents = new Map((options.documents ?? [createFakeProject('project-a', ['home', 'detail'])])
    .map(document => [document.id, document]))
  const currentProject = shallowRef<FakeProject>()
  const currentSurfaceId = ref('')
  const initialized = ref(options.initialized ?? true)
  const dirty = ref(false)
  const configError = ref('')
  const notify = vi.fn()

  const requestOpenProject = vi.fn(async (id: string) => {
    const document = documents.get(id)
    if (!document)
      return
    currentProject.value = document
    // Mirrors the real controller: an already-selected page wins over the home
    // page, and the snapshot may lag behind a page created moments ago.
    if (!currentSurfaceId.value)
      currentSurfaceId.value = document.homeSurfaceId
  })
  const selectSurfaceFromDesigner = vi.fn(async (surfaceId: string) => {
    if (currentProject.value?.surfacesById[surfaceId])
      currentSurfaceId.value = surfaceId
  })

  const controller = {
    configError,
    currentProject,
    currentSurfaceId,
    dirty,
    initialized,
    requestOpenProject,
    selectSurfaceFromDesigner,
    workbenchLocale: computed(() => ({
      locale: 'en-US',
      t: (_key: string, fallback: string) => fallback,
    })),
  } as unknown as WorkbenchController

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects', name: 'projects', component: Stub },
      { path: '/projects/:projectId/pages', name: 'project-pages', component: Stub },
      { path: '/projects/:projectId/pages/new', name: 'page-create', component: Stub },
      { path: '/projects/:projectId/pages/:pageId/design', name: 'page-design', component: Stub },
    ],
  })
  await router.push(options.initialPath)
  await router.isReady()

  const Host = defineComponent({
    setup() {
      useWorkbenchRouteSync({ controller, ui: { notify } as unknown as WorkbenchUiStore })
      return () => h('div')
    },
  })
  const wrapper = mount(Host, { global: { plugins: [router] } })
  await flushPromises()

  return {
    currentProject,
    currentSurfaceId,
    dirty,
    initialized,
    notify,
    requestOpenProject,
    router,
    selectSurfaceFromDesigner,
    wrapper,
  }
}

describe('workbench route sync', () => {
  it('opens the project and the page named by the URL', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/detail/design',
    })

    expect(harness.requestOpenProject).toHaveBeenCalledWith('project-a')
    expect(harness.selectSurfaceFromDesigner).toHaveBeenCalledWith('detail')
    expect(harness.currentSurfaceId.value).toBe('detail')
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages/detail/design')
    expect(harness.notify).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('opens a project without touching the page selection on page management', async () => {
    const harness = await createHarness({ initialPath: '/projects/project-a/pages' })

    expect(harness.requestOpenProject).toHaveBeenCalledWith('project-a')
    expect(harness.selectSurfaceFromDesigner).not.toHaveBeenCalled()
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages')
    harness.wrapper.unmount()
  })

  it('returns to the projects list when the URL names a project that is gone', async () => {
    const harness = await createHarness({ initialPath: '/projects/deleted-project/pages' })

    expect(harness.router.currentRoute.value.path).toBe('/projects')
    expect(harness.notify).toHaveBeenCalledOnce()
    expect(String(harness.notify.mock.calls[0]?.[0])).toContain('unavailable')
    harness.wrapper.unmount()
  })

  it('returns to page management when the URL names a page the project no longer has', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/removed/design',
    })

    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages')
    expect(harness.notify).toHaveBeenCalledOnce()
    expect(String(harness.notify.mock.calls[0]?.[0])).toContain('no longer part')
    harness.wrapper.unmount()
  })

  it('trusts the page a just-created workspace already selected', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/brand-new/design',
      initialized: false,
    })
    // The page was created and selected before the repository finished booting, so
    // the session snapshot behind `surfacesById` may still be stale.
    harness.currentSurfaceId.value = 'brand-new'
    harness.initialized.value = true
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages/brand-new/design')
    expect(harness.notify).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('waits for the repository before opening a deep link', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/detail/design',
      initialized: false,
    })

    expect(harness.requestOpenProject).not.toHaveBeenCalled()
    harness.initialized.value = true
    await flushPromises()

    expect(harness.requestOpenProject).toHaveBeenCalledWith('project-a')
    expect(harness.currentSurfaceId.value).toBe('detail')
    harness.wrapper.unmount()
  })

  it('rewrites the design URL when another page is chosen inside the designer', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/detail/design',
    })

    harness.currentSurfaceId.value = 'home'
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages/home/design')
    harness.wrapper.unmount()
  })

  it('refuses to switch projects while the open project is dirty', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/home/design',
    })
    harness.dirty.value = true
    harness.notify.mockClear()

    await harness.router.push('/projects/project-b/pages')
    await flushPromises()

    expect(harness.router.currentRoute.value.params.projectId).toBe('project-a')
    expect(harness.notify).toHaveBeenCalledOnce()
    harness.wrapper.unmount()
  })

  it('still allows navigation inside the dirty project and back to the list', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/home/design',
    })
    harness.dirty.value = true

    await harness.router.push('/projects/project-a/pages')
    await flushPromises()
    expect(harness.router.currentRoute.value.path).toBe('/projects/project-a/pages')

    await harness.router.push('/projects')
    await flushPromises()
    expect(harness.router.currentRoute.value.path).toBe('/projects')
    expect(harness.notify).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('returns to the projects list when the open project is closed from the workspace', async () => {
    const harness = await createHarness({
      initialPath: '/projects/project-a/pages/home/design',
    })

    harness.currentProject.value = undefined
    await flushPromises()

    expect(harness.router.currentRoute.value.path).toBe('/projects')
    harness.wrapper.unmount()
  })
})
