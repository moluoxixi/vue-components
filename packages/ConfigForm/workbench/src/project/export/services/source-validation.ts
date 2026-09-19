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
      target[node.id] = {
        ...(node.validation === undefined ? {} : { validation: structuredClone(node.validation) }),
        validateOn: [...node.validateOn],
      }
    }
    else if (node.kind === 'layout') {
      Object.values(node.slots).forEach(children => collectFieldValidation(children, target))
    }
  }
  return target
}

export function createStandaloneValidationRuntimeSource(nodes: StandaloneSourceNode[]): string {
  const fields = collectFieldValidation(nodes)
  return `import type { ConfigFormFieldValidator } from '../../runtime/headless'
import type { CompiledRuleSet, RuleCustomValidator, RuleSet } from '@moluoxixi/zod3-to-rule'
import { compileRules } from '@moluoxixi/zod3-to-rule'

export type GeneratedValidationTrigger = 'submit' | 'blur' | 'change'
export type GeneratedFieldValidation = { validation?: RuleSet, validateOn: GeneratedValidationTrigger[] }
export interface GeneratedFieldRuntimeValidation {
  validateOn: GeneratedValidationTrigger[]
  required?: boolean
  requiredMessage?: string
  schema?: CompiledRuleSet['schema']
  validator?: ConfigFormFieldValidator
}

export const fieldValidation = ${scriptJson(fields, 2)} as Record<string, GeneratedFieldValidation>
const customValidators: Record<string, RuleCustomValidator> = Object.create(null)
const compiledFields = new Map<string, GeneratedFieldRuntimeValidation>()

export function registerFieldValidator(key: string, validator: RuleCustomValidator): void {
  if (!key.trim() || typeof validator !== 'function')
    throw new Error('Field validator keys must be non-empty and executable.')
  customValidators[key] = validator
  compiledFields.clear()
}

function ruleContext(ruleSet: RuleSet): { custom: Record<string, RuleCustomValidator> } {
  const custom: Record<string, RuleCustomValidator> = Object.create(null)
  for (const rule of ruleSet.rules) {
    if (rule.kind === 'custom' && customValidators[rule.key])
      custom[rule.key] = customValidators[rule.key]
  }
  return { custom }
}

export function resolveFieldValidation(nodeId: string): GeneratedFieldRuntimeValidation {
  const current = compiledFields.get(nodeId)
  if (current)
    return current
  const descriptor = fieldValidation[nodeId]
  if (!descriptor)
    throw new Error(\`Unknown generated field validation: \${nodeId}\`)
  if (!descriptor.validation) {
    const empty = { validateOn: [...descriptor.validateOn] }
    compiledFields.set(nodeId, empty)
    return empty
  }
  const compiled = compileRules(descriptor.validation, ruleContext(descriptor.validation))
  const errors = compiled.diagnostics.filter(item => item.severity === 'error')
  if (errors.length)
    throw new Error(errors.map(item => item.message).join('; '))
  const result: GeneratedFieldRuntimeValidation = {
    validateOn: [...descriptor.validateOn],
    ...(compiled.required === undefined ? {} : { required: compiled.required }),
    ...(compiled.requiredMessage === undefined ? {} : { requiredMessage: compiled.requiredMessage }),
    schema: compiled.schema,
    ...(compiled.validator ? { validator: compiled.validator } : {}),
  }
  compiledFields.set(nodeId, result)
  return result
}
`
}
