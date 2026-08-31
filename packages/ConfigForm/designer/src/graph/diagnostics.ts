import type { DesignerDiagnostic, DesignerDiagnosticSeverity } from './types'

export function designerDiagnostic(
  code: string,
  message: string,
  path: Array<string | number> = [],
  severity: DesignerDiagnosticSeverity = 'error',
  nodeId?: string,
): DesignerDiagnostic {
  return { code, message, path, severity, ...(nodeId ? { nodeId } : {}) }
}

export function hasDesignerErrors(diagnostics: DesignerDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error')
}

export class DesignerRegistryError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'DesignerRegistryError'
  }
}
