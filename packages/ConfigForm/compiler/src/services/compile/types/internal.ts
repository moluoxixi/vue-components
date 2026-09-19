import type {
  DeepReadonly,
  RegistryContractComponentSnapshot,
  RegistryContractSnapshot,
  SurfaceGraph,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalNodeIR,
  SemanticCompilerDiagnostic,
  SemanticCompilerEnvironment,
} from '../../../types'

export interface CompileSurfaceContext {
  surfaceId: string
  graph: DeepReadonly<SurfaceGraph>
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>
  diagnostics: SemanticCompilerDiagnostic[]
  nodesById: Record<string, CanonicalNodeIR>
}

export interface PreparedCompilerContext {
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>
  environment: SemanticCompilerEnvironment
  environmentHash: string
  registry: RegistryContractSnapshot
}
