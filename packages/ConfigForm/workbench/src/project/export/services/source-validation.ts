import type {
  StandaloneSourceFieldValidation,
  StandaloneSourceNode,
} from '../types/source'
import { scriptJson } from './source-serialization'

function collectFieldValidation(
  nodes: StandaloneSourceNode[],
  target: Record<string, StandaloneSourceFieldValidation> = {},
): Record<string, StandaloneSourceFieldValidation> {
  for (const node of nodes) {
    if (node.kind === 'field') {
      const configured = node.validateOn === undefined
        ? []
        : Array.isArray(node.validateOn) ? node.validateOn : [node.validateOn]
      target[node.field] = {
        ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) }),
        validateOn: [...new Set([...configured, 'submit' as const])],
      }
    }
    else {
      Object.values(node.slots).forEach(children => collectFieldValidation(children, target))
    }
  }
  return target
}

export function createStandaloneValidationRuntimeSource(nodes: StandaloneSourceNode[]): string {
  const fields = collectFieldValidation(nodes)
  return `import type { RuleCustomValidator, RuleSet, RuleValidationResult } from '@moluoxixi/zod3-to-rule'
import { compileRules } from '@moluoxixi/zod3-to-rule'

export type GeneratedValidationTrigger = 'submit' | 'blur' | 'change'
export type GeneratedFieldValidation = { validation?: RuleSet, validateOn: GeneratedValidationTrigger[] }

export const fieldValidation = ${scriptJson(fields, 2)} as Record<string, GeneratedFieldValidation>
const customValidators: Record<string, RuleCustomValidator> = Object.create(null)

export function registerFieldValidator(key: string, validator: RuleCustomValidator): void {
  if (!key.trim() || typeof validator !== 'function')
    throw new Error('Field validator keys must be non-empty and executable.')
  customValidators[key] = validator
}

function validationMessages(result: RuleValidationResult): string[] {
  if (!result)
    return []
  return Array.isArray(result) ? result.filter(Boolean) : [result]
}

function ruleContext(ruleSet: RuleSet): { custom: Record<string, RuleCustomValidator> } {
  const custom: Record<string, RuleCustomValidator> = Object.create(null)
  for (const rule of ruleSet.rules) {
    if (rule.kind === 'custom' && customValidators[rule.key])
      custom[rule.key] = customValidators[rule.key]
  }
  return { custom }
}

export async function validateField(field: string, values: Record<string, unknown>): Promise<string[]> {
  const ruleSet = fieldValidation[field]?.validation
  if (!ruleSet)
    return []
  try {
    const compiled = compileRules(ruleSet, ruleContext(ruleSet))
    const diagnostics = compiled.diagnostics
      .filter(item => item.severity === 'error')
      .map(item => item.message)
    if (diagnostics.length)
      return diagnostics
    const parsed = await compiled.schema.safeParseAsync(values[field])
    if (!parsed.success)
      return parsed.error.issues.map(issue => issue.message)
    return compiled.validator
      ? validationMessages(await compiled.validator(parsed.data, values))
      : []
  }
  catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

export async function validateFieldForTrigger(
  field: string,
  trigger: GeneratedValidationTrigger,
  values: Record<string, unknown>,
): Promise<string[] | undefined> {
  if (!fieldValidation[field]?.validateOn.includes(trigger))
    return undefined
  return validateField(field, values)
}

export async function validateFields(
  fields: readonly string[],
  values: Record<string, unknown>,
): Promise<Record<string, string[]>> {
  const entries = await Promise.all([...new Set(fields)].map(async field => [
    field,
    await validateField(field, values),
  ] as const))
  return Object.fromEntries(entries)
}
`
}
