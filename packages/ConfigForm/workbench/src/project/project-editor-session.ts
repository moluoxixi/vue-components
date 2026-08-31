import type {
  ModelDiagnostic,
  PersistedProjectEnvelope,
  ProjectChangeSet,
  ProjectCommand,
  ProjectDomainDispatchResult,
  ProjectDomainEngine,
  ProjectDomainEngineOptions,
  ProjectDomainSnapshot,
  ProjectRepository,
  ProjectRepositoryPersistence,
  ProjectSnapshot,
} from '@moluoxixi/config-form-model'
import type {
  ProjectSaveCoordinator,
  ProjectSaveCoordinatorResult,
  ProjectSaveCoordinatorSnapshot,
  ProjectSavedIdentity,
} from './project-save-coordinator'
import {
  createProjectDomainEngine,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { createProjectSaveCoordinator } from './project-save-coordinator'

const EMPTY_CHANGE_SET: ProjectChangeSet = Object.freeze({
  project: false,
  pageIds: Object.freeze([]),
  nodeIds: Object.freeze([]),
  nodeChanges: Object.freeze([]),
})

export interface ProjectEditorSessionSnapshot extends ProjectSnapshot {
  canRedo: boolean
  canUndo: boolean
  createdAt: string
  dirty: boolean
  history: ProjectDomainSnapshot['history']
  lastError?: ModelDiagnostic
  persistence: ProjectRepositoryPersistence
  repositoryRevision: number
  saving: boolean
  updatedAt: string
}

export interface ProjectEditorSessionDispatchResult {
  changed: boolean
  changeSet: ProjectChangeSet
  diagnostics: ModelDiagnostic[]
  snapshot: ProjectEditorSessionSnapshot
}

export type ProjectEditorSessionSaveResult
  = | {
    success: true
    newerEdits: boolean
    repositoryRevision: number
    savedIdentity: ProjectSavedIdentity
    snapshot: ProjectEditorSessionSnapshot
  }
  | {
    success: false
    error: ModelDiagnostic
    snapshot: ProjectEditorSessionSnapshot
  }

export interface ProjectEditorSessionOptions extends Omit<ProjectDomainEngineOptions, 'document'> {
  createCommitId?: () => string
  project: PersistedProjectEnvelope
  repository: ProjectRepository
}

export interface OpenProjectEditorSessionOptions
  extends Omit<ProjectEditorSessionOptions, 'project'> {
  projectId: string
}

export interface ProjectEditorSession {
  readonly snapshot: ProjectEditorSessionSnapshot
  execute: (command: ProjectCommand) => ProjectEditorSessionDispatchResult
  redo: () => ProjectEditorSessionDispatchResult
  save: (options: ProjectEditorSessionSaveOptions) => Promise<ProjectEditorSessionSaveResult>
  subscribe: (
    listener: (snapshot: ProjectEditorSessionSnapshot, changeSet: ProjectChangeSet) => void,
  ) => () => void
  undo: () => ProjectEditorSessionDispatchResult
}

export interface ProjectEditorSessionSaveOptions {
  label?: string
  sealHistoryGroup: boolean
  source: 'autosave' | 'manual'
}

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

  function publish(changeSet: ProjectChangeSet = EMPTY_CHANGE_SET): ProjectEditorSessionSnapshot {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot, changeSet))
    return snapshot
  }

  engine.subscribe((snapshot, changeSet) => {
    engineSnapshot = snapshot
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

  function execute(command: ProjectCommand): ProjectEditorSessionDispatchResult {
    return acceptDomainResult(engine.execute(command))
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
    return sessionSaveResult(await saveCoordinator.save({
      contentHash: engineSnapshot.contentHash,
      cursor: engineSnapshot.cursor,
      document: engineSnapshot.document,
      editVersion: engineSnapshot.editVersion,
    }, {
      source: saveOptions.source,
      ...(saveOptions.label ? { label: saveOptions.label } : {}),
    }, () => ({
      contentHash: engine.snapshot.contentHash,
      cursor: engine.snapshot.cursor,
      editVersion: engine.snapshot.editVersion,
    })))
  }

  return {
    get snapshot() {
      return currentSnapshot()
    },
    execute,
    redo,
    save,
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot(), EMPTY_CHANGE_SET)
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
