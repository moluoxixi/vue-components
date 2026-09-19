import type {
  ProjectChangeSet,
  ProjectCommand,
  ProjectDomainDispatchResult,
  ProjectDomainEngine,
  ProjectDomainSnapshot,
  ProjectEmbeddedResourceRead,
  ProjectEmbeddedResourceWrite,
  ProjectSnapshot,
} from '@moluoxixi/config-form-model'
import type {
  ProjectSaveCoordinator,
  ProjectSaveCoordinatorResult,
  ProjectSaveCoordinatorSnapshot,
} from '../persistence'
import type {
  OpenProjectEditorSessionOptions,
  ProjectEditorSession,
  ProjectEditorSessionDispatchResult,
  ProjectEditorSessionExecuteOptions,
  ProjectEditorSessionOptions,
  ProjectEditorSessionSaveOptions,
  ProjectEditorSessionSaveResult,
  ProjectEditorSessionSnapshot,
} from '../types'
import {
  createProjectDomainEngine,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { EMPTY_PROJECT_CHANGE_SET } from '../defaults/editor-session'
import { createProjectSaveCoordinator } from '../persistence'

/** Construct the exact compiler boundary without persistence/session fields. */
export function projectSnapshotFromEditorSession(
  snapshot: ProjectEditorSessionSnapshot,
): ProjectSnapshot {
  return Object.freeze({
    document: snapshot.document,
    editVersion: snapshot.editVersion,
    contentHash: snapshot.contentHash,
  })
}

export function createProjectEditorSession(
  options: ProjectEditorSessionOptions,
): ProjectEditorSession {
  const engine: ProjectDomainEngine = createProjectDomainEngine({
    ...options,
    document: options.project.document,
  })
  let engineSnapshot: ProjectDomainSnapshot = engine.snapshot
  const saveCoordinator: ProjectSaveCoordinator = createProjectSaveCoordinator({
    ...(options.createCommitId ? { createCommitId: options.createCommitId } : {}),
    projectId: engineSnapshot.document.id,
    repository: options.repository,
    repositoryRevision: options.project.repositoryRevision,
    savedContentHash: engineSnapshot.contentHash,
    savedCursor: engineSnapshot.cursor,
    savedEditVersion: engineSnapshot.editVersion,
    createdAt: options.project.createdAt,
    updatedAt: options.project.updatedAt,
  })
  let persistenceSnapshot: ProjectSaveCoordinatorSnapshot = saveCoordinator.snapshot
  const pendingEmbeddedWrites = new Map<string, ProjectEmbeddedResourceWrite>()
  let batchDepth = 0
  let batchedDispatches = 0
  let batchedChangeSet: ProjectChangeSet | undefined
  const listeners = new Set<(
    snapshot: ProjectEditorSessionSnapshot,
    changeSet: ProjectChangeSet,
  ) => void>()

  function currentSnapshot(): ProjectEditorSessionSnapshot {
    return {
      canRedo: engineSnapshot.canRedo,
      canUndo: engineSnapshot.canUndo,
      contentHash: engineSnapshot.contentHash,
      createdAt: persistenceSnapshot.createdAt,
      dirty: engineSnapshot.cursor !== persistenceSnapshot.savedCursor,
      document: engineSnapshot.document,
      editVersion: engineSnapshot.editVersion,
      history: engineSnapshot.history,
      ...(persistenceSnapshot.lastError ?? engineSnapshot.lastError
        ? { lastError: persistenceSnapshot.lastError ?? engineSnapshot.lastError }
        : {}),
      persistence: persistenceSnapshot.persistence,
      repositoryRevision: persistenceSnapshot.repositoryRevision,
      saving: persistenceSnapshot.saving,
      updatedAt: persistenceSnapshot.updatedAt,
    }
  }

  function publish(changeSet: ProjectChangeSet = EMPTY_PROJECT_CHANGE_SET): ProjectEditorSessionSnapshot {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot, changeSet))
    return snapshot
  }

  engine.subscribe((snapshot, changeSet) => {
    engineSnapshot = snapshot
    if (batchDepth > 0) {
      // Defer subscriber fan-out until the batch settles. A single-dispatch
      // batch keeps its precise changeSet; multiple dispatches fall back to
      // the imprecise empty set so compilers invalidate conservatively.
      batchedDispatches += 1
      batchedChangeSet = batchedDispatches === 1 ? changeSet : undefined
      return
    }
    publish(changeSet)
  })
  saveCoordinator.subscribe((snapshot) => {
    persistenceSnapshot = snapshot
    publish()
  })

  function acceptDomainResult(
    result: ProjectDomainDispatchResult,
  ): ProjectEditorSessionDispatchResult {
    engineSnapshot = result.snapshot
    return { ...result, snapshot: currentSnapshot() }
  }

  function batch<T>(work: () => T): T {
    batchDepth += 1
    try {
      return work()
    }
    finally {
      batchDepth -= 1
      if (batchDepth === 0) {
        const dispatched = batchedDispatches
        const changeSet = batchedChangeSet
        batchedDispatches = 0
        batchedChangeSet = undefined
        if (dispatched > 0)
          publish(changeSet)
      }
    }
  }

  function embeddedWriteKey(resourceId: string, contentHash: string): string {
    return `${resourceId}\0${contentHash}`
  }

  function cloneEmbeddedWrites(
    writes: readonly ProjectEmbeddedResourceWrite[],
  ): ProjectEmbeddedResourceWrite[] {
    return writes.map(write => ({
      resourceId: write.resourceId,
      contentHash: write.contentHash,
      bytes: new Uint8Array(write.bytes),
    }))
  }

  function writesForDocument(
    document: ProjectEditorSessionSnapshot['document'],
  ): ProjectEmbeddedResourceWrite[] {
    return cloneEmbeddedWrites([...pendingEmbeddedWrites.values()].filter((write) => {
      const resource = document.resources[write.resourceId]
      return resource?.kind === 'embedded'
        && resource.contentHash === write.contentHash
        && resource.byteLength === write.bytes.byteLength
    }))
  }

  function execute(
    command: ProjectCommand,
    executeOptions: ProjectEditorSessionExecuteOptions = {},
  ): ProjectEditorSessionDispatchResult {
    const embeddedWrites = cloneEmbeddedWrites(executeOptions.embeddedWrites ?? [])
    const result = acceptDomainResult(engine.execute(command))
    if (result.changed) {
      embeddedWrites.forEach((write) => {
        const resource = result.snapshot.document.resources[write.resourceId]
        if (resource?.kind !== 'embedded'
          || resource.contentHash !== write.contentHash
          || resource.byteLength !== write.bytes.byteLength) {
          throw new TypeError(`Embedded Resource write does not match the command result: ${write.resourceId}`)
        }
        pendingEmbeddedWrites.set(
          embeddedWriteKey(write.resourceId, write.contentHash),
          write,
        )
      })
    }
    return result
  }

  function undo(): ProjectEditorSessionDispatchResult {
    return acceptDomainResult(engine.undo())
  }

  function redo(): ProjectEditorSessionDispatchResult {
    return acceptDomainResult(engine.redo())
  }

  function sessionSaveResult(
    result: ProjectSaveCoordinatorResult,
  ): ProjectEditorSessionSaveResult {
    persistenceSnapshot = result.snapshot
    return result.success
      ? { ...result, snapshot: currentSnapshot() }
      : { ...result, snapshot: currentSnapshot() }
  }

  async function save(saveOptions: ProjectEditorSessionSaveOptions): Promise<ProjectEditorSessionSaveResult> {
    if (saveOptions.sealHistoryGroup) {
      engine.sealHistoryGroup()
      engineSnapshot = engine.snapshot
    }
    const embeddedWrites = writesForDocument(engineSnapshot.document)
    const result = sessionSaveResult(await saveCoordinator.save({
      contentHash: engineSnapshot.contentHash,
      cursor: engineSnapshot.cursor,
      document: engineSnapshot.document,
      embeddedWrites,
      editVersion: engineSnapshot.editVersion,
    }, {
      source: saveOptions.source,
      ...(saveOptions.label ? { label: saveOptions.label } : {}),
    }, () => ({
      contentHash: engine.snapshot.contentHash,
      cursor: engine.snapshot.cursor,
      editVersion: engine.snapshot.editVersion,
    })))
    if (result.success) {
      embeddedWrites.forEach((write) => {
        pendingEmbeddedWrites.delete(embeddedWriteKey(write.resourceId, write.contentHash))
      })
    }
    return result
  }

  async function readEmbedded(
    input: ProjectEmbeddedResourceRead,
  ): Promise<Uint8Array | undefined> {
    if (input.projectId !== engineSnapshot.document.id)
      return undefined
    const pending = pendingEmbeddedWrites.get(embeddedWriteKey(input.resourceId, input.contentHash))
    return pending
      ? new Uint8Array(pending.bytes)
      : await options.repository.readEmbedded(input)
  }

  return {
    get snapshot() {
      return currentSnapshot()
    },
    batch,
    execute,
    readEmbedded,
    redo,
    save,
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot(), EMPTY_PROJECT_CHANGE_SET)
      return () => listeners.delete(listener)
    },
    undo,
  }
}

export async function openProjectEditorSession(
  options: OpenProjectEditorSessionOptions,
): Promise<ProjectEditorSession> {
  const project = await options.repository.get(options.projectId)
  if (!project) {
    throw new ProjectRepositoryError(
      'PROJECT_REPOSITORY_NOT_FOUND',
      `Project does not exist: ${options.projectId}`,
    )
  }
  const { projectId: _projectId, ...sessionOptions } = options
  return createProjectEditorSession({ ...sessionOptions, project })
}
