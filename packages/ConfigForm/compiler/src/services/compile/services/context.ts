import type { SemanticCompilerDiagnostic, SemanticCompilerEnvironment } from '../../../types'
import type { PreparedCompilerContext } from '../types'
import { parseRegistryContractSnapshot } from '@moluoxixi/config-form-model'
import { normalizeSemanticCompilerEnvironment } from '../../../schemas'
import { semanticHash } from '../../../utils'

export function prepareCompilerContext(
  registryInput: unknown,
  environmentInput: Partial<SemanticCompilerEnvironment> | undefined,
): { success: true, context: PreparedCompilerContext } | { success: false, diagnostics: SemanticCompilerDiagnostic[] } {
  const registryResult = parseRegistryContractSnapshot(registryInput)
  if (!registryResult.success)
    return { success: false, diagnostics: registryResult.diagnostics }
  const diagnostics: SemanticCompilerDiagnostic[] = []
  const environment = normalizeSemanticCompilerEnvironment(environmentInput, diagnostics)
  if (!environment || diagnostics.length > 0)
    return { success: false, diagnostics }
  const registry = registryResult.data
  return {
    success: true,
    context: {
      contracts: new Map(registry.components.map(component => [component.key, component])),
      environment,
      environmentHash: semanticHash(environment),
      registry,
    },
  }
}
