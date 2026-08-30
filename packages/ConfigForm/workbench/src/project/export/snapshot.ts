import type {
  CanonicalProjectIdentity,
  ProjectCompilation,
} from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../types'
import type { CanonicalSourceBindingResolver } from './canonical-bindings'
import { assertUniqueProjectPaths, normalizeProjectPath } from '../path'
import { createCanonicalProjectConfigExport } from './config'
import { createCanonicalProjectSourceExport } from './source'

export const CONFIG_FORM_EXPORT_GENERATOR_VERSION = '1.0.0' as const

export interface ExportFileSet {
  readonly entry: ProjectPath
  readonly files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>
}

export interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly config: ExportFileSet
  readonly generatorVersion: string
  readonly source: ExportFileSet
}

export interface BuildExportSnapshotInput {
  compilation: ProjectCompilation
  resolver: CanonicalSourceBindingResolver
  generatorVersion?: string
}

export interface ExportSessionState {
  readonly error?: string
  readonly snapshot?: ExportSnapshot
  readonly stale: boolean
}

export type ExportSessionRefreshResult
  = | { success: true, state: ExportSessionState, snapshot: ExportSnapshot }
    | { success: false, state: ExportSessionState, error: string }

export interface ExportSession {
  readonly state: ExportSessionState
  refresh: () => Promise<ExportSessionRefreshResult>
  subscribe: (listener: (state: ExportSessionState) => void) => () => void
  sync: () => ExportSessionState
}

export interface CreateExportSessionOptions {
  build?: (input: BuildExportSnapshotInput) => ExportSnapshot
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation: () => ProjectCompilation | undefined
}

function cloneSnapshotFile(file: WorkspaceFile): Readonly<WorkspaceFile> {
  return Object.freeze(file.kind === 'text'
    ? { ...file }
    : { ...file, content: Uint8Array.from(file.content) })
}

function createExportFileSet(
  entryInput: ProjectPath,
  sourceFiles: Readonly<Record<ProjectPath, WorkspaceFile>>,
): ExportFileSet {
  const sourcePaths = Object.keys(sourceFiles)
  const paths = assertUniqueProjectPaths(sourcePaths)
  const files = Object.freeze(Object.fromEntries(paths.map((path, index) => [
    path,
    cloneSnapshotFile(sourceFiles[sourcePaths[index]! as ProjectPath]!),
  ])) as Record<ProjectPath, Readonly<WorkspaceFile>>)
  const entry = normalizeProjectPath(entryInput)
  if (!Object.hasOwn(files, entry))
    throw new Error(`[config-form-workbench] export entry "${entry}" does not exist`)
  return Object.freeze({ entry, files })
}

export function buildExportSnapshot(input: BuildExportSnapshotInput): ExportSnapshot {
  const generatorVersion = input.generatorVersion ?? CONFIG_FORM_EXPORT_GENERATOR_VERSION
  if (!generatorVersion.trim())
    throw new Error('[config-form-workbench] export generator version is required')
  const source = createCanonicalProjectSourceExport(input.compilation, input.resolver)
  const config = createCanonicalProjectConfigExport(input.compilation, input.resolver)
  return Object.freeze({
    compilation: input.compilation,
    config: createExportFileSet(config.entry, config.files),
    generatorVersion,
    source: createExportFileSet(source.entry, source.files),
  })
}

export function isSameCompilation(
  left: Pick<CanonicalProjectIdentity, | 'projectId'
  | 'contentHash'
  | 'registryAdapter'
  | 'registryAdapterVersion'
  | 'registryFingerprint'
  | 'compilerVersion'
  | 'environmentHash'
  | 'irHash'>,
  right: CanonicalProjectIdentity,
): boolean {
  return left.projectId === right.projectId
    && left.contentHash === right.contentHash
    && left.registryAdapter === right.registryAdapter
    && left.registryAdapterVersion === right.registryAdapterVersion
    && left.registryFingerprint === right.registryFingerprint
    && left.compilerVersion === right.compilerVersion
    && left.environmentHash === right.environmentHash
    && left.irHash === right.irHash
}

export function isExportSnapshotStale(
  snapshot: ExportSnapshot | undefined,
  current: ProjectCompilation | undefined,
): boolean {
  return !!snapshot && (!current || !isSameCompilation(snapshot.compilation.key, current.key))
}

export function resolveExportSnapshotPath(
  fileSet: ExportFileSet,
  preferred?: ProjectPath,
): ProjectPath | undefined {
  if (preferred && Object.hasOwn(fileSet.files, preferred))
    return preferred
  if (Object.hasOwn(fileSet.files, fileSet.entry))
    return fileSet.entry

  const paths = Object.keys(fileSet.files).sort((left, right) => left.localeCompare(right, 'en')) as ProjectPath[]
  return paths.find(path => fileSet.files[path]?.kind === 'text') ?? paths[0]
}

export function createExportSession(options: CreateExportSessionOptions): ExportSession {
  const build = options.build ?? buildExportSnapshot
  const listeners = new Set<(state: ExportSessionState) => void>()
  let state: ExportSessionState = Object.freeze({ stale: false })

  function publish(next: ExportSessionState): ExportSessionState {
    state = Object.freeze(next)
    listeners.forEach(listener => listener(state))
    return state
  }

  function sync(): ExportSessionState {
    const stale = isExportSnapshotStale(state.snapshot, options.currentCompilation())
    if (stale === state.stale)
      return state
    return publish({ ...state, stale })
  }

  async function refresh(): Promise<ExportSessionRefreshResult> {
    const input = options.capture()
    if (!input) {
      const error = 'No compiled project is available for export.'
      return { success: false, error, state: publish({ ...state, error, stale: !!state.snapshot }) }
    }
    try {
      const snapshot = build(input)
      const next = publish({ snapshot, stale: false })
      return { success: true, snapshot, state: next }
    }
    catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      const next = publish({
        ...(state.snapshot ? { snapshot: state.snapshot } : {}),
        error,
        stale: isExportSnapshotStale(state.snapshot, options.currentCompilation()),
      })
      return { success: false, error, state: next }
    }
  }

  return {
    get state() {
      return state
    },
    refresh,
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    sync,
  }
}
