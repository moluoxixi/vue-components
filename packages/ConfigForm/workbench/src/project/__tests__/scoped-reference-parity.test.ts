// @vitest-environment happy-dom
import type { ConfigFormFlow, ConfigFormValueReferenceScope } from '@moluoxixi/config-form-core'
import type { ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ComponentContract, PageNode, ProjectDocument } from '@moluoxixi/config-form-model'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createComponentContractRegistry, createProjectSnapshot, createRegistryContractSnapshot } from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'

const Control = defineComponent({
  inheritAttrs: false,
  props: ['modelValue'],
  emits: ['blur'],
  setup: (props, { attrs, emit }) => () => h('input', {
    ...attrs,
    value: props.modelValue,
    onBlur: () => emit('blur'),
  }),
})
const Section = defineComponent({ setup: (_props, { slots }) => () => h('section', slots.default?.()) })

function fixture(parentTarget = 'item-code') {
  const contracts: ComponentContract[] = [
    { key: 'test.input', version: '1', kind: 'field', props: [{ key: 'data-id', path: ['props', 'data-id'] }], events: [{ name: 'blur' }], bindings: [], slots: [], allowedParents: [], defaults: {} },
    { key: 'test.scope', version: '1', kind: 'layout', props: [], events: [], bindings: [], slots: [{ name: 'default' }], allowedParents: [], defaults: {} },
  ]
  const registry = createComponentContractRegistry(contracts, { adapter: 'test', version: '1' })
  const field = (id: string, name: string): PageNode => ({
    id,
    kind: 'field',
    component: 'test.input',
    field: name,
    props: { 'data-id': id },
    events: {},
    bindings: {},
  })
  const container = (id: string, kind: 'object' | 'array', children: string[]): PageNode => ({
    id,
    kind: 'layout',
    component: 'test.scope',
    props: {},
    events: {},
    bindings: {},
    valueScope: { kind, field: id },
    slots: { default: children.map(nodeId => ({ nodeId, placement: {} })) },
  })
  const nodes = [
    field('root-code', 'rootCode'),
    container('rows', 'array', ['outer-code', 'items']),
    field('outer-code', 'code'),
    container('items', 'array', ['item-code', 'details']),
    field('item-code', 'code'),
    container('details', 'object', ['detail-code', 'trigger']),
    field('detail-code', 'code'),
    field('trigger', 'trigger'),
  ]
  const reference = (nodeId: string, scope: ConfigFormValueReferenceScope) => ({ $ref: { kind: 'field' as const, nodeId, scope } })
  const flow: ConfigFormFlow = {
    version: 1,
    id: 'read-scope',
    name: 'Read scope',
    trigger: { kind: 'component.event', nodeId: 'trigger', event: 'blur' },
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'read', type: 'action', ref: 'observe', config: { input: {
        current: reference('detail-code', 'current'),
        parent: reference(parentTarget, 'parent'),
        root: reference('root-code', 'root'),
      } } },
      { id: 'end', type: 'success' },
    ],
    edges: [{ id: 'start-read', source: 'start', target: 'read' }, { id: 'read-end', source: 'read', target: 'end' }],
  }
  const document: ProjectDocument = {
    version: 4,
    id: 'scope-contract',
    name: 'Scope contract',
    homePageId: 'home',
    pageOrder: ['home'],
    registryLock: registry.lock,
    settings: {},
    resources: {},
    pagesById: { home: {
      id: 'home',
      name: 'Home',
      route: '/',
      flows: [flow],
      graph: { version: 2, props: {}, form: {}, root: ['root-code', 'rows'].map(nodeId => ({ nodeId, placement: {} })), nodesById: Object.fromEntries(nodes.map(node => [node.id, node])) },
    } },
  }
  return { document, registry }
}

describe('compiled data-scope reference contract', () => {
  it('keeps the current array row when parent leaves an object scope', async () => {
    const { document, registry } = fixture()
    const compiled = compileCanonicalProject({ snapshot: createProjectSnapshot(document), registry: createRegistryContractSnapshot(registry) })
    if (!compiled.success)
      throw new Error(JSON.stringify(compiled.diagnostics))
    const runtime = compileCanonicalPageRuntime({ compilation: compiled.compilation, pageId: 'home' }, {
      resolveBinding: (key) => {
        const identity = registry.lock.components[key]!
        return { component: key === 'test.input' ? Control : Section, kind: key === 'test.input' ? 'field' : 'layout', contractFingerprint: identity.fingerprint, contractVersion: identity.contractVersion }
      },
    })
    if (!runtime.success)
      throw new Error(JSON.stringify(runtime.diagnostics))
    const execute = vi.fn()
    const values = shallowRef<ConfigFormValues>({ rootCode: 'ROOT', rows: [{ code: 'OUTER', items: [{ code: 'ITEM', details: { code: 'DETAIL', trigger: 'GO' } }] }] })
    const wrapper = mount(ConfigFormRenderer, { props: {
      ...runtime.artifact.renderer,
      model: createConfigFormModel(values),
      flowActions: { get: ref => ref === 'observe'
        ? {
            descriptor: { ref, title: 'Observe', category: 'test', parameters: [], outputs: [], capabilities: [] },
            execute,
          }
        : undefined },
    } })
    try {
      await flushPromises()
      await wrapper.get('[data-id="trigger"]').trigger('blur')
      await flushPromises()
      expect(wrapper.emitted('flowError')).toBeUndefined()
      expect(execute).toHaveBeenCalledOnce()
      expect(execute.mock.calls[0]![0]).toEqual({ current: 'DETAIL', parent: 'ITEM', root: 'ROOT' })
    }
    finally {
      wrapper.unmount()
    }
  })

  it('rejects a parent reference that skips the direct array parent in the model', () => {
    const { document } = fixture('outer-code')
    expect(() => createProjectSnapshot(document)).toThrow()
  })
})
