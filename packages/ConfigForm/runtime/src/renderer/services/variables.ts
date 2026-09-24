import type {
  ConfigFormValueContext,
  ConfigFormVariableDefinition,
} from '@moluoxixi/config-form-core'
import {
  collectConfigFormValueReferences,
  ConfigFormValueReferenceError,
  resolveConfigFormValueInput,
} from '@moluoxixi/config-form-core'

/** Resolve the dependency graph before publishing any variable. Uses only Core ValueInput. */
export function initializeRendererVariables(
  definitions: readonly ConfigFormVariableDefinition[],
  context: ConfigFormValueContext,
): Record<string, unknown> {
  if (definitions.length > 1000)
    throw new ConfigFormValueReferenceError('CONFIG_FORM_VARIABLE_LIMIT', 'At most 1000 page variables are supported.', 'runtime.variables')
  const entries = new Map<string, { definition: ConfigFormVariableDefinition, path: string }>()
  definitions.forEach((definition, index) => {
    const path = `runtime.variables[${index}]`
    if (!definition.id || ['__proto__', 'constructor', 'prototype'].includes(definition.id) || entries.has(definition.id))
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VARIABLE_ID_INVALID', `Invalid or duplicate variable ID: ${definition.id}`, `${path}.id`)
    entries.set(definition.id, { definition, path })
  })
  const variables: Record<string, unknown> = {}
  const visiting = new Set<string>()
  function resolve(id: string, referencePath: string): void {
    if (Object.hasOwn(variables, id))
      return
    const entry = entries.get(id)
    if (!entry)
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VARIABLE_MISSING', `Missing variable: ${id}`, referencePath)
    if (visiting.has(id))
      throw new ConfigFormValueReferenceError('CONFIG_FORM_VARIABLE_CYCLE', `Circular variable dependency: ${[...visiting, id].join(' -> ')}`, referencePath)
    visiting.add(id)
    const path = `${entry.path}.initialValue`
    try {
      for (const ref of collectConfigFormValueReferences(entry.definition.initialValue)) {
        if (ref.kind === 'variable')
          resolve(ref.id, `${path}${ref.path.slice(1)}`)
      }
      variables[id] = resolveConfigFormValueInput(entry.definition.initialValue, { ...context, variables })
    }
    catch (cause) {
      if (cause instanceof ConfigFormValueReferenceError && cause.path.startsWith('$'))
        throw new ConfigFormValueReferenceError(cause.code, cause.message, `${path}${cause.path.slice(1)}`, { cause })
      throw cause
    }
    visiting.delete(id)
  }
  entries.forEach((entry, id) => resolve(id, `${entry.path}.initialValue`))
  return variables
}
