import type { VueRuntimeDiagnostic } from '../types'

export function createVueRuntimeDiagnostic(
  code: string,
  message: string,
  path: Array<string | number>,
  nodeId?: string,
  severity: VueRuntimeDiagnostic['severity'] = 'error',
): VueRuntimeDiagnostic {
  return {
    code,
    message,
    path,
    severity,
    ...(nodeId ? { nodeId } : {}),
  }
}

export function hasVueRuntimeErrors(diagnostics: VueRuntimeDiagnostic[]): boolean {
  return diagnostics.some(item => item.severity === 'error')
}
