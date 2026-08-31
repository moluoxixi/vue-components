import type {
  CanonicalPageIdentity,
  CanonicalProjectIdentity,
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormComponentRegistry,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form/renderer'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'

export type CanonicalRuntimePage = PageCompilation['page']
export type CanonicalRuntimeNode = CanonicalRuntimePage['nodesById'][string]
export type CanonicalRuntimeFieldNode = Extract<CanonicalRuntimeNode, { readonly kind: 'field' }>

export interface VueRuntimeReadonlyRenderContext {
  componentProps: Record<string, unknown>
  model: Record<string, unknown>
  node: CanonicalRuntimeFieldNode
  value: unknown
}

export interface VueRuntimeComponentBinding {
  component: Component | string
  contractFingerprint: string
  contractVersion: string
  kind: 'field' | 'layout'
  blurTrigger?: string
  getValueFromEvent?: (...args: unknown[]) => unknown
  readonlyRender?: (context: VueRuntimeReadonlyRenderContext) => VNodeChild
  trigger?: string
  valueProp?: string
}

export interface VueRuntimeBindingResolver {
  components?: ConfigFormComponentRegistry
  resolveBinding: (component: string) => VueRuntimeComponentBinding | undefined
  resolveValidator?: (key: string) => RuleCustomValidator | undefined
}

export interface VueRuntimeRendererConfig {
  components?: ConfigFormComponentRegistry
  fields: ConfigFormRendererNode[]
  readonly?: boolean
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  responsive?: ConfigFormResponsiveLayout
}

export interface VueRuntimeRenderPlan {
  renderer: VueRuntimeRendererConfig
}

/**
 * Immutable identity envelope for one page runtime derived from a complete
 * ProjectCompilation. Runtime consumers retain this envelope instead of
 * pairing a page plan with an independently captured project revision.
 */
export interface VueRuntimeArtifact {
  readonly compilationKey: Readonly<CanonicalPageIdentity | CanonicalProjectIdentity>
  readonly pageId: string
  readonly plan: Readonly<VueRuntimeRenderPlan>
}

export type CompileCanonicalPageRuntimeInput
  = | { compilation: PageCompilation, pageId?: never }
    | { compilation: ProjectCompilation, pageId: string }

export type VueRuntimeDiagnosticSeverity = 'error' | 'warning'

export interface VueRuntimeDiagnostic {
  code: string
  message: string
  path: Array<string | number>
  severity: VueRuntimeDiagnosticSeverity
  nodeId?: string
}

export interface VueRuntimeCompileSuccess {
  success: true
  artifact: VueRuntimeArtifact
  diagnostics: readonly VueRuntimeDiagnostic[]
}

export interface VueRuntimeCompileFailure {
  success: false
  artifact?: undefined
  diagnostics: readonly VueRuntimeDiagnostic[]
}

export type VueRuntimeCompileResult = VueRuntimeCompileSuccess | VueRuntimeCompileFailure
