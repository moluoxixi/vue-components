import type {
  CanonicalProjectIdentity,
  ProjectCompilation,
  ProjectCompilationOrigin,
} from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type {
  BuildExportSnapshotInput,
  CreateExportSessionOptions,
  ExportFileSet,
  ExportSession,
  ExportSessionRefreshResult,
  ExportSessionState,
  ExportSnapshot,
} from '../types'
import { assertUniqueProjectPaths, normalizeProjectPath } from '../../utils'
import { createCanonicalProjectConfigExport } from './config'
import { createCanonicalProjectSourceExport } from './source'

export const CONFIG_FORM_EXPORT_GENERATOR_VERSION = '1.0.0' as const

function cloneSnapshotFile(file: WorkspaceFile): Readonly<WorkspaceFile> {
  if (file.kind === 'text')
    return Object.freeze({ ...file })

  const content = Uint8Array.from(file.content)
  return Object.freeze({
    ...file,
    get content() {
      return Uint8Array.from(content)
    },
  })
}

export function createExportFileSet(
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

export function isSameCompilationOrigin(
  left: ProjectCompilationOrigin,
  right: ProjectCompilationOrigin,
): boolean {
  if (left.kind === 'committed')
    return right.kind === 'committed' && left.editVersion === right.editVersion
  return right.kind === 'draft'
    && left.baseEditVersion === right.baseEditVersion
    && left.draftId === right.draftId
}

export function isExportSnapshotStale(
  snapshot: ExportSnapshot | undefined,
  current: ProjectCompilation | undefined,
  currentGeneratorVersion: string = CONFIG_FORM_EXPORT_GENERATOR_VERSION,
): boolean {
  return !!snapshot && (
    !current
    || snapshot.generatorVersion !== currentGeneratorVersion
    || !isSameCompilation(snapshot.compilation.key, current.key)
    || !isSameCompilationOrigin(snapshot.compilation.origin, current.origin)
  )
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
  const currentGeneratorVersion = options.currentGeneratorVersion
    ?? (() => CONFIG_FORM_EXPORT_GENERATOR_VERSION)
  const listeners = new Set<(state: ExportSessionState) => void>()
  let state: ExportSessionState = Object.freeze({ stale: false })

  function publish(next: ExportSessionState): ExportSessionState {
    state = Object.freeze(next)
    listeners.forEach(listener => listener(state))
    return state
  }

  function sync(): ExportSessionState {
    const stale = isExportSnapshotStale(
      state.snapshot,
      options.currentCompilation(),
      currentGeneratorVersion(),
    )
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
      const next = publish({
        snapshot,
        stale: isExportSnapshotStale(
          snapshot,
          options.currentCompilation(),
          currentGeneratorVersion(),
        ),
      })
      return { success: true, snapshot, state: next }
    }
    catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      const next = publish({
        ...(state.snapshot ? { snapshot: state.snapshot } : {}),
        error,
        stale: isExportSnapshotStale(
          state.snapshot,
          options.currentCompilation(),
          currentGeneratorVersion(),
        ),
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
