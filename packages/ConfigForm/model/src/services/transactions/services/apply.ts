import type {
  ApplyProjectDraftTransactionOptions,
  ApplyProjectTransactionOptions,
  NodeId,
  PageId,
  ProjectDocument,
  ProjectNodeChange,
  ProjectOperation,
  ProjectTransaction,
  ProjectTransactionResult,
} from '../../../types'
import { Immer } from 'immer'
import { failure, TransactionError } from '../errors'
import {
  collectValidationPlan,
  createValidationPlan,
  validateChangedDocument,
  validateRegistryLock,
} from '../validation'
import { applyOperation } from './apply-operation'
import { hasSemanticChanges, normalizeNodeChanges, semanticallyEqual } from './changes'

const projectDocumentImmer = new Immer({ autoFreeze: false })

export function applyProjectTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options)
}

export function applyProjectDraftTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options)
}

/**
 * Command resolvers use this only while expanding multiple semantic actions.
 * The complete transaction must be passed through
 * applyProjectDraftTransaction or applyProjectTransaction before publication.
 *
 * @internal
 */
export function applyProjectCommandDraftTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options, false)
}

function applyProjectChange(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectTransactionOptions,
  validateDocument = true,
): ProjectTransactionResult {
  if (!transaction.id.trim() || !transaction.label.trim())
    return failure(document, 'PROJECT_TRANSACTION_IDENTITY_INVALID', 'Transactions require non-empty id and label values.')
  if (transaction.operations.length === 0)
    return failure(document, 'PROJECT_TRANSACTION_EMPTY', 'Transactions must contain at least one operation.')
  const configRemovalCount = transaction.operations.filter(operation => operation.type === 'node.config.remove').length
  if (configRemovalCount > 0 && configRemovalCount !== transaction.operations.length) {
    return failure(
      document,
      'PROJECT_NODE_CONFIG_REMOVE_MIXED',
      'Stored configuration removal cannot be mixed with other operations.',
    )
  }
  if (configRemovalCount > 0 && transaction.mergeKey) {
    return failure(
      document,
      'PROJECT_NODE_CONFIG_REMOVE_MERGE_INVALID',
      'Stored configuration removal cannot join a merged history entry.',
    )
  }
  if (options.registry) {
    try {
      validateRegistryLock(document, options.registry)
    }
    catch (error) {
      if (error instanceof TransactionError)
        return { success: false, document, diagnostics: [error.diagnostic] }
      throw error
    }
  }

  const inverseOperations: ProjectOperation[] = []
  const changedPageIds = new Set<PageId>()
  const changedNodeIds = new Set<NodeId>()
  const changedNodeChanges: ProjectNodeChange[] = []
  const validationPlan = createValidationPlan()
  let changedProject = false
  let draftCandidate: ProjectDocument

  try {
    draftCandidate = projectDocumentImmer.produce(document, (candidate) => {
      transaction.operations.forEach((operation) => {
        const result = applyOperation(candidate, operation)
        inverseOperations.unshift(...result.inverse)
        changedProject ||= result.changedProject
        result.changedPageIds.forEach(pageId => changedPageIds.add(pageId))
        result.changedNodeIds.forEach(nodeId => changedNodeIds.add(nodeId))
        changedNodeChanges.push(...result.changedNodeChanges)
        collectValidationPlan(validationPlan, operation, result)
      })
    })
  }
  catch (error) {
    if (error instanceof TransactionError)
      return { success: false, document, diagnostics: [error.diagnostic] }
    throw error
  }

  if (
    draftCandidate === document
    || (
      transaction.operations.length > 1
      && !hasSemanticChanges(document, draftCandidate, changedProject, changedPageIds)
    )
  ) {
    return {
      success: true,
      changed: false,
      document,
      inverse: { id: `${transaction.id}:inverse`, label: `Undo ${transaction.label}`, operations: [] },
      diagnostics: [],
      changedProject: false,
      changedPageIds: [],
      changedNodeIds: [],
      changedNodeChanges: [],
    }
  }

  if (options.registry) {
    const registryLock = options.registry.lock
    if (!semanticallyEqual(draftCandidate.registryLock, registryLock)) {
      draftCandidate = projectDocumentImmer.produce(draftCandidate, (candidate) => {
        candidate.registryLock = structuredClone(registryLock)
      })
      changedProject = true
    }
  }

  if (validateDocument) {
    const validation = validateChangedDocument(draftCandidate, validationPlan, options.registry)
    if (validation.length > 0)
      return { success: false, document, diagnostics: validation }
  }

  return {
    success: true,
    changed: true,
    document: draftCandidate,
    inverse: {
      id: `${transaction.id}:inverse`,
      label: `Undo ${transaction.label}`,
      operations: inverseOperations,
    },
    diagnostics: [],
    changedProject,
    changedPageIds: [...changedPageIds],
    changedNodeIds: [...changedNodeIds],
    changedNodeChanges: normalizeNodeChanges(changedNodeChanges),
  }
}
