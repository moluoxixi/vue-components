import type { ConfigFormReactionProjection } from '../../reaction'
import type {
  ConfigFormEventRuntime,
  ConfigFormEventRuntimeOptions,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowDispatchInput,
  ConfigFormFlowDispatchResult,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowValuePatch,
} from '../types'
import { CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS } from '../constants'
import { cloneConfigFormFlowData } from './event'
import { ConfigFormFlowInterpreter } from './interpreter'
import { getConfigFormFlowTriggerKey } from './plan'

export function createConfigFormEventRuntime(options: ConfigFormEventRuntimeOptions): ConfigFormEventRuntime {
  const interpreter = new ConfigFormFlowInterpreter(options.actions)
  let plans: readonly ConfigFormFlowExecutionPlan[] = []
  let retained = new Map<string, { flowId: string, projection: ConfigFormReactionProjection<Record<string, unknown>> }>()
  let lifetime = new AbortController()
  let disposed = false
  let activeDispatches = 0

  function projection(): ConfigFormReactionProjection<Record<string, unknown>> {
    const merged: ConfigFormReactionProjection<Record<string, unknown>> = {
      values: options.readValues(),
      props: {},
      states: {},
      validate: [],
    }
    for (const retainedEntry of retained.values()) {
      const current = retainedEntry.projection
      for (const [field, props] of Object.entries(current.props))
        merged.props[field] = { ...merged.props[field], ...props }
      for (const [field, states] of Object.entries(current.states))
        merged.states[field] = { ...merged.states[field], ...states }
      merged.validate = [...new Set([...merged.validate, ...current.validate])]
    }
    return merged
  }

  function invalidate(): void {
    lifetime.abort('runtime changed')
    interpreter.abort('runtime changed')
    lifetime = new AbortController()
  }

  function sync(next: readonly ConfigFormFlowExecutionPlan[], settings?: { reset?: boolean }): void {
    if (disposed)
      return
    invalidate()
    plans = [...next]
    const ids = new Set(next.map(plan => plan.flowId))
    retained = settings?.reset
      ? new Map()
      : new Map([...retained].filter(([, entry]) => ids.has(entry.flowId)))
    options.onProjection?.(projection())
  }

  async function dispatch(input: ConfigFormFlowDispatchInput): Promise<ConfigFormFlowDispatchResult> {
    const scope = lifetime
    const isCurrent = (): boolean => !disposed && scope === lifetime && !scope.signal.aborted
      && !input.signal?.aborted && (input.isCurrent?.() ?? true)
    const response: ConfigFormFlowDispatchResult = {
      status: 'noop',
      results: [],
      valuePatch: { remove: [], set: {} },
      projectionUpdates: {},
      diagnostics: [],
    }
    if (!isCurrent())
      return { ...response, status: 'stale' }
    const matches = plans.filter(plan => getConfigFormFlowTriggerKey(plan.trigger) === getConfigFormFlowTriggerKey(input.trigger))
    if (matches.length === 0)
      return response
    if (activeDispatches >= CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS) {
      const error: ConfigFormFlowDiagnostic = {
        code: 'FLOW_REENTRY_LIMIT_EXCEEDED',
        message: `Flow runtime cannot exceed ${CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS} active dispatches.`,
      }
      response.diagnostics.push(error)
      options.onDiagnostic?.(error)
      return { ...response, status: 'failure', error }
    }
    activeDispatches += 1
    const controller = new AbortController()
    const abort = (): void => controller.abort('event cancelled')
    scope.signal.addEventListener('abort', abort, { once: true })
    input.signal?.addEventListener('abort', abort, { once: true })
    try {
      const event = cloneConfigFormFlowData(input.event ?? { trigger: input.trigger, args: [] })
      const concurrencyKey = getScopeConcurrencyKey(event.scope)
      for (const plan of matches) {
        let before: Record<string, unknown> = {}
        let transaction: ReturnType<NonNullable<ConfigFormEventRuntimeOptions['createTransaction']>> | undefined
        const result = await interpreter.run(plan, {
          event,
          revision: input.revision,
          concurrencyKey,
          signal: controller.signal,
          valueContext: options.valueContext,
          readValueContext: options.readValueContext,
          ...(options.createTransaction
            ? {
                createTransaction: (transactionInput) => {
                  transaction = options.createTransaction!(transactionInput)
                  return transaction
                },
              }
            : {}),
          readValues: () => {
            before = { ...options.readValues() }
            return before
          },
          onTrace: trace => isCurrent() && options.onTrace?.(trace),
          onComplete: async (completed) => {
            if (!isCurrent() || !['success', 'end', 'blocked'].includes(completed.status))
              return
            const patch = createConfigFormFlowValuePatch(before, completed.values)
            if (transaction)
              await transaction.commit(patch)
            else if (options.writeValuePatch)
              options.writeValuePatch(cloneValuePatch(patch))
            else {
              const current = options.readValues()
              const next = applyConfigFormFlowValuePatch(current, patch)
              if (next !== current)
                options.writeValues(next)
            }
            if (!isCurrent())
              return
            const executionKey = getFlowExecutionKey(plan.flowId, concurrencyKey)
            retained.set(executionKey, { flowId: plan.flowId, projection: completed.projection })
            response.projectionUpdates[executionKey] = completed.projection
            for (const key of patch.remove) {
              delete response.valuePatch.set[key]
              if (!response.valuePatch.remove.includes(key))
                response.valuePatch.remove.push(key)
            }
            for (const [key, value] of Object.entries(patch.set)) {
              response.valuePatch.set[key] = value
              response.valuePatch.remove = response.valuePatch.remove.filter(field => field !== key)
            }
            options.onProjection?.(projection())
          },
        })
        response.results.push(result)
        if (!isCurrent())
          return { ...response, status: 'stale' }
        for (const diagnostic of result.diagnostics) {
          response.diagnostics.push(diagnostic)
          options.onDiagnostic?.(diagnostic)
        }
        if (result.error)
          response.error = result.error
        if (result.status === 'success' || result.status === 'end') {
          response.status = 'committed'
          continue
        }
        if (result.status === 'blocked')
          return { ...response, status: 'blocked' }
        if (result.status === 'ignored') {
          if (response.status !== 'committed')
            response.status = 'ignored'
          continue
        }
        return { ...response, status: result.status }
      }
      return response
    }
    catch (cause) {
      const error = dispatchDiagnosticFromCause(cause)
      if (isCurrent()) {
        response.diagnostics.push(error)
        options.onDiagnostic?.(error)
      }
      return { ...response, status: isCurrent() ? 'failure' : 'stale', error }
    }
    finally {
      scope.signal.removeEventListener('abort', abort)
      input.signal?.removeEventListener('abort', abort)
      activeDispatches -= 1
    }
  }

  function clear(): void {
    invalidate()
    plans = []
    retained.clear()
    options.onProjection?.(projection())
  }

  return {
    get projection() { return projection() },
    sync,
    dispatch,
    clear,
    dispose: () => {
      if (disposed)
        return
      clear()
      disposed = true
    },
  }
}

export function createConfigFormFlowValuePatch(before: Record<string, unknown>, after: Record<string, unknown>): ConfigFormFlowValuePatch {
  return {
    remove: Object.keys(before).filter(key => !Object.hasOwn(after, key)),
    set: Object.fromEntries(Object.entries(after).filter(([key, value]) => !Object.hasOwn(before, key) || !Object.is(before[key], value))),
  }
}

export function applyConfigFormFlowValuePatch(current: Record<string, unknown>, patch: ConfigFormFlowValuePatch): Record<string, unknown> {
  if (!patch.remove.some(key => Object.hasOwn(current, key))
    && Object.entries(patch.set).every(([key, value]) => Object.hasOwn(current, key) && Object.is(current[key], value))) {
    return current
  }
  const next = { ...current, ...patch.set }
  patch.remove.forEach(key => delete next[key])
  return next
}

function getScopeConcurrencyKey(scope: readonly { scopeId: string, rowId: string }[] | undefined): string | undefined {
  return scope && scope.length > 0 ? JSON.stringify(scope) : undefined
}

function getFlowExecutionKey(flowId: string, concurrencyKey: string | undefined): string {
  return concurrencyKey === undefined ? flowId : `${flowId}\u0000${concurrencyKey}`
}

function cloneValuePatch(patch: ConfigFormFlowValuePatch): ConfigFormFlowValuePatch {
  return {
    remove: [...patch.remove],
    set: cloneConfigFormFlowData(patch.set),
  }
}

function dispatchDiagnosticFromCause(cause: unknown): ConfigFormFlowDiagnostic {
  const record = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : undefined
  return {
    code: typeof record?.code === 'string' ? record.code : 'FLOW_DISPATCH_ERROR',
    message: typeof record?.message === 'string'
      ? record.message
      : cause instanceof Error ? cause.message : String(cause),
    ...(typeof record?.path === 'string' ? { path: record.path } : {}),
    ...(typeof record?.nodeId === 'string' ? { nodeId: record.nodeId } : {}),
    ...(typeof record?.edgeId === 'string' ? { edgeId: record.edgeId } : {}),
  }
}
