import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import { rawValidatorNames } from './raw-validation'
import { sourceJson, sourceString } from './serialization'

type SourceSurface = ProjectCompilation['ir']['surfacesById'][string]
type SourceField = Extract<SourceSurface['nodesById'][string], { kind: 'field' }>

function scopeChain(surface: SourceSurface, field: SourceField): string[] {
  const scoped = surface.scopedFields.find(item => item.nodeId === field.id)
  const scopes = new Map(surface.valueScopes.map(scope => [scope.nodeId, scope]))
  const chain: string[] = []
  let scopeId = scoped?.scopeId
  const visited = new Set<string>()
  while (scopeId !== undefined) {
    if (visited.has(scopeId))
      throw new Error(`Cyclic value scope for ${surface.id}/${field.id}.`)
    visited.add(scopeId)
    const scope = scopes.get(scopeId)
    if (!scope)
      throw new Error(`Missing value scope ${scopeId}.`)
    chain.unshift(scope.kind === 'array'
      ? `.flatMap(container => Array.isArray(container[${sourceString(scope.field)}]) ? container[${sourceString(scope.field)}] as Record<string, unknown>[] : [])`
      : `.flatMap(container => container[${sourceString(scope.field)}] && typeof container[${sourceString(scope.field)}] === 'object' ? [container[${sourceString(scope.field)}] as Record<string, unknown>] : [])`)
    scopeId = scope.parentId
  }
  return chain
}

/** Generate calls for the actual fields, without shipping a field registry or scope interpreter. */
export function rawValidationComposableSource(surface: SourceSurface, hasStateProjection: boolean): string {
  const fields = Object.values(surface.nodesById)
    .filter((node): node is SourceField => node.kind === 'field')
    .sort((left, right) => left.id.localeCompare(right.id))
  const names = rawValidatorNames(surface)
  const cases = fields.map((field) => {
    const chain = scopeChain(surface, field)
    const required = hasStateProjection
      ? `states()[${sourceString(field.id)}]?.required ?? ${field.required === true}`
      : String(field.required === true)
    const validator = names.get(field.id)
    if (!validator) {
      return `      case ${sourceString(field.id)}: {
        const containers = [values]${chain.join('')}
        errors = requireInstance && containers.length === 0 ? [${sourceString(`No live field instance exists for ${field.label ?? field.field}.`)}] : []
        break
      }`
    }
    const validate = `${validator}(container[${sourceString(field.field)}], container, ${required})`
    return `      case ${sourceString(field.id)}: {
        const containers = [values]${chain.join('')}
        errors = containers.flatMap(container => ${validate})
        if (requireInstance && containers.length === 0)
          errors.push(${sourceString(`No live field instance exists for ${field.label ?? field.field}.`)})
        break
      }`
  }).join('\n')
  return `import { reactive } from 'vue'
${names.size > 0 ? `import { ${[...names.values()].join(', ')} } from '../validation'` : ''}

export function useFormValidation(
  values: Record<string, unknown>,${hasStateProjection ? '\n  states: () => Readonly<Record<string, { required?: boolean }>>,' : ''}
) {
  const validationErrors = reactive<Record<string, string[]>>({})

  function validateFields(fieldIds: readonly string[] = ${sourceJson(fields.map(field => field.id), 0)}, requireInstance = false): boolean {
    let valid = true
    for (const fieldId of new Set(fieldIds)) {
      let errors: string[]
      switch (fieldId) {
${cases}
        default: valid = false; continue
      }
      validationErrors[fieldId] = errors
      if (errors.length > 0)
        valid = false
    }
    return valid
  }

  const validation = {
    validate(request: { surfaceId: string, scope: 'surface' | 'fields', fieldIds: readonly string[] }): boolean {
      if (request.surfaceId !== ${sourceString(surface.id)})
        return false
      if (request.scope === 'fields' && request.fieldIds.length === 0)
        return false
      return validateFields(request.scope === 'surface' ? undefined : request.fieldIds, request.scope === 'fields')
    },
  }

  return { validationErrors, validateFields, validation }
}
`
}
