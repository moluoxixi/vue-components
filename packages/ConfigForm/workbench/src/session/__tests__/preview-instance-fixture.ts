import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ComponentContract, FieldNode, LayoutNode, PageGraph, ProjectDocument } from '@moluoxixi/config-form-model'
import type { VueRuntimeBindingResolver, VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type { PreviewSessionAcceptInput } from '../types/preview'
import { compileCanonicalPage } from '@moluoxixi/config-form-compiler'
import { createComponentContractRegistry, createProjectSnapshot, createRegistryContractSnapshot, PAGE_GRAPH_VERSION, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { defineComponent, h } from 'vue'

const Input = defineComponent({
  name: 'PreviewInstanceInput',
  props: { modelValue: String },
  emits: ['update:modelValue', 'blur'],
  setup: (props, { emit }) => () => h('input', {
    value: props.modelValue,
    onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    onBlur: () => emit('blur'),
  }),
})

export function scopedGraph(): PageGraph {
  const field = (id: string, name = 'name'): FieldNode => ({
    id,
    field: name,
    kind: 'field',
    component: 'test.input',
    props: {},
    events: {},
    bindings: {},
    defaultValue: `${id} default`,
    validation: { version: 1, base: { type: 'string' }, rules: [{ kind: 'required', message: `${id} required` }] },
  })
  const scope = (id: string, name: string, kind: 'array' | 'object', children: string[]): LayoutNode => ({
    id,
    kind: 'layout',
    component: 'test.scope',
    props: {},
    events: {},
    bindings: {},
    valueScope: { field: name, kind },
    slots: { default: children.map(nodeId => ({ nodeId, placement: {} })) },
  })
  const nodes = [
    field('literal', 'literal.name'),
    field('billing-name'),
    field('shipping-name'),
    field('group-name'),
    field('item-name'),
    scope('billing', 'billing', 'object', ['billing-name']),
    scope('shipping', 'shipping', 'object', ['shipping-name']),
    scope('groups', 'groups', 'array', ['group-name', 'items']),
    scope('items', 'items', 'array', ['item-name']),
  ]
  return {
    version: PAGE_GRAPH_VERSION,
    props: {},
    form: {},
    root: ['literal', 'billing', 'shipping', 'groups'].map(nodeId => ({ nodeId, placement: {} })),
    nodesById: Object.fromEntries(nodes.map(node => [node.id, node])),
  }
}

export function nestedValues() {
  return {
    'literal.name': 'Literal key',
    'billing': { name: 'Billing', extra: { retained: true } },
    'shipping': { name: 'Shipping' },
    'groups': [
      { name: 'Group A', items: [{ name: 'A1' }, { name: 'A2' }] },
      { name: 'Group B', items: [{ name: 'B1' }, { name: 'B2' }] },
    ],
  }
}

export function compileScopedFixture(graph = scopedGraph(), editVersion = 0, inputVersion = '1'): {
  graph: PageGraph
  compilation: PageCompilation
  runtime: VueRuntimeCompileSuccess
  resolver: VueRuntimeBindingResolver
  input: PreviewSessionAcceptInput
} {
  const contracts: ComponentContract[] = ['test.input', 'test.other', 'test.scope'].map(key => ({
    key,
    version: key === 'test.input' ? inputVersion : '1',
    kind: key === 'test.scope' ? 'layout' : 'field',
    props: [{ key: 'placeholder', path: ['props', 'placeholder'] }],
    events: [{ name: 'update:modelValue' }, { name: 'blur' }],
    bindings: key === 'test.scope' ? [] : [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    slots: key === 'test.scope' ? [{ name: 'default', accepts: ['field', 'layout'] }] : [],
    allowedParents: [],
    defaults: {},
  }))
  const registry = createComponentContractRegistry(contracts, { adapter: 'element-plus', version: '1' })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'scoped-preview',
    name: 'Scoped preview',
    homePageId: 'home',
    pageOrder: ['home'],
    registryLock: registry.lock,
    settings: {},
    resources: {},
    pagesById: { home: { id: 'home', name: 'Home', route: '/', graph, flows: ['billing-name', 'item-name'].map(nodeId => ({
      version: 1,
      id: `observe-${nodeId}`,
      name: 'Observe',
      trigger: { kind: 'component.event', nodeId, event: 'update:modelValue' },
      nodes: [{ id: 'start', type: 'trigger' }, { id: 'end', type: 'success' }],
      edges: [{ id: 'next', source: 'start', target: 'end', condition: 'next' }],
    })) } },
  }
  const result = compileCanonicalPage({ snapshot: createProjectSnapshot(document, editVersion), pageId: 'home', registry: createRegistryContractSnapshot(registry) })
  if (!result.success)
    throw new Error(JSON.stringify(result.diagnostics))
  const compilation = result.compilation
  const resolver: VueRuntimeBindingResolver = {
    resolveBinding(key) {
      const contract = compilation.registryUsage.find(component => component.key === key)
      if (!contract)
        return undefined
      return {
        component: key === 'test.scope' ? 'section' : Input,
        kind: key === 'test.scope' ? 'layout' : 'field',
        contractVersion: contract.contractVersion,
        contractFingerprint: contract.fingerprint,
        valueProp: 'modelValue',
        trigger: 'update:modelValue',
        blurTrigger: 'blur',
      }
    },
  }
  const runtime = compileCanonicalPageRuntime({ compilation }, resolver)
  if (!runtime.success)
    throw new Error(JSON.stringify(runtime.diagnostics))
  return {
    graph,
    compilation,
    runtime,
    resolver,
    input: { adapter: 'element-plus', compilation, editVersion, graph, pageId: 'home', projectId: document.id, repositoryRevision: 1, runtime },
  }
}
