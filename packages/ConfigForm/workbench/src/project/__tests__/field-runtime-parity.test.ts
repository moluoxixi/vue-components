import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
// @vitest-environment happy-dom
import type { ComponentContract, ProjectDocument } from '@moluoxixi/config-form-model'
import type * as Rules from '@moluoxixi/zod3-to-rule'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createComponentContractRegistry, createProjectSnapshot, createRegistryContractSnapshot } from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
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

async function surfaces(readonly = false, validator?: Rules.RuleCustomValidator, stateOnBlur?: 'disabled' | 'readonly' | 'visible') {
  const contract: ComponentContract = {
    key: 'test.input',
    version: '1',
    kind: 'field',
    props: [{ key: 'data-key', path: ['props', 'data-key'] }, { key: 'placeholder', path: ['props', 'placeholder'] }],
    events: [{ name: 'commit' }, { name: 'blur' }],
    bindings: [{ name: 'model', valueProp: 'value', trigger: 'commit' }],
    slots: [],
    allowedParents: [],
    defaults: {},
  }
  const registry = createComponentContractRegistry([contract], { adapter: 'test', version: '1' })
  const document: ProjectDocument = {
    version: 4,
    id: 'parity',
    name: 'Parity',
    homePageId: 'home',
    pageOrder: ['home'],
    registryLock: registry.lock,
    settings: {},
    resources: {},
    pagesById: { home: { id: 'home', name: 'Home', route: '/', flows: [], graph: {
      version: 2,
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
          events: {},
          bindings: {},
          validateOn: ['blur'],
          conditions: { required: {
            kind: 'compare',
            operator: 'eq',
            left: { kind: 'field', field: 'mode' },
            right: { kind: 'literal', value: 'required' },
          } },
        },
        mode: { id: 'mode', kind: 'field', component: 'test.input', field: 'mode', defaultValue: 'edit', props: { 'data-key': 'mode' }, events: {}, bindings: {} },
        name: {
          id: 'name',
          kind: 'field',
          component: 'test.input',
          field: 'name',
          defaultValue: 'Ada',
          props: { 'data-key': 'name' },
          events: {},
          bindings: {},
          validateOn: ['blur', 'blur'],
          validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: 'Name required' }] },
          conditions: Object.fromEntries(['readonly', 'disabled'].map(key => [key, {
            kind: 'compare',
            operator: 'eq',
            left: { kind: 'field', field: 'mode' },
            right: { kind: 'literal', value: key },
          }])),
          reactions: [{
            id: 'placeholder',
            when: { kind: 'literal', value: true },
            then: [{ kind: 'setProps', target: 'name', props: { placeholder: { kind: 'field', field: 'mode' } } }],
          }],
        },
      },
    } } },
  }
  if (validator) {
    const node = document.pagesById.home!.graph.nodesById.name!
    if (node.kind === 'field')
      node.validation!.rules.push({ kind: 'custom', key: 'remote' })
  }
  if (stateOnBlur) {
    document.pagesById.home!.flows!.push({
      version: 1,
      id: 'state',
      name: 'Change state',
      trigger: { kind: 'component.event', nodeId: 'mode', event: 'blur' },
      nodes: [
        { id: 'start', type: 'trigger' },
        { id: 'change', type: 'reaction', config: { reactions: [{
          id: 'state',
          when: { kind: 'literal', value: true },
          then: [{ kind: 'setState', target: 'name', state: { [stateOnBlur]: stateOnBlur !== 'visible' } }],
        }] } },
        { id: 'end', type: 'success' },
      ],
      edges: [
        { id: 'start-change', source: 'start', target: 'change', condition: 'next' },
        { id: 'change-end', source: 'change', target: 'end', condition: 'next' },
      ],
    })
  }
  const compiled = compileCanonicalProject({ snapshot: createProjectSnapshot(document), registry: createRegistryContractSnapshot(registry) })
  if (!compiled.success)
    throw new Error(JSON.stringify(compiled.diagnostics))
  const identity = registry.lock.components['test.input']!
  const runtime = compileCanonicalPageRuntime({ compilation: compiled.compilation, pageId: 'home' }, {
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
  const validation = load('src/pages/home/validation.ts')
  if (validator)
    validation.registerFieldValidator('remote', validator)
  const page = load('src/pages/home/Page.vue')
  const source = mount(page.default as Vue.Component, { global: { components: { Control } } })
  await flushPromises()
  return [preview, source]
}

describe('compiled Preview and executed generated Page parity', () => {
  it('shares defaults, binding event, blur validation, reactions, disabled and readonly semantics', async () => {
    const wrappers = await surfaces()
    try {
      for (const wrapper of wrappers) {
        const api = wrapper.vm as unknown as ConfigFormRendererExpose
        expect(api.getValues()).toEqual({ mode: 'edit', name: 'Ada' })
        expect(wrapper.get('input[data-key="name"]').attributes('placeholder')).toBe('edit')
        await wrapper.get('input[data-key="name"]').setValue('')
        expect(api.getValues().name).toBe('')
        expect(api.getErrors()).toEqual({})
        await wrapper.get('input[data-key="name"]').trigger('blur')
        await flushPromises()
        expect(api.getErrors()).toEqual({ [api.getInstanceKey({ nodeId: 'name', scope: [] })]: ['Name required'] })
        expect(api.getInstanceErrors({ nodeId: 'name', scope: [] })).toEqual(['Name required'])
        await wrapper.get('input[data-key="mode"]').setValue('disabled')
        await flushPromises()
        expect(wrapper.get('input[data-key="name"]').attributes('disabled')).toBeDefined()
        await api.submit()
        expect(api.getErrors()).toEqual({})
        await wrapper.get('input[data-key="mode"]').setValue('readonly')
        await flushPromises()
        expect(wrapper.find('input[data-key="name"]').exists()).toBe(false)
        await api.submit()
        expect(api.getErrors()).toEqual({})
      }
    }
    finally { wrappers.forEach(wrapper => wrapper.unmount()) }
  })

  it('enforces form readonly even when field conditions would allow editing', async () => {
    const wrappers = await surfaces(true)
    try {
      for (const wrapper of wrappers) {
        expect(wrapper.find('input').exists()).toBe(false)
        expect((wrapper.vm as unknown as ConfigFormRendererExpose).getValues()).toEqual({ mode: 'edit', name: 'Ada' })
      }
    }
    finally { wrappers.forEach(wrapper => wrapper.unmount()) }
  })

  it('validates a conditionally required field without inventing a default value', async () => {
    const wrappers = await surfaces()
    try {
      for (const wrapper of wrappers) {
        const api = wrapper.vm as unknown as ConfigFormRendererExpose
        expect(Object.hasOwn(api.getValues(), 'optional')).toBe(false)
        await wrapper.get('input[data-key="mode"]').setValue('required')
        await wrapper.get('input[data-key="optional"]').trigger('blur')
        await flushPromises()
        expect(api.getInstanceErrors({ nodeId: 'optional', scope: [] })).toHaveLength(1)
        await wrapper.get('input[data-key="optional"]').setValue('Complete')
        await wrapper.get('input[data-key="optional"]').trigger('blur')
        await flushPromises()
        expect(api.getErrors()).toEqual({})
      }
    }
    finally { wrappers.forEach(wrapper => wrapper.unmount()) }
  })

  it.each(['disabled', 'readonly', 'visible'] as const)('invalidates generated validation when a flow changes %s without changing values', async (state) => {
    const pending: Array<(result: string) => void> = []
    const wrappers = await surfaces(false, () => new Promise<string>(resolve => pending.push(resolve)), state)
    const source = wrappers[1]!
    const api = source.vm as unknown as ConfigFormRendererExpose
    try {
      const submit = api.submit()
      await flushPromises()
      expect(pending).toHaveLength(1)
      await source.get('input[data-key="mode"]').trigger('blur')
      await flushPromises()
      expect(api.getValues()).toEqual({ mode: 'edit', name: 'Ada' })
      pending[0]!('Outdated error')
      await submit
      expect(api.getErrors()).toEqual({})
      expect(source.find('.source-result').exists()).toBe(false)
    }
    finally { wrappers.forEach(wrapper => wrapper.unmount()) }
  })

  it('keeps newer validation results when an earlier generated submit finishes last', async () => {
    const pending: Array<(result: string | undefined) => void> = []
    const wrappers = await surfaces(false, () => new Promise<string | undefined>(resolve => pending.push(resolve)))
    const source = wrappers[1]!
    const api = source.vm as unknown as ConfigFormRendererExpose
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
    finally { wrappers.forEach(wrapper => wrapper.unmount()) }
  })

  it('discards generated validation after the page unmounts', async () => {
    const pending: Array<(result: string) => void> = []
    const wrappers = await surfaces(false, () => new Promise<string>(resolve => pending.push(resolve)))
    const source = wrappers[1]!
    const api = source.vm as unknown as ConfigFormRendererExpose
    const renderer = source.findComponent({ name: 'ConfigFormRenderer' })
    const retainedApi = renderer.vm.$.exposed as unknown as ConfigFormRendererExpose
    const submit = api.submit()
    await flushPromises()
    expect(pending).toHaveLength(1)
    wrappers.forEach(wrapper => wrapper.unmount())
    pending[0]!('Disposed error')
    await expect(submit).resolves.toBe(false)
    expect(retainedApi.getErrors()).toEqual({})
    expect(renderer.emitted('submit')).toBeUndefined()
    expect(() => api.getErrors()).toThrow('ConfigFormRenderer is not mounted.')
  })
})
