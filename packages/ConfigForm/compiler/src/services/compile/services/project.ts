import type {
  CanonicalProjectIR,
  CanonicalProjectIRDocument,
  CanonicalSurfaceIR,
  CompileCanonicalProjectInput,
  CompileCanonicalProjectResult,
  CompileCanonicalSurfaceInput,
  CompileCanonicalSurfaceResult,
  ProjectCompilation,
  SemanticCompilerDiagnostic,
} from '../../../types'
import { parseProjectCompilationSnapshot } from '@moluoxixi/config-form-model'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '../../../constants'
import { clone, deepFreeze, semanticHash } from '../../../utils'
import { validateRegistryLock } from '../validation'
import { prepareCompilerContext } from './context'
import { compilePreparedSurface, compileSurfaceIR } from './surface'

export function compileCanonicalProject(input: CompileCanonicalProjectInput): CompileCanonicalProjectResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const prepared = prepareCompilerContext(input.registry, input.environment)
  if (!prepared.success)
    return prepared

  const snapshot = snapshotResult.data
  const isDraft = 'kind' in snapshot
  const contentHash = isDraft ? snapshot.draftHash : snapshot.contentHash
  const project = snapshot.document
  const { contracts, environment, environmentHash, registry } = prepared.context
  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, registry, diagnostics)
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const surfacesById: Record<string, CanonicalSurfaceIR> = Object.create(null)
  project.surfaceOrder.forEach((surfaceId) => {
    const surface = project.surfacesById[surfaceId]
    if (!surface)
      return
    const compiled = compileSurfaceIR(surface, contracts, diagnostics)
    if (compiled)
      surfacesById[surfaceId] = compiled
  })
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const base: CanonicalProjectIRDocument = {
    version: CANONICAL_PROJECT_IR_VERSION,
    identity: {
      projectId: project.id,
      contentHash,
      registryAdapter: registry.adapter,
      registryAdapterVersion: registry.adapterVersion,
      registryFingerprint: registry.fingerprint,
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash,
      irHash: '',
    },
    name: project.name,
    homeSurfaceId: project.homeSurfaceId,
    surfaceOrder: [...project.surfaceOrder],
    surfacesById,
    datasetOrder: [...project.datasetOrder],
    datasetsById: clone(project.datasetsById),
    resources: clone(project.resources),
    theme: clone(project.theme),
    settings: clone(project.settings),
    environment,
  }
  const { contentHash: _contentHash, irHash: _irHash, ...semanticIdentity } = base.identity
  base.identity.irHash = semanticHash({ ...base, identity: semanticIdentity })
  const ir = deepFreeze(base) as CanonicalProjectIR
  const compilation = deepFreeze({
    snapshot,
    registry,
    origin: isDraft
      ? {
          kind: 'draft' as const,
          baseEditVersion: snapshot.base.editVersion,
          draftId: snapshot.draftId,
        }
      : {
          kind: 'committed' as const,
          editVersion: snapshot.editVersion,
        },
    key: ir.identity,
    ir,
  }) as ProjectCompilation
  return { success: true, compilation, diagnostics: [] }
}

export function compileCanonicalSurface(input: CompileCanonicalSurfaceInput): CompileCanonicalSurfaceResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const prepared = prepareCompilerContext(input.registry, input.environment)
  if (!prepared.success)
    return prepared
  return compilePreparedSurface(snapshotResult.data, input.surfaceId, prepared.context)
}
