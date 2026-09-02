import type {
  SemanticCompilerDiagnostic,
  SemanticCompilerEnvironment,
} from '../types'
import { DEFAULT_SEMANTIC_COMPILER_ENVIRONMENT } from '../defaults'
import { clone } from '../utils'

export function normalizeSemanticCompilerEnvironment(
  input: Partial<SemanticCompilerEnvironment> | undefined,
  diagnostics: SemanticCompilerDiagnostic[],
): SemanticCompilerEnvironment | undefined {
  const environment = {
    version: input?.version ?? DEFAULT_SEMANTIC_COMPILER_ENVIRONMENT.version,
    features: clone(input?.features ?? DEFAULT_SEMANTIC_COMPILER_ENVIRONMENT.features),
  }
  if (!environment.version.trim()) {
    diagnostics.push({
      code: 'COMPILER_ENVIRONMENT_VERSION_INVALID',
      message: 'Semantic compiler environment requires a non-empty version.',
      path: ['environment', 'version'],
    })
    return undefined
  }
  return environment
}
