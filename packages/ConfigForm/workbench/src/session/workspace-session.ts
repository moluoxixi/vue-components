import type {
  LowCodeComponentRegistry,
  ModelDiagnostic,
  ModelOperation,
  ModelOperationOptions,
} from '@moluoxixi/config-form-designer'
import type {
  WorkspaceApplication,
  WorkspaceApplicationOperation,
  WorkspacePage,
} from '../project/application'
import type { WorkspaceApplicationRepository } from '../project/application-repository'
import { applyModelOperation } from '@moluoxixi/config-form-designer'
import {
  applyWorkspaceApplicationOperation,
  cloneWorkspaceApplication,
  parseWorkspaceApplication,
} from '../project/application'
import { WorkspaceProjectError } from '../project/errors'

export type WorkspaceOperation
  = | {
    type: 'page.model'
    pageId: string
    operation: ModelOperation
  }
  | {
    type: 'application'
    operation: WorkspaceApplicationOperation
  }

export interface WorkspaceTransaction {
  id: string
  label: string
  operations: WorkspaceOperation[]
  mergeKey?: string
}

export interface WorkspaceSessionSnapshot {
  application: WorkspaceApplication
  applicationRevision: number
  canRedo: boolean
  canUndo: boolean
  currentPage: WorkspacePage
  currentPageId: string
  dirty: boolean
  lastError?: WorkspaceSessionDiagnostic
  modelRevision: number
  persistence: WorkspaceApplicationRepository['persistence']
  saving: boolean
}

export interface WorkspaceSessionDiagnostic extends ModelDiagnostic {
  operationIndex?: number
}

export interface WorkspaceDispatchResult {
  changed: boolean
  diagnostics: WorkspaceSessionDiagnostic[]
  snapshot: WorkspaceSessionSnapshot
}

export type WorkspaceSaveResult
  = | {
    success: true
    newerEdits: boolean
    revision: number
    snapshot: WorkspaceSessionSnapshot
  }
  | {
    success: false
    error: WorkspaceSessionDiagnostic
    snapshot: WorkspaceSessionSnapshot
  }

export interface WorkspaceSessionOptions {
  application: WorkspaceApplication
  currentPageId?: string
  historyLimit?: number
  mergeWindowMs?: number
  modelOperationOptions?: ModelOperationOptions
  modelRevision?: number
  now?: () => number
  registry: LowCodeComponentRegistry
  repository: WorkspaceApplicationRepository
}

interface WorkspaceStateCapture {
  application: WorkspaceApplication
  currentPageId: string
}

interface WorkspaceHistoryEntry {
  after: WorkspaceStateCapture
  before: WorkspaceStateCapture
  timestamp: number
  transaction: WorkspaceTransaction
}

export interface WorkspaceSession {
  readonly snapshot: WorkspaceSessionSnapshot
  dispatch: (transaction: WorkspaceTransaction) => WorkspaceDispatchResult
  redo: () => WorkspaceDispatchResult
  save: () => Promise<WorkspaceSaveResult>
  setCurrentPage: (pageId: string) => WorkspaceDispatchResult
  subscribe: (listener: (snapshot: WorkspaceSessionSnapshot) => void) => () => void
  undo: () => WorkspaceDispatchResult
}

function workspaceContentFingerprint(application: WorkspaceApplication): string {
  const comparable = cloneWorkspaceApplication(application)
  comparable.revision = 0
  comparable.updatedAt = ''
  return JSON.stringify(comparable)
}

function diagnosticFromError(error: unknown, operationIndex?: number): WorkspaceSessionDiagnostic {
  return {
    code: error instanceof WorkspaceProjectError ? error.code : 'WORKSPACE_TRANSACTION_FAILED',
    message: error instanceof Error ? error.message : String(error),
    ...(operationIndex === undefined ? {} : { operationIndex }),
  }
}

function invalidTransaction(message: string): WorkspaceSessionDiagnostic {
  return { code: 'WORKSPACE_TRANSACTION_INVALID', message }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1)
    throw new RangeError(`${label} must be a positive integer`)
}

function resolveCurrentPage(application: WorkspaceApplication, preferredId?: string): WorkspacePage {
  const page = application.pages.find(item => item.id === preferredId)
    ?? application.pages.find(item => item.id === application.homePageId)
    ?? application.pages[0]
  if (!page)
    throw new WorkspaceProjectError('PROJECT_INVALID', '[config-form-workbench] workspace session requires a page')
  return page
}

function cloneTransaction(transaction: WorkspaceTransaction): WorkspaceTransaction {
  return structuredClone(transaction)
}

export function createWorkspaceSession(options: WorkspaceSessionOptions): WorkspaceSession {
  const historyLimit = options.historyLimit ?? 100
  const mergeWindowMs = options.mergeWindowMs ?? 750
  assertPositiveInteger(historyLimit, 'Workspace history limit')
  if (!Number.isFinite(mergeWindowMs) || mergeWindowMs < 0)
    throw new RangeError('Workspace merge window must be a non-negative number')

  const now = options.now ?? Date.now
  const repository = options.repository
  const registry = options.registry
  const modelOperationOptions = options.modelOperationOptions ?? {}
  let application = parseWorkspaceApplication(options.application)
  let currentPageId = resolveCurrentPage(application, options.currentPageId).id
  let modelRevision = options.modelRevision ?? application.revision
  let savedFingerprint = workspaceContentFingerprint(application)
  let saving = false
  let lastError: WorkspaceSessionDiagnostic | undefined
  let past: WorkspaceHistoryEntry[] = []
  let future: WorkspaceHistoryEntry[] = []
  const listeners = new Set<(snapshot: WorkspaceSessionSnapshot) => void>()

  function currentSnapshot(): WorkspaceSessionSnapshot {
    const clonedApplication = cloneWorkspaceApplication(application)
    const currentPage = resolveCurrentPage(clonedApplication, currentPageId)
    return {
      application: clonedApplication,
      applicationRevision: application.revision,
      canRedo: future.length > 0,
      canUndo: past.length > 0,
      currentPage,
      currentPageId: currentPage.id,
      dirty: workspaceContentFingerprint(application) !== savedFingerprint,
      ...(lastError ? { lastError: { ...lastError } } : {}),
      modelRevision,
      persistence: repository.persistence,
      saving,
    }
  }

  function publish(): WorkspaceSessionSnapshot {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot))
    return snapshot
  }

  function unchanged(diagnostics: WorkspaceSessionDiagnostic[] = []): WorkspaceDispatchResult {
    if (diagnostics.length > 0)
      lastError = diagnostics[0]
    return { changed: false, diagnostics, snapshot: currentSnapshot() }
  }

  function capture(): WorkspaceStateCapture {
    return { application: cloneWorkspaceApplication(application), currentPageId }
  }

  function restore(state: WorkspaceStateCapture): void {
    const repositoryRevision = application.revision
    const repositoryUpdatedAt = application.updatedAt
    application = cloneWorkspaceApplication(state.application)
    application.revision = repositoryRevision
    application.updatedAt = repositoryUpdatedAt
    currentPageId = resolveCurrentPage(application, state.currentPageId).id
  }

  function dispatch(transaction: WorkspaceTransaction): WorkspaceDispatchResult {
    const invalid = !transaction.id.trim()
      ? invalidTransaction('Workspace transaction id is required.')
      : !transaction.label.trim()
          ? invalidTransaction('Workspace transaction label is required.')
          : transaction.operations.length === 0
            ? invalidTransaction('Workspace transaction must contain at least one operation.')
            : undefined
    if (invalid)
      return unchanged([invalid])

    const before = capture()
    let candidate = cloneWorkspaceApplication(application)
    let candidatePageId = currentPageId

    for (const [operationIndex, operation] of transaction.operations.entries()) {
      try {
        if (operation.type === 'page.model') {
          const page = candidate.pages.find(item => item.id === operation.pageId)
          if (!page) {
            throw new WorkspaceProjectError(
              'PROJECT_INVALID',
              `[config-form-workbench] page "${operation.pageId}" does not exist`,
            )
          }
          const result = applyModelOperation(page.model, operation.operation, registry, modelOperationOptions)
          if (!result.success) {
            return unchanged(result.diagnostics.map(diagnostic => ({
              ...diagnostic,
              operationIndex,
            })))
          }
          candidate = applyWorkspaceApplicationOperation(candidate, {
            type: 'update-page-model',
            pageId: operation.pageId,
            model: result.model,
          })
        }
        else {
          candidate = applyWorkspaceApplicationOperation(candidate, operation.operation)
        }
        candidatePageId = resolveCurrentPage(candidate, candidatePageId).id
      }
      catch (error) {
        return unchanged([diagnosticFromError(error, operationIndex)])
      }
    }

    if (workspaceContentFingerprint(candidate) === workspaceContentFingerprint(application))
      return unchanged()

    application = candidate
    currentPageId = candidatePageId
    modelRevision += 1
    lastError = undefined
    const timestamp = now()
    const after = capture()
    const previous = past.at(-1)
    if (
      transaction.mergeKey
      && previous?.transaction.mergeKey === transaction.mergeKey
      && timestamp - previous.timestamp <= mergeWindowMs
    ) {
      previous.after = after
      previous.timestamp = timestamp
      previous.transaction = {
        ...cloneTransaction(transaction),
        operations: [
          ...previous.transaction.operations,
          ...cloneTransaction(transaction).operations,
        ],
      }
    }
    else {
      past = [...past, {
        after,
        before,
        timestamp,
        transaction: cloneTransaction(transaction),
      }].slice(-historyLimit)
    }
    future = []
    return { changed: true, diagnostics: [], snapshot: publish() }
  }

  function undo(): WorkspaceDispatchResult {
    const entry = past.at(-1)
    if (!entry)
      return unchanged()
    past = past.slice(0, -1)
    future = [...future, entry]
    restore(entry.before)
    modelRevision += 1
    lastError = undefined
    return { changed: true, diagnostics: [], snapshot: publish() }
  }

  function redo(): WorkspaceDispatchResult {
    const entry = future.at(-1)
    if (!entry)
      return unchanged()
    future = future.slice(0, -1)
    past = [...past, entry].slice(-historyLimit)
    restore(entry.after)
    modelRevision += 1
    lastError = undefined
    return { changed: true, diagnostics: [], snapshot: publish() }
  }

  function setCurrentPage(pageId: string): WorkspaceDispatchResult {
    const page = application.pages.find(item => item.id === pageId)
    if (!page) {
      return unchanged([{
        code: 'WORKSPACE_PAGE_UNKNOWN',
        message: `Page not found: ${pageId}`,
      }])
    }
    if (currentPageId === page.id)
      return unchanged()
    currentPageId = page.id
    lastError = undefined
    return { changed: true, diagnostics: [], snapshot: publish() }
  }

  function syncRepositoryMetadata(target: WorkspaceApplication, committed: WorkspaceApplication): WorkspaceApplication {
    return {
      ...cloneWorkspaceApplication(target),
      createdAt: committed.createdAt,
      revision: committed.revision,
      updatedAt: committed.updatedAt,
    }
  }

  async function save(): Promise<WorkspaceSaveResult> {
    if (saving) {
      const error = { code: 'WORKSPACE_SAVE_BUSY', message: 'A workspace save is already in progress.' }
      return { success: false, error, snapshot: currentSnapshot() }
    }
    saving = true
    lastError = undefined
    publish()
    const capturedApplication = cloneWorkspaceApplication(application)
    const capturedFingerprint = workspaceContentFingerprint(capturedApplication)
    try {
      const committed = await repository.commit(
        capturedApplication.id,
        capturedApplication.revision,
        capturedApplication,
      )
      const newerEdits = workspaceContentFingerprint(application) !== capturedFingerprint
      application = syncRepositoryMetadata(newerEdits ? application : committed, committed)
      savedFingerprint = workspaceContentFingerprint(committed)
      const lastEntry = past.at(-1)
      if (lastEntry?.transaction.mergeKey) {
        lastEntry.transaction = { ...lastEntry.transaction, mergeKey: undefined }
      }
      saving = false
      return {
        success: true,
        newerEdits,
        revision: committed.revision,
        snapshot: publish(),
      }
    }
    catch (cause) {
      const error = diagnosticFromError(cause)
      lastError = error
      saving = false
      return { success: false, error, snapshot: publish() }
    }
  }

  return {
    get snapshot() {
      return currentSnapshot()
    },
    dispatch,
    redo,
    save,
    setCurrentPage,
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot())
      return () => listeners.delete(listener)
    },
    undo,
  }
}
