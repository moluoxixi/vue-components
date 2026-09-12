import type { ConfigFormPageRuntimePlan } from '@moluoxixi/config-form'
import type { CanonicalPageIR, PageCompilation, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { CanonicalSourceBindingResolver, ConfigRuntimeBindingRequirement } from '../types'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { formatStaticValue } from '../utils'

// These actions are owned by ConfigFormRenderer, not the business action registry.
const RENDERER_ACTION_REFS = new Set([
  'builtin.field.set',
  'builtin.variable.set',
  'builtin.field.state',
  'builtin.form.validate',
  'builtin.form.submit',
  'builtin.form.reset',
  'builtin.dataSource.load',
])

function staticData(value: unknown, path: string): string {
  return formatStaticValue(value, 0, path)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function requiredPageBindings(
  page: CanonicalPageIR,
  resolver: CanonicalSourceBindingResolver,
): ConfigRuntimeBindingRequirement[] {
  const required: ConfigRuntimeBindingRequirement[] = []
  for (const node of Object.values(page.nodesById)) {
    const path = ['nodesById', node.id, 'component']
    const location = `page ${JSON.stringify(page.id)} at ${JSON.stringify(path)}`
    const binding = resolver.resolveBinding(node.component)
    if (!binding)
      throw new Error(`Component "${node.component}" has no Config source binding: ${location}.`)
    if (
      binding.component !== node.component
      || binding.contractVersion !== node.componentVersion
      || binding.contractFingerprint !== node.componentFingerprint
    ) {
      throw new Error(`Component "${node.component}" Config source binding does not match the compilation Registry snapshot: ${location}.`)
    }
    required.push({ kind: 'component', ref: node.component, pageId: page.id, nodeId: node.id, path })
    if (node.kind === 'field') {
      node.validation?.rules.forEach((rule, index) => {
        if (rule.kind === 'custom') {
          required.push({
            kind: 'validator',
            ref: rule.key,
            pageId: page.id,
            nodeId: node.id,
            path: ['nodesById', node.id, 'validation', 'rules', index, 'key'],
          })
        }
      })
    }
  }
  page.flows.forEach(({ plan }, flowIndex) => {
    plan.nodes.forEach((node, nodeIndex) => {
      if (node.type === 'action' && node.ref && !RENDERER_ACTION_REFS.has(node.ref)) {
        required.push({
          kind: 'action',
          ref: node.ref,
          pageId: page.id,
          flowId: plan.flowId,
          nodeId: node.id,
          path: ['flows', flowIndex, 'plan', 'nodes', nodeIndex, 'ref'],
        })
      }
    })
  })
  page.runtime?.dataSources.forEach((source, index) => {
    required.push({
      kind: 'dataSource',
      ref: source.id,
      sourceId: source.id,
      pageId: page.id,
      path: ['runtime', 'dataSources', index, 'request'],
    })
  })
  return required
}

export function configPageSource(
  pageCompilation: PageCompilation,
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): string {
  const page = structuredClone(pageCompilation.page) as CanonicalPageIR
  // Only execution data is projected here. Vue backend owns all renderer lowering.
  const plan: ConfigFormPageRuntimePlan = {
    flows: page.flows.map(flow => flow.plan),
    valueSchema: { scopedFields: page.scopedFields, valueScopes: page.valueScopes },
    runtime: page.runtime ?? { dataSources: [], variables: [] },
    optionBindings: Object.values(page.nodesById)
      .flatMap(node => node.kind === 'field' && node.optionSource ? [{ nodeId: node.id, source: node.optionSource }] : [])
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
  }
  const initialValues = createConfigFormValueScopeStore({
    fields: plan.valueSchema.scopedFields,
    scopes: plan.valueSchema.valueScopes,
  }).getValues()
  const requiredBindings = requiredPageBindings(page, resolver)
  return `import type { ConfigFormPageRuntimePlan } from '@moluoxixi/config-form'
import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormDataSourceHost, ConfigFormFlowActionRegistry } from '@moluoxixi/config-form-core'
import type { VueRuntimeBindingResolver, VueRuntimeDiagnostic, VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'

export interface RuntimeBindingResolver extends VueRuntimeBindingResolver {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
}

export interface RuntimeBindingRequirement {
  kind: 'component' | 'validator' | 'action' | 'dataSource'
  ref: string
  pageId: string
  path: Array<string | number>
  nodeId?: string
  flowId?: string
  sourceId?: string
}

export type RuntimeDiagnostic = VueRuntimeDiagnostic & { pageId: string, flowId?: string, sourceId?: string }
export interface RuntimeHostBindings {
  flowActions?: ConfigFormFlowActionRegistry
  dataSourceHost?: ConfigFormDataSourceHost
}
export type RuntimeRendererConfig = VueRuntimeRendererConfig & RuntimeHostBindings & {
  defaultValues: Record<string, unknown>
}

export class ConfigRuntimeBindingError extends Error {
  constructor(readonly diagnostics: readonly RuntimeDiagnostic[]) {
    super('Config runtime binding failed: ' + JSON.stringify(diagnostics))
    this.name = 'ConfigRuntimeBindingError'
  }
}

export const registryIdentity = ${staticData({
  adapter: compilation.key.registryAdapter,
  adapterVersion: compilation.key.registryAdapterVersion,
  registryFingerprint: compilation.key.registryFingerprint,
}, 'registryIdentity')}

export const pageCompilation: PageCompilation = ${staticData(pageCompilation, 'pageCompilation')}

export const plan: ConfigFormPageRuntimePlan = ${staticData(plan, 'plan')}

export const initialValues: Record<string, unknown> = ${staticData(initialValues, 'initialValues')}

export const requiredBindings: readonly RuntimeBindingRequirement[] = ${staticData(requiredBindings, 'requiredBindings')}

export function createRendererConfig(
  resolver: RuntimeBindingResolver,
  host: RuntimeHostBindings = {},
): RuntimeRendererConfig {
  const { flowActions, dataSourceHost } = host
  const pageId = pageCompilation.key.pageId
  if (
    resolver.adapter !== registryIdentity.adapter
    || resolver.adapterVersion !== registryIdentity.adapterVersion
    || resolver.registryFingerprint !== registryIdentity.registryFingerprint
  ) {
    throw new ConfigRuntimeBindingError([{
      code: 'CONFIG_RUNTIME_REGISTRY_IDENTITY_MISMATCH',
      message: 'Runtime resolver does not match the exported Registry identity.',
      path: ['registryIdentity'],
      severity: 'error',
      pageId,
    }])
  }
  const result = compileCanonicalPageRuntime({ compilation: pageCompilation }, resolver)
  const diagnostics: RuntimeDiagnostic[] = result.diagnostics.map(item => ({ ...item, pageId }))
  for (const binding of requiredBindings) {
    if (binding.kind === 'action' && typeof flowActions?.get(binding.ref)?.execute !== 'function') {
      diagnostics.push({
        code: 'CONFIG_RUNTIME_ACTION_BINDING_UNAVAILABLE',
        message: 'Runtime action binding is unavailable: ' + binding.ref,
        path: binding.path,
        severity: 'error',
        pageId,
        nodeId: binding.nodeId,
        flowId: binding.flowId,
      })
    }
    if (binding.kind === 'dataSource' && typeof dataSourceHost?.request !== 'function') {
      diagnostics.push({
        code: 'CONFIG_RUNTIME_DATA_SOURCE_HOST_MISSING',
        message: 'Data-source request binding is unavailable: ' + binding.ref,
        path: binding.path,
        severity: 'error',
        pageId,
        sourceId: binding.sourceId,
      })
    }
  }
  if (!result.success || diagnostics.some(item => item.severity === 'error'))
    throw new ConfigRuntimeBindingError(diagnostics)
  return {
    ...result.artifact.renderer,
    defaultValues: structuredClone(initialValues),
    ...(flowActions ? { flowActions } : {}),
    ...(dataSourceHost ? { dataSourceHost } : {}),
  }
}
`
}
