import type { ProjectDocument, ProjectTransactionSuccess } from '../../../types'

const transactionSources = new WeakMap<ProjectTransactionSuccess, ProjectDocument>()
const frozenValues = new WeakSet<object>()
const validatedProjectDocuments = new WeakSet<object>()

export function publishProjectTransactionSuccess(
  source: ProjectDocument,
  result: ProjectTransactionSuccess,
): ProjectTransactionSuccess {
  freezeResult(result, isValidatedProjectDocument(source))
  markValidatedProjectDocument(result.document)
  transactionSources.set(result, source)
  return result
}

export function getProjectTransactionSource(result: ProjectTransactionSuccess): ProjectDocument | undefined {
  return transactionSources.get(result)
}

export function isValidatedProjectDocument(value: unknown): value is ProjectDocument {
  return !!value && typeof value === 'object' && validatedProjectDocuments.has(value)
}

export function markValidatedProjectDocument(document: object): void {
  validatedProjectDocuments.add(document)
}

function freezeResult(value: unknown, trustFrozenBranches: boolean): void {
  if (!value || typeof value !== 'object' || frozenValues.has(value))
    return
  if (trustFrozenBranches && Object.isFrozen(value)) {
    frozenValues.add(value)
    return
  }
  frozenValues.add(value)
  Object.values(value).forEach(child => freezeResult(child, trustFrozenBranches))
  Object.freeze(value)
}
