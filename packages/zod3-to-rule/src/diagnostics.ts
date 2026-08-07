import type { ZodIssue } from 'zod'
import type { RuleDiagnostic, RuleDiagnosticSeverity } from './types'

export function ruleDiagnostic(
  code: string,
  message: string,
  path: (string | number)[] = [],
  severity: RuleDiagnosticSeverity = 'error',
  ruleIndex?: number,
): RuleDiagnostic {
  return { code, severity, path, message, ...(ruleIndex === undefined ? {} : { ruleIndex }) }
}

export function formatRuleZodIssues(issues: ZodIssue[]): RuleDiagnostic[] {
  return issues.map(issue => ruleDiagnostic(
    'RULE_DOCUMENT_INVALID',
    issue.message,
    issue.path,
  ))
}

export class RuleCompileError extends Error {
  constructor(public readonly diagnostics: RuleDiagnostic[]) {
    super(diagnostics.map(diagnostic => diagnostic.message).join('; '))
    this.name = 'RuleCompileError'
  }
}
