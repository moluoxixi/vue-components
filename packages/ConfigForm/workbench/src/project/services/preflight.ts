import type { ProjectDocument, RegistryContractSnapshot } from '@moluoxixi/config-form-model'
import { compileCanonicalProject } from '@moluoxixi/config-form-compiler'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'

export function preflightPreparedProject(
  project: ProjectDocument,
  registry: RegistryContractSnapshot,
): void {
  const snapshot = createProjectSnapshot(project, 0)
  // A project may be persisted before its first page is created. There is no
  // canonical surface to compile yet; schema validation above remains the
  // source of truth for the empty shell.
  if (project.surfaceOrder.length === 0 || !project.homeSurfaceId)
    return
  const result = compileCanonicalProject({
    snapshot: {
      document: snapshot.document,
      editVersion: snapshot.editVersion,
      contentHash: snapshot.contentHash,
    },
    registry,
  })
  if (!result.success) {
    throw new TypeError(
      `${result.diagnostics[0]?.code ?? 'PROJECT_PREFLIGHT_COMPILE_FAILED'}: ${result.diagnostics[0]?.message ?? 'Project compilation failed.'}`,
    )
  }
}
