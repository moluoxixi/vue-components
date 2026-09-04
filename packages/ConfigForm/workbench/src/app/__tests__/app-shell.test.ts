// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import App from '../../App.vue'

const mocks = vi.hoisted(() => ({
  provideController: vi.fn(),
}))
const mountedWrappers: VueWrapper[] = []

vi.mock('..', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    provideWorkbenchController: mocks.provideController,
    TemplateCreationWorkspace: defineComponent({
      name: 'TemplateCreationWorkspace',
      props: {
        canClose: Boolean,
        target: String,
      },
      emits: ['close', 'created', 'toggleLocale'],
      setup(props, { emit }) {
        return () => h('section', {
          'data-can-close': String(props.canClose),
          'data-target': props.target,
          'data-template-workspace': '',
        }, [
          h('button', { 'data-close': '', 'onClick': () => emit('close') }),
          h('button', { 'data-created': '', 'onClick': () => emit('created') }),
        ])
      },
    }),
    WorkbenchAppearanceDrawer: defineComponent({
      name: 'WorkbenchAppearanceDrawer',
      setup: () => () => h('aside', { 'data-appearance': '' }),
    }),
    WorkbenchShell: defineComponent({
      name: 'WorkbenchShell',
      emits: ['create', 'creationFocusRestored'],
      setup(_props, { emit }) {
        return () => h('button', {
          'data-create-trigger': 'topbar-new-page',
          'data-designer-entry': '',
          'data-shell': '',
          'onClick': () => emit('create', { focusKey: 'topbar-new-page', target: 'page' }),
        })
      },
    }),
  }
})

function createUi() {
  return {
    appearanceDrawerOpen: ref(false),
    closeAppearanceDrawer: vi.fn(),
    closePageManager: vi.fn(),
    pageManagerOpen: ref(false),
    paletteFamily: ref('catppuccin'),
    resolvedTheme: ref('dark'),
    setPaletteFamily: vi.fn(),
    setThemePreference: vi.fn(),
    themePreference: ref('system'),
    toggleLocale: vi.fn(),
  }
}

describe('workbench app shell', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('routes page creation back to the designer and closes page management after success', async () => {
    const ui = createUi()
    mocks.provideController.mockReturnValue({
      controller: {
        currentProject: shallowRef({ id: 'project' }),
        initialized: ref(true),
        localeOptions: ref({ locale: 'en-US', messages: {} }),
      },
      ui,
    })
    const wrapper = mount(App, { attachTo: document.body })
    mountedWrappers.push(wrapper)

    expect(wrapper.find('[data-shell]').exists()).toBe(true)
    await wrapper.get('[data-shell]').trigger('click')
    expect(wrapper.get('[data-template-workspace]').attributes()).toMatchObject({
      'data-can-close': 'true',
      'data-target': 'page',
    })

    await wrapper.get('[data-close]').trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-shell]').element)

    await wrapper.get('[data-shell]').trigger('click')
    await wrapper.get('[data-created]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-shell]').exists()).toBe(true)
    expect(ui.closePageManager).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(wrapper.get('[data-designer-entry]').element)
  })

  it('opens project creation when initialization has no current project', () => {
    mocks.provideController.mockReturnValue({
      controller: {
        currentProject: shallowRef(),
        initialized: ref(true),
        localeOptions: ref({ locale: 'en-US', messages: {} }),
      },
      ui: createUi(),
    })
    const wrapper = mount(App)
    mountedWrappers.push(wrapper)

    expect(wrapper.get('[data-template-workspace]').attributes()).toMatchObject({
      'data-can-close': 'false',
      'data-target': 'project',
    })
  })
})
