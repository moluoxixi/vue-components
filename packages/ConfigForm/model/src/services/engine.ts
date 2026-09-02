import type {
  ApplyProjectHistoryOptions,
  ModelDiagnostic,
  ProjectChangeSet,
  ProjectCommand,
  ProjectDocument,
  ProjectDomainDispatchResult,
  ProjectDomainEngine,
  ProjectDomainEngineOptions,
  ProjectDomainSnapshot,
  ProjectHistory,
  ProjectHistoryEntrySummary,
  ProjectTransaction,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { resolveProjectCommand } from './commands'
import {
  applyProjectHistoryTransaction,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from './history'

const EMPTY_CHANGE_SET: ProjectChangeSet = Object.freeze({
  project: false,
  pageIds: Object.freeze([]),
  nodeIds: Object.freeze([]),
  nodeChanges: Object.freeze([]),
})

export function createProjectDomainEngine(
  options: ProjectDomainEngineOptions,
): ProjectDomainEngine {
  const transactionOptions: ApplyProjectHistoryOptions = {
    ...(options.registry ? { registry: options.registry } : {}),
    ...(options.nowMs ? { nowMs: options.nowMs } : {}),
  }
  let history = createProjectHistory(options.document, {
    ...(options.editVersion === undefined ? {} : { editVersion: options.editVersion }),
    ...(options.historyLimit === undefined ? {} : { limit: options.historyLimit }),
    ...(options.mergeWindowMs === undefined ? {} : { mergeWindowMs: options.mergeWindowMs }),
  })
  let lastError: ModelDiagnostic | undefined
  const commandFingerprints = new Map<string, string>()
  const historyEntrySummaries = new WeakMap<ProjectTransaction, ProjectHistoryEntrySummary>()
  let historyEntrySequence = 0
  const listeners = new Set<(
    snapshot: ProjectDomainSnapshot,
    changeSet: ProjectChangeSet,
  ) => void>()

  function historyCursor(target: ProjectHistory = history): string {
    const current = target.past.at(-1)
    return current
      ? entrySummary(current).id
      : `history-base:${target.snapshot.document.id}:${target.snapshot.contentHash}`
  }

  function entrySummary(entry: ProjectHistory['past'][number]): ProjectHistoryEntrySummary {
    const existing = historyEntrySummaries.get(entry.transaction)
    if (existing)
      return existing
    const summary = Object.freeze({
      editVersion: entry.editVersion,
      id: `local-history-${++historyEntrySequence}`,
      label: entry.transaction.label,
      timestamp: entry.timestamp,
    })
    historyEntrySummaries.set(entry.transaction, summary)
    return summary
  }

  function currentSnapshot(): ProjectDomainSnapshot {
    const retainedEntries = [...history.past, ...history.future]
    const entries = retainedEntries.map(entrySummary)
    return {
      canRedo: history.future.length > 0,
      canUndo: history.past.length > 0,
      contentHash: history.snapshot.contentHash,
      cursor: historyCursor(),
      document: history.snapshot.document,
      editVersion: history.snapshot.editVersion,
      history: Object.freeze({
        entries: Object.freeze(entries),
        limit: history.limit,
        position: history.past.length,
      }),
      ...(lastError ? { lastError } : {}),
    }
  }

  function publish(changeSet: ProjectChangeSet = EMPTY_CHANGE_SET): ProjectDomainSnapshot {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot, changeSet))
    return snapshot
  }

  function unchanged(diagnostics: ModelDiagnostic[] = []): ProjectDomainDispatchResult {
    lastError = diagnostics[0]
    return { changed: false, changeSet: EMPTY_CHANGE_SET, diagnostics, snapshot: currentSnapshot() }
  }

  function acceptHistoryResult(
    result: ReturnType<typeof applyProjectHistoryTransaction>,
  ): ProjectDomainDispatchResult {
    if (!result.changed)
      return unchanged(result.diagnostics)
    history = result.history
    lastError = undefined
    return {
      changed: true,
      changeSet: result.changeSet,
      diagnostics: [],
      snapshot: publish(result.changeSet),
    }
  }

  function replayResult(
    commandId: string,
    fingerprint: string,
  ): ProjectDomainDispatchResult | undefined {
    const previousFingerprint = commandFingerprints.get(commandId)
    if (!commandId || !previousFingerprint)
      return undefined
    if (previousFingerprint === fingerprint)
      return unchanged()
    return unchanged([{
      code: 'PROJECT_COMMAND_ID_REUSED',
      message: `Project command id was reused with a different payload: ${commandId}`,
    }])
  }

  function dispatchResolved(
    transaction: ProjectTransaction,
    fingerprint: string,
  ): ProjectDomainDispatchResult {
    const commandId = transaction.id.trim()
    const replay = replayResult(commandId, fingerprint)
    if (replay)
      return replay
    const result = applyProjectHistoryTransaction(history, transaction, transactionOptions)
    if (commandId && result.diagnostics.length === 0)
      commandFingerprints.set(commandId, fingerprint)
    return acceptHistoryResult(result)
  }

  function execute(command: ProjectCommand): ProjectDomainDispatchResult {
    const commandId = command.id.trim()
    const fingerprint = getConfigFormJsonSemanticHash(command)
    const replay = replayResult(commandId, fingerprint)
    if (replay)
      return replay
    const resolution = resolveProjectCommand(history.snapshot.document as ProjectDocument, command, transactionOptions)
    if (!resolution.success)
      return unchanged(resolution.diagnostics)
    if (resolution.transaction.operations.length === 0) {
      if (commandId)
        commandFingerprints.set(commandId, fingerprint)
      return unchanged()
    }
    return dispatchResolved(resolution.transaction, fingerprint)
  }

  function undo(): ProjectDomainDispatchResult {
    return acceptHistoryResult(undoProjectHistory(history, transactionOptions))
  }

  function redo(): ProjectDomainDispatchResult {
    return acceptHistoryResult(redoProjectHistory(history, transactionOptions))
  }

  function sealHistoryGroup(): void {
    const previous = history.past.at(-1)
    if (!previous?.transaction.mergeKey)
      return
    const transaction = { ...previous.transaction, mergeKey: undefined }
    const summary = historyEntrySummaries.get(previous.transaction)
    if (summary)
      historyEntrySummaries.set(transaction, summary)
    history = {
      ...history,
      past: [
        ...history.past.slice(0, -1),
        {
          ...previous,
          transaction,
        },
      ],
    }
  }

  return {
    get snapshot() {
      return currentSnapshot()
    },
    execute,
    redo,
    sealHistoryGroup,
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot(), EMPTY_CHANGE_SET)
      return () => listeners.delete(listener)
    },
    undo,
  }
}
