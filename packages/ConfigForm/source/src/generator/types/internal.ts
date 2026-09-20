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

export interface SourceValidationFieldEmission {
  readonly nodeId: string
  /** Strictly parsed current RuleSet used by binding output and Raw code generation. */
  readonly ruleSet: RuleSet
  readonly attachValidator: boolean
}

export interface SourceValidationSurfaceEmission {
  readonly surfaceId: string
  readonly fields: readonly SourceValidationFieldEmission[]
}

export interface SourceValidationEmissionPlan {
  readonly surfaces: readonly SourceValidationSurfaceEmission[]
}
