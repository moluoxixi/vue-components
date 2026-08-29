import type { ConfigFormReactionProjection } from '../types'
import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowActionNodeConfig,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowRunOptions,
  ConfigFormFlowRunResult,
  ConfigFormFlowTraceEvent,
} from './types'
import { applyConfigFormReactionList, evaluateConfigFormReactionCondition } from '../reaction'
import { analyzeConfigFormFlow } from './plan'

interface QueuedFlowRun {
  flow: ConfigFormFlow
  options: ConfigFormFlowRunOptions
  resolve: (result: ConfigFormFlowRunResult) => void
  reject: (reason: unknown) => void
  cleanup: () => void
  settled: boolean
}

export class ConfigFormFlowInterpreter {
  private readonly active = new Map<string, { controller: AbortController, promise: Promise<ConfigFormFlowRunResult> }>()
  private readonly queues = new Map<string, QueuedFlowRun[]>()

  constructor(private readonly actions: ConfigFormFlowActionRegistry = { get: () => undefined }) {}

  run(flowOrPlan: ConfigFormFlow | ConfigFormFlowExecutionPlan, options: ConfigFormFlowRunOptions = {}): Promise<ConfigFormFlowRunResult> {
    const planResult = 'topologicalOrder' in flowOrPlan
      ? { success: true as const, plan: flowOrPlan, flow: { id: flowOrPlan.flowId } as ConfigFormFlow }
      : analyzeConfigFormFlow(flowOrPlan, options.revision ?? 0)
    if (!planResult.success) {
      const runId = options.runId ?? createRunId()
      const flowId = 'id' in flowOrPlan ? flowOrPlan.id : flowOrPlan.flowId
      return Promise.resolve({
        status: 'failure',
        flowId,
        runId,
        revision: options.revision ?? 0,
        values: { ...(options.values ?? {}) },
        outputs: {},
        projection: emptyReactionProjection(options.values),
        trace: [],
        error: planResult.diagnostics[0],
      })
    }
    const plan = planResult.plan
    const flow = 'nodes' in flowOrPlan && 'trigger' in flowOrPlan ? flowOrPlan : planResult.flow
    const key = flow.id
    if (options.signal?.aborted)
      return Promise.resolve(abortedRunResult(flow, plan, options))
    const active = this.active.get(key)
    const concurrency = flow.concurrency ?? 'latest'
    if (active) {
      if (concurrency === 'ignore') {
        const runId = options.runId ?? createRunId()
        return Promise.resolve({
          status: 'ignored',
          flowId: key,
          runId,
          revision: options.revision ?? plan.revision,
          values: { ...(options.values ?? {}) },
          outputs: {},
          projection: emptyReactionProjection(options.values),
          trace: [],
        })
      }
      if (concurrency === 'latest') {
        active.controller.abort('superseded')
      }
      else {
        return this.enqueue(flow, plan, options)
      }
    }
    return this.start(flow, plan, options)
  }

  private start(
    flow: ConfigFormFlow,
    plan: ConfigFormFlowExecutionPlan,
    options: ConfigFormFlowRunOptions,
  ): Promise<ConfigFormFlowRunResult> {
    const key = flow.id
    const controller = new AbortController()
    const unlink = linkAbortSignal(options.signal, controller)
    const mergedOptions = { ...options, signal: controller.signal }
    const promise = this.execute(plan, flow, mergedOptions).finally(() => {
      unlink()
      if (this.active.get(key)?.promise === promise) {
        this.active.delete(key)
        this.startNextQueuedRun(key)
      }
    })
    this.active.set(key, { controller, promise })
    return promise
  }

  private enqueue(
    flow: ConfigFormFlow,
    plan: ConfigFormFlowExecutionPlan,
    options: ConfigFormFlowRunOptions,
  ): Promise<ConfigFormFlowRunResult> {
    const key = flow.id
    return new Promise<ConfigFormFlowRunResult>((resolve, reject) => {
      const queue = this.queues.get(key) ?? []
      const entry: QueuedFlowRun = {
        cleanup: () => {},
        flow,
        options,
        reject,
        resolve,
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
          this.queues.delete(key)
        resolve(abortedRunResult(flow, plan, options))
      }
      if (options.signal) {
        options.signal.addEventListener('abort', abort, { once: true })
        entry.cleanup = () => options.signal?.removeEventListener('abort', abort)
      }
      queue.push(entry)
      this.queues.set(key, queue)
    })
  }

  private startNextQueuedRun(key: string): void {
    const queue = this.queues.get(key)
    let next = queue?.shift()
    while (next?.settled)
      next = queue?.shift()
    if (!next) {
      this.queues.delete(key)
      return
    }
    if (queue?.length === 0)
      this.queues.delete(key)
    next.settled = true
    next.cleanup()
    this.run(next.flow, next.options).then(next.resolve, next.reject)
  }

  private async execute(plan: ConfigFormFlowExecutionPlan, flow: ConfigFormFlow, options: ConfigFormFlowRunOptions): Promise<ConfigFormFlowRunResult> {
    const runId = options.runId ?? createRunId()
    const revision = options.revision ?? plan.revision
    const values = { ...(options.values ?? {}) }
    const outputs: Record<string, unknown> = {}
    const projection = emptyReactionProjection(values)
    const trace: ConfigFormFlowTraceEvent[] = []
    const emit = (event: ConfigFormFlowTraceEvent): void => {
      trace.push(event)
      options.onTrace?.(event)
    }
    emit({ type: 'start', flowId: flow.id, runId, revision })
    let currentId: string | undefined = plan.triggerNodeId
    let status: ConfigFormFlowRunResult['status'] = 'end'
    let error: ConfigFormFlowRunResult['error']
    while (currentId) {
      if (options.signal?.aborted) {
        emit({ type: 'abort', flowId: flow.id, runId, revision, nodeId: currentId, status: 'aborted' })
        status = 'aborted'
        break
      }
      const node = plan.nodes.find(candidate => candidate.id === currentId)
      if (!node) {
        status = 'failure'
        error = { code: 'FLOW_NODE_UNKNOWN', message: `Unknown execution node: ${currentId}`, nodeId: currentId }
        break
      }
      emit({ type: 'enter', flowId: flow.id, runId, revision, nodeId: node.id })
      try {
        const next = await this.executeNode(node, flow, values, outputs, projection, runId, revision, options.signal)
        emit({ type: 'exit', flowId: flow.id, runId, revision, nodeId: node.id })
        if (node.type === 'success') {
          status = 'success'
          break
        }
        if (node.type === 'failure') {
          status = 'failure'
          break
        }
        if (node.type === 'end') {
          status = 'end'
          break
        }
        currentId = next
      }
      catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        if (options.signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
          emit({ type: 'abort', flowId: flow.id, runId, revision, nodeId: node.id, status: 'aborted', error: message })
          status = 'aborted'
          break
        }
        const timeout = cause instanceof FlowTimeoutError
        status = timeout ? 'timeout' : 'failure'
        error = { code: timeout ? 'FLOW_TIMEOUT' : 'FLOW_NODE_ERROR', message, nodeId: node.id }
        emit({ type: 'error', flowId: flow.id, runId, revision, nodeId: node.id, status, error: message })
        const errorEdge = node.outgoing.find(edge => edge.condition === 'error')
        if (errorEdge && flow.errorPolicy?.onError === 'failure') {
          currentId = errorEdge.target
          continue
        }
        // `onError: 'end'` is an explicit terminal policy. Preserve timeout
        // diagnostics while treating ordinary action errors as a clean end;
        // otherwise the policy would be indistinguishable from the default
        // failure behaviour to callers.
        if (flow.errorPolicy?.onError === 'end' && !timeout)
          status = 'end'
        break
      }
    }
    emit({ type: 'finish', flowId: flow.id, runId, revision, status })
    projection.values = { ...values }
    return { status, flowId: flow.id, runId, revision, values, outputs, projection, trace, ...(error ? { error } : {}) }
  }

  private async executeNode(
    node: ConfigFormFlowExecutionPlan['nodes'][number],
    flow: ConfigFormFlow,
    values: Record<string, unknown>,
    outputs: Record<string, unknown>,
    flowProjection: ConfigFormReactionProjection<Record<string, unknown>>,
    runId: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    if (signal?.aborted)
      throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
    if (node.type === 'condition') {
      const condition = node.config?.condition
      if (!condition || typeof condition !== 'object')
        throw new Error('Condition node config.condition is required.')
      const matches = evaluateConfigFormReactionCondition(condition as any, values)
      return node.outgoing.find(edge => edge.condition === (matches ? 'true' : 'false'))?.target
        ?? node.outgoing.find(edge => edge.condition === 'next')?.target
    }
    if (node.type === 'reaction') {
      const reactions = node.config?.reactions
      if (!Array.isArray(reactions))
        throw new Error('Reaction node config.reactions is required.')
      const projection = applyConfigFormReactionList(reactions as any, values)
      Object.keys(values).forEach(key => delete values[key])
      Object.assign(values, projection.values)
      mergeReactionProjection(flowProjection, projection)
      return node.outgoing.find(edge => edge.condition === 'next' || edge.condition === undefined)?.target
    }
    if (node.type === 'action') {
      const action = node.ref ? this.actions.get(node.ref) : undefined
      if (!action)
        throw new Error(`Unknown flow action: ${node.ref ?? '(missing ref)'}`)
      const config = (node.config ?? {}) as ConfigFormFlowActionNodeConfig
      const input = resolveValue(config.input, values, outputs)
      const controller = new AbortController()
      const unlink = linkAbortSignal(signal, controller)
      const context: ConfigFormFlowActionContext = { flow, node, revision, runId, signal: controller.signal, values, outputs }
      let result: unknown
      try {
        result = await withTimeout(action.execute(input, context), flow.errorPolicy?.timeoutMs, controller)
      }
      finally {
        unlink()
      }
      outputs[node.id] = result
      if (config.output) {
        for (const [field, mapping] of Object.entries(config.output))
          values[field] = resolveValue(mapping, values, outputs)
      }
      return node.outgoing.find(edge => edge.condition === 'next' || edge.condition === undefined)?.target
    }
    return node.outgoing.find(edge => edge.condition === 'next' || edge.condition === undefined)?.target
  }
}

function emptyReactionProjection(
  values: Record<string, unknown> | undefined,
): ConfigFormReactionProjection<Record<string, unknown>> {
  return {
    values: { ...(values ?? {}) },
    props: {},
    states: {},
    validate: [],
  }
}

function mergeReactionProjection(
  target: ConfigFormReactionProjection<Record<string, unknown>>,
  source: ConfigFormReactionProjection<Record<string, unknown>>,
): void {
  target.values = { ...source.values }
  for (const [field, props] of Object.entries(source.props))
    target.props[field] = { ...target.props[field], ...props }
  for (const [field, states] of Object.entries(source.states))
    target.states[field] = { ...target.states[field], ...states }
  target.validate = [...new Set([...target.validate, ...source.validate])]
}

export class FlowTimeoutError extends Error {
  constructor() {
    super('Flow action timed out.')
    this.name = 'FlowTimeoutError'
  }
}

async function withTimeout<T>(value: T | Promise<T>, timeoutMs: number | undefined, controller: AbortController): Promise<T> {
  const signal = controller.signal
  if (signal.aborted)
    throw abortReason(signal.reason)
  return new Promise<T>((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    let abortListener: (() => void) | undefined
    const cleanup = (): void => {
      if (timeout !== undefined)
        clearTimeout(timeout)
      if (abortListener)
        signal.removeEventListener('abort', abortListener)
    }
    const settle = (callback: () => void): void => {
      if (settled)
        return
      settled = true
      cleanup()
      callback()
    }
    abortListener = () => settle(() => reject(abortReason(signal.reason)))
    signal.addEventListener('abort', abortListener, { once: true })
    if (timeoutMs && timeoutMs > 0) {
      timeout = setTimeout(() => {
        const error = new FlowTimeoutError()
        controller.abort(error)
        settle(() => reject(error))
      }, timeoutMs)
    }
    Promise.resolve(value).then(
      result => settle(() => resolve(result)),
      reason => settle(() => reject(reason)),
    )
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

function abortedRunResult(
  flow: ConfigFormFlow,
  plan: ConfigFormFlowExecutionPlan,
  options: ConfigFormFlowRunOptions,
): ConfigFormFlowRunResult {
  return {
    status: 'aborted',
    flowId: flow.id,
    runId: options.runId ?? createRunId(),
    revision: options.revision ?? plan.revision,
    values: { ...(options.values ?? {}) },
    outputs: {},
    projection: emptyReactionProjection(options.values),
    trace: [],
  }
}

function resolveValue(value: unknown, values: Record<string, unknown>, outputs: Record<string, unknown>): unknown {
  if (Array.isArray(value))
    return value.map(item => resolveValue(item, values, outputs))
  if (!value || typeof value !== 'object')
    return value
  const record = value as Record<string, unknown>
  if (Object.keys(record).length === 1 && typeof record.$field === 'string')
    return values[record.$field]
  if (Object.keys(record).length === 1 && typeof record.$output === 'string')
    return outputs[record.$output]
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, resolveValue(child, values, outputs)]))
}

function createRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
