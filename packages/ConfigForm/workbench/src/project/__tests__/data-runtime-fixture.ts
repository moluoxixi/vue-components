import type { ComponentContract, ProjectDocument } from '@moluoxixi/config-form-model'
import type { VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'
import type { DataRuntimeFixture } from './types'
import { compileCanonicalPage, compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createComponentContractRegistry, createProjectSnapshot, createRegistryContractSnapshot, PAGE_GRAPH_VERSION, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { defineComponent, h } from 'vue'
import { createCanonicalProjectSourceExport } from '../export'

export const DataControl = defineComponent({
  props: ['modelValue', 'options', 'optionState'],
  emits: ['update:modelValue'],
  setup: props => () => h('button', { type: 'button' }, JSON.stringify(props.options ?? [])),
})

export function compileDataFixture(): DataRuntimeFixture {
  const contract: ComponentContract = {
    key: 'test.choice',
    version: '1',
    kind: 'field',
    props: [],
    bindings: [{ name: 'model', valueProp: 'modelValue', trigger: 'update:modelValue' }],
    slots: [],
    allowedParents: [],
    defaults: {},
  }
  const registry = createComponentContractRegistry([contract], { adapter: 'element-plus', version: '1' })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'data-preview',
    name: 'Data preview',
    homePageId: 'home',
    pageOrder: ['home'],
    registryLock: registry.lock,
    settings: {},
    resources: {},
    pagesById: { home: {
      id: 'home',
      name: 'Home',
      route: '/',
      runtime: {
        variables: [{ id: 'region', name: 'Region', initialValue: 'US' }],
        dataSources: [{ id: 'choices', name: 'Choices', auto: true, cacheTtlMs: 60_000, request: { url: '/choices', query: { region: { $ref: { kind: 'variable', variableId: 'region' } } } } }],
      },
      graph: { version: PAGE_GRAPH_VERSION, props: {}, form: {}, root: ['choice', 'result'].map(nodeId => ({ nodeId, placement: {} })), nodesById: {
        choice: { id: 'choice', kind: 'field', component: 'test.choice', field: 'choice', defaultValue: '', props: {}, bindings: {}, optionSource: { kind: 'dataSource', dataSourceId: 'choices' } },
        result: { id: 'result', kind: 'field', component: 'test.choice', field: 'result', defaultValue: '', props: {}, bindings: {} },
      } },
    } },
  }
  const input = { snapshot: createProjectSnapshot(document), registry: createRegistryContractSnapshot(registry) }
  const page = compileCanonicalPage({ ...input, pageId: 'home' })
  const project = compileCanonicalProject(input)
  if (!page.success || !project.success)
    throw new Error(JSON.stringify([page.diagnostics, project.diagnostics]))
  const identity = registry.lock.components['test.choice']!
  const resolver: VueRuntimeBindingResolver = {
    resolveBinding: () => ({ component: DataControl, kind: 'field', contractVersion: identity.contractVersion, contractFingerprint: identity.fingerprint, valueProp: 'modelValue', trigger: 'update:modelValue' }),
  }
  const runtime = compileCanonicalPageRuntime({ compilation: page.compilation }, resolver)
  if (!runtime.success)
    throw new Error(JSON.stringify(runtime.diagnostics))
  const exportSource = () => createCanonicalProjectSourceExport(project.compilation, {
    adapter: project.compilation.registry.adapter,
    adapterVersion: project.compilation.registry.adapterVersion,
    registryFingerprint: project.compilation.registry.fingerprint,
    resolveBinding: () => ({ component: 'test.choice', contractVersion: identity.contractVersion, contractFingerprint: identity.fingerprint, configComponent: 'choice', tag: 'DataControl', render: 'component', valueProp: 'modelValue', trigger: 'update:modelValue' }),
  })
  return { compilation: page.compilation, runtime, resolver, exportSource }
}
