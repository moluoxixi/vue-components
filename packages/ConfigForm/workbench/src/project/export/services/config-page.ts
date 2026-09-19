import type { ConfigFormSurfaceRuntimePlan } from '@moluoxixi/config-form'
import type { CanonicalSurfaceIR, SurfaceCompilation, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { CanonicalSourceBindingResolver, ConfigRuntimeBindingRequirement } from '../types'
import { createConfigFormValueScopeStore } from '@moluoxixi/config-form-core'
import { formatStaticValue } from '../utils'

function staticData(value: unknown, path: string): string {
  return formatStaticValue(value, 0, path)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function requiredSurfaceBindings(
  surface: CanonicalSurfaceIR,
  resolver: CanonicalSourceBindingResolver,
): ConfigRuntimeBindingRequirement[] {
  const required: ConfigRuntimeBindingRequirement[] = []
  for (const node of Object.values(surface.nodesById)) {
    const path = ['nodesById', node.id, 'component']
    const location = `Surface ${JSON.stringify(surface.id)} at ${JSON.stringify(path)}`
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
    required.push({ kind: 'component', ref: node.component, surfaceId: surface.id, nodeId: node.id, path })
    if (node.kind === 'field') {
      node.validation?.rules.forEach((rule, index) => {
        if (rule.kind === 'custom') {
          required.push({
            kind: 'validator',
            ref: rule.key,
            surfaceId: surface.id,
            nodeId: node.id,
            path: ['nodesById', node.id, 'validation', 'rules', index, 'key'],
          })
        }
      })
    }
  }
  return required
}

export function configSurfaceSource(
  surfaceCompilation: SurfaceCompilation,
  compilation: ProjectCompilation,
  resolver: CanonicalSourceBindingResolver,
): string {
  const surface = structuredClone(surfaceCompilation.surface) as CanonicalSurfaceIR
  // Only execution data is projected here. Vue backend owns all renderer lowering.
  const plan: ConfigFormSurfaceRuntimePlan = {
    valueSchema: { scopedFields: surface.scopedFields, valueScopes: surface.valueScopes },
    runtime: { dataSources: [], variables: [] },
    optionBindings: [],
  }
  const initialValues = createConfigFormValueScopeStore({
    fields: plan.valueSchema.scopedFields,
    scopes: plan.valueSchema.valueScopes,
  }).getValues()
  const requiredBindings = requiredSurfaceBindings(surface, resolver)
  return `import type { ConfigFormSurfaceRuntimePlan } from '@moluoxixi/config-form'
import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { VueRuntimeBindingResolver, VueRuntimeDiagnostic, VueRuntimeRendererConfig } from '@moluoxixi/config-form-vue-backend'
import { compileCanonicalSurfaceRuntime } from '@moluoxixi/config-form-vue-backend'

export interface RuntimeBindingResolver extends VueRuntimeBindingResolver {
  adapter: string
  adapterVersion: string
  registryFingerprint: string
}

export interface RuntimeBindingRequirement {
  kind: 'component' | 'validator'
  ref: string
  surfaceId: string
  path: Array<string | number>
  nodeId?: string
}

export type RuntimeDiagnostic = VueRuntimeDiagnostic & { surfaceId: string }
export type RuntimeRendererConfig = VueRuntimeRendererConfig & {
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

export const surfaceCompilation: SurfaceCompilation = ${staticData(surfaceCompilation, 'surfaceCompilation')}

export const plan: ConfigFormSurfaceRuntimePlan = ${staticData(plan, 'plan')}

export const initialValues: Record<string, unknown> = ${staticData(initialValues, 'initialValues')}

export const requiredBindings: readonly RuntimeBindingRequirement[] = ${staticData(requiredBindings, 'requiredBindings')}

export function createRendererConfig(
  resolver: RuntimeBindingResolver,
): RuntimeRendererConfig {
  const surfaceId = surfaceCompilation.key.surfaceId
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
      surfaceId,
    }])
  }
  const result = compileCanonicalSurfaceRuntime({ compilation: surfaceCompilation }, resolver)
  const diagnostics: RuntimeDiagnostic[] = result.diagnostics.map(item => ({ ...item, surfaceId }))
  if (!result.success || diagnostics.some(item => item.severity === 'error'))
    throw new ConfigRuntimeBindingError(diagnostics)
  return {
    ...result.artifact.renderer,
    defaultValues: structuredClone(initialValues),
  }
}
`
}
