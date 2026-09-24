// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../App.vue'
import { WORKBENCH_ROUTES } from '../router'

const mocks = vi.hoisted(() => ({
  provideController: vi.fn(),
  useWorkbenchRouteSync: vi.fn(),
}))
const mountedWrappers: VueWrapper[] = []

vi.mock('..', async () => {
  const { defineComponent: define, h: createElement } = await import('vue')
  return {
    provideWorkbenchController: mocks.provideController,
    useWorkbenchRouteSync: mocks.useWorkbenchRouteSync,
    WorkbenchAppearanceDrawer: define({
      name: 'WorkbenchAppearanceDrawer',
      setup: () => () => createElement('aside', { 'data-appearance': '' }),
    }),
  }
})

function screenStub(name: string) {
  return defineComponent({
    name: `ScreenStub:${name}`,
    setup: () => () => h('section', { 'data-screen': name }),
  })
}

/** The real route table with stub screens, so the shell owns the assertions. */
const stubRoutes = WORKBENCH_ROUTES.map(route => ('component' in route && route.component
  ? { ...route, component: screenStub(String(route.name)) }
  : route))

function createUi() {
  return {
    appearanceDrawerOpen: ref(false),
    closeAppearanceDrawer: vi.fn(),
    paletteFamily: ref('ink'),
    setPaletteFamily: vi.fn(),
    setThemePreference: vi.fn(),
    themePreference: ref('system'),
  }
}

async function mountApp(path = '/') {
  const ui = createUi()
  const controller = { localeOptions: ref({ locale: 'en-US', messages: {} }) }
  mocks.provideController.mockReturnValue({ controller, ui })
  const router = createRouter({ history: createMemoryHistory(), routes: stubRoutes })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [router] } })
  mountedWrappers.push(wrapper)
  return { router, ui, wrapper }
}

function screenOf(wrapper: VueWrapper): string | undefined {
  return wrapper.find('[data-screen]').attributes('data-screen')
}

describe('workbench routed app shell', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    mocks.provideController.mockReset()
    mocks.useWorkbenchRouteSync.mockReset()
  })

  it('lands on the projects screen through the root redirect', async () => {
    const { router, wrapper } = await mountApp('/')

    expect(router.currentRoute.value.path).toBe('/projects')
    expect(screenOf(wrapper)).toBe('projects')
    expect(wrapper.findAll('[data-screen]')).toHaveLength(1)
  })

  it('renders one screen per deep link and keeps the appearance chrome mounted', async () => {
    const { router, wrapper } = await mountApp('/projects/project-a/pages/page-b/design')

    expect(screenOf(wrapper)).toBe('page-design')
    expect(wrapper.find('[data-appearance]').exists()).toBe(true)

    await router.push('/projects/project-a/pages')
    await router.isReady()
    expect(screenOf(wrapper)).toBe('project-pages')

    await router.push('/projects/project-a/pages/new')
    await router.isReady()
    expect(screenOf(wrapper)).toBe('page-create')

    await router.push('/projects/new')
    await router.isReady()
    expect(screenOf(wrapper)).toBe('project-create')
    expect(wrapper.findAll('[data-screen]')).toHaveLength(1)
  })

  it('returns unknown deep links to the projects list', async () => {
    const { router, wrapper } = await mountApp('/projects/project-a/pages/page-b/design/extra')

    expect(router.currentRoute.value.path).toBe('/projects')
    expect(screenOf(wrapper)).toBe('projects')
  })

  it('drives the workspace from the URL instead of a local view flag', async () => {
    await mountApp('/projects')

    expect(mocks.useWorkbenchRouteSync).toHaveBeenCalledOnce()
    const [options] = mocks.useWorkbenchRouteSync.mock.calls[0]!
    const contexts = mocks.provideController.mock.results[0]!.value
    expect(options.controller).toBe(contexts.controller)
    expect(options.ui).toBe(contexts.ui)
  })
})
