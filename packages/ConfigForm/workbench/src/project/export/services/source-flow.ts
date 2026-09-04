import type { ConfigFormFlowExecutionPlan } from '@moluoxixi/config-form-core'
import { CONFIG_FORM_FLOW_RUNTIME_VERSION } from '@moluoxixi/config-form-core'
import { scriptJson } from './source-serialization'

export function createStandaloneFlowRuntimeSource(plans: readonly ConfigFormFlowExecutionPlan[]): string {
  const serialized = scriptJson(plans, 2)
  return `export const FLOW_RUNTIME_VERSION = ${CONFIG_FORM_FLOW_RUNTIME_VERSION} as const

export type FlowTrigger = { kind: 'page.mount' | 'form.submit' | 'field.change' | 'component.event', field?: string, nodeId?: string, event?: string }
export type FlowValues = Record<string, unknown>
export type FlowAction = (input: unknown, context: { flowId: string, nodeId: string, values: FlowValues, outputs: Readonly<Record<string, unknown>>, signal: AbortSignal }) => unknown | Promise<unknown>
export type GeneratedFlowNode = { id: string, type: string, ref?: string, config?: Record<string, unknown>, outgoing: GeneratedFlowEdge[], incoming: GeneratedFlowEdge[] }
export type GeneratedFlowEdge = { id: string, source: string, target: string, condition?: string }
export type GeneratedFlow = { version: 1, flowId: string, name: string, trigger: FlowTrigger, concurrency?: 'latest' | 'queue' | 'ignore', triggerNodeId: string, topologicalOrder: string[], nodes: GeneratedFlowNode[], errorPolicy?: { onError: 'failure' | 'end', timeoutMs?: number } }
export type FlowProjection = { props: Record<string, Record<string, unknown>>, states: Record<string, Record<string, boolean>>, validate: string[] }
export type FlowExecutionStatus = 'success' | 'failure' | 'end' | 'aborted' | 'timeout' | 'ignored'
export type FlowDispatchStatus = 'committed' | 'noop' | 'ignored' | 'aborted' | 'failure' | 'timeout'
export type FlowDispatchResult = { status: FlowDispatchStatus, values: FlowValues, error?: string }

export const flowPlans = ${serialized} as readonly GeneratedFlow[]
const actions: Record<string, FlowAction> = Object.create(null)
const activeRuns = new Map<string, { controller: AbortController, promise: Promise<FlowExecutionResult> }>()
const queuedRuns = new Map<string, QueuedFlowRun[]>()
const flowProjections = new Map<string, FlowProjection>()

export function registerFlowAction(ref: string, action: FlowAction): void {
  if (!ref || typeof action !== 'function')
    throw new Error('Flow action refs must be non-empty and executable.')
  actions[ref] = action
}

export function getFlowProjection(): FlowProjection {
  const projection = emptyProjection()
  for (const flow of flowPlans) {
    const current = flowProjections.get(flow.flowId)
    if (current)
      mergeProjection(projection, current)
  }
  return projection
}

class FlowTimeoutError extends Error {
  constructor() {
    super('Flow action timed out.')
    this.name = 'FlowTimeoutError'
  }
}

interface FlowExecutionResult {
  status: FlowExecutionStatus
  values: FlowValues
  projection: FlowProjection
  error?: string
}

interface QueuedFlowRun {
  flow: GeneratedFlow
  input: FlowValues
  signal?: AbortSignal
  resolve: (result: FlowExecutionResult) => void
  reject: (error: unknown) => void
  cleanup: () => void
  settled: boolean
}

function emptyProjection(): FlowProjection {
  return { props: Object.create(null), states: Object.create(null), validate: [] }
}

function cloneProjection(projection: FlowProjection): FlowProjection {
  return {
    props: Object.fromEntries(Object.entries(projection.props).map(([key, value]) => [key, { ...value }])),
    states: Object.fromEntries(Object.entries(projection.states).map(([key, value]) => [key, { ...value }])),
    validate: [...projection.validate],
  }
}

function mergeProjection(target: FlowProjection, next: FlowProjection): void {
  for (const [key, value] of Object.entries(next.props))
    target.props[key] = { ...(target.props[key] ?? {}), ...value }
  for (const [key, value] of Object.entries(next.states))
    target.states[key] = { ...(target.states[key] ?? {}), ...value }
  target.validate = [...new Set([...target.validate, ...next.validate])]
}

async function withTimeout<T>(value: T | Promise<T>, timeoutMs: number | undefined, controller: AbortController): Promise<T> {
  const signal = controller.signal
  if (signal.aborted)
    throw abortReason(signal.reason)
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const cleanup = (): void => {
      if (timer !== undefined)
        clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
    const finish = (callback: () => void): void => {
      if (settled)
        return
      settled = true
      cleanup()
      callback()
    }
    const abort = (): void => finish(() => reject(abortReason(signal.reason)))
    signal.addEventListener('abort', abort, { once: true })
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        const error = new FlowTimeoutError()
        controller.abort(error)
        finish(() => reject(error))
      }, timeoutMs)
    }
    Promise.resolve(value).then(result => finish(() => resolve(result)), error => finish(() => reject(error)))
  })
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source)
    return () => {}
  const abort = (): void => target.abort(source.reason)
  if (source.aborted) {
    abort()
    return () => {}
  }
  source.addEventListener('abort', abort, { once: true })
  return () => source.removeEventListener('abort', abort)
}

function abortReason(reason: unknown): Error {
  return reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError')
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) || Array.isArray(right))
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index]))
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  return keys.length === Object.keys(rightRecord).length && keys.every(key => Object.hasOwn(rightRecord, key) && equal(leftRecord[key], rightRecord[key]))
}

function operand(value: unknown, values: FlowValues, outputs: Record<string, unknown>): unknown {
  if (Array.isArray(value))
    return value.map(item => operand(item, values, outputs))
  if (!value || typeof value !== 'object')
    return value
  const record = value as Record<string, unknown>
  // Preserve the current Core reaction AST in the standalone projection,
  // which uses { kind: 'field' | 'literal' } operands rather than the
  // generator's internal $field/$output shorthand.
  if (record.kind === 'field' && typeof record.field === 'string')
    return values[record.field]
  if (record.kind === 'literal' && Object.hasOwn(record, 'value'))
    return operand(record.value, values, outputs)
  if (Object.keys(record).length === 1 && typeof record.$field === 'string')
    return values[record.$field]
  if (Object.keys(record).length === 1 && typeof record.$output === 'string')
    return outputs[record.$output]
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, operand(child, values, outputs)]))
}

function condition(value: unknown, values: FlowValues): boolean {
  if (!value || typeof value !== 'object')
    return Boolean(value)
  const item = value as Record<string, unknown>
  if (item.kind === 'literal') return Boolean(item.value)
  if (item.kind === 'not') return !condition(item.expression, values)
  if (item.kind === 'and') return Array.isArray(item.expressions) && item.expressions.every(expression => condition(expression, values))
  if (item.kind === 'or') return Array.isArray(item.expressions) && item.expressions.some(expression => condition(expression, values))
  if (item.kind === 'compare') {
    const left = operand(item.left, values, {})
    const right = operand(item.right, values, {})
    switch (item.operator) {
      case 'eq': return equal(left, right)
      case 'neq': return !equal(left, right)
      case 'gt': return typeof left === typeof right && (left as any) > (right as any)
      case 'gte': return typeof left === typeof right && (left as any) >= (right as any)
      case 'lt': return typeof left === typeof right && (left as any) < (right as any)
      case 'lte': return typeof left === typeof right && (left as any) <= (right as any)
      case 'in': return Array.isArray(right) && right.some(value => equal(left, value))
      case 'contains': return typeof left === 'string' && typeof right === 'string' ? left.includes(right) : Array.isArray(left) && left.some(value => equal(value, right))
      default: return false
    }
  }
  return false
}

function reactionProjection(reactions: Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>, values: FlowValues, outputs: Record<string, unknown>): FlowProjection {
  const maxPasses = Math.max(16, reactions.length * 4)
  const seen = new Set<string>()
  let converged = false
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const before = JSON.stringify(values)
    if (before !== undefined)
      seen.add(before)
    for (const reaction of reactions) {
      if (reaction.enabled === false)
        continue
      const effects = condition(reaction.when, values) ? reaction.then : (reaction.else ?? [])
      for (const effect of effects) {
        if (effect.kind === 'setValue' && typeof effect.target === 'string')
          values[effect.target] = operand(effect.value, values, outputs)
        else if (effect.kind === 'clearValue' && typeof effect.target === 'string')
          delete values[effect.target]
      }
    }
    const after = JSON.stringify(values)
    if (before === after) {
      converged = true
      break
    }
    if (after !== undefined && seen.has(after))
      throw new Error('ConfigForm reactions did not converge because their value effects form a cycle.')
  }
  if (!converged)
    throw new Error('ConfigForm reactions exceeded the convergence limit.')

  const projection = emptyProjection()
  for (const reaction of reactions) {
    if (reaction.enabled === false)
      continue
    const effects = condition(reaction.when, values) ? reaction.then : (reaction.else ?? [])
    for (const effect of effects) {
      if (typeof effect.target !== 'string')
        continue
      if (effect.kind === 'setProps' && effect.props && typeof effect.props === 'object')
        projection.props[effect.target] = Object.fromEntries(Object.entries(effect.props).map(([key, value]) => [key, operand(value, values, outputs)]))
      else if (effect.kind === 'setState' && effect.state && typeof effect.state === 'object')
        projection.states[effect.target] = Object.fromEntries(Object.entries(effect.state).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>
      else if (effect.kind === 'validate')
        projection.validate.push(effect.target)
    }
  }
  return projection
}

export function evaluateRuntimeCondition(value: unknown, values: FlowValues): boolean {
  return condition(value, values)
}

export function projectRuntimeReactions(
  reactions: Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>,
  values: FlowValues,
): FlowProjection {
  return reactionProjection(reactions, values, {})
}

export async function invokeRegisteredAction(
  ref: string,
  input: unknown,
  context: { eventName?: string, nodeId: string, values: FlowValues, signal: AbortSignal },
): Promise<unknown> {
  const action = actions[ref]
  if (!action)
    throw new Error('Missing generated action: ' + ref)
  return action(input, {
    flowId: context.eventName ? 'event:' + context.eventName : 'manual',
    nodeId: context.nodeId,
    values: context.values,
    outputs: {},
    signal: context.signal,
  })
}

async function executeFlow(flow: GeneratedFlow, input: FlowValues, controller: AbortController): Promise<FlowExecutionResult> {
  const signal = controller.signal
  const values = { ...input }
  const outputs: Record<string, unknown> = {}
  const projection = emptyProjection()
  const byId = new Map(flow.nodes.map(node => [node.id, node]))
  const outgoing = (id: string) => byId.get(id)?.outgoing ?? []
  let current: string | undefined = flow.triggerNodeId
  let guard = 0
  let status: FlowExecutionStatus = 'end'
  let flowError: string | undefined
  while (current && guard++ < flow.nodes.length * 2) {
    if (signal.aborted) {
      status = 'aborted'
      break
    }
    const node = byId.get(current)
    if (!node)
      break
    if (node.type === 'condition') {
      const matches = condition(node.config?.condition, values)
      current = outgoing(current).find(edge => edge.condition === (matches ? 'true' : 'false'))?.target
    }
    else if (node.type === 'reaction') {
      const reactions = (Array.isArray(node.config?.reactions) ? node.config.reactions : []) as Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>
      mergeProjection(projection, reactionProjection(reactions, values, outputs))
      current = outgoing(current).find(edge => edge.condition === 'next')?.target ?? outgoing(current).find(edge => edge.condition === undefined)?.target
    }
    else if (node.type === 'action') {
      try {
        const action = node.ref ? actions[node.ref] : undefined
        if (!action)
          throw new Error('Missing generated flow action: ' + (node.ref ?? node.id))
        const actionController = new AbortController()
        const unlink = linkAbortSignal(signal, actionController)
        let result: unknown
        try {
          result = await withTimeout(action(operand(node.config?.input, values, outputs), { flowId: flow.flowId, nodeId: node.id, values, outputs, signal: actionController.signal }), flow.errorPolicy?.timeoutMs, actionController)
        }
        finally {
          unlink()
        }
        outputs[node.id] = result
        if (node.config?.output && typeof node.config.output === 'object') {
          for (const [field, mapping] of Object.entries(node.config.output))
            values[field] = operand(mapping, values, outputs)
        }
        current = outgoing(node.id).find(edge => edge.condition === 'next')?.target ?? outgoing(node.id).find(edge => edge.condition === undefined)?.target
      }
      catch (error) {
        const timeout = error instanceof FlowTimeoutError
        const aborted = signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
        // Superseded/externally aborted runs must never enter a configured
        // failure branch. Timeout aborts are handled as failures below so the
        // explicit timeout policy remains observable.
        if (aborted && !timeout) {
          status = 'aborted'
          break
        }
        const failure = outgoing(node.id).find(edge => edge.condition === 'error')
        flowError = error instanceof Error ? error.message : String(error)
        if (failure && flow.errorPolicy?.onError === 'failure') {
          current = failure.target
          continue
        }
        if (flow.errorPolicy?.onError === 'end' && !timeout) {
          status = 'end'
          break
        }
        status = timeout ? 'timeout' : 'failure'
        break
      }
    }
    else if (node.type === 'success') {
      status = 'success'
      break
    }
    else if (node.type === 'failure') {
      status = 'failure'
      break
    }
    else if (node.type === 'end') {
      status = 'end'
      break
    }
    else current = outgoing(current).find(edge => edge.condition === 'next')?.target ?? outgoing(current).find(edge => edge.condition === undefined)?.target
  }
  return { status, values, projection, ...(flowError ? { error: flowError } : {}) }
}

function abortedExecution(input: FlowValues): FlowExecutionResult {
  return { status: 'aborted', values: { ...input }, projection: emptyProjection() }
}

function startFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  if (signal?.aborted)
    return Promise.resolve(abortedExecution(input))
  const controller = new AbortController()
  const unlink = linkAbortSignal(signal, controller)
  const promise = executeFlow(flow, input, controller).finally(() => {
    unlink()
    if (activeRuns.get(flow.flowId)?.promise !== promise)
      return
    activeRuns.delete(flow.flowId)
    startNextQueuedRun(flow.flowId)
  })
  activeRuns.set(flow.flowId, { controller, promise })
  return promise
}

function startNextQueuedRun(flowId: string): void {
  const queue = queuedRuns.get(flowId)
  let next = queue?.shift()
  while (next?.settled)
    next = queue?.shift()
  if (!next) {
    queuedRuns.delete(flowId)
    return
  }
  if (queue?.length === 0)
    queuedRuns.delete(flowId)
  next.settled = true
  next.cleanup()
  startFlow(next.flow, next.input, next.signal).then(next.resolve, next.reject)
}

function enqueueFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  return new Promise((resolve, reject) => {
    const queue = queuedRuns.get(flow.flowId) ?? []
    const entry: QueuedFlowRun = {
      cleanup: () => {},
      flow,
      input: { ...input },
      signal,
      resolve,
      reject,
      settled: false,
    }
    const abort = (): void => {
      if (entry.settled)
        return
      entry.settled = true
      entry.cleanup()
      const index = queue.indexOf(entry)
      if (index >= 0)
        queue.splice(index, 1)
      if (queue.length === 0)
        queuedRuns.delete(flow.flowId)
      resolve(abortedExecution(input))
    }
    if (signal) {
      signal.addEventListener('abort', abort, { once: true })
      entry.cleanup = () => signal.removeEventListener('abort', abort)
    }
    queue.push(entry)
    queuedRuns.set(flow.flowId, queue)
  })
}

function scheduleFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  if (signal?.aborted)
    return Promise.resolve(abortedExecution(input))
  const active = activeRuns.get(flow.flowId)
  if (!active)
    return startFlow(flow, input, signal)
  const concurrency = flow.concurrency ?? 'latest'
  if (concurrency === 'ignore')
    return Promise.resolve({ status: 'ignored', values: { ...input }, projection: emptyProjection() })
  if (concurrency === 'latest') {
    active.controller.abort('superseded')
    return startFlow(flow, input, signal)
  }
  return enqueueFlow(flow, input, signal)
}

function replaceValues(target: FlowValues, source: FlowValues): void {
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key))
      delete target[key]
  }
  Object.assign(target, source)
}

export function applyFlowValuePatch(target: FlowValues, before: FlowValues, after: FlowValues): void {
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key))
      delete target[key]
  }
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key) || !Object.is(before[key], value))
      target[key] = value
  }
}

export async function runFlows(trigger: FlowTrigger, input: FlowValues = {}, signal?: AbortSignal): Promise<FlowDispatchResult> {
  const values = { ...input }
  const projectionUpdates = new Map<string, FlowProjection>()
  let matched = false
  let committed = false
  let flowError: string | undefined
  for (const flow of flowPlans) {
    if (
      flow.trigger.kind !== trigger.kind
      || (flow.trigger.field && flow.trigger.field !== trigger.field)
      || (flow.trigger.nodeId && flow.trigger.nodeId !== trigger.nodeId)
      || (flow.trigger.event && flow.trigger.event !== trigger.event)
    )
      continue
    matched = true
    const result = await scheduleFlow(flow, values, signal)
    if (result.status === 'success' || result.status === 'end') {
      committed = true
      replaceValues(values, result.values)
      projectionUpdates.set(flow.flowId, result.projection)
      flowError = result.error ?? flowError
      continue
    }
    if (result.status === 'ignored')
      continue
    return { status: result.status, values: { ...input }, ...(result.error ? { error: result.error } : {}) }
  }
  if (!matched)
    return { status: 'noop', values: { ...input } }
  if (!committed)
    return { status: 'ignored', values: { ...input } }
  for (const [flowId, projection] of projectionUpdates)
    flowProjections.set(flowId, cloneProjection(projection))
  return { status: 'committed', values, ...(flowError ? { error: flowError } : {}) }
}
`
}
