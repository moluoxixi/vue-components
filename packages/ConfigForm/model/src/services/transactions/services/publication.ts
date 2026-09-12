import type { ProjectDocument, ProjectTransactionSuccess } from '../../../types'

const transactionSources = new WeakMap<ProjectTransactionSuccess, ProjectDocument>()
const frozenValues = new WeakSet<object>()

export function publishProjectTransactionSuccess(
  source: ProjectDocument,
  result: ProjectTransactionSuccess,
): ProjectTransactionSuccess {
  freezeResult(result)
  transactionSources.set(result, source)
  return result
}

export function getProjectTransactionSource(result: ProjectTransactionSuccess): ProjectDocument | undefined {
  return transactionSources.get(result)
}

function freezeResult(value: unknown): void {
  if (!value || typeof value !== 'object' || frozenValues.has(value))
    return
  frozenValues.add(value)
  // Object.isFrozen alone cannot certify that nested values are immutable.
  Object.values(value).forEach(freezeResult)
  Object.freeze(value)
}
