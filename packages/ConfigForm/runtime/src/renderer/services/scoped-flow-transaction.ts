import type {
  ConfigFormFlowTransaction,
  ConfigFormFlowTransactionFactoryInput,
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReactionProjection,
  ConfigFormValueReferenceScope,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormController,
  ConfigFormFieldInstance,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import { cloneConfigFormFlowData, ConfigFormFlowDataError } from '@moluoxixi/config-form-core'
import {
  createRendererFlowValueContext,
  isRendererScopeActive,
  readValuePath,
  selectRendererFieldInstance,
} from './flow-value-context'

type FieldStates = ConfigFormReactionProjection['states']

/** Adapts Core's run-local transaction to the controller's stable field addresses. */
export function createRendererScopedFlowTransaction<TValues extends ConfigFormValues>(options: {
  controller: ConfigFormController<TValues>
  input: ConfigFormFlowTransactionFactoryInput
  plan: ConfigFormPageRuntimePlan | undefined
  variables: Readonly<Record<string, unknown>>
  commit: (write: () => void, variables: Record<string, unknown>, states: FieldStates) => void
}): ConfigFormFlowTransaction {
  const { controller, input, plan } = options
  const { event, signal, values } = input
  const before = cloneConfigFormFlowData(values)
  const instances = controller.listFieldInstances()
  const variables: Record<string, unknown> = cloneConfigFormFlowData(options.variables)
  const variablePatch: Record<string, unknown> = {}
  const states: FieldStates = {}
  const context = createRendererFlowValueContext(plan, controller, values, event, variables, instances)
  const stateInstances = new Map<string, ConfigFormFieldInstance>()

  function fieldInstance(nodeId: string, scope: ConfigFormValueReferenceScope = 'current'): ConfigFormFieldInstance {
    const instance = selectRendererFieldInstance(
      instances.filter(instance => instance.address.nodeId === nodeId),
      event.scope ?? [],
      scope,
      plan ? {
        schema: plan.valueSchema,
        sourceNodeId: event.trigger.kind === 'component.event' ? event.trigger.nodeId : undefined,
      } : undefined,
    )
    if (!instance)
      throw new ConfigFormFlowDataError('FLOW_FIELD_UNAVAILABLE', `Flow field is unavailable: ${nodeId}`, 'form.field')
    return instance
  }

  function assertVariable(variableId: string): void {
    if (!Object.hasOwn(variables, variableId))
      throw new ConfigFormFlowDataError('FLOW_VARIABLE_UNAVAILABLE', `Flow variable is unavailable: ${variableId}`, 'form.variable')
  }

  return {
    form: {
      getField: (nodeId, scope) => cloneConfigFormFlowData(readValuePath(values, fieldInstance(nodeId, scope).valuePath).value),
      setField: (nodeId, value, scope) => {
        signal.throwIfAborted()
        writeValuePath(values, fieldInstance(nodeId, scope).valuePath, value)
      },
      getVariable: (variableId) => {
        assertVariable(variableId)
        return cloneConfigFormFlowData(variables[variableId])
      },
      setVariable: (variableId, value) => {
        signal.throwIfAborted()
        assertVariable(variableId)
        variables[variableId] = cloneConfigFormFlowData(value)
        variablePatch[variableId] = variables[variableId]
      },
      setFieldState: (nodeId, state, value, scope) => {
        signal.throwIfAborted()
        const instance = fieldInstance(nodeId, scope)
        stateInstances.set(instance.instanceKey, instance)
        states[instance.instanceKey] = { ...states[instance.instanceKey], [state]: value }
      },
    },
    readValueContext: outputs => ({ ...context, outputs }),
    commit: (patch) => {
      signal.throwIfAborted()
      if (!isRendererScopeActive(controller, event.scope ?? []))
        throw new ConfigFormFlowDataError('FLOW_SCOPE_REMOVED', 'The event row no longer exists.', 'event.scope')

      const root: Record<string, unknown> = {}
      const fields: Array<{ instance: ConfigFormFieldInstance, value: ConfigFormJsonValue }> = []
      for (const [key, value] of Object.entries(patch.set)) {
        if (Object.hasOwn(before, key) && equalValue(before[key], value))
          continue
        const nested = instances.filter(instance => instance.valuePath.length > 1 && instance.valuePath[0] === key)
        const candidate: Record<string, unknown> = { [key]: cloneConfigFormFlowData(before[key]) }
        const changed: typeof fields = []
        let representable = true
        for (const instance of nested) {
          const previous = readValuePath(before, instance.valuePath)
          const next = readValuePath({ [key]: value }, instance.valuePath)
          if (previous.found === next.found && equalValue(previous.value, next.value))
            continue
          if (!next.found) {
            representable = false
            break
          }
          writeValuePath(candidate, instance.valuePath, next.value)
          changed.push({ instance, value: next.value as ConfigFormJsonValue })
        }
        // An explicit scope replacement keeps Headless's replacement semantics.
        // Field-only edits are rebased by identity, never by their old array indexes.
        if (nested.length > 0 && representable && equalValue(candidate[key], value))
          fields.push(...changed)
        else
          root[key] = cloneConfigFormFlowData(value)
      }

      const currentInstances = new Set(controller.listFieldInstances().map(instance => instance.instanceKey))
      for (const instance of [...fields.map(field => field.instance), ...stateInstances.values()]) {
        if (!currentInstances.has(instance.instanceKey))
          throw new ConfigFormFlowDataError('FLOW_SCOPE_REMOVED', 'A transaction field no longer exists.', instance.address.nodeId)
        controller.getInstanceKey(instance.address)
      }

      options.commit(() => {
        signal.throwIfAborted()
        if (!isRendererScopeActive(controller, event.scope ?? []))
          throw new ConfigFormFlowDataError('FLOW_SCOPE_REMOVED', 'The event row no longer exists.', 'event.scope')
        controller.applyValuePatch({
          set: root as ConfigFormJsonObject,
          remove: patch.remove,
          instances: fields.map(({ instance, value }) => ({ address: instance.address, value })),
        })
      }, variablePatch, states)
    },
  }
}

function writeValuePath(values: Record<string, unknown>, path: readonly (number | string)[], value: unknown): void {
  const root = path[0] as string
  if (path.length === 1) {
    values[root] = cloneConfigFormFlowData(value)
    return
  }
  const copy = cloneConfigFormFlowData(values[root])
  let parent = copy as Record<string | number, unknown>
  for (const segment of path.slice(1, -1)) {
    if (!parent || typeof parent !== 'object')
      throw new ConfigFormFlowDataError('FLOW_FIELD_UNAVAILABLE', 'The field value path no longer exists.', 'form.field')
    parent = parent[segment] as Record<string | number, unknown>
  }
  if (!parent || typeof parent !== 'object')
    throw new ConfigFormFlowDataError('FLOW_FIELD_UNAVAILABLE', 'The field value path no longer exists.', 'form.field')
  parent[path[path.length - 1]!] = cloneConfigFormFlowData(value)
  values[root] = copy
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (left instanceof Date || right instanceof Date)
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime()
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right))
    return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key)
      && equalValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]))
}
