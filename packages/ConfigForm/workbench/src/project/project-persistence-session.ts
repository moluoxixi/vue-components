import type {
  ModelDiagnostic,
  ProjectChangeSet,
} from '@moluoxixi/config-form-model'
import type {
  ProjectCoordinationChannel,
  ProjectCoordinationRevisionMessage,
} from './project-coordination-channel'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSaveResult,
  ProjectEditorSessionSnapshot,
} from './project-editor-session'
import type {
  ProjectRecoveryDraftCapture,
  ProjectRecoveryDraftStore,
} from './project-recovery-draft-store'

const EMPTY_CHANGE_SET: ProjectChangeSet = Object.freeze({
  project: false,
  pageIds: Object.freeze([]),
  nodeIds: Object.freeze([]),
  nodeChanges: Object.freeze([]),
})

export const DEFAULT_PROJECT_PERSISTENCE_POLICY: Readonly<ProjectPersistencePolicy> = Object.freeze({
  autosaveIdleMs: 800,
  autosaveMaxWaitMs: 5_000,
  draftIdleMs: 250,
  draftMaxWaitMs: 1_000,
})

export interface ProjectPersistencePolicy {
  autosaveIdleMs: number
  autosaveMaxWaitMs: number
  draftIdleMs: number
  draftMaxWaitMs: number
}

export interface ProjectPersistenceClock {
  clearTimeout: (timer: unknown) => void
  now: () => number
  setTimeout: (callback: () => void, delayMs: number) => unknown
}

export type ProjectPersistenceStatus
  = | 'conflict'
    | 'failed'
    | 'pending'
    | 'saved'
    | 'saving'
    | 'volatile'

export type ProjectDraftCoverage = 'durable' | 'failed' | 'none' | 'pending'

export interface ProjectPersistenceSnapshot {
  beforeUnloadRequired: boolean
  draftCoverage: ProjectDraftCoverage
  externalRepositoryRevision?: number
  lastError?: ModelDiagnostic
  repositoryRevision: number
  status: ProjectPersistenceStatus
}

export interface ProjectPersistenceSessionOptions {
  clock?: ProjectPersistenceClock
  coordination?: ProjectCoordinationChannel
  draftStore: ProjectRecoveryDraftStore
  editor: ProjectEditorSession
  onExternalRevision?: (
    resolution: 'conflict' | 'ignored' | 'reload',
    message: ProjectCoordinationRevisionMessage,
  ) => void | Promise<void>
  policy?: Partial<ProjectPersistencePolicy>
  sessionId?: string
}

export interface ProjectPersistenceSession {
  readonly draftId: string
  readonly snapshot: ProjectPersistenceSnapshot
  createNamedCheckpoint: (label: string) => Promise<ProjectEditorSessionSaveResult | undefined>
  dispose: () => Promise<void>
  flush: () => Promise<ProjectEditorSessionSaveResult | undefined>
  handleVisibilityHidden: () => Promise<void>
  notifyExternalRevision: (revision: number) => Promise<'conflict' | 'ignored' | 'reload'>
  querySessionPresence: (sessionId: string) => Promise<'active' | 'inactive' | 'unknown'>
  subscribe: (listener: (snapshot: ProjectPersistenceSnapshot) => void) => () => void
}

interface EditIdentity {
  contentHash: string
  editVersion: number
}

function defaultClock(): ProjectPersistenceClock {
  return {
    clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  }
}

function createSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function assertPolicy(input: Partial<ProjectPersistencePolicy>): ProjectPersistencePolicy {
  const policy = { ...DEFAULT_PROJECT_PERSISTENCE_POLICY, ...input }
  Object.entries(policy).forEach(([key, value]) => {
    if (!Number.isFinite(value) || value < 0)
      throw new RangeError(`Project persistence policy ${key} must be a non-negative number.`)
  })
  if (policy.autosaveMaxWaitMs < policy.autosaveIdleMs
    || policy.draftMaxWaitMs < policy.draftIdleMs) {
    throw new RangeError('Project persistence max wait must be greater than or equal to idle delay.')
  }
  return policy
}

function sameIdentity(left: EditIdentity | undefined, right: EditIdentity): boolean {
  return !!left
    && left.contentHash === right.contentHash
    && left.editVersion === right.editVersion
}

function identityFromSnapshot(snapshot: ProjectEditorSessionSnapshot): EditIdentity {
  return { contentHash: snapshot.contentHash, editVersion: snapshot.editVersion }
}

function mergeChangeSets(left: ProjectChangeSet, right: ProjectChangeSet): ProjectChangeSet {
  return Object.freeze({
    project: left.project || right.project,
    pageIds: Object.freeze([...new Set([...left.pageIds, ...right.pageIds])]),
    nodeIds: Object.freeze([...new Set([...left.nodeIds, ...right.nodeIds])]),
    nodeChanges: Object.freeze([...left.nodeChanges, ...right.nodeChanges]),
  })
}

function persistenceDiagnostic(error: unknown, fallbackCode: string): ModelDiagnostic {
  let current: unknown = error
  while (current instanceof Error) {
    const name = current instanceof DOMException ? current.name : ''
    if (name === 'QuotaExceededError')
      return { code: 'PROJECT_PERSISTENCE_QUOTA_EXCEEDED', message: current.message }
    if (name === 'AbortError')
      return { code: 'PROJECT_PERSISTENCE_TRANSACTION_ABORTED', message: current.message }
    current = current.cause
  }
  return {
    code: fallbackCode,
    message: error instanceof Error ? error.message : String(error),
  }
}

export function createProjectPersistenceSession(
  options: ProjectPersistenceSessionOptions,
): ProjectPersistenceSession {
  const editor = options.editor
  const draftStore = options.draftStore
  const clock = options.clock ?? defaultClock()
  const policy = assertPolicy(options.policy ?? {})
  const sessionId = options.sessionId?.trim() || createSessionId()
  const projectId = editor.snapshot.document.id
  const draftId = `${projectId}:${sessionId}`
  const listeners = new Set<(snapshot: ProjectPersistenceSnapshot) => void>()
  let status: ProjectPersistenceStatus = editor.snapshot.persistence === 'volatile' ? 'volatile' : 'saved'
  let draftCoverage: ProjectDraftCoverage = 'none'
  let durableDraftIdentity: EditIdentity | undefined
  let lastError: ModelDiagnostic | undefined
  let externalRepositoryRevision: number | undefined
  let autosaveIdleTimer: unknown
  let autosaveMaxTimer: unknown
  let draftIdleTimer: unknown
  let draftMaxTimer: unknown
  let stopping = false
  let conflict = false
  let lastObservedIdentity = identityFromSnapshot(editor.snapshot)
  let pendingChangeSet = EMPTY_CHANGE_SET
  let editSequence = 0
  let lastPublishedRevision = editor.snapshot.repositoryRevision
  let saveQueue: Promise<ProjectEditorSessionSaveResult | undefined> = Promise.resolve(undefined)
  let draftQueue: Promise<void> = Promise.resolve()

  function currentSnapshot(): ProjectPersistenceSnapshot {
    const editorSnapshot = editor.snapshot
    const covered = sameIdentity(durableDraftIdentity, identityFromSnapshot(editorSnapshot))
    return {
      beforeUnloadRequired: editorSnapshot.dirty && !covered,
      draftCoverage: covered ? 'durable' : draftCoverage,
      ...(externalRepositoryRevision !== undefined ? { externalRepositoryRevision } : {}),
      ...(lastError ? { lastError } : {}),
      repositoryRevision: editorSnapshot.repositoryRevision,
      status,
    }
  }

  function publish(): void {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot))
  }

  function clearTimer(timer: unknown): undefined {
    if (timer !== undefined)
      clock.clearTimeout(timer)
    return undefined
  }

  function clearAutosaveTimers(): void {
    autosaveIdleTimer = clearTimer(autosaveIdleTimer)
    autosaveMaxTimer = clearTimer(autosaveMaxTimer)
  }

  function clearDraftTimers(): void {
    draftIdleTimer = clearTimer(draftIdleTimer)
    draftMaxTimer = clearTimer(draftMaxTimer)
  }

  function draftCapture(): ProjectRecoveryDraftCapture {
    const snapshot = editor.snapshot
    return {
      baseRepositoryRevision: snapshot.repositoryRevision,
      changeSet: pendingChangeSet,
      contentHash: snapshot.contentHash,
      document: snapshot.document,
      draftId,
      editVersion: snapshot.editVersion,
      projectId,
      registryLock: snapshot.document.registryLock,
      sessionId,
    }
  }

  function writeDraft(): Promise<void> {
    clearDraftTimers()
    if (draftStore.persistence !== 'durable' || !editor.snapshot.dirty || (conflict && stopping))
      return draftQueue
    const capture = draftCapture()
    const sequence = editSequence
    draftCoverage = 'pending'
    publish()
    const write = draftQueue.then(async () => {
      try {
        await draftStore.put(capture)
        durableDraftIdentity = { contentHash: capture.contentHash, editVersion: capture.editVersion }
        if (editSequence === sequence)
          pendingChangeSet = EMPTY_CHANGE_SET
        draftCoverage = sameIdentity(durableDraftIdentity, identityFromSnapshot(editor.snapshot))
          ? 'durable'
          : 'pending'
        lastError = undefined
      }
      catch (error) {
        draftCoverage = 'failed'
        lastError = persistenceDiagnostic(error, 'PROJECT_RECOVERY_DRAFT_WRITE_FAILED')
      }
      publish()
    })
    draftQueue = write.catch(() => {})
    return write
  }

  function scheduleDraft(): void {
    if (stopping || conflict || draftStore.persistence !== 'durable')
      return
    draftCoverage = 'pending'
    draftIdleTimer = clearTimer(draftIdleTimer)
    draftIdleTimer = clock.setTimeout(() => void writeDraft(), policy.draftIdleMs)
    if (draftMaxTimer === undefined)
      draftMaxTimer = clock.setTimeout(() => void writeDraft(), policy.draftMaxWaitMs)
  }

  async function afterSave(result: ProjectEditorSessionSaveResult): Promise<void> {
    if (!result.success) {
      status = result.error.code === 'PROJECT_REVISION_CONFLICT' ? 'conflict' : 'failed'
      conflict = result.error.code === 'PROJECT_REVISION_CONFLICT'
      lastError = result.error
      await writeDraft()
      publish()
      return
    }
    lastError = undefined
    if (result.repositoryRevision > lastPublishedRevision) {
      lastPublishedRevision = result.repositoryRevision
      options.coordination?.publishRevision(result.repositoryRevision)
    }
    if (!editor.snapshot.dirty) {
      await draftQueue
      await draftStore.delete(draftId).catch((error) => {
        lastError = persistenceDiagnostic(error, 'PROJECT_RECOVERY_DRAFT_DELETE_FAILED')
      })
      durableDraftIdentity = undefined
      draftCoverage = 'none'
      pendingChangeSet = EMPTY_CHANGE_SET
      status = editor.snapshot.persistence === 'volatile' ? 'volatile' : 'saved'
    }
    else {
      status = 'pending'
      await writeDraft()
      scheduleAutosave()
    }
    publish()
  }

  function enqueueSave(
    saveOptions: { label?: string, sealHistoryGroup: boolean, source: 'autosave' | 'manual' },
  ): Promise<ProjectEditorSessionSaveResult | undefined> {
    const next = saveQueue.then(async () => {
      if (stopping || conflict)
        return undefined
      clearAutosaveTimers()
      status = 'saving'
      lastError = undefined
      publish()
      const result = await editor.save(saveOptions)
      await afterSave(result)
      return result
    })
    saveQueue = next.catch((error) => {
      status = 'failed'
      lastError = persistenceDiagnostic(error, 'PROJECT_AUTOSAVE_FAILED')
      publish()
      return undefined
    })
    return next
  }

  function runAutosave(): void {
    clearAutosaveTimers()
    if (stopping || conflict || !editor.snapshot.dirty)
      return
    void enqueueSave({ source: 'autosave', sealHistoryGroup: false })
  }

  function scheduleAutosave(): void {
    if (stopping || conflict)
      return
    status = 'pending'
    autosaveIdleTimer = clearTimer(autosaveIdleTimer)
    autosaveIdleTimer = clock.setTimeout(runAutosave, policy.autosaveIdleMs)
    if (autosaveMaxTimer === undefined)
      autosaveMaxTimer = clock.setTimeout(runAutosave, policy.autosaveMaxWaitMs)
    publish()
  }

  const unsubscribe = editor.subscribe((snapshot, changeSet) => {
    const identity = identityFromSnapshot(snapshot)
    if (sameIdentity(lastObservedIdentity, identity))
      return
    lastObservedIdentity = identity
    editSequence += 1
    pendingChangeSet = mergeChangeSets(pendingChangeSet, changeSet)
    durableDraftIdentity = sameIdentity(durableDraftIdentity, identity)
      ? durableDraftIdentity
      : undefined
    scheduleDraft()
    scheduleAutosave()
  })
  let unsubscribeCoordination = () => {}

  async function flush(): Promise<ProjectEditorSessionSaveResult | undefined> {
    if (conflict)
      return undefined
    return await enqueueSave({ source: 'manual', sealHistoryGroup: true })
  }

  async function createNamedCheckpoint(
    label: string,
  ): Promise<ProjectEditorSessionSaveResult | undefined> {
    if (conflict)
      return undefined
    return await enqueueSave({ source: 'manual', label, sealHistoryGroup: true })
  }

  async function handleVisibilityHidden(): Promise<void> {
    if (editor.snapshot.dirty)
      await writeDraft()
  }

  async function notifyExternalRevision(
    revision: number,
  ): Promise<'conflict' | 'ignored' | 'reload'> {
    if (!Number.isInteger(revision) || revision <= editor.snapshot.repositoryRevision)
      return 'ignored'
    externalRepositoryRevision = revision
    if (!editor.snapshot.dirty) {
      publish()
      return 'reload'
    }
    conflict = true
    status = 'conflict'
    clearAutosaveTimers()
    await writeDraft()
    publish()
    return 'conflict'
  }

  async function dispose(): Promise<void> {
    if (stopping)
      return
    clearAutosaveTimers()
    clearDraftTimers()
    unsubscribe()
    unsubscribeCoordination()
    if (editor.snapshot.dirty && draftStore.persistence === 'durable')
      await writeDraft()
    stopping = true
    await Promise.allSettled([saveQueue, draftQueue])
    draftStore.close()
    options.coordination?.close()
  }

  unsubscribeCoordination = options.coordination?.subscribeRevision((message) => {
    void notifyExternalRevision(message.repositoryRevision).then(resolution =>
      options.onExternalRevision?.(resolution, message))
  }) ?? (() => {})

  return {
    draftId,
    get snapshot() {
      return currentSnapshot()
    },
    createNamedCheckpoint,
    dispose,
    flush,
    handleVisibilityHidden,
    notifyExternalRevision,
    querySessionPresence(sessionId) {
      return options.coordination?.queryPresence(sessionId) ?? Promise.resolve('unknown')
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot())
      return () => listeners.delete(listener)
    },
  }
}
