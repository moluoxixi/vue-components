import type {
  ConfigFormComponentRegistry,
  ConfigFormPageRuntimeOptionBinding,
  ConfigFormPageRuntimePlan,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form'
import type {
  CanonicalPageIdentity,
  CanonicalProjectIdentity,
  PageCompilation,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormPageRuntimeConfiguration,
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'

/** Public contracts for projecting Canonical IR into the Vue renderer. */

type RuntimeMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? RuntimeMutable<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: RuntimeMutable<T[Key]> }
      : T

type CompilerCanonicalRuntimePageSource = PageCompilation['page']
type CompilerCanonicalRuntimePage = RuntimeMutable<CompilerCanonicalRuntimePageSource>
type CompilerCanonicalRuntimeFlow = CompilerCanonicalRuntimePageSource['flows'][number]
type CompilerCanonicalRuntimeNode = CompilerCanonicalRuntimePage['nodesById'][string]

export type CanonicalRuntimeFieldNode
  = Extract<CompilerCanonicalRuntimeNode, { kind: 'field' }>
    & { optionSource?: ConfigFormPageRuntimeOptionBinding['source'] }

export type CanonicalRuntimeLayoutNode
  = Extract<CompilerCanonicalRuntimeNode, { kind: 'layout' }>
    & { valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'> }

export type CanonicalRuntimeNode = CanonicalRuntimeFieldNode | CanonicalRuntimeLayoutNode
export type CanonicalRuntimePage = Omit<CompilerCanonicalRuntimePage, 'flows' | 'nodesById'> & {
  flows: CompilerCanonicalRuntimeFlow[]
  nodesById: Record<string, CanonicalRuntimeNode>
  runtime?: ConfigFormPageRuntimeConfiguration
  scopedFields: ConfigFormScopedFieldDefinition[]
  valueScopes: ConfigFormValueScopeDefinition[]
}

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
  /** The sole compiled execution-data input consumed by ConfigFormRenderer. */
  plan: ConfigFormPageRuntimePlan
  readonly?: boolean
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  labelWidth?: number
  responsive?: ConfigFormResponsiveLayout
}

/**
 * Immutable identity envelope for one page runtime derived from a complete
 * ProjectCompilation. Runtime consumers retain this envelope instead of
 * pairing a page plan with an independently captured project revision.
 */
export interface VueRuntimeArtifact {
  readonly compilationKey: Readonly<CanonicalPageIdentity | CanonicalProjectIdentity>
  readonly pageId: string
  readonly renderer: Readonly<VueRuntimeRendererConfig>
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
