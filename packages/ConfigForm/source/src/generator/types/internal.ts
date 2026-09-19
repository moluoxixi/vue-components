import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import type {
  SourceBinaryFile,
  SourceComponentResolution,
} from './index'

export interface ResolvedSourceComponents {
  byKey: ReadonlyMap<string, SourceComponentResolution>
  dependencies: Readonly<Record<string, string>>
}

export interface CollectedSourceResources {
  files: readonly SourceBinaryFile[]
  values: ReadonlyMap<
    string,
    { kind: 'embedded', fileName: string } | { kind: 'url', url: string }
  >
}

export interface SourceValidationRuntimeCompiler {
  readonly dependencyVersion: string
  readonly importName: 'compileRules'
  readonly moduleSpecifier: '@moluoxixi/zod3-to-rule'
}

export interface SourceValidationFieldProjection {
  /** The generated field must receive the schema returned by compileRules(). */
  readonly attachSchema: true
  /** The generated field receives compileRules().validator only when one was compiled. */
  readonly attachValidator: boolean
  readonly required?: true
  readonly requiredMessage?: string
}

export interface SourceValidationFieldEmission {
  readonly nodeId: string
  /** JSON-safe input that the generated project compiles with runtimeCompiler. */
  readonly ruleSet: RuleSet
  readonly field: SourceValidationFieldProjection
}

export interface SourceValidationSurfaceEmission {
  readonly surfaceId: string
  readonly fields: readonly SourceValidationFieldEmission[]
}

export interface SourceValidationEmissionPlan {
  readonly runtimeCompiler: SourceValidationRuntimeCompiler
  readonly surfaces: readonly SourceValidationSurfaceEmission[]
}
