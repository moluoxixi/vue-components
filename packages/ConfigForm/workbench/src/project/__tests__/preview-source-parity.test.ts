import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
// @vitest-environment happy-dom
import type { ComponentContract, ProjectDocument } from '@moluoxixi/config-form-model'
import type * as Rules from '@moluoxixi/zod3-to-rule'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import {
  createComponentContractRegistry,
  createProjectSnapshot,
  createRegistryContractSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { compileCanonicalSurfaceRuntime } from '@moluoxixi/config-form-vue-backend'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import * as Vue from 'vue'
import { createCanonicalProjectSourceExport } from '../export'
import { createGeneratedModuleLoader } from './generated-runtime-module'

const Control = Vue.defineComponent({
  inheritAttrs: false,
  props: { value: String },
  emits: ['commit', 'blur'],
  setup: (props, { attrs, emit }) => () => Vue.h('input', {
    ...attrs,
    value: props.value,
    onInput: (event: Event) => emit('commit', (event.target as HTMLInputElement).value),
    onBlur: () => emit('blur'),
  }),
})

async function surfaces(readonly = false, validator?: Rules.RuleCustomValidator) {
  const contract: ComponentContract = {
    key: 'test.input',
    version: '1',
    kind: 'field',
    semanticTriggers: [],
    stateProjectionProperties: [],
    datasetBindings: [],
    resourceBindings: [],
    props: [{ key: 'data-key', path: ['props', 'data-key'] }, { key: 'placeholder', path: ['props', 'placeholder'] }],
    bindings: [{ name: 'model', valueProp: 'value', trigger: 'commit' }],
    slots: [],
    allowedParents: [],
    defaults: {},
  }
  const registry = createComponentContractRegistry([contract], { adapter: 'test', version: '1' })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'parity',
    name: 'Parity',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    datasetOrder: [],
    datasetsById: {},
    registryLock: registry.lock,
    settings: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    surfacesById: { home: { id: 'home', name: 'Home', kind: 'page', route: '/', parameters: [], outputs: [], interactions: [], graph: {
      version: SURFACE_GRAPH_VERSION,
      props: {},
      form: { readonly },
      root: ['mode', 'name', 'optional'].map(nodeId => ({ nodeId, placement: {} })),
      nodesById: {
        optional: {
          id: 'optional',
          kind: 'field',
          component: 'test.input',
          field: 'optional',
          props: { 'data-key': 'optional' },
          validateOn: ['blur'],
          validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Optional required' }] },
        },
        mode: { id: 'mode', kind: 'field', component: 'test.input', field: 'mode', defaultValue: 'edit', props: { 'data-key': 'mode' } },
        name: {
          id: 'name',
          kind: 'field',
          component: 'test.input',
          field: 'name',
          defaultValue: 'Ada',
          props: { 'data-key': 'name', 'placeholder': 'edit' },
          validateOn: ['blur', 'blur'],
          validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Name required' }] },
        },
      },
    } } },
  }
  if (validator) {
    const node = document.surfacesById.home!.graph.nodesById.name!
    if (node.kind === 'field')
      node.validation!.rules.push({ kind: 'custom', key: 'remote' })
  }
  const compiled = compileCanonicalProject({ snapshot: createProjectSnapshot(document), registry: createRegistryContractSnapshot(registry) })
  if (!compiled.success)
    throw new Error(JSON.stringify(compiled.diagnostics))
  const identity = registry.lock.components['test.input']!
  const runtime = compileCanonicalSurfaceRuntime({ compilation: compiled.compilation, surfaceId: 'home' }, {
    resolveValidator: () => validator,
    resolveBinding: () => ({
      component: Control,
      kind: 'field',
      contractFingerprint: identity.fingerprint,
      contractVersion: identity.contractVersion,
      valueProp: 'value',
      trigger: 'commit',
    }),
  })
  if (!runtime.success)
    throw new Error(JSON.stringify(runtime.diagnostics))
  const values = Vue.shallowRef<Record<string, unknown>>({})
  const preview = mount(ConfigFormRenderer, { props: { ...runtime.artifact.renderer, model: createConfigFormModel(values) } })
  const exported = createCanonicalProjectSourceExport(compiled.compilation, {
    adapter: compiled.compilation.registry.adapter,
    adapterVersion: compiled.compilation.registry.adapterVersion,
    registryFingerprint: compiled.compilation.registry.fingerprint,
    resolveBinding: () => ({
      component: 'test.input',
      contractVersion: identity.contractVersion,
      contractFingerprint: identity.fingerprint,
      configComponent: 'text',
      tag: 'Control',
      render: 'component',
      valueProp: 'value',
      trigger: 'commit',
    }),
  })
  const load = await createGeneratedModuleLoader(Object.fromEntries(Object.entries(exported.files)
    .filter(([, file]) => file.kind === 'text')
    .map(([path, file]) => [path, file.content as string])))
  const validation = load('src/surfaces/home/validation.ts')
  if (validator)
    validation.registerFieldValidator('remote', validator)
  const router = load('src/router.ts').router
  await router.push('/')
  const source = mount(load('src/App.vue').default as Vue.Component, {
    global: {
      components: { Control },
      plugins: [router],
      stubs: { teleport: true },
    },
  })
  await flushPromises()
  const sourceRenderer = source.findComponent({ name: 'ConfigFormRenderer' })
  if (!sourceRenderer.exists())
    throw new Error('Generated project did not mount the active Surface renderer.')
  return [
    { wrapper: preview, api: preview.vm as unknown as ConfigFormRendererExpose },
    { wrapper: source, api: sourceRenderer.vm.$.exposed as unknown as ConfigFormRendererExpose },
  ]
}

describe('compiled Preview and executed generated Surface parity', () => {
  it('shares defaults, binding events, static props, and blur validation', async () => {
    const wrappers = await surfaces()
    try {
      for (const { wrapper, api } of wrappers) {
        expect(api.getValues()).toEqual({ mode: 'edit', name: 'Ada' })
        expect(wrapper.get('input[data-key="name"]').attributes('placeholder')).toBe('edit')
        await wrapper.get('input[data-key="name"]').setValue('')
        expect(api.getValues().name).toBe('')
        expect(api.getErrors()).toEqual({})
        await wrapper.get('input[data-key="name"]').trigger('blur')
        await flushPromises()
        expect(api.getErrors()).toEqual({ [api.getInstanceKey({ nodeId: 'name', scope: [] })]: ['Name required'] })
        expect(api.getInstanceErrors({ nodeId: 'name', scope: [] })).toEqual(['Name required'])
      }
    }
    finally { wrappers.forEach(({ wrapper }) => wrapper.unmount()) }
  })

  it('enforces form readonly across otherwise editable fields', async () => {
    const wrappers = await surfaces(true)
    try {
      for (const { wrapper, api } of wrappers) {
        expect(wrapper.find('input').exists()).toBe(false)
        expect(api.getValues()).toEqual({ mode: 'edit', name: 'Ada' })
      }
    }
    finally { wrappers.forEach(({ wrapper }) => wrapper.unmount()) }
  })

  it('validates a required field without inventing a default value', async () => {
    const wrappers = await surfaces()
    try {
      for (const { wrapper, api } of wrappers) {
        expect(Object.hasOwn(api.getValues(), 'optional')).toBe(false)
        await wrapper.get('input[data-key="optional"]').trigger('blur')
        await flushPromises()
        expect(api.getInstanceErrors({ nodeId: 'optional', scope: [] })).toHaveLength(1)
        await wrapper.get('input[data-key="optional"]').setValue('Complete')
        await wrapper.get('input[data-key="optional"]').trigger('blur')
        await flushPromises()
        expect(api.getErrors()).toEqual({})
      }
    }
    finally { wrappers.forEach(({ wrapper }) => wrapper.unmount()) }
  })

  it('keeps newer validation results when an earlier generated submit finishes last', async () => {
    const pending: Array<(result: string | undefined) => void> = []
    const wrappers = await surfaces(false, () => new Promise<string | undefined>(resolve => pending.push(resolve)))
    const { wrapper: source, api } = wrappers[1]!
    try {
      const submit = api.submit()
      await flushPromises()
      await source.get('input[data-key="name"]').trigger('blur')
      await flushPromises()
      expect(pending).toHaveLength(2)
      pending[1]!('Current error')
      await flushPromises()
      pending[0]!(undefined)
      await submit
      expect(api.getErrors()).toEqual({ [api.getInstanceKey({ nodeId: 'name', scope: [] })]: ['Current error'] })
    }
    finally { wrappers.forEach(({ wrapper }) => wrapper.unmount()) }
  })

  it('discards generated validation after the page unmounts', async () => {
    const pending: Array<(result: string) => void> = []
    const wrappers = await surfaces(false, () => new Promise<string>(resolve => pending.push(resolve)))
    const { wrapper: source, api } = wrappers[1]!
    const renderer = source.findComponent({ name: 'ConfigFormRenderer' })
    const retainedApi = renderer.vm.$.exposed as unknown as ConfigFormRendererExpose
    const submit = api.submit()
    await flushPromises()
    expect(pending).toHaveLength(1)
    wrappers.forEach(({ wrapper }) => wrapper.unmount())
    pending[0]!('Disposed error')
    await expect(submit).resolves.toBe(false)
    expect(retainedApi.getErrors()).toEqual({})
    expect(renderer.emitted('submit')).toBeUndefined()
  })
})
