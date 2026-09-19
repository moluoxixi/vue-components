import type {
  CanonicalProjectIdentity,
  ProjectCompilation,
  ProjectCompilationOrigin,
} from '@moluoxixi/config-form-compiler'
import type {
  ConfigBindingFileSetV1,
  RawSourceFileSetV1,
  SourceFile,
  SourceFileSetV1,
} from '@moluoxixi/config-form-source/generator'
import type {
  BuildExportSnapshotInput,
  CreateExportSessionOptions,
  ExportSession,
  ExportSessionRefreshResult,
  ExportSessionState,
  ExportSnapshot,
} from '../types'
import {
  generateConfigFormBindings,
  generateVueSource,
} from '@moluoxixi/config-form-source/generator'

export const CONFIG_FORM_EXPORT_GENERATOR_VERSION = 'source-file-set-v1' as const

function failureMessage(label: string, diagnostics: readonly { code: string, message: string }[]): string {
  const detail = diagnostics.map(item => `${item.code}: ${item.message}`).join('; ')
  return `${label} generation failed${detail ? `: ${detail}` : '.'}`
}

function freezeFile(file: SourceFile): SourceFile {
  return Object.freeze({ ...file })
}

function freezeFileSet(fileSet: RawSourceFileSetV1): RawSourceFileSetV1
function freezeFileSet(fileSet: ConfigBindingFileSetV1): ConfigBindingFileSetV1
function freezeFileSet(fileSet: SourceFileSetV1): SourceFileSetV1 {
  const files = Object.freeze(fileSet.files.map(freezeFile))
  return fileSet.kind === 'raw-source'
    ? Object.freeze({
        version: fileSet.version,
        kind: fileSet.kind,
        entry: fileSet.entry,
        files,
      })
    : Object.freeze({
        version: fileSet.version,
        kind: fileSet.kind,
        entry: fileSet.entry,
        files,
      })
}

export async function buildExportSnapshot(input: BuildExportSnapshotInput): Promise<ExportSnapshot> {
  const generatorVersion = input.generatorVersion ?? CONFIG_FORM_EXPORT_GENERATOR_VERSION
  if (!generatorVersion.trim())
    throw new Error('[config-form-workbench] export generator version is required')

  const generatorInput = {
    compilation: input.compilation,
    providerResolver: input.providerResolver,
    resourceReader: input.resourceReader,
  }
  const [rawResult, bindingResult] = await Promise.all([
    generateVueSource(generatorInput),
    generateConfigFormBindings(generatorInput),
  ])
  if (!rawResult.success)
    throw new Error(failureMessage('Raw Vue source', rawResult.diagnostics))
  if (!bindingResult.success)
    throw new Error(failureMessage('ConfigForm binding source', bindingResult.diagnostics))

  return Object.freeze({
    compilation: input.compilation,
    configBindings: freezeFileSet(bindingResult.data),
    generatorVersion,
    rawSource: freezeFileSet(rawResult.data),
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
  fileSet: SourceFileSetV1,
  preferred?: string,
): string | undefined {
  if (preferred && fileSet.files.some(file => file.path === preferred))
    return preferred
  if (fileSet.files.some(file => file.path === fileSet.entry))
    return fileSet.entry
  return fileSet.files.find(file => file.kind === 'text')?.path ?? fileSet.files[0]?.path
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
      const snapshot = await build(input)
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
