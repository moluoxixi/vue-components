import type {
  ConfigFormComponentRegistry,
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
  ConfigFormSurfaceRuntimePlan,
} from '@moluoxixi/config-form'
import type {
  CanonicalProjectIdentity,
  CanonicalSurfaceIdentity,
  ProjectCompilation,
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormScopedFieldDefinition,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'

/** Public contracts for projecting Canonical IR into the Vue renderer. */

type RuntimeMutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? [RuntimeMutable<Head>, ...RuntimeMutable<Tail>]
    : T extends readonly (infer Item)[]
      ? RuntimeMutable<Item>[]
      : T extends object
        ? { -readonly [Key in keyof T]: RuntimeMutable<T[Key]> }
        : T

type CompilerCanonicalRuntimeSurfaceSource = SurfaceCompilation['surface']
type CompilerCanonicalRuntimeSurface = RuntimeMutable<CompilerCanonicalRuntimeSurfaceSource>
type CompilerCanonicalRuntimeNode = CompilerCanonicalRuntimeSurface['nodesById'][string]

export type CanonicalRuntimeFieldNode
  = Extract<CompilerCanonicalRuntimeNode, { kind: 'field' }>

export type CanonicalRuntimeLayoutNode
  = Extract<CompilerCanonicalRuntimeNode, { kind: 'layout' }>
    & { valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'> }

export type CanonicalRuntimeElementNode = Extract<CompilerCanonicalRuntimeNode, { kind: 'element' }>

export type CanonicalRuntimeNode
  = CanonicalRuntimeFieldNode | CanonicalRuntimeLayoutNode | CanonicalRuntimeElementNode

export type CanonicalRuntimeSurface = CompilerCanonicalRuntimeSurface & {
  nodesById: Record<string, CanonicalRuntimeNode>
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
  kind: 'field' | 'layout' | 'element'
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
  plan: ConfigFormSurfaceRuntimePlan
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
 * Immutable identity envelope for one Surface runtime derived from a complete
 * SurfaceCompilation or ProjectCompilation. Runtime consumers retain this
 * envelope instead of pairing a renderer plan with an independently captured
 * project revision.
 */
export interface VueSurfaceRuntimeArtifact {
  readonly compilationKey: Readonly<CanonicalSurfaceIdentity | CanonicalProjectIdentity>
  readonly surfaceId: string
  readonly kind: CanonicalRuntimeSurface['kind']
  readonly presentation?: Extract<CanonicalRuntimeSurface, { kind: 'dialog' | 'drawer' }>['presentation']
  readonly renderer: Readonly<VueRuntimeRendererConfig>
}

export type CompileCanonicalSurfaceRuntimeInput
  = | { compilation: SurfaceCompilation, surfaceId?: never }
    | { compilation: ProjectCompilation, surfaceId: string }

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
  artifact: VueSurfaceRuntimeArtifact
  diagnostics: readonly VueRuntimeDiagnostic[]
}

export interface VueRuntimeCompileFailure {
  success: false
  artifact?: undefined
  diagnostics: readonly VueRuntimeDiagnostic[]
}

export type VueRuntimeCompileResult = VueRuntimeCompileSuccess | VueRuntimeCompileFailure
