import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormValueScopeDefinition } from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { RuntimeHostFieldInstance, RuntimeHostRuntimeStatePayload } from '../../runtime-host/types/protocol'
import type { PreviewFieldContracts } from '../types/preview'
import { deriveProjectPageValueSchema } from '@moluoxixi/config-form-model'
import { cloneWorkbenchJson } from '../../utils'

export function emptyPreviewContracts(): PreviewFieldContracts {
  return { fields: Object.create(null), scopes: [] }
}

function contractsFor(
  schema: { valueScopes: readonly ConfigFormValueScopeDefinition[], scopedFields: readonly { nodeId: string, field: string, scopeId?: string, defaultValue?: unknown }[] },
  nodes: Readonly<Record<string, { component: string }>>,
  usage: PageCompilation['registryUsage'],
): PreviewFieldContracts {
  const result = emptyPreviewContracts()
  const scopes = new Map(schema.valueScopes.map(scope => [scope.nodeId, scope]))
  const registry = new Map(usage.map(component => [component.key, component]))
  const chain = (scopeId?: string): ConfigFormValueScopeDefinition[] => {
    const ancestors: ConfigFormValueScopeDefinition[] = []
    while (scopeId !== undefined) {
      const scope = scopes.get(scopeId)
      if (!scope || ancestors.some(ancestor => ancestor.nodeId === scopeId) || ancestors.length >= 32)
        throw new TypeError('Invalid preview value scope ancestry.')
      ancestors.unshift(scope)
      scopeId = scope.parentId
    }
    return ancestors
  }
  const componentSignature = (nodeId: string) => {
    const component = nodes[nodeId]?.component
    const contract = component === undefined ? undefined : registry.get(component)
    return [component, contract?.contractVersion, contract?.fingerprint]
  }
  const scopeSignature = (scope: ConfigFormValueScopeDefinition) => [
    scope.nodeId,
    scope.field,
    scope.kind,
    scope.itemKey ?? null,
    scope.minItems ?? null,
    scope.maxItems ?? null,
    ...componentSignature(scope.nodeId),
  ]
  result.scopes = schema.valueScopes.map(definition => ({
    definition: cloneWorkbenchJson(definition),
    signature: JSON.stringify(chain(definition.nodeId).map(scopeSignature)),
  }))
  for (const field of schema.scopedFields) {
    const ancestors = chain(field.scopeId)
    result.fields[field.nodeId] = {
      field: field.field,
      scopes: cloneWorkbenchJson(ancestors),
      signature: JSON.stringify([field.nodeId, field.field, componentSignature(field.nodeId), ancestors.map(scopeSignature)]),
      ...(Object.hasOwn(field, 'defaultValue') ? { defaultValue: cloneWorkbenchJson(field.defaultValue) } : {}),
    }
  }
  return result
}

export function collectPreviewContracts(graph: PageGraph, compilation?: PageCompilation): PreviewFieldContracts {
  return contractsFor(deriveProjectPageValueSchema(cloneWorkbenchJson(graph)), graph.nodesById, compilation?.registryUsage ?? [])
}

export function collectCompiledPreviewContracts(compilation: PageCompilation): PreviewFieldContracts {
  return contractsFor(compilation.page, compilation.page.nodesById, compilation.registryUsage)
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** A stateless projection of natural JSON, not a second field/row store. */
export function reconcilePreviewState(
  contracts: PreviewFieldContracts,
  previousContracts: PreviewFieldContracts,
  previous: RuntimeHostRuntimeStatePayload,
  reset: boolean,
): RuntimeHostRuntimeStatePayload {
  const old = reset ? emptyPreviewContracts() : previousContracts
  const fieldOwner = (field: PreviewFieldContracts['fields'][string]) => field.scopes.at(-1)?.nodeId
  const projectContainer = (input: unknown, owner?: string): Record<string, unknown> => {
    const source = record(input)
    const values = cloneWorkbenchJson(source)
    for (const [nodeId, field] of Object.entries(old.fields)) {
      if (fieldOwner(field) === owner && contracts.fields[nodeId]?.signature !== field.signature)
        delete values[field.field]
    }
    for (const scope of old.scopes) {
      if (scope.definition.parentId === owner && !contracts.scopes.some(next => next.signature === scope.signature))
        delete values[scope.definition.field]
    }
    for (const [nodeId, field] of Object.entries(contracts.fields)) {
      if (fieldOwner(field) !== owner)
        continue
      const compatible = old.fields[nodeId]?.signature === field.signature
      if (!compatible)
        delete values[field.field]
      if (!Object.hasOwn(values, field.field) && Object.hasOwn(field, 'defaultValue'))
        values[field.field] = cloneWorkbenchJson(field.defaultValue)
    }
    for (const scope of contracts.scopes) {
      const definition = scope.definition
      if (definition.parentId !== owner)
        continue
      const compatible = old.scopes.some(previousScope => previousScope.signature === scope.signature)
      const value = compatible ? source[definition.field] : undefined
      values[definition.field] = definition.kind === 'object'
        ? projectContainer(value, definition.nodeId)
        : (Array.isArray(value) ? value : []).map(row => projectContainer(row, definition.nodeId))
    }
    return values
  }
  const values = projectContainer(reset ? {} : previous.values)
  const fields = reset
    ? []
    : previous.fields.filter((instance) => {
        const contract = contracts.fields[instance.nodeId]
        return contract?.signature === old.fields[instance.nodeId]?.signature
          && matchesPreviewInstance(instance, contracts, values)
      })
  return filterPreviewState({ ...previous, fields, values }, contracts)
}

export function matchesPreviewInstance(
  instance: RuntimeHostFieldInstance,
  contracts: PreviewFieldContracts,
  values: Record<string, unknown>,
): boolean {
  const contract = contracts.fields[instance.nodeId]
  if (!contract)
    return false
  let index = 0
  let rowIndex = 0
  let current: unknown = values
  for (const scope of contract.scopes) {
    if (instance.valuePath[index++] !== scope.field || !Object.hasOwn(record(current), scope.field))
      return false
    current = record(current)[scope.field]
    if (scope.kind === 'array') {
      const position = instance.valuePath[index++]
      if (!Array.isArray(current) || typeof position !== 'number' || !Number.isSafeInteger(position)
        || position < 0 || position >= current.length || instance.scope[rowIndex++]?.scopeId !== scope.nodeId) {
        return false
      }
      current = current[position]
    }
    if (current === null || typeof current !== 'object' || Array.isArray(current))
      return false
  }
  return rowIndex === instance.scope.length
    && instance.valuePath.length === index + 1
    && instance.valuePath[index] === contract.field
}

export function filterPreviewState(
  state: RuntimeHostRuntimeStatePayload,
  contracts: PreviewFieldContracts,
): RuntimeHostRuntimeStatePayload {
  const fields = state.fields.filter(instance => matchesPreviewInstance(instance, contracts, state.values))
  const keys = new Set(fields.map(instance => instance.instanceKey))
  return {
    fields: cloneWorkbenchJson(fields),
    values: cloneWorkbenchJson(state.values),
    touched: state.touched.filter(key => keys.has(key)),
    validation: Object.fromEntries(Object.entries(state.validation).filter(([key]) => keys.has(key))
      .map(([key, errors]) => [key, [...errors]])),
  }
}

/** Remounts may allocate new transient row IDs. Only a verified schema path bridges them. */
export function remapPreviewFieldState(
  state: RuntimeHostRuntimeStatePayload,
  fields: RuntimeHostFieldInstance[],
  contracts: PreviewFieldContracts,
): Pick<RuntimeHostRuntimeStatePayload, 'touched' | 'validation'> {
  const previous = filterPreviewState(state, contracts)
  const location = (instance: RuntimeHostFieldInstance) => JSON.stringify([instance.nodeId, instance.valuePath])
  const byLocation = new Map(previous.fields.map(instance => [location(instance), instance]))
  const touched = new Set(previous.touched)
  const result: Pick<RuntimeHostRuntimeStatePayload, 'touched' | 'validation'> = { touched: [], validation: {} }
  for (const instance of fields) {
    if (!matchesPreviewInstance(instance, contracts, state.values))
      continue
    const old = byLocation.get(location(instance))
    if (!old)
      continue
    if (touched.has(old.instanceKey))
      result.touched.push(instance.instanceKey)
    if (Object.hasOwn(previous.validation, old.instanceKey))
      result.validation[instance.instanceKey] = [...previous.validation[old.instanceKey]!]
  }
  return result
}
