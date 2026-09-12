import type {
  ConfigFormJsonObject,
  ConfigFormValueScopeRowIdFactory,
} from '@moluoxixi/config-form-core'
import type { ConfigFormFieldInstance, ConfigFormValueSchema, ConfigFormValues } from '../types'
import type { ControllerScopeService } from '../types/controller-internal'
import {
  CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS,
  getConfigFormValueScopeInstanceKey,
} from '@moluoxixi/config-form-core'
import { createControllerScopeService } from './controller-scope'
import { cloneControllerValue, equalControllerValues, setConfigFormValue } from './controller-values'

export function createControllerRowIdFactory(factory?: ConfigFormValueScopeRowIdFactory): ConfigFormValueScopeRowIdFactory {
  const issued = new Set<string>()
  let nextId = 0
  return (context) => {
    for (let attempt = 0; attempt < CONFIG_FORM_VALUE_SCOPE_ROW_ID_ATTEMPTS; attempt += 1) {
      const rowId = factory ? factory({ ...context, attempt }) : `row-${++nextId}`
      if (!issued.has(rowId)) {
        issued.add(rowId)
        return rowId
      }
    }
    throw new Error('ConfigForm row ID factory exhausted fresh identities.')
  }
}

export function prepareControllerSchemaRefresh<TValues extends ConfigFormValues>(options: {
  previousSchema: ConfigFormValueSchema
  schema: ConfigFormValueSchema
  previousService: ControllerScopeService | undefined
  scoped: boolean
  values: TValues
  resetValues: TValues
  createRowId: ConfigFormValueScopeRowIdFactory
}) {
  const { previousSchema, schema, createRowId } = options
  const scopes = compatibleScopes(previousSchema, schema)
  const previousFields = new Map(previousSchema.scopedFields.map(field => [field.nodeId, field]))
  const fields = new Set(schema.scopedFields.filter((field) => {
    const previous = previousFields.get(field.nodeId)
    return previous?.field === field.field && previous.scopeId === field.scopeId
      && (field.scopeId === undefined || scopes.has(field.scopeId))
  }).map(field => field.nodeId))
  const previousInstances = options.previousService?.listInstances()
    ?? flatInstances(previousSchema, options.values)
  let source = options.previousService
  if (source && !equalControllerValues(source.store.getValues(), options.values)) {
    // Stage external replacement as well, so a rejected schema cannot mutate the live store.
    source = restoreScopeService(previousSchema, source.store.getValues(), source.listRowIds(), createRowId)
    source.store.replaceValues(options.values as unknown as ConfigFormJsonObject)
  }

  const values = pruneValues(options.values, previousSchema, fields, scopes)
  const resetValues = pruneValues(options.resetValues, previousSchema, fields, scopes)
  const service = options.scoped
    ? restoreScopeService(schema, values as unknown as ConfigFormJsonObject, source?.listRowIds(scopes), createRowId)
    : undefined
  const nextValues = service
    ? service.store.getValues() as unknown as TValues
    : applyFlatDefaults(values, schema)
  const nextResetValues = options.scoped
    ? createControllerScopeService(schema, resetValues as unknown as ConfigFormJsonObject).store.getValues() as unknown as TValues
    : applyFlatDefaults(resetValues, schema)
  const instances = service?.listInstances() ?? flatInstances(schema, nextValues)
  const previousByAddress = new Map(previousInstances.map(instance => [addressKey(instance), instance]))
  const previousKeys = new Map<string, string>()
  instances.forEach((instance) => {
    const previous = previousByAddress.get(addressKey(instance))
    if (previous && fields.has(instance.address.nodeId))
      previousKeys.set(instance.instanceKey, previous.instanceKey)
  })
  return {
    defaults: new Map(schema.scopedFields.filter(field => field.defaultValue !== undefined)
      .map(field => [field.nodeId, field.defaultValue])),
    instances,
    previousInstanceKeys: new Set(previousInstances.map(instance => instance.instanceKey)),
    previousKeys,
    resetValues: nextResetValues,
    scopeService: service,
    values: nextValues,
  }
}

function restoreScopeService(
  schema: ConfigFormValueSchema,
  values: ConfigFormJsonObject,
  rowIds: Map<string, string[]> | undefined,
  createRowId: ConfigFormValueScopeRowIdFactory,
): ControllerScopeService {
  let restoring = true
  const service = createControllerScopeService(schema, values, (context) => {
    const key = getConfigFormValueScopeInstanceKey(context.scopeId, context.parentScope)
    return (restoring ? rowIds?.get(key)?.shift() : undefined) ?? createRowId(context)
  })
  restoring = false
  return service
}

function compatibleScopes(previous: ConfigFormValueSchema, next: ConfigFormValueSchema): Set<string> {
  const previousById = new Map(previous.valueScopes.map(scope => [scope.nodeId, scope]))
  const nextById = new Map(next.valueScopes.map(scope => [scope.nodeId, scope]))
  return new Set(next.valueScopes.filter((scope) => {
    let current: typeof scope | undefined = scope
    const seen = new Set<string>()
    while (current) {
      const old = previousById.get(current.nodeId)
      if (seen.has(current.nodeId) || !old || old.field !== current.field
        || old.parentId !== current.parentId || old.kind !== current.kind || old.itemKey !== current.itemKey)
        return false
      seen.add(current.nodeId)
      if (current.parentId === undefined)
        return true
      current = nextById.get(current.parentId)
    }
    return false
  }).map(scope => scope.nodeId))
}

function pruneValues<TValues extends ConfigFormValues>(
  values: TValues,
  previous: ConfigFormValueSchema,
  fields: ReadonlySet<string>,
  scopes: ReadonlySet<string>,
): TValues {
  const next = cloneControllerValue(values)
  const visit = (container: ConfigFormValues, parentId?: string): void => {
    previous.scopedFields.forEach((field) => {
      if (field.scopeId === parentId && !fields.has(field.nodeId))
        delete container[field.field]
    })
    previous.valueScopes.forEach((scope) => {
      if (scope.parentId !== parentId)
        return
      if (!scopes.has(scope.nodeId)) {
        delete container[scope.field]
        return
      }
      const value = container[scope.field]
      const children = scope.kind === 'array' ? (Array.isArray(value) ? value : []) : [value]
      children.forEach((child) => {
        if (child !== null && typeof child === 'object' && !Array.isArray(child))
          visit(child as ConfigFormValues, scope.nodeId)
      })
    })
  }
  // Retire declared properties only; Core owns scope normalization and address resolution.
  visit(next)
  return next
}

function applyFlatDefaults<TValues extends ConfigFormValues>(values: TValues, schema: ConfigFormValueSchema): TValues {
  schema.scopedFields.forEach((field) => {
    if (!Object.hasOwn(values, field.field) && field.defaultValue !== undefined)
      setConfigFormValue(values, field.field, field.defaultValue)
  })
  return values
}

function flatInstances(schema: ConfigFormValueSchema, values: ConfigFormValues): ConfigFormFieldInstance[] {
  return schema.scopedFields.map(field => ({
    address: { nodeId: field.nodeId, scope: [] },
    field: field.field,
    instanceKey: field.field,
    value: cloneControllerValue(values[field.field]),
    valuePath: [field.field],
  }))
}

function addressKey(instance: ConfigFormFieldInstance): string {
  return getConfigFormValueScopeInstanceKey(instance.address.nodeId, instance.address.scope)
}
