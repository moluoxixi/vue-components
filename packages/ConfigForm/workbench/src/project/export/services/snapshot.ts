import type {
  CanonicalProjectIdentity,
  ProjectCompilation,
  ProjectCompilationOrigin,
} from '@moluoxixi/config-form-compiler'
import type { ContractResult, ModelDiagnostic } from '@moluoxixi/config-form-model'
import type { SourceFile, SourceFileSetV1 } from '@moluoxixi/config-form-source/generator'
import type {
  BuildExportSnapshotInput,
  CreateExportSessionOptions,
  ExportArtifact,
  ExportSession,
  ExportSessionRefreshResult,
  ExportSessionState,
  ExportSnapshot,
} from '../types'
import {
  generateConfigFormBindings,
  generateVueSource,
} from '@moluoxixi/config-form-source/generator'

function freezeFile(file: SourceFile): SourceFile {
  return Object.freeze({ ...file })
}

function freezeDiagnostics(diagnostics: readonly ModelDiagnostic[]): readonly ModelDiagnostic[] {
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze({
    ...diagnostic,
    ...(diagnostic.path ? { path: [...diagnostic.path] } : {}),
  })))
}

async function generateArtifact<TFileSet extends SourceFileSetV1>(
  label: string,
  generate: () => Promise<ContractResult<TFileSet>>,
): Promise<ExportArtifact<TFileSet>> {
  try {
    const result = await generate()
    return result.success
      ? Object.freeze({ status: 'ready' as const, fileSet: freezeFileSet(result.data) })
      : Object.freeze({ status: 'failed' as const, diagnostics: freezeDiagnostics(result.diagnostics) })
  }
  catch (cause) {
    return Object.freeze({
      status: 'failed' as const,
      diagnostics: freezeDiagnostics([{
        code: 'source_generation_failed',
        message: `${label} generation failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }]),
    })
  }
}

function freezeFileSet<TFileSet extends SourceFileSetV1>(fileSet: TFileSet): TFileSet {
  const files = Object.freeze(fileSet.files.map(freezeFile))
  const snapshot: TFileSet = { ...fileSet, files }
  Object.freeze(snapshot)
  return snapshot
}

export async function buildExportSnapshot(input: BuildExportSnapshotInput): Promise<ExportSnapshot> {
  const rawInput = {
    compilation: input.compilation,
    componentResolver: input.componentResolver,
    resourceReader: input.resourceReader,
  }
  const [rawSource, configBindings] = await Promise.all([
    generateArtifact('Raw Vue source', () => generateVueSource(rawInput)),
    generateArtifact('ConfigForm binding source', () => generateConfigFormBindings({
      ...rawInput,
      bindingResolver: input.bindingResolver,
    })),
  ])

  return Object.freeze({
    compilation: input.compilation,
    configBindings,
    rawSource,
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
): boolean {
  return !!snapshot && (
    !current
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
