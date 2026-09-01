import type { ApplyProjectTransactionOptions } from './transaction'
import type {
  AppliedProjectTransaction,
  ProjectDocument,
  ProjectHistory,
  ProjectHistoryResult,
  ProjectSnapshot,
  ProjectTransaction,
} from './types'
import { assertProjectSnapshot, createProjectSnapshot } from './schema'
import { applyProjectTransaction } from './transaction'

const EMPTY_CHANGE_SET = Object.freeze({
  project: false,
  pageIds: Object.freeze([]),
  nodeIds: Object.freeze([]),
  nodeChanges: Object.freeze([]),
})

export interface CreateProjectHistoryOptions {
  editVersion?: number
  limit?: number
  mergeWindowMs?: number
}

export interface ApplyProjectHistoryOptions extends ApplyProjectTransactionOptions {
  nowMs?: () => number
}

export function createProjectHistory(
  document: ProjectDocument | ProjectSnapshot,
  options: CreateProjectHistoryOptions = {},
): ProjectHistory {
  const limit = options.limit ?? 100
  const mergeWindowMs = options.mergeWindowMs ?? 500
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError('Project history limit must be a positive integer.')
  if (!Number.isFinite(mergeWindowMs) || mergeWindowMs < 0)
    throw new RangeError('Project history merge window must be a non-negative finite number.')
  const snapshot = isProjectSnapshot(document)
    ? assertProjectSnapshot(document)
    : createProjectSnapshot(document, options.editVersion ?? 0)
  return {
    snapshot,
    past: [],
    future: [],
    limit,
    mergeWindowMs,
  }
}

export function applyProjectHistoryTransaction(
  history: ProjectHistory,
  transaction: ProjectTransaction,
  options: ApplyProjectHistoryOptions = {},
): ProjectHistoryResult {
  const result = applyProjectTransaction(currentDocument(history), transaction, options)
  if (!result.success)
    return { changed: false, history, diagnostics: result.diagnostics, changeSet: EMPTY_CHANGE_SET }
  if (!result.changed)
    return { changed: false, history, diagnostics: [], changeSet: EMPTY_CHANGE_SET }

  const timestamp = options.nowMs?.() ?? Date.now()
  const editVersion = history.snapshot.editVersion + 1
  const snapshot = createProjectSnapshot(result.document, editVersion)
  const entry: AppliedProjectTransaction = {
    transaction: structuredClone(transaction),
    inverse: result.inverse,
    editVersion,
    contentHash: snapshot.contentHash,
    timestamp,
  }
  const previous = history.past.at(-1)
  const merge = previous
    && transaction.mergeKey
    && transaction.mergeKey === previous.transaction.mergeKey
    && timestamp - previous.timestamp <= history.mergeWindowMs
  const past = merge
    ? [
        ...history.past.slice(0, -1),
        mergeEntries(previous, entry),
      ]
    : [...history.past, entry].slice(-history.limit)

  return {
    changed: true,
    diagnostics: [],
    changeSet: {
      project: result.changedProject,
      pageIds: result.changedPageIds,
      nodeIds: result.changedNodeIds,
      nodeChanges: result.changedNodeChanges,
    },
    history: {
      ...history,
      snapshot,
      past,
      future: [],
    },
  }
}

export function undoProjectHistory(
  history: ProjectHistory,
  options: ApplyProjectHistoryOptions = {},
): ProjectHistoryResult {
  const entry = history.past.at(-1)
  if (!entry)
    return { changed: false, history, diagnostics: [], changeSet: EMPTY_CHANGE_SET }
  const result = applyProjectTransaction(
    currentDocument(history),
    entry.inverse,
    inverseOptions(entry.transaction, options),
  )
  if (!result.success)
    return { changed: false, history, diagnostics: result.diagnostics, changeSet: EMPTY_CHANGE_SET }
  if (!result.changed)
    return { changed: false, history, diagnostics: [], changeSet: EMPTY_CHANGE_SET }
  const snapshot = createProjectSnapshot(result.document, history.snapshot.editVersion + 1)
  return {
    changed: true,
    diagnostics: [],
    changeSet: {
      project: result.changedProject,
      pageIds: result.changedPageIds,
      nodeIds: result.changedNodeIds,
      nodeChanges: result.changedNodeChanges,
    },
    history: {
      ...history,
      snapshot,
      past: history.past.slice(0, -1),
      future: [entry, ...history.future],
    },
  }
}

function inverseOptions(
  transaction: ProjectTransaction,
  options: ApplyProjectHistoryOptions,
): ApplyProjectHistoryOptions {
  if (!transaction.operations.every(operation => operation.type === 'node.config.remove'))
    return options
  // The forward transaction was accepted only because every operation was a
  // monotonic deletion. Its engine-generated inverse must be able to restore
  // the exact prior snapshot, including the stale Registry data being repaired.
  const { registry: _registry, ...rest } = options
  return rest
}

export function redoProjectHistory(
  history: ProjectHistory,
  options: ApplyProjectHistoryOptions = {},
): ProjectHistoryResult {
  const [entry, ...future] = history.future
  if (!entry)
    return { changed: false, history, diagnostics: [], changeSet: EMPTY_CHANGE_SET }
  const result = applyProjectTransaction(currentDocument(history), entry.transaction, options)
  if (!result.success)
    return { changed: false, history, diagnostics: result.diagnostics, changeSet: EMPTY_CHANGE_SET }
  if (!result.changed)
    return { changed: false, history, diagnostics: [], changeSet: EMPTY_CHANGE_SET }
  const snapshot = createProjectSnapshot(result.document, history.snapshot.editVersion + 1)
  return {
    changed: true,
    diagnostics: [],
    changeSet: {
      project: result.changedProject,
      pageIds: result.changedPageIds,
      nodeIds: result.changedNodeIds,
      nodeChanges: result.changedNodeChanges,
    },
    history: {
      ...history,
      snapshot,
      past: [...history.past, {
        ...entry,
        inverse: result.inverse,
        editVersion: snapshot.editVersion,
        contentHash: snapshot.contentHash,
        timestamp: options.nowMs?.() ?? Date.now(),
      }].slice(-history.limit),
      future,
    },
  }
}

function mergeEntries(
  previous: AppliedProjectTransaction,
  current: AppliedProjectTransaction,
): AppliedProjectTransaction {
  return {
    transaction: {
      ...current.transaction,
      id: `${previous.transaction.id}+${current.transaction.id}`,
      operations: [
        ...structuredClone(previous.transaction.operations),
        ...structuredClone(current.transaction.operations),
      ],
    },
    inverse: {
      ...current.inverse,
      id: `${current.inverse.id}+${previous.inverse.id}`,
      operations: [
        ...structuredClone(current.inverse.operations),
        ...structuredClone(previous.inverse.operations),
      ],
    },
    editVersion: current.editVersion,
    contentHash: current.contentHash,
    timestamp: current.timestamp,
  }
}

function isProjectSnapshot(
  value: ProjectDocument | ProjectSnapshot,
): value is ProjectSnapshot {
  return 'document' in value && 'editVersion' in value && 'contentHash' in value
}

function currentDocument(history: ProjectHistory): ProjectDocument {
  return history.snapshot.document as ProjectDocument
}
