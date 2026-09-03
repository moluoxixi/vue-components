import type { ProjectDocument } from '@moluoxixi/config-form-model'
import type {
  CanonicalPageIR,
  CanonicalProjectIR,
  CanonicalProjectIRDocument,
  CompileCanonicalPageInput,
  CompileCanonicalPageResult,
  CompileCanonicalProjectInput,
  CompileCanonicalProjectResult,
  ProjectCompilation,
  SemanticCompilerDiagnostic,
} from '../../../types'
import { parseProjectCompilationSnapshot } from '@moluoxixi/config-form-model'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '../../../constants'
import { clone, deepFreeze, semanticHash } from '../../../utils'
import { validateRegistryLock } from '../validation'
import { prepareCompilerContext } from './context'
import { compilePageIR, compilePreparedPage } from './page'

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
  const project = snapshot.document as ProjectDocument
  const { contracts, environment, environmentHash, registry } = prepared.context
  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, registry, diagnostics)
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const pagesById: Record<string, CanonicalPageIR> = Object.create(null)
  project.pageOrder.forEach((pageId) => {
    const page = project.pagesById[pageId]
    if (!page)
      return
    const compiled = compilePageIR(page, contracts, diagnostics)
    if (compiled)
      pagesById[pageId] = compiled
  })
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const base = {
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
    homePageId: project.homePageId,
    pageOrder: [...project.pageOrder],
    pagesById,
    settings: clone(project.settings),
    resources: clone(project.resources),
    environment,
  } satisfies CanonicalProjectIRDocument
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

export function compileCanonicalPage(input: CompileCanonicalPageInput): CompileCanonicalPageResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const prepared = prepareCompilerContext(input.registry, input.environment)
  if (!prepared.success)
    return prepared
  return compilePreparedPage(snapshotResult.data, input.pageId, prepared.context)
}
