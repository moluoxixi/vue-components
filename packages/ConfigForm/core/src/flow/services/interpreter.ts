import type { ConfigFormJsonObject } from '../../json'
import type {
  ConfigFormReactionCondition,
  ConfigFormReactionProjection,
} from '../../reaction'
import type { ConfigFormValueContext, ConfigFormValueInput } from '../../value-reference'
import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowActionNodeConfig,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowEvent,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowFormApi,
  ConfigFormFlowRunOptions,
  ConfigFormFlowRunResult,
  ConfigFormFlowRuntimeDescriptor,
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTransaction,
} from '../types'
import { applyConfigFormReactionList, evaluateConfigFormReactionCondition } from '../../reaction'
import { ConfigFormValueReferenceError, resolveConfigFormValueInput } from '../../value-reference'
import {
  CONFIG_FORM_FLOW_DEFAULT_TIMEOUT_MS,
  CONFIG_FORM_FLOW_MAX_QUEUE_SIZE,
  CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS,
  CONFIG_FORM_FLOW_MAX_TRACE_EVENTS,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_VERSION,
} from '../constants'
import { getConfigFormFlowActionDescriptorDiagnostic } from './actions'
import {
  cloneConfigFormFlowData,
  ConfigFormFlowDataError,
  createConfigFormFlowFormApi,
  flowDataErrorFromCause,
  resolveConfigFormFlowInput,
  snapshotConfigFormFlowTraceValue,
} from './event'
import { analyzeConfigFormFlow } from './plan'

interface QueuedFlowRun {
  flow: ConfigFormFlowRuntimeDescriptor
  plan: ConfigFormFlowExecutionPlan
  options: ConfigFormFlowRunOptions
  resolve: (result: ConfigFormFlowRunResult) => void
  reject: (reason: unknown) => void
  cleanup: () => void
  settled: boolean
}

interface NodeTraceState {
  hasInput: boolean
  hasOutput: boolean
  input?: unknown
  output?: unknown
}

interface NodeExecutionOutcome {
  next?: string
  blocked?: boolean
}

export class ConfigFormFlowInterpreter {
  readonly runtimeVersion = CONFIG_FORM_FLOW_RUNTIME_VERSION

  private readonly active = new Map<string, { controller: AbortController, promise: Promise<ConfigFormFlowRunResult> }>()
  private readonly latestSupersessions = new Map<string, number>()
  private readonly queues = new Map<string, QueuedFlowRun[]>()

  constructor(private readonly actions: ConfigFormFlowActionRegistry = { get: () => undefined }) {}

  abort(reason: unknown = 'disposed'): void {
    for (const queue of this.queues.values()) {
      for (const entry of queue) {
        entry.settled = true
        entry.cleanup()
        entry.resolve(abortedRunResult(entry.flow, entry.options))
      }
    }
    this.queues.clear()
    for (const active of this.active.values())
      active.controller.abort(reason)
    this.active.clear()
    this.latestSupersessions.clear()
  }

  run(flowOrPlan: ConfigFormFlow | ConfigFormFlowExecutionPlan, options: ConfigFormFlowRunOptions = {}): Promise<ConfigFormFlowRunResult> {
    const planResult = 'topologicalOrder' in flowOrPlan
      ? { success: true as const, plan: flowOrPlan }
      : analyzeConfigFormFlow(flowOrPlan)
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
        diagnostics: [...planResult.diagnostics],
        error: planResult.diagnostics[0],
      })
    }
    const plan = planResult.plan
    const flow = flowDescriptorFromPlan(planResult.plan)
    const key = schedulerKey(flow.id, options.concurrencyKey)
    if (options.signal?.aborted)
      return Promise.resolve(abortedRunResult(flow, options))
    const active = this.active.get(key)
    const concurrency = flow.concurrency ?? 'latest'
    if (active) {
      if (concurrency === 'ignore') {
        const runId = options.runId ?? createRunId()
        return Promise.resolve({
          status: 'ignored',
          flowId: flow.id,
          runId,
          revision: options.revision ?? 0,
          values: { ...(options.values ?? {}) },
          outputs: {},
          projection: emptyReactionProjection(options.values),
          trace: [],
          diagnostics: [],
        })
      }
      if (concurrency === 'latest') {
        const supersessions = (this.latestSupersessions.get(key) ?? 0) + 1
        if (supersessions > CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS)
          return Promise.resolve(reentryLimitResult(flow, options))
        this.latestSupersessions.set(key, supersessions)
        active.controller.abort('superseded')
      }
      else {
        return this.enqueue(flow, plan, options)
      }
    }
    return this.start(flow, plan, options)
  }

  private start(
    flow: ConfigFormFlowRuntimeDescriptor,
    plan: ConfigFormFlowExecutionPlan,
    options: ConfigFormFlowRunOptions,
  ): Promise<ConfigFormFlowRunResult> {
    const key = schedulerKey(flow.id, options.concurrencyKey)
    const controller = new AbortController()
    const unlink = linkAbortSignal(options.signal, controller)
    const mergedOptions = { ...options, values: options.readValues?.() ?? options.values, signal: controller.signal }
    const promise = this.execute(plan, flow, mergedOptions).then(async (result) => {
      if (controller.signal.aborted)
        return { ...result, status: 'aborted' as const }
      await options.onComplete?.(result)
      return result
    }).finally(() => {
      unlink()
      if (this.active.get(key)?.promise === promise) {
        this.active.delete(key)
        this.startNextQueuedRun(key)
        this.latestSupersessions.delete(key)
      }
    })
    this.active.set(key, { controller, promise })
    return promise
  }

  private enqueue(
    flow: ConfigFormFlowRuntimeDescriptor,
    plan: ConfigFormFlowExecutionPlan,
    options: ConfigFormFlowRunOptions,
  ): Promise<ConfigFormFlowRunResult> {
    const key = schedulerKey(flow.id, options.concurrencyKey)
    const queue = this.queues.get(key) ?? []
    if (queue.length >= CONFIG_FORM_FLOW_MAX_QUEUE_SIZE)
      return Promise.resolve(queueLimitResult(flow, options))

    return new Promise<ConfigFormFlowRunResult>((resolve, reject) => {
      const entry: QueuedFlowRun = {
        cleanup: () => {},
        flow,
        plan,
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
        resolve(abortedRunResult(flow, options))
      }
      if (options.signal) {
        options.signal.addEventListener('abort', abort, { once: true })
        entry.cleanup = () => options.signal?.removeEventListener('abort', abort)
      }
      if (options.signal?.aborted) {
        abort()
        return
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
    this.start(next.flow, next.plan, next.options).then(next.resolve, next.reject)
  }

  private async execute(
    plan: ConfigFormFlowExecutionPlan,
    flow: ConfigFormFlowRuntimeDescriptor,
    options: ConfigFormFlowRunOptions,
  ): Promise<ConfigFormFlowRunResult> {
    const runId = options.runId ?? createRunId()
    const revision = options.revision ?? 0
    let originalValues: Record<string, unknown>
    let initialSnapshot: Record<string, unknown>
    let values: Record<string, unknown>
    let event: ConfigFormFlowEvent
    try {
      originalValues = { ...(options.values ?? {}) }
      initialSnapshot = cloneConfigFormFlowData(originalValues)
      values = cloneConfigFormFlowData(initialSnapshot)
      event = cloneConfigFormFlowData(options.event ?? { trigger: flow.trigger, args: [] })
    }
    catch (cause) {
      const dataError = flowDataErrorFromCause(cause)
      const error: ConfigFormFlowDiagnostic = {
        code: dataError.code,
        message: dataError.message,
        ...(dataError.path ? { path: dataError.path } : {}),
      }
      return {
        status: 'failure',
        flowId: flow.id,
        runId,
        revision,
        values: {},
        outputs: {},
        projection: emptyReactionProjection({}),
        trace: [],
        diagnostics: [error],
        error,
      }
    }
    const initialValues = { ...values }
    const transaction = options.createTransaction?.({
      event,
      signal: options.signal ?? new AbortController().signal,
      values,
    })
    const form: ConfigFormFlowFormApi = {
      ...createConfigFormFlowFormApi(values, options.signal),
      ...(transaction?.form ?? {}),
    }
    const outputs: Record<string, unknown> = {}
    const projection = emptyReactionProjection(values)
    const trace: ConfigFormFlowTraceEvent[] = []
    const diagnostics: ConfigFormFlowDiagnostic[] = []
    const startedAt = Date.now()
    let traceLimited = false

    const addDiagnostic = (diagnostic: ConfigFormFlowDiagnostic): void => {
      diagnostics.push(diagnostic)
    }
    const emit = (candidate: Omit<ConfigFormFlowTraceEvent, 'timestamp'> & { timestamp?: number }): void => {
      const traceEvent: ConfigFormFlowTraceEvent = {
        ...candidate,
        timestamp: candidate.timestamp ?? Date.now(),
        durationMs: candidate.durationMs ?? 0,
      }
      if (trace.length < CONFIG_FORM_FLOW_MAX_TRACE_EVENTS - 2) {
        trace.push(traceEvent)
      }
      else {
        if (!traceLimited) {
          traceLimited = true
          const diagnostic: ConfigFormFlowDiagnostic = {
            code: 'FLOW_TRACE_LIMIT_EXCEEDED',
            message: `Flow trace is limited to ${CONFIG_FORM_FLOW_MAX_TRACE_EVENTS} events.`,
            severity: 'warning',
          }
          addDiagnostic(diagnostic)
          const limitEvent: ConfigFormFlowTraceEvent = {
            type: 'error',
            flowId: flow.id,
            runId,
            revision,
            error: diagnostic.message,
            timestamp: Date.now(),
            durationMs: Date.now() - startedAt,
            truncated: true,
          }
          trace.push(limitEvent)
          options.onTrace?.(limitEvent)
        }
        if (trace.length < CONFIG_FORM_FLOW_MAX_TRACE_EVENTS)
          trace.push(traceEvent)
        else
          trace[CONFIG_FORM_FLOW_MAX_TRACE_EVENTS - 1] = traceEvent
      }
      options.onTrace?.(traceEvent)
    }

    emit({ type: 'start', flowId: flow.id, runId, revision })
    let currentId: string | undefined = plan.triggerNodeId
    let status: ConfigFormFlowRunResult['status'] = 'end'
    let error: ConfigFormFlowRunResult['error']
    while (currentId) {
      if (options.signal?.aborted) {
        emit({ type: 'abort', flowId: flow.id, runId, revision, nodeId: currentId, status: 'aborted', durationMs: Date.now() - startedAt })
        status = 'aborted'
        break
      }
      const node = plan.nodes.find(candidate => candidate.id === currentId)
      if (!node) {
        status = 'failure'
        error = { code: 'FLOW_NODE_UNKNOWN', message: `Unknown execution node: ${currentId}`, nodeId: currentId }
        addDiagnostic(error)
        break
      }
      const nodeStartedAt = Date.now()
      const beforeValues = { ...values }
      const traceState: NodeTraceState = { hasInput: false, hasOutput: false }
      emit({ type: 'enter', flowId: flow.id, runId, revision, nodeId: node.id })
      try {
        const outcome = await this.executeNode(
          node,
          flow,
          values,
          outputs,
          projection,
          runId,
          revision,
          event,
          diagnostics,
          traceState,
          options,
          form,
          transaction,
        )
        options.signal?.throwIfAborted()
        const details = createTraceDetails(traceState, beforeValues, values, node.id, diagnostics)
        emit({
          type: 'exit',
          flowId: flow.id,
          runId,
          revision,
          nodeId: node.id,
          durationMs: Date.now() - nodeStartedAt,
          ...details,
        })
        if (node.type === 'success') {
          status = 'success'
          break
        }
        if (node.type === 'failure') {
          status = 'failure'
          if (!error) {
            error = { code: 'FLOW_TERMINAL_FAILURE', message: 'The event flow reached a failure terminal.', nodeId: node.id }
            addDiagnostic(error)
          }
          break
        }
        if (node.type === 'end') {
          status = 'end'
          break
        }
        if (node.type === 'blocked' || outcome.blocked) {
          status = 'blocked'
          break
        }
        currentId = outcome.next
      }
      catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        if (isAbortError(cause, options.signal)) {
          emit({
            type: 'abort',
            flowId: flow.id,
            runId,
            revision,
            nodeId: node.id,
            status: 'aborted',
            error: message,
            durationMs: Date.now() - nodeStartedAt,
            ...createTraceDetails(traceState, beforeValues, values, node.id, diagnostics),
          })
          status = 'aborted'
          break
        }
        const diagnostic = diagnosticFromCause(cause, node.id)
        addDiagnostic(diagnostic)
        const timeout = diagnostic.code === 'FLOW_TIMEOUT'
        const failureStatus = timeout ? 'timeout' : 'failure'
        emit({
          type: 'error',
          flowId: flow.id,
          runId,
          revision,
          nodeId: node.id,
          status: failureStatus,
          error: diagnostic.message,
          durationMs: Date.now() - nodeStartedAt,
          ...createTraceDetails(traceState, beforeValues, values, node.id, diagnostics),
        })

        if (node.policy?.onError === 'continue') {
          currentId = nextNode(node)
          continue
        }

        status = failureStatus
        error = diagnostic
        const errorEdge = node.outgoing.find(edge => edge.condition === 'error')
        const useGlobalEnd = node.policy?.onError === undefined && flow.errorPolicy?.onError === 'end'
        if (errorEdge && !useGlobalEnd) {
          currentId = errorEdge.target
          continue
        }
        if (useGlobalEnd && !timeout)
          status = 'end'
        break
      }
    }
    emit({ type: 'finish', flowId: flow.id, runId, revision, status, durationMs: Date.now() - startedAt })
    // Keep the runtime's reference-based patch limited to actual writes, without
    // sharing the transaction's local objects with its original input.
    const resultValues = { ...values }
    for (const [key, initialValue] of Object.entries(initialValues)) {
      if (Object.hasOwn(values, key) && Object.is(values[key], initialValue)
        && equalFlowData(initialSnapshot[key], initialValue)) {
        resultValues[key] = originalValues[key]
      }
    }
    projection.values = { ...resultValues }
    return {
      status,
      flowId: flow.id,
      runId,
      revision,
      values: resultValues,
      outputs,
      projection,
      trace,
      diagnostics,
      ...(error ? { error } : {}),
    }
  }

  private async executeNode(
    node: ConfigFormFlowExecutionPlan['nodes'][number],
    flow: ConfigFormFlowRuntimeDescriptor,
    values: Record<string, unknown>,
    outputs: Record<string, unknown>,
    flowProjection: ConfigFormReactionProjection<Record<string, unknown>>,
    runId: string,
    revision: number,
    event: ConfigFormFlowEvent,
    diagnostics: ConfigFormFlowDiagnostic[],
    trace: NodeTraceState,
    options: ConfigFormFlowRunOptions,
    form: ConfigFormFlowFormApi,
    transaction: ConfigFormFlowTransaction | undefined,
  ): Promise<NodeExecutionOutcome> {
    const signal = options.signal
    if (signal?.aborted)
      throw abortReason(signal.reason)

    const executable = node.type === 'action' || node.type === 'reaction'
    if (executable && node.policy?.when) {
      const matches = evaluateFlowCondition(node.policy.when as unknown as ConfigFormReactionCondition, values, outputs, event, 'policy.when', options, transaction)
      if (!matches) {
        trace.hasInput = true
        trace.input = node.config ?? null
        trace.hasOutput = true
        trace.output = { skipped: true }
        return { next: nextNode(node) }
      }
    }

    if (node.type === 'condition') {
      const condition = node.config?.condition
      if (!condition || typeof condition !== 'object')
        throw flowDataErrorFromCause(new Error('Condition node config.condition is required.'), 'config.condition')
      trace.hasInput = true
      trace.input = condition
      const matches = evaluateFlowCondition(condition as ConfigFormReactionCondition, values, outputs, event, 'config.condition', options, transaction)
      trace.hasOutput = true
      trace.output = matches
      return {
        next: node.outgoing.find(edge => edge.condition === (matches ? 'true' : 'false'))?.target
          ?? nextNode(node),
      }
    }

    if (node.type === 'reaction') {
      const reactions = node.config?.reactions
      if (!Array.isArray(reactions))
        throw flowDataErrorFromCause(new Error('Reaction node config.reactions is required.'), 'config.reactions')
      trace.hasInput = true
      trace.input = reactions
      let projected: ConfigFormReactionProjection<Record<string, unknown>>
      try {
        const valueContext = readFlowValueContext(options, values, event, outputs, transaction)
        projected = applyConfigFormReactionList(reactions as never, values, {
          strict: true,
          scope: createFlowExpressionScope(valueContext, event, outputs, 'config.reactions'),
        })
      }
      catch (cause) {
        throw flowDataErrorFromCause(cause, 'config.reactions')
      }
      Object.keys(values).forEach(key => delete values[key])
      Object.assign(values, projected.values)
      mergeReactionProjection(flowProjection, projected)
      trace.hasOutput = true
      trace.output = projected
      const blocked = node.policy?.stopWhen
        ? evaluateFlowCondition(node.policy.stopWhen as unknown as ConfigFormReactionCondition, values, outputs, event, 'policy.stopWhen', options, transaction)
        : false
      return { blocked, next: nextNode(node) }
    }

    if (node.type === 'action') {
      const action = node.ref ? this.actions.get(node.ref) : undefined
      if (!action) {
        throw flowDataErrorFromCause(
          new ConfigFormFlowInterpreterError('FLOW_ACTION_UNKNOWN', `Unknown flow action: ${node.ref ?? '(missing ref)'}`, 'ref'),
        )
      }
      const descriptorDiagnostic = getConfigFormFlowActionDescriptorDiagnostic(node.ref!, action, this.actions)
      if (descriptorDiagnostic)
        diagnostics.push({ ...descriptorDiagnostic, nodeId: descriptorDiagnostic.nodeId ?? node.id })
      const config = (node.config ?? {}) as ConfigFormFlowActionNodeConfig
      const input = resolveConfigFormFlowInput(
        config.input,
        values,
        outputs,
        event,
        'config.input',
        readFlowValueContext(options, values, event, outputs, transaction),
      )
      trace.hasInput = true
      trace.input = input
      const controller = new AbortController()
      const unlink = linkAbortSignal(signal, controller)
      const context: ConfigFormFlowActionContext = {
        flow,
        node,
        revision,
        runId,
        signal: controller.signal,
        values: cloneConfigFormFlowData(values),
        outputs: cloneConfigFormFlowData(outputs),
        event: cloneConfigFormFlowData(event),
        form: createActionFormApi(form, controller.signal, node.id),
      }
      const timeoutMs = node.policy?.timeoutMs
        ?? flow.errorPolicy?.timeoutMs
        ?? CONFIG_FORM_FLOW_DEFAULT_TIMEOUT_MS
      try {
        const output = await withTimeout(() => action.execute(input, context), timeoutMs, controller)
        Object.defineProperty(outputs, node.id, {
          configurable: true,
          enumerable: true,
          value: output,
          writable: true,
        })
        trace.hasOutput = true
        trace.output = output
        if (config.output) {
          for (const [field, mapping] of Object.entries(config.output)) {
            form.setValue(
              field,
              resolveConfigFormFlowInput(
                mapping,
                values,
                outputs,
                event,
                `config.output.${field}`,
                readFlowValueContext(options, values, event, outputs, transaction),
              ),
            )
          }
        }
        const blocked = node.policy?.stopWhen
          ? evaluateFlowCondition(node.policy.stopWhen as unknown as ConfigFormReactionCondition, values, outputs, event, 'policy.stopWhen', options, transaction)
          : false
        return { blocked, next: nextNode(node) }
      }
      finally {
        unlink()
        if (!controller.signal.aborted)
          controller.abort('action settled')
      }
    }
    return { next: nextNode(node) }
  }
}

function createActionFormApi(
  form: ConfigFormFlowFormApi,
  signal: AbortSignal,
  nodeId: string,
): ConfigFormFlowFormApi {
  const guard = <Args extends unknown[], Result>(
    name: keyof ConfigFormFlowFormApi,
    method: (...args: Args) => Result,
    copy?: 'read' | 'write',
  ) => (...args: Args): Result => {
    if (signal.aborted) {
      throw Object.assign(new ConfigFormFlowInterpreterError(
        'FLOW_ACTION_INACTIVE',
        `Flow action "${nodeId}" is no longer active.`,
        `form.${name}`,
      ), { nodeId })
    }
    const result = method.apply(form, copy === 'write' ? args.map(arg => cloneConfigFormFlowData(arg)) as Args : args)
    return copy === 'read' ? cloneConfigFormFlowData(result) : result
  }
  return {
    getValue: guard('getValue', form.getValue),
    getValues: guard('getValues', form.getValues),
    setValue: guard('setValue', form.setValue),
    setValues: guard('setValues', form.setValues),
    ...(form.getField ? { getField: guard('getField', form.getField, 'read') } : {}),
    ...(form.setField ? { setField: guard('setField', form.setField, 'write') } : {}),
    ...(form.getVariable ? { getVariable: guard('getVariable', form.getVariable, 'read') } : {}),
    ...(form.setVariable ? { setVariable: guard('setVariable', form.setVariable, 'write') } : {}),
    ...(form.setFieldState ? { setFieldState: guard('setFieldState', form.setFieldState) } : {}),
  }
}

function evaluateFlowCondition(
  condition: ConfigFormReactionCondition,
  values: Record<string, unknown>,
  outputs: Record<string, unknown>,
  event: ConfigFormFlowEvent,
  path: string,
  options: ConfigFormFlowRunOptions,
  transaction?: ConfigFormFlowTransaction,
): boolean {
  try {
    const valueContext = readFlowValueContext(options, values, event, outputs, transaction)
    return evaluateConfigFormReactionCondition(condition, values, {
      strict: true,
      scope: createFlowExpressionScope(valueContext, event, outputs, path),
    })
  }
  catch (cause) {
    throw flowDataErrorFromCause(cause, path)
  }
}

function readFlowValueContext(
  options: ConfigFormFlowRunOptions,
  values: Record<string, unknown>,
  event: ConfigFormFlowEvent,
  outputs: Record<string, unknown>,
  transaction?: ConfigFormFlowTransaction,
): ConfigFormValueContext | undefined {
  if (!transaction?.readValueContext && !options.readValueContext && options.valueContext === undefined)
    return undefined

  let provided: ConfigFormValueContext
  try {
    provided = transaction?.readValueContext
      ? transaction.readValueContext(outputs)
      : options.readValueContext
        ? options.readValueContext(values, event, outputs)
        : options.valueContext!
  }
  catch (cause) {
    throw new ConfigFormFlowInterpreterError(
      'FLOW_VALUE_CONTEXT_FAILED',
      cause instanceof Error ? cause.message : 'Reading the flow value context failed.',
      'readValueContext',
    )
  }
  if (typeof provided !== 'object' || provided === null || Array.isArray(provided)) {
    throw new ConfigFormFlowInterpreterError(
      'FLOW_VALUE_CONTEXT_INVALID',
      'Flow value context must be an object.',
      options.readValueContext ? 'readValueContext' : 'valueContext',
    )
  }
  return {
    event,
    fields: provided.fields,
    outputs,
    resolveField: provided.resolveField,
    variables: provided.variables,
  }
}

function createFlowExpressionScope(
  context: ConfigFormValueContext | undefined,
  event: ConfigFormFlowEvent,
  outputs: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  if (!context)
    return { $event: event, $outputs: outputs }
  return {
    $event: event,
    $fields: createValueReferenceRoot('field', context, path),
    $outputs: createValueReferenceRoot('output', context, path),
    $variables: createValueReferenceRoot('variable', context, path),
  }
}

function createValueReferenceRoot(
  kind: 'field' | 'output' | 'variable',
  context: ConfigFormValueContext,
  path: string,
): Record<string, unknown> {
  const resolve = (id: string): unknown => {
    const input: ConfigFormValueInput = kind === 'field'
      ? { $ref: { kind, nodeId: id } }
      : kind === 'output'
        ? { $ref: { kind, stepId: id } }
        : { $ref: { kind, variableId: id } }
    try {
      return resolveConfigFormValueInput(input, context)
    }
    catch (cause) {
      if (cause instanceof ConfigFormValueReferenceError)
        throw new ConfigFormFlowDataError(cause.code, cause.message, path)
      throw cause
    }
  }
  return new Proxy(Object.create(null) as Record<string, unknown>, {
    get: (_target, property) => typeof property === 'string' ? resolve(property) : undefined,
    getOwnPropertyDescriptor: (_target, property) => typeof property === 'string'
      ? { configurable: true, enumerable: true, value: resolve(property), writable: false }
      : undefined,
  })
}

function nextNode(node: ConfigFormFlowExecutionPlan['nodes'][number]): string | undefined {
  return node.outgoing.find(edge => edge.condition === 'next' || edge.condition === undefined)?.target
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

export class ConfigFormFlowInterpreterError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

export class FlowTimeoutError extends ConfigFormFlowInterpreterError {
  constructor() {
    super('FLOW_TIMEOUT', 'Flow action timed out.', 'policy.timeoutMs')
  }
}

async function withTimeout(execute: () => unknown, timeoutMs: number, controller: AbortController): Promise<unknown> {
  const signal = controller.signal
  if (signal.aborted)
    throw abortReason(signal.reason)
  return new Promise((resolve, reject) => {
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
      // Revoke host capabilities before output mapping or the next node can run.
      controller.abort('action settled')
      callback()
    }
    const rejectValue = (reason: unknown): void => settle(() => reject(reason))
    const acceptValue = (value: unknown): void => {
      if (settled)
        return
      try {
        // Snapshot at observation, before abort listeners or queued host work mutate it.
        const output = cloneConfigFormFlowData(value)
        settle(() => resolve(output))
      }
      catch (reason) {
        rejectValue(reason)
      }
    }
    const rejectThenable = (): void => rejectValue(new ConfigFormFlowInterpreterError(
      'FLOW_ACTION_THENABLE_UNSUPPORTED',
      'Flow actions must return cloneable data or a native Promise, not a custom or unreadable thenable.',
      'execute',
    ))
    abortListener = () => settle(() => reject(abortReason(signal.reason)))
    signal.addEventListener('abort', abortListener, { once: true })
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        const error = new FlowTimeoutError()
        controller.abort(error)
        settle(() => reject(error))
      }, timeoutMs)
    }
    Promise.resolve().then(() => {
      try {
        signal.throwIfAborted()
        const value = execute()
        if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
          let then: unknown
          try {
            then = Reflect.get(value, 'then')
          }
          catch {
            rejectThenable()
            return
          }
          if (typeof then === 'function') {
            try {
              // The intrinsic brands native Promises across realms without calling
              // a host then method. Access expires when this observer runs.
              Promise.prototype.then.call(value, acceptValue, rejectValue)
            }
            catch {
              rejectThenable()
            }
            return
          }
        }
        acceptValue(value)
      }
      catch (reason) {
        rejectValue(reason)
      }
    }).catch(reason => settle(() => reject(reason)))
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

function isAbortError(cause: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (cause instanceof DOMException && cause.name === 'AbortError')
}

function diagnosticFromCause(cause: unknown, nodeId: string): ConfigFormFlowDiagnostic {
  const record = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : undefined
  return {
    code: typeof record?.code === 'string' ? record.code : 'FLOW_NODE_ERROR',
    message: typeof record?.message === 'string'
      ? record.message
      : cause instanceof Error ? cause.message : String(cause),
    nodeId: typeof record?.nodeId === 'string' ? record.nodeId : nodeId,
    ...(typeof record?.path === 'string' ? { path: record.path } : {}),
    ...(typeof record?.edgeId === 'string' ? { edgeId: record.edgeId } : {}),
  }
}

function createTraceDetails(
  state: NodeTraceState,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  nodeId: string,
  diagnostics: ConfigFormFlowDiagnostic[],
): Pick<ConfigFormFlowTraceEvent, 'input' | 'output' | 'valuePatch' | 'truncated'> {
  const details: Pick<ConfigFormFlowTraceEvent, 'input' | 'output' | 'valuePatch' | 'truncated'> = {}
  let truncated = false
  if (state.hasInput) {
    const snapshot = snapshotConfigFormFlowTraceValue(state.input)
    details.input = snapshot.value
    truncated ||= snapshot.truncated
  }
  if (state.hasOutput) {
    const snapshot = snapshotConfigFormFlowTraceValue(state.output)
    details.output = snapshot.value
    truncated ||= snapshot.truncated
  }
  const patch = shallowValuePatch(before, after)
  if (patch) {
    const snapshot = snapshotConfigFormFlowTraceValue(patch)
    details.valuePatch = snapshot.value as ConfigFormJsonObject
    truncated ||= snapshot.truncated
  }
  if (truncated) {
    details.truncated = true
    if (!diagnostics.some(diagnostic => diagnostic.code === 'FLOW_TRACE_VALUE_LIMIT_EXCEEDED' && diagnostic.nodeId === nodeId)) {
      diagnostics.push({
        code: 'FLOW_TRACE_VALUE_LIMIT_EXCEEDED',
        message: 'A flow trace value was truncated to its JSON snapshot budget.',
        nodeId,
        path: 'trace',
        severity: 'warning',
      })
    }
  }
  return details
}

function shallowValuePatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { remove: string[], set: Record<string, unknown> } | undefined {
  const remove = Object.keys(before).filter(key => !Object.hasOwn(after, key))
  const set = Object.fromEntries(Object.entries(after).filter(([key, value]) => !Object.hasOwn(before, key) || !Object.is(before[key], value)))
  return remove.length > 0 || Object.keys(set).length > 0 ? { remove, set } : undefined
}

function equalFlowData(before: unknown, after: unknown): boolean {
  if (Object.is(before, after))
    return true
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object')
    return false
  if (before instanceof Date || after instanceof Date)
    return before instanceof Date && after instanceof Date && Object.is(before.getTime(), after.getTime())
  if (Object.getPrototypeOf(before) !== Object.getPrototypeOf(after)
    || (Array.isArray(before) && before.length !== (after as unknown[]).length)) {
    return false
  }
  const keys = Object.keys(before)
  return keys.length === Object.keys(after).length && keys.every(key => Object.hasOwn(after, key)
    && equalFlowData((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key]))
}

function abortedRunResult(
  flow: ConfigFormFlowRuntimeDescriptor,
  options: ConfigFormFlowRunOptions,
): ConfigFormFlowRunResult {
  return {
    status: 'aborted',
    flowId: flow.id,
    runId: options.runId ?? createRunId(),
    revision: options.revision ?? 0,
    values: { ...(options.values ?? {}) },
    outputs: {},
    projection: emptyReactionProjection(options.values),
    trace: [],
    diagnostics: [],
  }
}

function reentryLimitResult(
  flow: ConfigFormFlowRuntimeDescriptor,
  options: ConfigFormFlowRunOptions,
): ConfigFormFlowRunResult {
  return schedulerLimitResult(
    flow,
    options,
    'FLOW_REENTRY_LIMIT_EXCEEDED',
    `Flow cannot be superseded more than ${CONFIG_FORM_FLOW_MAX_REENTRANT_RUNS} times without settling.`,
  )
}

function queueLimitResult(
  flow: ConfigFormFlowRuntimeDescriptor,
  options: ConfigFormFlowRunOptions,
): ConfigFormFlowRunResult {
  return schedulerLimitResult(
    flow,
    options,
    'FLOW_QUEUE_LIMIT_EXCEEDED',
    `Flow queue cannot contain more than ${CONFIG_FORM_FLOW_MAX_QUEUE_SIZE} pending runs.`,
  )
}

function schedulerLimitResult(
  flow: ConfigFormFlowRuntimeDescriptor,
  options: ConfigFormFlowRunOptions,
  code: string,
  message: string,
): ConfigFormFlowRunResult {
  const runId = options.runId ?? createRunId()
  const revision = options.revision ?? 0
  const timestamp = Date.now()
  const error: ConfigFormFlowDiagnostic = { code, message }
  const trace: ConfigFormFlowTraceEvent[] = [
    { type: 'start', flowId: flow.id, runId, revision, timestamp, durationMs: 0 },
    { type: 'error', flowId: flow.id, runId, revision, timestamp, durationMs: 0, status: 'failure', error: error.message },
    { type: 'finish', flowId: flow.id, runId, revision, timestamp, durationMs: 0, status: 'failure' },
  ]
  trace.forEach(event => options.onTrace?.(event))
  return {
    status: 'failure',
    flowId: flow.id,
    runId,
    revision,
    values: { ...(options.values ?? {}) },
    outputs: {},
    projection: emptyReactionProjection(options.values),
    trace,
    diagnostics: [error],
    error,
  }
}

function flowDescriptorFromPlan(plan: ConfigFormFlowExecutionPlan): ConfigFormFlowRuntimeDescriptor {
  return {
    runtimeVersion: CONFIG_FORM_FLOW_RUNTIME_VERSION,
    version: CONFIG_FORM_FLOW_VERSION,
    id: plan.flowId,
    name: plan.name,
    trigger: cloneConfigFormFlowData(plan.trigger),
    ...(plan.concurrency === undefined ? {} : { concurrency: plan.concurrency }),
    ...(plan.errorPolicy === undefined ? {} : { errorPolicy: cloneConfigFormFlowData(plan.errorPolicy) }),
  }
}

function createRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function schedulerKey(flowId: string, concurrencyKey: string | undefined): string {
  return concurrencyKey === undefined ? flowId : `${flowId}\u0000${concurrencyKey}`
}
