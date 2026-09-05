import type {
  ConfigFormFlowInterpreter,
} from '@moluoxixi/config-form-core'
import type {
  PreviewFlowDispatchInput,
  PreviewFlowDispatchResult,
  PreviewFlowDispatchStatus,
  PreviewFlowValuePatch,
} from '../types'

const EMPTY_PATCH: PreviewFlowValuePatch = { remove: [], set: {} }

export class PreviewFlowCoordinator {
  constructor(private readonly interpreter: Pick<ConfigFormFlowInterpreter, 'run'>) {}

  async dispatch(input: PreviewFlowDispatchInput): Promise<PreviewFlowDispatchResult> {
    const isCurrent = (): boolean => !input.signal?.aborted && (input.isCurrent?.() ?? true)
    if (!isCurrent())
      return emptyResult('stale')

    const matchingPlans = input.plans.filter(plan => plan.trigger.kind === input.trigger.kind
      && (!plan.trigger.nodeId || plan.trigger.nodeId === input.trigger.nodeId)
      && (!plan.trigger.event || plan.trigger.event === input.trigger.event))
    if (matchingPlans.length === 0)
      return emptyResult('noop')

    const initialValues = { ...input.values }
    let nextValues = { ...input.values }
    let committed = false
    const projectionUpdates: PreviewFlowDispatchResult['projectionUpdates'] = {}

    for (const plan of matchingPlans) {
      const result = await this.interpreter.run(plan, {
        revision: input.revision,
        signal: input.signal,
        values: nextValues,
        onTrace: event => isCurrent() && input.onTrace?.(event),
      })
      if (!isCurrent())
        return emptyResult('stale')
      if (result.status === 'success' || result.status === 'end') {
        committed = true
        nextValues = result.values
        projectionUpdates[plan.flowId] = result.projection
        continue
      }
      if (result.status === 'ignored')
        continue
      return {
        ...emptyResult(result.status),
        ...(result.error ? { error: result.error } : {}),
      }
    }

    if (!committed)
      return emptyResult('ignored')
    return {
      status: 'committed',
      valuePatch: createPreviewFlowValuePatch(initialValues, nextValues),
      projectionUpdates,
    }
  }
}

export function applyPreviewFlowValuePatch(
  current: Record<string, unknown>,
  patch: PreviewFlowValuePatch,
): Record<string, unknown> {
  const next = { ...current }
  let changed = false
  patch.remove.forEach((key) => {
    if (!Object.hasOwn(next, key))
      return
    delete next[key]
    changed = true
  })
  for (const [key, value] of Object.entries(patch.set)) {
    if (Object.hasOwn(next, key) && Object.is(next[key], value))
      continue
    next[key] = value
    changed = true
  }
  return changed ? next : current
}

export function createPreviewFlowValuePatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): PreviewFlowValuePatch {
  const set: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key) || !Object.is(before[key], value))
      set[key] = value
  }
  return {
    remove: Object.keys(before).filter(key => !Object.hasOwn(after, key)),
    set,
  }
}

function emptyResult(status: Exclude<PreviewFlowDispatchStatus, 'committed'>): PreviewFlowDispatchResult {
  return {
    status,
    valuePatch: EMPTY_PATCH,
    projectionUpdates: {},
  }
}
