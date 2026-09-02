import type {
  ComponentContractRegistry,
  ModelDiagnostic,
  ProjectChangeSet,
  ProjectCommand,
  ProjectDocument,
  ProjectSnapshot,
} from './contracts'

export interface ProjectDomainSnapshot extends ProjectSnapshot {
  canRedo: boolean
  canUndo: boolean
  /** Opaque history identity used by editor sessions to track saved state. */
  cursor: string
  history: ProjectHistorySummary
  lastError?: ModelDiagnostic
}

export interface ProjectHistoryEntrySummary {
  readonly id: string
  readonly label: string
  readonly editVersion: number
  readonly timestamp: number
}

export interface ProjectHistorySummary {
  /** Chronological entries, including redo entries after `position`. */
  readonly entries: readonly ProjectHistoryEntrySummary[]
  /** Number of retained entries currently applied; zero means the earliest retained state. */
  readonly position: number
  readonly limit: number
}

export interface ProjectDomainDispatchResult {
  changed: boolean
  changeSet: ProjectChangeSet
  diagnostics: ModelDiagnostic[]
  snapshot: ProjectDomainSnapshot
}

export interface ProjectDomainEngineOptions {
  document: ProjectDocument | ProjectSnapshot
  /** Initial local edit version when opening a wire ProjectDocument. */
  editVersion?: number
  historyLimit?: number
  mergeWindowMs?: number
  nowMs?: () => number
  registry?: ComponentContractRegistry
}

export interface ProjectDomainEngine {
  readonly snapshot: ProjectDomainSnapshot
  execute: (command: ProjectCommand) => ProjectDomainDispatchResult
  redo: () => ProjectDomainDispatchResult
  sealHistoryGroup: () => void
  subscribe: (
    listener: (snapshot: ProjectDomainSnapshot, changeSet: ProjectChangeSet) => void,
  ) => () => void
  undo: () => ProjectDomainDispatchResult
}
