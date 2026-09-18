import type { PageGraph, RegistryContractComponentSnapshot, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { CanonicalNodeIR, SemanticCompilerDiagnostic, SemanticCompilerEnvironment } from '../../../types'

export interface CompilePageContext {
  pageId: string
  graph: PageGraph
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
