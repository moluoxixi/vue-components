// @vitest-environment happy-dom

import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import TemplateCreationWorkspace from '../../../app/components/TemplateCreationWorkspace/index.vue'

const mocks = vi.hoisted(() => ({
  actualCatalogLoad: undefined as undefined | (() => Promise<unknown>),
  analyzeEligibility: vi.fn(),
  catalogLoad: vi.fn(),
  createPage: vi.fn(),
  createProject: vi.fn(),
  loadAdapter: vi.fn(),
  preparePreview: vi.fn(),
  useController: vi.fn(),
  useUi: vi.fn(),
}))

const currentProject = shallowRef({
  registryLock: {
    adapter: 'element-plus',
    components: {},
    fingerprint: 'element-plus:registry',
    version: '1',
  },
})
const appearanceDrawerOpen = ref(false)
const closeAppearanceDrawer = vi.fn()

vi.mock('../../../adapters', () => ({
  loadWorkbenchAdapter: mocks.loadAdapter,
}))

vi.mock('../../../app/composables', () => ({
  useWorkbenchController: mocks.useController,
  useWorkbenchUiStore: mocks.useUi,
}))

vi.mock('../../../app/components/WorkbenchAppearancePopover.vue', () => ({
  default: { template: '<button data-appearance-popover />' },
}))

vi.mock('../../../project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../project')>()
  mocks.actualCatalogLoad = actual.createTemplateCatalogService([actual.builtInTemplateCatalogProvider]).load
  return {
    ...actual,
    analyzeTemplateEligibility: mocks.analyzeEligibility,
    createTemplateCatalogService: () => ({ load: mocks.catalogLoad }),
    prepareTemplatePreview: mocks.preparePreview,
  }
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    loading: Boolean,
  },
  setup(props, { attrs, slots }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled || props.loading,
      type: 'button',
    }, slots.default?.())
  },
})

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, expose }) {
    const input = ref<HTMLInputElement>()
    expose({ focus: () => input.value?.focus() })
    return () => h('input', {
      ...attrs,
      ref: input,
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })
  },
})

const OptionStub = defineComponent({
  props: {
    label: String,
    value: String,
  },
  setup(props) {
    return () => h('option', { value: props.value }, props.label)
  },
})

const SelectStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    return () => h('select', {
      ...attrs,
      value: props.modelValue,
      onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
    }, slots.default?.())
  },
})

const RuntimeStub = defineComponent({
  name: 'PreviewRuntimeHostFrameStub',
  inheritAttrs: false,
  props: { adapter: String },
  setup(props) {
    return () => h('div', { 'data-preview-adapter': props.adapter })
  },
})

function stubMatchMedia(resolveMatches: (query: string) => boolean): void {
  vi.stubGlobal('matchMedia', vi.fn((query: string): MediaQueryList => ({
    matches: resolveMatches(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })))
}

function eligible() {
  return { eligible: true, diagnostics: [] }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function previewFor(template: { manifest: { adapter: string, id: string } }) {
  const projectId = `preview-${template.manifest.id}`
  return {
    adapter: template.manifest.adapter,
    compilation: { snapshotIdentity: { pageId: 'page', projectId } },
    namespace: 'mx-template-preview',
    reactionProjection: { props: {}, states: {}, validate: [], values: {} },
    revision: projectId,
    runtimeSessionKey: `${projectId}:page`,
    runtimeState: { touched: [], validation: {}, values: {} },
  }
}

function mountWorkspace(target: 'page' | 'project' = 'project') {
  return mount(TemplateCreationWorkspace as Component, {
    attachTo: document.body,
    props: {
      canClose: true,
      target,
    },
    global: {
      stubs: {
        ElButton: ButtonStub,
        ElInput: InputStub,
        ElOption: OptionStub,
        ElSelect: SelectStub,
        PreviewRuntimeHostFrame: RuntimeStub,
      },
    },
  })
}

describe('template creation workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="workbench-overlays"></div>'
    stubMatchMedia(() => false)
    mocks.analyzeEligibility.mockImplementation(eligible)
    mocks.catalogLoad.mockImplementation(() => mocks.actualCatalogLoad!())
    mocks.createPage.mockResolvedValue(true)
    mocks.createProject.mockResolvedValue(true)
    mocks.loadAdapter.mockImplementation(async (adapter: string) => ({
      designerRegistry: { rendererNamespace: `mx-${adapter}` },
      registrySnapshot: { adapter, components: [] },
    }))
    mocks.preparePreview.mockImplementation(previewFor)
    currentProject.value = {
      registryLock: {
        adapter: 'element-plus',
        components: {},
        fingerprint: 'element-plus:registry',
        version: '1',
      },
    }
    appearanceDrawerOpen.value = false
    mocks.useController.mockReturnValue({
      busy: ref(false),
      createPageFromTemplate: mocks.createPage,
      createProjectFromTemplate: mocks.createProject,
      currentProject,
    })
    mocks.useUi.mockReturnValue({
      appearanceDrawerOpen,
      clearMessage: vi.fn(),
      closeAppearanceDrawer,
      openAppearanceDrawer: vi.fn(),
      message: ref(''),
      paletteFamily: ref('catppuccin'),
      resolvedTheme: ref('dark'),
      setPaletteFamily: vi.fn(),
      setThemePreference: vi.fn(),
      themePreference: ref('system'),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('searches, filters, clears an empty result, and focuses search on entry', async () => {
    const wrapper = mountWorkspace()
    await flushPromises()

    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search templates')

    await wrapper.get('select[aria-label="Template category"]').setValue('starter')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)
    await wrapper.get('select[aria-label="Template provider"]').setValue('built-in')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(2)

    await wrapper.get('input[aria-label="Search templates"]').setValue('no-such-template')
    expect(wrapper.get('[role="status"] strong').text()).toBe('No templates match these filters')
    expect(wrapper.get('.template-no-selection').text()).toContain('No template selected')
    await wrapper.get('.template-no-selection button').trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search templates')
    await wrapper.get('.template-empty-state button').trigger('click')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('shows Provider diagnostics with a working catalog retry', async () => {
    mocks.catalogLoad.mockImplementationOnce(async () => {
      const catalog = await mocks.actualCatalogLoad!() as { diagnostics: unknown[], templates: unknown[] }
      return {
        ...catalog,
        diagnostics: [{ code: 'TEMPLATE_PROVIDER_FAILED', message: 'Built-in provider failed.' }],
      }
    })
    const wrapper = mountWorkspace()
    await flushPromises()

    expect(wrapper.get('.template-provider-error').text()).toContain('Built-in provider failed.')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    await wrapper.get('.template-provider-error button').trigger('click')
    await flushPromises()
    expect(mocks.catalogLoad).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('keeps catalog loading and fatal failure distinct from filtered empty', async () => {
    const catalog = deferred<unknown>()
    mocks.catalogLoad.mockReturnValueOnce(catalog.promise)
    const wrapper = mountWorkspace()
    await flushPromises()

    expect(wrapper.get('.template-state').text()).toBe('Loading templates')
    expect(wrapper.find('.template-empty-state').exists()).toBe(false)
    catalog.reject(new Error('Catalog offline'))
    await flushPromises()

    expect(wrapper.get('.template-catalog-fatal').text()).toContain('Template catalog unavailable')
    expect(wrapper.get('.template-catalog-fatal').text()).toContain('Catalog offline')
    expect(wrapper.find('.template-empty-state').exists()).toBe(false)
    await wrapper.get('.template-catalog-fatal button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[role="option"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('keys eligibility display status by the current Registry fingerprint', async () => {
    const wrapper = mountWorkspace('page')
    await flushPromises()

    const selectedStatus = () => wrapper.get('[data-template-id="element-blank"] .template-catalog-status')
    expect(selectedStatus().attributes('data-status')).toBe('eligible')
    expect(wrapper.get('[data-template-id="element-profile"] .template-catalog-status').attributes('data-status')).toBe('pending')
    const previousAnalyzeCalls = mocks.analyzeEligibility.mock.calls.length
    const nextAdapter = deferred<{
      designerRegistry: { rendererNamespace: string }
      registrySnapshot: { adapter: string, components: never[] }
    }>()
    mocks.loadAdapter.mockImplementationOnce(() => nextAdapter.promise)
    currentProject.value = {
      registryLock: {
        ...currentProject.value.registryLock,
        fingerprint: 'element-plus:registry-v2',
      },
    }
    await flushPromises()

    expect(selectedStatus().attributes('data-status')).toBe('checking')
    expect(mocks.analyzeEligibility).toHaveBeenCalledTimes(previousAnalyzeCalls)
    nextAdapter.resolve({
      designerRegistry: { rendererNamespace: 'mx-element-plus' },
      registrySnapshot: { adapter: 'element-plus', components: [] },
    })
    await flushPromises()
    expect(selectedStatus().attributes('data-status')).toBe('eligible')
    expect(mocks.analyzeEligibility).toHaveBeenCalledTimes(previousAnalyzeCalls + 1)
    wrapper.unmount()
  })

  it('uses roving keyboard selection and restores the selected item from mobile details', async () => {
    stubMatchMedia(query => query === '(max-width: 640px)')
    const wrapper = mountWorkspace()
    await flushPromises()

    const first = wrapper.get('[role="option"]')
    const firstElement = first.element as HTMLElement
    firstElement.focus()
    await first.trigger('keydown', { key: 'End' })
    await flushPromises()
    const selected = wrapper.get('[role="option"][aria-selected="true"]')
    expect(selected.attributes('data-template-id')).toBe('antd-profile')
    expect(document.activeElement).toBe(selected.element)

    await selected.trigger('keydown', { key: 'Enter' })
    expect(wrapper.classes()).toContain('is-mobile-details')
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.classes()).toContain('is-mobile-catalog')
    expect(document.activeElement).toBe(selected.element)

    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps the catalog Drawer mutually exclusive with appearance settings', async () => {
    stubMatchMedia(query => query === '(min-width: 641px) and (max-width: 1000px)')
    const wrapper = mountWorkspace()
    await flushPromises()

    await wrapper.get('[data-template-catalog-open]').trigger('click')
    await flushPromises()
    expect(closeAppearanceDrawer).toHaveBeenCalledTimes(1)
    expect(wrapper.getComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(true)

    appearanceDrawerOpen.value = true
    await flushPromises()
    expect(wrapper.getComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(false)
    wrapper.unmount()
  })

  it('shows actionable diagnostics and disables creation when page requirements are unmet', async () => {
    mocks.analyzeEligibility.mockImplementation((template: { manifest: { adapter: string } }) =>
      template.manifest.adapter === 'antd-vue'
        ? {
            eligible: false,
            diagnostics: [{
              code: 'TEMPLATE_REGISTRY_ADAPTER_MISMATCH',
              message: 'Template adapter antd-vue does not match element-plus.',
            }],
          }
        : eligible())
    const wrapper = mountWorkspace('page')
    await flushPromises()

    await wrapper.get('[data-template-id="antd-profile"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-template-id="antd-profile"] .template-catalog-status').attributes('data-status')).toBe('ineligible')
    expect(wrapper.get('[role="alert"]').text()).toContain('Template adapter antd-vue does not match element-plus.')
    expect(wrapper.get('.template-create-footer button').attributes('disabled')).toBeDefined()
    await wrapper.get('.template-eligibility button').trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-template-id')).toBe('antd-profile')
    wrapper.unmount()
  })

  it('keeps creation disabled when adapter loading or preview compilation fails', async () => {
    mocks.loadAdapter.mockRejectedValueOnce(new Error('Adapter unavailable'))
    const adapterFailure = mountWorkspace()
    await flushPromises()

    expect(adapterFailure.get('.template-preview-error').text()).toContain('Adapter unavailable')
    expect(adapterFailure.get('.template-create-footer button').attributes('disabled')).toBeDefined()
    await adapterFailure.get('.template-create-footer button').trigger('click')
    expect(mocks.createProject).not.toHaveBeenCalled()
    adapterFailure.unmount()

    mocks.loadAdapter.mockImplementation(async (adapter: string) => ({
      designerRegistry: { rendererNamespace: `mx-${adapter}` },
      registrySnapshot: { adapter, components: [] },
    }))
    mocks.preparePreview.mockImplementation(() => {
      throw new Error('TEMPLATE_PREVIEW_COMPILE_FAILED: invalid graph')
    })
    const compileFailure = mountWorkspace()
    await flushPromises()

    expect(compileFailure.get('.template-preview-error').text()).toContain('TEMPLATE_PREVIEW_COMPILE_FAILED')
    expect(compileFailure.get('.template-create-footer button').attributes('disabled')).toBeDefined()
    await compileFailure.get('.template-create-footer button').trigger('click')
    expect(mocks.createProject).not.toHaveBeenCalled()
    compileFailure.unmount()
  })

  it('prevents Back and Escape from abandoning an in-flight creation', async () => {
    let resolveCreation!: (created: boolean) => void
    mocks.createProject.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveCreation = resolve
    }))
    const wrapper = mountWorkspace()
    await flushPromises()

    await wrapper.get('.template-create-footer button').trigger('click')
    await wrapper.get('.template-create-footer button').trigger('click')
    expect(mocks.createProject).toHaveBeenCalledTimes(1)
    const back = wrapper.get('.template-workspace-heading button')
    expect(back.attributes('disabled')).toBeDefined()
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeUndefined()

    resolveCreation(true)
    await flushPromises()
    expect(wrapper.emitted('created')).toHaveLength(1)
    wrapper.unmount()
  })

  it('ignores a stale preview request that resolves after the current selection', async () => {
    let resolveElement!: (value: unknown) => void
    let resolveAntd!: (value: unknown) => void
    mocks.loadAdapter.mockImplementation((adapter: string) => new Promise((resolve) => {
      if (adapter === 'element-plus')
        resolveElement = resolve
      else
        resolveAntd = resolve
    }))
    const wrapper = mountWorkspace()
    await flushPromises()
    expect(mocks.loadAdapter).toHaveBeenCalledWith('element-plus')

    await wrapper.get('[data-template-id="antd-profile"]').trigger('click')
    await flushPromises()
    expect(mocks.loadAdapter).toHaveBeenCalledWith('antd-vue')
    resolveAntd({ designerRegistry: { rendererNamespace: 'mx-antd' }, registrySnapshot: { adapter: 'antd-vue', components: [] } })
    await flushPromises()
    expect(wrapper.get('[data-preview-adapter]').attributes('data-preview-adapter')).toBe('antd-vue')

    resolveElement({ designerRegistry: { rendererNamespace: 'mx-element' }, registrySnapshot: { adapter: 'element-plus', components: [] } })
    await flushPromises()
    expect(wrapper.get('[data-preview-adapter]').attributes('data-preview-adapter')).toBe('antd-vue')
    expect(mocks.preparePreview).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
