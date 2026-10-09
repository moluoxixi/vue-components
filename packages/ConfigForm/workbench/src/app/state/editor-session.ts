import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type { DiagnosticOrigin, StudioDiagnostic } from '../types/editor-session'
import { ref, shallowRef } from 'vue'

/** Ephemeral editor state. Never serialized into ProjectDocument or history. */
export function createEditorSession() {
  const commandOpen = ref(false)
  const issuesOpen = ref(false)
  const designerDiagnostics = shallowRef<readonly StudioDiagnostic[]>([])
  const exportDiagnostics = shallowRef<readonly StudioDiagnostic[]>([])

  return { commandOpen, issuesOpen, designerDiagnostics, exportDiagnostics }
}

export function normalizeDiagnostics(
  diagnostics: readonly (Omit<ModelDiagnostic, 'path'> & { path?: readonly (string | number)[], severity?: string })[],
  origin: DiagnosticOrigin,
  surfaceId?: string,
): StudioDiagnostic[] {
  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    severity: diagnostic.severity === 'warning' ? 'warning' : diagnostic.severity === 'info' ? 'info' : 'error',
    origin,
    path: diagnostic.path ? [...diagnostic.path] : undefined,
    surfaceId: diagnostic.surfaceId ?? surfaceId,
  }))
}

export function uniqueDiagnostics(diagnostics: readonly StudioDiagnostic[]): StudioDiagnostic[] {
  const entries = new Map<string, StudioDiagnostic>()
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify([
      diagnostic.code,
      diagnostic.surfaceId,
      diagnostic.nodeId,
      diagnostic.path,
      diagnostic.message,
    ])
    if (!entries.has(key))
      entries.set(key, diagnostic)
  }
  return [...entries.values()]
}
