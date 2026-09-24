import type { ModelDiagnostic, NodeId, ProjectDocument, ProjectTransactionResult, SurfaceId } from '../../../types'

export class TransactionError extends Error {
  readonly diagnostic: ModelDiagnostic

  constructor(diagnostic: ModelDiagnostic) {
    super(diagnostic.message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ProjectTransactionError'
    this.diagnostic = diagnostic
  }
}

export function failure(document: ProjectDocument, code: string, message: string): ProjectTransactionResult {
  return { success: false, document, diagnostics: [{ code, message }] }
}

export function invalid(
  code: string,
  message: string,
  surfaceId?: SurfaceId,
  nodeId?: NodeId,
  context?: Record<string, unknown>,
): never {
  throw new TransactionError({
    code,
    message,
    ...(surfaceId ? { surfaceId } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(context ? { context } : {}),
  })
}
