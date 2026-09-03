import type { ModelDiagnostic, NodeId, PageId, ProjectDocument, ProjectTransactionResult } from '../../../types'

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

export function invalid(code: string, message: string, pageId?: PageId, nodeId?: NodeId): never {
  throw new TransactionError({ code, message, ...(pageId ? { pageId } : {}), ...(nodeId ? { nodeId } : {}) })
}
