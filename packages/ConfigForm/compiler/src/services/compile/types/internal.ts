import type { PageGraph, RegistryContractComponentSnapshot, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import type { CanonicalFlowIR, CanonicalNodeIR, SemanticCompilerDiagnostic, SemanticCompilerEnvironment } from '../../../types'

export interface CompilePageContext {
  pageId: string
  graph: PageGraph
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>
  diagnostics: SemanticCompilerDiagnostic[]
  nodesById: Record<string, CanonicalNodeIR>
  flowEvents: ReadonlyMap<string, readonly string[]>
}

export interface PreparedCompilerContext {
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>
  environment: SemanticCompilerEnvironment
  environmentHash: string
  registry: RegistryContractSnapshot
}

export type CompiledFlowEvents = ReadonlyMap<string, readonly string[]>
export type CompiledFlows = readonly CanonicalFlowIR[]
