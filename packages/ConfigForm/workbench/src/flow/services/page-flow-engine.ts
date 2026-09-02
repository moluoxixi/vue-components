import type {
  ConfigFormFlowDiagnostic,
  ConfigFormFlowExecutionPlan,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type {
  PageFlowEngine,
  PageFlowEngineDispatchInput,
  PageFlowEngineOptions,
  PageFlowEngineSyncInput,
  WorkbenchPageFlowEngineOptions,
} from '../types'
import { ConfigFormFlowInterpreter } from '@moluoxixi/config-form-core'
import { computed, shallowRef } from 'vue'
import {
  applyPreviewFlowValuePatch,
  createWorkbenchFlowActionRegistry,
  PreviewFlowCoordinator,
} from '../../preview'
import { cloneWorkbenchJson } from '../../utils'

export function createPageFlowEngine(options: PageFlowEngineOptions): PageFlowEngine {
  const coordinator = new PreviewFlowCoordinator(new ConfigFormFlowInterpreter(options.actions))
  const plans = shallowRef<readonly ConfigFormFlowExecutionPlan[]>([])
  const projections = shallowRef<Record<string, ConfigFormReactionProjection<Record<string, unknown>>>>({})
  let pageKey = ''
  let generation = 0
  let disposed = false

  const projection = computed<ConfigFormReactionProjection<Record<string, unknown>>>(() => {
    const merged: ConfigFormReactionProjection<Record<string, unknown>> = {
      values: options.readValues(),
      props: {},
      states: {},
      validate: [],
    }
    const validate = new Set<string>()
    for (const plan of plans.value) {
      const current = projections.value[plan.flowId]
      if (!current)
        continue
      for (const [field, fieldProps] of Object.entries(current.props))
        merged.props[field] = { ...merged.props[field], ...fieldProps }
      for (const [field, fieldStates] of Object.entries(current.states))
        merged.states[field] = { ...merged.states[field], ...fieldStates }
      current.validate.forEach(field => validate.add(field))
    }
    merged.validate = [...validate]
    return merged
  })

  function sync(input: PageFlowEngineSyncInput): void {
    generation += 1
    const pageChanged = pageKey !== input.pageKey
    pageKey = input.pageKey
    plans.value = [...input.plans]
    const activeIds = new Set(input.plans.map(plan => plan.flowId))
    if (pageChanged) {
      projections.value = {}
      return
    }
    projections.value = Object.fromEntries(
      Object.entries(projections.value).filter(([flowId]) => activeIds.has(flowId)),
    )
  }

  async function dispatch(input: PageFlowEngineDispatchInput) {
    const dispatchGeneration = generation
    let traceDiagnostic: ConfigFormFlowDiagnostic | undefined
    const isCurrent = (): boolean => !disposed
      && dispatchGeneration === generation
      && !input.signal?.aborted
      && (input.isCurrent?.() ?? true)
    const result = await coordinator.dispatch({
      plans: plans.value,
      trigger: cloneWorkbenchJson(input.trigger),
      values: cloneWorkbenchJson(input.values),
      revision: input.revision,
      signal: input.signal,
      isCurrent,
      onTrace: (event) => {
        if (!isCurrent())
          return
        options.onTrace?.(event)
        if (event.type === 'error' && event.error) {
          traceDiagnostic = {
            code: 'FLOW_ACTION_FAILED',
            message: event.error,
            ...(event.nodeId ? { nodeId: event.nodeId } : {}),
          }
        }
      },
    })
    if (!isCurrent())
      return result
    const terminalDiagnostic = (result.status === 'failure' || result.status === 'timeout')
      ? result.error ?? traceDiagnostic
      : traceDiagnostic
    if (terminalDiagnostic)
      options.onDiagnostic?.(terminalDiagnostic)
    if (result.status !== 'committed')
      return result

    const activeIds = new Set(plans.value.map(plan => plan.flowId))
    const retained = Object.fromEntries(
      Object.entries(projections.value).filter(([flowId]) => activeIds.has(flowId)),
    )
    projections.value = { ...retained, ...result.projectionUpdates }
    options.writeValues(applyPreviewFlowValuePatch(options.readValues(), result.valuePatch))
    return result
  }

  function clear(): void {
    generation += 1
    pageKey = ''
    plans.value = []
    projections.value = {}
  }

  function dispose(): void {
    disposed = true
    clear()
  }

  return {
    projection,
    clear,
    dispatch,
    dispose,
    sync,
  }
}

export function createWorkbenchPageFlowEngine(
  options: WorkbenchPageFlowEngineOptions,
): PageFlowEngine {
  return createPageFlowEngine({
    ...options,
    actions: createWorkbenchFlowActionRegistry(options.onNotify),
  })
}
