import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSaveResult,
} from '../../types'
import type {
  ProjectCoordinationChannel,
  ProjectCoordinationRevisionMessage,
} from './coordination'
import type { ProjectRecoveryDraftStore } from './recovery'

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

export interface EditIdentity {
  contentHash: string
  editVersion: number
}
