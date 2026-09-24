import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ContractResult,
  ModelDiagnostic,
} from '@moluoxixi/config-form-model'
import type {
  RuleDiagnostic,
  RuleSet,
} from '@moluoxixi/zod3-to-rule'
import type {
  SourceValidationEmissionPlan,
  SourceValidationFieldEmission,
} from '../types/internal'
import { compileRules, parseRuleSet, RuleCompileError } from '@moluoxixi/zod3-to-rule'

type SourceSurface = ProjectCompilation['ir']['surfacesById'][string]
type SourceFieldNode = Extract<SourceSurface['nodesById'][string], { kind: 'field' }>

export const SOURCE_CONFIG_FORM_RULE_COMPILER = Object.freeze({
  dependencyVersion: '^0.1.3',
  importName: 'compileRules',
  moduleSpecifier: '@moluoxixi/zod3-to-rule',
} as const)

function diagnosticPath(
  surfaceId: string,
  nodeId: string,
  path: readonly (string | number)[] = [],
): Array<string | number> {
  return [
    'ir',
    'surfacesById',
    surfaceId,
    'nodesById',
    nodeId,
    'validation',
    ...path,
  ]
}

function ruleFailure(
  surfaceId: string,
  nodeId: string,
  diagnostic: RuleDiagnostic,
  reason: 'rule_compile_error' | 'rule_diagnostic' | 'rule_parse_error',
): ModelDiagnostic {
  return {
    code: 'source_input_invalid',
    message: `Validation rules for "${surfaceId}/${nodeId}" could not be compiled: ${diagnostic.message}`,
    path: diagnosticPath(surfaceId, nodeId, diagnostic.path),
    surfaceId,
    nodeId,
    context: {
      reason,
      ruleDiagnostic: structuredClone(diagnostic),
    },
  }
}

function unexpectedFailure(
  surfaceId: string,
  nodeId: string,
  error: unknown,
): ModelDiagnostic {
  return {
    code: 'source_input_invalid',
    message: `Validation rules for "${surfaceId}/${nodeId}" could not be compiled.`,
    path: diagnosticPath(surfaceId, nodeId),
    surfaceId,
    nodeId,
    context: {
      reason: 'unexpected_error',
      error: error instanceof Error ? error.message : String(error),
    },
  }
}

function compileField(
  surfaceId: string,
  nodeId: string,
  validation: unknown,
): ContractResult<SourceValidationFieldEmission> {
  try {
    const parsed = parseRuleSet(structuredClone(validation))
    if (!parsed.success) {
      return {
        success: false,
        diagnostics: parsed.diagnostics.map(diagnostic => ruleFailure(
          surfaceId,
          nodeId,
          diagnostic,
          'rule_parse_error',
        )),
      }
    }
    const ruleSet: RuleSet = parsed.data
    const compiled = compileRules(ruleSet)
    const errors = compiled.diagnostics.filter(diagnostic => diagnostic.severity === 'error')
    if (errors.length > 0) {
      return {
        success: false,
        diagnostics: errors.map(diagnostic => ruleFailure(
          surfaceId,
          nodeId,
          diagnostic,
          'rule_diagnostic',
        )),
      }
    }

    return {
      success: true,
      data: {
        nodeId,
        ruleSet,
        attachValidator: compiled.validator !== undefined,
      },
      diagnostics: [],
    }
  }
  catch (error) {
    if (error instanceof RuleCompileError) {
      return {
        success: false,
        diagnostics: error.diagnostics.map(diagnostic => ruleFailure(
          surfaceId,
          nodeId,
          diagnostic,
          'rule_compile_error',
        )),
      }
    }
    return {
      success: false,
      diagnostics: [unexpectedFailure(surfaceId, nodeId, error)],
    }
  }
}

/** Strictly parses and preflights every canonical RuleSet before either output is assembled. */
export function compileSourceValidationPlan(
  compilation: ProjectCompilation,
): ContractResult<SourceValidationEmissionPlan> {
  const surfaces: SourceValidationEmissionPlan['surfaces'][number][] = []
  const diagnostics: ModelDiagnostic[] = []

  for (const surfaceId of compilation.ir.surfaceOrder) {
    const surface = compilation.ir.surfacesById[surfaceId]
    if (!surface) {
      diagnostics.push({
        code: 'source_input_invalid',
        message: `Compiled Surface "${surfaceId}" is missing.`,
        path: ['ir', 'surfacesById', surfaceId],
        surfaceId,
        context: { reason: 'surface_missing' },
      })
      continue
    }

    const fields: SourceValidationFieldEmission[] = []
    const fieldNodes = Object.values(surface.nodesById)
      .filter((node): node is SourceFieldNode & { validation: RuleSet } => (
        node.kind === 'field' && node.validation !== undefined
      ))
      .sort((left, right) => left.id.localeCompare(right.id))
    for (const node of fieldNodes) {
      const result = compileField(surfaceId, node.id, node.validation)
      if (result.success)
        fields.push(result.data)
      else
        diagnostics.push(...result.diagnostics)
    }
    surfaces.push({ surfaceId, fields })
  }

  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  return {
    success: true,
    data: {
      surfaces,
    },
    diagnostics: [],
  }
}
