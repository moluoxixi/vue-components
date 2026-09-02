import type { SemanticCompilerEnvironment } from '../types'

/** Baseline environment used when the caller omits optional compiler context. */
export const DEFAULT_SEMANTIC_COMPILER_ENVIRONMENT: SemanticCompilerEnvironment = {
  version: '1',
  features: {},
}
