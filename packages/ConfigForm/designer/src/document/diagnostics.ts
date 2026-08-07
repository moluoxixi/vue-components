import type { ZodIssue } from 'zod'
import type { DesignerDiagnostic, DesignerDiagnosticSeverity } from './types'

export function designerDiagnostic(
  code: string,
  message: string,
  path: (string | number)[] = [],
  severity: DesignerDiagnosticSeverity = 'error',
  nodeId?: string,
): DesignerDiagnostic {
  return { code, severity, path, message, ...(nodeId ? { nodeId } : {}) }
}

export function formatDesignerZodIssues(issues: ZodIssue[]): DesignerDiagnostic[] {
  return issues.map(issue => designerDiagnostic(
    'DESIGNER_DOCUMENT_INVALID',
    issue.message,
    issue.path,
  ))
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
