import type {
  ConfigFormFlow,
  ConfigFormFlowActionContext,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowFormApi,
} from '@moluoxixi/config-form-core'
import type {
  RuntimeHostActionCancelMessage,
  RuntimeHostActionIdentity,
  RuntimeHostActionRequestMessage,
  RuntimeHostActionResultMessage,
  RuntimeHostMessageBase,
} from '../types'
import {
  analyzeConfigFormFlow,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_VERSION,
  createConfigFormEventRuntime,
  createConfigFormFlowFormApi,
} from '@moluoxixi/config-form-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import {
  createRuntimeHostActionExecutor,
  createRuntimeHostActionProxy,
} from '../services/action-rpc'

const defaultIdentity: RuntimeHostActionIdentity = {
  hostId: 'host-a',
  projectId: 'project-a',
  pageId: 'page-a',
  revision: 'project-a:1:page-a:1',
}

function sameIdentity(left: RuntimeHostActionIdentity, right: RuntimeHostActionIdentity): boolean {
  return left.hostId === right.hostId
    && left.projectId === right.projectId
    && left.pageId === right.pageId
    && left.revision === right.revision
}

function messageBase(identity: RuntimeHostActionIdentity, sequence = 0): RuntimeHostMessageBase {
  return {
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    ...identity,
    sequence,
  }
}

function plan(ref = 'host.action', timeoutMs?: number): ConfigFormFlowExecutionPlan {
  const flow: ConfigFormFlow = {
    version: CONFIG_FORM_FLOW_VERSION,
    id: 'rpc-flow',
    name: 'RPC flow',
    trigger: { kind: 'page.mount' },
    concurrency: 'latest',
    nodes: [
      { id: 'trigger', type: 'trigger' },
      {
        id: 'action',
        type: 'action',
        ref,
        config: {},
        ...(timeoutMs === undefined ? {} : { policy: { timeoutMs } }),
      },
      { id: 'success', type: 'success' },
    ],
    edges: [
      { id: 'trigger-action', source: 'trigger', target: 'action', condition: 'next' },
      { id: 'action-success', source: 'action', target: 'success', condition: 'next' },
    ],
  }
  const analyzed = analyzeConfigFormFlow(flow)
  if (!analyzed.success)
    throw new Error(analyzed.diagnostics.map(item => item.message).join('\n'))
  return analyzed.plan
}

function actionCall(options: {
  timeoutMs?: number
  values?: Record<string, unknown>
} = {}): {
  context: ConfigFormFlowActionContext
  controller: AbortController
  values: Record<string, unknown>
} {
  const executionPlan = plan('host.action', options.timeoutMs)
  const node = executionPlan.nodes.find(item => item.id === 'action')!
  const controller = new AbortController()
  const values = structuredClone(options.values ?? { name: 'Ada' })
  return {
    controller,
    values,
    context: {
      flow: {
        runtimeVersion: CONFIG_FORM_FLOW_RUNTIME_VERSION,
        version: CONFIG_FORM_FLOW_VERSION,
        id: executionPlan.flowId,
        name: executionPlan.name,
        trigger: executionPlan.trigger,
        concurrency: executionPlan.concurrency,
      },
      node,
      revision: 1,
      runId: 'run-a',
      signal: controller.signal,
      values: structuredClone(values),
      outputs: {},
      event: { trigger: executionPlan.trigger, args: [] },
      form: createConfigFormFlowFormApi(values),
    },
  }
}

interface BridgeOptions {
  defaultDeadlineMs?: number
  maxPending?: number
  mode?: 'design' | 'preview'
}

function createBridge(registry: ConfigFormFlowActionRegistry | undefined, options: BridgeOptions = {}) {
  let identity = { ...defaultIdentity }
  let mode = options.mode ?? 'preview'
  let childSequence = 0
  let parentSequence = 0
  const requests: RuntimeHostActionRequestMessage[] = []
  const cancels: RuntimeHostActionCancelMessage[] = []
  const results: RuntimeHostActionResultMessage[] = []
  const isCurrent = (candidate: RuntimeHostActionIdentity): boolean => mode === 'preview'
    && sameIdentity(candidate, identity)
  let proxy!: ReturnType<typeof createRuntimeHostActionProxy>
  const executor = createRuntimeHostActionExecutor({
    getRegistry: () => registry,
    isCurrent,
    ...(options.defaultDeadlineMs === undefined ? {} : { defaultDeadlineMs: options.defaultDeadlineMs }),
    ...(options.maxPending === undefined ? {} : { maxPending: options.maxPending }),
    postResult: (payload) => {
      const result = {
        ...messageBase(identity, ++parentSequence),
        ...payload,
      } as RuntimeHostActionResultMessage
      results.push(structuredClone(result))
      proxy.acceptResult(result)
    },
  })
  proxy = createRuntimeHostActionProxy({
    getBase: () => messageBase(identity),
    isCurrent,
    ...(options.defaultDeadlineMs === undefined ? {} : { defaultDeadlineMs: options.defaultDeadlineMs }),
    ...(options.maxPending === undefined ? {} : { maxPending: options.maxPending }),
    postRequest: (payload) => {
      const request = {
        ...messageBase(identity, ++childSequence),
        ...payload,
      } as RuntimeHostActionRequestMessage
      requests.push(structuredClone(request))
      executor.handleRequest(request)
    },
    postCancel: (payload) => {
      const cancel = {
        ...messageBase(identity, ++childSequence),
        ...payload,
      } as RuntimeHostActionCancelMessage
      cancels.push(structuredClone(cancel))
      executor.handleCancel(cancel)
    },
  })

  return {
    cancels,
    executor,
    proxy,
    requests,
    results,
    setIdentity: (next: RuntimeHostActionIdentity) => identity = { ...next },
    setMode: (next: 'design' | 'preview') => mode = next,
    dispose: () => {
      proxy.dispose()
      executor.dispose()
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('runtimeHost action RPC', () => {
  it('executes a real Core Flow through the parent registry and commits its JSON patch', async () => {
    const execute = vi.fn((_input: unknown, context: ConfigFormFlowActionContext) => {
      context.form.setValue('result', `saved:${String(context.values.name)}`)
      return { accepted: true }
    })
    const bridge = createBridge({
      get: ref => ref === 'host.save' ? { execute } : undefined,
    })
    let values: Record<string, unknown> = { name: 'Ada' }
    const runtime = createConfigFormEventRuntime({
      actions: bridge.proxy.registry,
      readValues: () => values,
      writeValues: next => values = next,
    })
    runtime.sync([plan('host.save')])

    const result = await runtime.dispatch({ trigger: { kind: 'page.mount' }, revision: 7 })

    expect(result.status).toBe('committed')
    expect(values).toEqual({ name: 'Ada', result: 'saved:Ada' })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(bridge.requests).toHaveLength(1)
    expect(bridge.requests[0]).toMatchObject({ type: 'actionRequest', ref: 'host.save' })
    expect(bridge.requests[0]).not.toHaveProperty('input')
    expect(bridge.results).toEqual([
      expect.objectContaining({
        type: 'actionResult',
        success: true,
        output: { accepted: true },
        valuePatch: { remove: [], set: { result: 'saved:Ada' } },
      }),
    ])
    runtime.dispose()
    bridge.dispose()
  })

  it('returns only JSON output and set/remove patches to the renderer transaction', async () => {
    const bridge = createBridge({
      get: () => ({
        execute: (input, context) => {
          context.form.setValue('nested', { enabled: true, items: [1, 'two'] })
          const extended = context.form as ConfigFormFlowFormApi & { deleteValue?: (field: string) => void }
          extended.deleteValue?.('removeMe')
          return { echo: input }
        },
      }),
    })
    const call = actionCall({ values: { keep: 1, removeMe: 'old' } })
    const input = { label: 'request' }

    const output = await bridge.proxy.registry.get('host.action')!.execute(input, call.context)
    input.label = 'mutated after request'

    expect(output).toEqual({ echo: { label: 'request' } })
    expect(call.values).toEqual({ keep: 1, nested: { enabled: true, items: [1, 'two'] } })
    expect(bridge.results[0]).toMatchObject({
      success: true,
      valuePatch: {
        remove: ['removeMe'],
        set: { nested: { enabled: true, items: [1, 'two'] } },
      },
    })
    expect(() => JSON.stringify(bridge.requests[0])).not.toThrow()
    expect(() => JSON.stringify(bridge.results[0])).not.toThrow()
    bridge.dispose()
  })

  it('rejects non-JSON input and host patches with precise code and path', async () => {
    const execute = vi.fn((_input: unknown, context: ConfigFormFlowActionContext) => {
      context.form.setValue('bad', new Date('2026-01-01T00:00:00.000Z'))
    })
    const bridge = createBridge({ get: () => ({ execute }) })
    const invalidInput = actionCall()

    await expect(bridge.proxy.registry.get('host.action')!.execute(
      { callback: () => undefined },
      invalidInput.context,
    )).rejects.toMatchObject({ code: 'FLOW_NON_JSON', path: 'input.callback' })
    expect(execute).not.toHaveBeenCalled()
    expect(bridge.requests).toHaveLength(0)

    const invalidPatch = actionCall()
    await expect(bridge.proxy.registry.get('host.action')!.execute(null, invalidPatch.context))
      .rejects
      .toMatchObject({ code: 'FLOW_DATA_OBJECT_UNSUPPORTED', path: 'valuePatch.set.bad' })
    expect(invalidPatch.values).toEqual({ name: 'Ada' })
    bridge.dispose()
  })

  it('reports a missing capability without silently executing anything', async () => {
    const bridge = createBridge(undefined)
    const call = actionCall()

    await expect(bridge.proxy.registry.get('host.missing')!.execute(null, call.context))
      .rejects
      .toMatchObject({ code: 'FLOW_ACTION_UNKNOWN', path: 'ref' })
    expect(bridge.results).toEqual([
      expect.objectContaining({
        success: false,
        diagnostic: expect.objectContaining({ code: 'FLOW_ACTION_UNKNOWN', path: 'ref' }),
      }),
    ])
    expect(call.values).toEqual({ name: 'Ada' })
    bridge.dispose()
  })

  it('preserves trusted action error code and path across the boundary', async () => {
    const failure = Object.assign(new Error('Host rejected the request.'), {
      code: 'HOST_REJECTED',
      path: 'input.accountId',
    })
    const bridge = createBridge({
      get: () => ({ execute: () => Promise.reject(failure) }),
    })
    const call = actionCall()

    await expect(bridge.proxy.registry.get('host.action')!.execute(null, call.context))
      .rejects
      .toMatchObject({
        message: 'Host rejected the request.',
        code: 'HOST_REJECTED',
        path: 'input.accountId',
      })
    expect(bridge.results[0]).toMatchObject({
      success: false,
      diagnostic: {
        message: 'Host rejected the request.',
        code: 'HOST_REJECTED',
        path: 'input.accountId',
      },
    })
    bridge.dispose()
  })

  it('propagates renderer abort to the real host action and releases both pending registries', async () => {
    let hostSignal: AbortSignal | undefined
    const bridge = createBridge({
      get: () => ({
        execute: (_input, context) => {
          hostSignal = context.signal
          return new Promise((_resolve, reject) => {
            context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true })
          })
        },
      }),
    })
    const call = actionCall()
    const pending = bridge.proxy.registry.get('host.action')!.execute(null, call.context)
    await vi.waitFor(() => expect(hostSignal).toBeDefined())

    call.controller.abort(new DOMException('Flow replaced.', 'AbortError'))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'Flow replaced.' })
    expect(hostSignal?.aborted).toBe(true)
    expect(bridge.cancels).toHaveLength(1)
    expect(bridge.proxy.pendingCount()).toBe(0)
    expect(bridge.executor.pendingCount()).toBe(0)
    bridge.dispose()
  })

  it('times out, aborts the host signal, and reports FLOW_TIMEOUT at policy.timeoutMs', async () => {
    vi.useFakeTimers()
    let hostSignal: AbortSignal | undefined
    const bridge = createBridge({
      get: () => ({
        execute: (_input, context) => {
          hostSignal = context.signal
          return new Promise(() => {})
        },
      }),
    }, { defaultDeadlineMs: 1_000 })
    const call = actionCall({ timeoutMs: 25 })
    const pending = bridge.proxy.registry.get('host.action')!.execute(null, call.context)
    const rejected = expect(pending).rejects.toMatchObject({
      code: 'FLOW_TIMEOUT',
      path: 'policy.timeoutMs',
    })

    await vi.advanceTimersByTimeAsync(25)
    await rejected

    expect(hostSignal?.aborted).toBe(true)
    expect(bridge.cancels).toHaveLength(1)
    expect(bridge.proxy.pendingCount()).toBe(0)
    expect(bridge.executor.pendingCount()).toBe(0)
    bridge.dispose()
  })

  it('treats timeoutMs zero as no deadline', async () => {
    vi.useFakeTimers()
    const work = deferred<{ done: boolean }>()
    const bridge = createBridge({
      get: () => ({ execute: () => work.promise }),
    }, { defaultDeadlineMs: 5 })
    const call = actionCall({ timeoutMs: 0 })
    const pending = bridge.proxy.registry.get('host.action')!.execute(null, call.context)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(bridge.proxy.pendingCount()).toBe(1)
    expect(bridge.executor.pendingCount()).toBe(1)
    expect(bridge.cancels).toHaveLength(0)

    work.resolve({ done: true })
    await expect(pending).resolves.toEqual({ done: true })
    expect(bridge.proxy.pendingCount()).toBe(0)
    expect(bridge.executor.pendingCount()).toBe(0)
    bridge.dispose()
  })

  it('forbids design-mode RPC before a side-effect action reaches the host', async () => {
    const execute = vi.fn()
    const bridge = createBridge({ get: () => ({ execute }) }, { mode: 'design' })
    const call = actionCall()

    await expect(bridge.proxy.registry.get('host.action')!.execute(null, call.context))
      .rejects
      .toMatchObject({ code: 'RUNTIME_ACTION_STALE' })
    expect(execute).not.toHaveBeenCalled()
    expect(bridge.requests).toHaveLength(0)
    expect(bridge.results).toHaveLength(0)
    bridge.dispose()
  })

  it('ignores a foreign result without settling the current request, then accepts the exact identity', async () => {
    let request: RuntimeHostActionRequestMessage | undefined
    const proxy = createRuntimeHostActionProxy({
      getBase: () => messageBase(defaultIdentity),
      isCurrent: identity => sameIdentity(identity, defaultIdentity),
      defaultDeadlineMs: 0,
      postCancel: () => {},
      postRequest: (payload) => {
        request = { ...messageBase(defaultIdentity, 1), ...payload } as RuntimeHostActionRequestMessage
      },
    })
    const call = actionCall()
    const pending = proxy.registry.get('host.action')!.execute(null, call.context)
    expect(request).toBeDefined()

    expect(proxy.acceptResult({
      ...messageBase({ ...defaultIdentity, revision: 'stale-revision' }, 1),
      type: 'actionResult',
      requestId: request!.requestId,
      success: true,
      output: 'foreign',
      valuePatch: { remove: [], set: { name: 'foreign' } },
    })).toBe(false)
    expect(proxy.pendingCount()).toBe(1)
    expect(call.values).toEqual({ name: 'Ada' })

    expect(proxy.acceptResult({
      ...messageBase(defaultIdentity, 2),
      type: 'actionResult',
      requestId: request!.requestId,
      success: true,
      output: 'current',
      valuePatch: { remove: [], set: { name: 'Grace' } },
    })).toBe(true)
    await expect(pending).resolves.toBe('current')
    expect(call.values).toEqual({ name: 'Grace' })
    proxy.dispose()
  })

  it('rejects a matching late result after identity invalidation without applying its patch', async () => {
    let current = true
    let request: RuntimeHostActionRequestMessage | undefined
    const proxy = createRuntimeHostActionProxy({
      getBase: () => messageBase(defaultIdentity),
      isCurrent: () => current,
      defaultDeadlineMs: 0,
      postCancel: () => {},
      postRequest: payload => request = {
        ...messageBase(defaultIdentity, 1),
        ...payload,
      } as RuntimeHostActionRequestMessage,
    })
    const call = actionCall()
    const pending = proxy.registry.get('host.action')!.execute(null, call.context)
    current = false

    expect(proxy.acceptResult({
      ...messageBase(defaultIdentity, 2),
      type: 'actionResult',
      requestId: request!.requestId,
      success: true,
      output: 'late',
      valuePatch: { remove: [], set: { name: 'Late' } },
    })).toBe(false)
    await expect(pending).rejects.toMatchObject({ code: 'RUNTIME_ACTION_STALE' })
    expect(call.values).toEqual({ name: 'Ada' })
    proxy.dispose()
  })

  it('bounds pending calls and rejects stale request/cancel identities', async () => {
    let hostSignal: AbortSignal | undefined
    const work = deferred<unknown>()
    const execute = vi.fn((_input: unknown, context: ConfigFormFlowActionContext) => {
      hostSignal = context.signal
      return work.promise
    })
    const bridge = createBridge({ get: () => ({ execute }) }, {
      defaultDeadlineMs: 0,
      maxPending: 1,
    })
    const firstCall = actionCall()
    const first = bridge.proxy.registry.get('host.action')!.execute(null, firstCall.context)
    await vi.waitFor(() => expect(hostSignal).toBeDefined())

    await expect(bridge.proxy.registry.get('host.action')!.execute(null, actionCall().context))
      .rejects
      .toMatchObject({ code: 'RUNTIME_ACTION_QUEUE_LIMIT' })
    expect(execute).toHaveBeenCalledTimes(1)

    const request = bridge.requests[0]!
    expect(bridge.executor.handleCancel({
      ...request,
      type: 'actionCancel',
      revision: 'stale-revision',
    })).toBe(false)
    expect(hostSignal?.aborted).toBe(false)
    expect(bridge.executor.pendingCount()).toBe(1)

    firstCall.controller.abort(new DOMException('Stopped.', 'AbortError'))
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(hostSignal?.aborted).toBe(true)
    expect(bridge.executor.handleRequest({
      ...request,
      requestId: 'stale-request',
      revision: 'stale-revision',
    })).toBe(false)
    expect(execute).toHaveBeenCalledTimes(1)
    bridge.dispose()
  })
})
