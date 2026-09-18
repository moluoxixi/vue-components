import type {
  ConfigFormScopePath,
  ConfigFormValueContext,
  ConfigFormValueReferenceScope,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormController,
  ConfigFormFieldInstance,
} from '@moluoxixi/config-form-headless'
import type { ConfigFormPageRuntimePlan } from '../../runtime'
import { selectConfigFormScopePath } from '@moluoxixi/config-form-core'

type ScopeController = Pick<ConfigFormController, 'listFieldInstances'>

/** Resolve stable field IDs for Data/value-reference consumers without an event payload. */
export function createRendererValueContext(
  plan: ConfigFormPageRuntimePlan | undefined,
  controller: ScopeController,
  values: Readonly<Record<string, unknown>>,
  scope: ConfigFormScopePath = [],
  sourceNodeId?: string,
  variables: Readonly<Record<string, unknown>> = {},
  instances: readonly ConfigFormFieldInstance[] = controller.listFieldInstances(),
): ConfigFormValueContext {
  if (!plan)
    return { variables }

  const declared = new Set(plan.valueSchema.scopedFields.map(field => field.nodeId))
  return {
    variables,
    resolveField: (nodeId, selector) => {
      if (!declared.has(nodeId))
        return { found: false }
      const instance = selectRendererFieldInstance(
        instances.filter(instance => instance.address.nodeId === nodeId),
        scope,
        selector,
        {
          schema: plan.valueSchema,
          sourceNodeId,
        },
      )
      if (!instance)
        return { found: false }
      const resolution = readValuePath(values, instance.valuePath)
      return resolution.found ? resolution : { found: false }
    },
  }
}

/** Select a field in its data scope; object parents retain their enclosing row identity. */
export function selectRendererFieldInstance(
  instances: readonly ConfigFormFieldInstance[],
  scope: ConfigFormScopePath,
  selector: ConfigFormValueReferenceScope,
  context?: {
    schema: ConfigFormPageRuntimePlan['valueSchema']
    sourceNodeId?: string
  },
): ConfigFormFieldInstance | undefined {
  if (!context) {
    const selected = selectConfigFormScopePath(scope, selector)
    return instances.find(instance => sameRendererScope(instance.address.scope, selected))
  }

  const scopes = new Map(context.schema.valueScopes.map(definition => [definition.nodeId, definition]))
  const sourceField = context.schema.scopedFields.find(field => field.nodeId === context.sourceNodeId)
  const current = context.sourceNodeId !== undefined && scopes.has(context.sourceNodeId)
    ? context.sourceNodeId
    : sourceField?.scopeId
  if (selector !== 'root' && context.sourceNodeId !== undefined && !sourceField && !scopes.has(context.sourceNodeId))
    return undefined
  if (selector === 'parent' && current === undefined)
    return undefined
  const owner = selector === 'root'
    ? undefined
    : selector === 'parent' ? scopes.get(current!)?.parentId : current
  const arrayChain: string[] = []
  const visited = new Set<string>()
  let cursor = owner
  while (cursor !== undefined) {
    if (visited.has(cursor))
      return undefined
    visited.add(cursor)
    const definition = scopes.get(cursor)
    if (!definition)
      return undefined
    if (definition.kind === 'array')
      arrayChain.unshift(cursor)
    cursor = definition.parentId
  }
  if (!arrayChain.every((scopeId, index) => scope[index]?.scopeId === scopeId))
    return undefined
  const selected = scope.slice(0, arrayChain.length)
  return instances.find(instance => instance.ownerScopeId === owner
    && sameRendererScope(instance.address.scope, selected))
}

export function isRendererScopeActive(
  controller: Pick<ConfigFormController, 'listRows'>,
  scope: ConfigFormScopePath,
): boolean {
  const parent: Array<{ scopeId: string, rowId: string }> = []
  try {
    for (const entry of scope) {
      if (!controller.listRows(entry.scopeId, parent).some(row => row.rowId === entry.rowId))
        return false
      parent.push({ ...entry })
    }
    return true
  }
  catch {
    return false
  }
}

export function rendererScopeStartsWith(
  scope: ConfigFormScopePath,
  prefix: ConfigFormScopePath,
): boolean {
  return prefix.length <= scope.length && prefix.every((entry, index) =>
    entry.scopeId === scope[index]?.scopeId && entry.rowId === scope[index]?.rowId)
}

export function sameRendererScope(
  left: ConfigFormScopePath,
  right: ConfigFormScopePath,
): boolean {
  return left.length === right.length && rendererScopeStartsWith(left, right)
}

export function readValuePath(
  values: Readonly<Record<string, unknown>>,
  path: readonly (number | string)[],
): { found: boolean, value?: unknown } {
  let current: unknown = values
  for (const segment of path) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, segment))
      return { found: false }
    current = (current as Record<number | string, unknown>)[segment]
  }
  return { found: true, value: current }
}
