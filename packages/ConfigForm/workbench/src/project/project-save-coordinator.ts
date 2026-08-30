import type {
  ModelDiagnostic,
  ProjectRepository,
  ProjectRepositoryPersistence,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'
import { assertProjectDocument, ProjectRepositoryError } from '@moluoxixi/config-form-model'

export interface ProjectSaveCapture {
  cursor: string
  document: ReadonlyProjectDocument
}

export interface ProjectSaveCoordinatorSnapshot {
  createdAt: string
  lastError?: ModelDiagnostic
  persistence: ProjectRepositoryPersistence
  repositoryRevision: number
  savedCursor: string
  saving: boolean
  updatedAt: string
}

export type ProjectSaveCoordinatorResult
  = | {
    success: true
    newerEdits: boolean
    repositoryRevision: number
    snapshot: ProjectSaveCoordinatorSnapshot
  }
  | {
    success: false
    error: ModelDiagnostic
    snapshot: ProjectSaveCoordinatorSnapshot
  }

export interface ProjectSaveCoordinatorOptions {
  createCommitId?: () => string
  projectId: string
  repository: ProjectRepository
  repositoryRevision: number
  savedCursor: string
  createdAt: string
  updatedAt: string
}

export interface ProjectSaveCoordinator {
  readonly snapshot: ProjectSaveCoordinatorSnapshot
  save: (
    capture: ProjectSaveCapture,
    currentCursor: () => string,
  ) => Promise<ProjectSaveCoordinatorResult>
  subscribe: (listener: (snapshot: ProjectSaveCoordinatorSnapshot) => void) => () => void
}

function diagnosticFromError(error: unknown): ModelDiagnostic {
  return {
    code: error instanceof ProjectRepositoryError ? error.code : 'PROJECT_EDITOR_SAVE_FAILED',
    message: error instanceof Error ? error.message : String(error),
  }
}

function createSessionCommitNamespace(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID()

  const values = new Uint32Array(4)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(values)
    return [...values].map(value => value.toString(36)).join('-')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createProjectSaveCoordinator(
  options: ProjectSaveCoordinatorOptions,
): ProjectSaveCoordinator {
  const repository = options.repository
  let savedCursor = options.savedCursor
  let repositoryRevision = options.repositoryRevision
  let createdAt = options.createdAt
  let updatedAt = options.updatedAt
  let saving = false
  let lastError: ModelDiagnostic | undefined
  let saveSequence = 0
  const listeners = new Set<(snapshot: ProjectSaveCoordinatorSnapshot) => void>()
  const commitNamespace = createSessionCommitNamespace()
  const createCommitId = options.createCommitId
    ?? (() => `${options.projectId}:save:${commitNamespace}:${++saveSequence}`)

  function currentSnapshot(): ProjectSaveCoordinatorSnapshot {
    return {
      createdAt,
      ...(lastError ? { lastError } : {}),
      persistence: repository.persistence,
      repositoryRevision,
      savedCursor,
      saving,
      updatedAt,
    }
  }

  function publish(): ProjectSaveCoordinatorSnapshot {
    const snapshot = currentSnapshot()
    listeners.forEach(listener => listener(snapshot))
    return snapshot
  }

  async function save(
    capture: ProjectSaveCapture,
    currentCursor: () => string,
  ): Promise<ProjectSaveCoordinatorResult> {
    if (saving) {
      const error = {
        code: 'PROJECT_EDITOR_SAVE_BUSY',
        message: 'A project save is already in progress.',
      }
      return { success: false, error, snapshot: currentSnapshot() }
    }
    if (capture.cursor === savedCursor) {
      return {
        success: true,
        newerEdits: false,
        repositoryRevision,
        snapshot: currentSnapshot(),
      }
    }

    const commandId = createCommitId().trim()
    if (!commandId) {
      const error = {
        code: 'PROJECT_EDITOR_COMMIT_ID_INVALID',
        message: 'Project save commit id cannot be empty.',
      }
      lastError = error
      return { success: false, error, snapshot: currentSnapshot() }
    }

    const document = assertProjectDocument(capture.document)
    saving = true
    lastError = undefined
    publish()
    try {
      const committed = await repository.commit({
        commandId,
        document,
        expectedRepositoryRevision: repositoryRevision,
        id: document.id,
      })
      repositoryRevision = committed.project.repositoryRevision
      createdAt = committed.project.createdAt
      updatedAt = committed.project.updatedAt
      savedCursor = capture.cursor
      saving = false
      return {
        success: true,
        newerEdits: currentCursor() !== capture.cursor,
        repositoryRevision,
        snapshot: publish(),
      }
    }
    catch (error) {
      lastError = diagnosticFromError(error)
      saving = false
      return { success: false, error: lastError, snapshot: publish() }
    }
  }

  return {
    get snapshot() {
      return currentSnapshot()
    },
    save,
    subscribe(listener) {
      listeners.add(listener)
      listener(currentSnapshot())
      return () => listeners.delete(listener)
    },
  }
}
