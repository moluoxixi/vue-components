import type {
  ConfigFormFlowAction,
  ConfigFormFlowActionContext,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowDispatchResult,
  ConfigFormFlowEvent,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTrigger,
  ConfigFormReactionProjection,
  ConfigFormScopePath,
} from '@moluoxixi/config-form-core'
import type {
  ConfigFormControllerDiagnostic,
  ConfigFormLifecycleContext,
  ConfigFormLifecycleHook,
  ConfigFormLifecycleKind,
  ConfigFormValues,
} from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererEmits,
  ConfigFormRendererProps,
  ConfigFormRuntimeEventPayload,
} from '../types'
import type { RendererControllerState } from '../types/internal'
import {
  createConfigFormEventRuntime,
  snapshotConfigFormEventArgs,
} from '@moluoxixi/config-form-core'
import { collectAllConfigFormNodes } from '@moluoxixi/config-form-headless'
import { computed, onBeforeUnmount, onMounted, shallowRef, toRaw, watch } from 'vue'
import {
  isRendererScopeActive,
  rendererScopeStartsWith,
} from '../services/flow-value-context'
import { ConfigFormRendererActionError, createRendererBuiltinActions } from '../services/runtime-actions'
import { createRendererScopedFlowTransaction } from '../services/scoped-flow-transaction'
import { useRendererData } from './use-renderer-data'

const UNMOUNT_FLOW_BUDGET_MS = 250
const BLOCKING_DISPATCH_STATUSES = new Set<ConfigFormFlowDispatchResult['status']>([
  'blocked',
  'aborted',
  'failure',
  'timeout',
  'stale',
])

interface RendererDispatchOptions {
  allowUnmount?: boolean
  field?: string
  publish?: boolean
  signal?: AbortSignal
  token?: number
  scope?: ConfigFormScopePath
}

export function useRendererEvents<TValues extends ConfigFormValues>(options: {
  props: Readonly<ConfigFormRendererProps<TValues>>
  emit: ConfigFormRendererEmits<TValues>
  controller: () => RendererControllerState<TValues>
}) {
  const { props, emit } = options
  const localProjection = shallowRef(emptyProjection())
  const fieldStates = shallowRef<ConfigFormReactionProjection['states']>({})
  const plans = shallowRef<readonly ConfigFormFlowExecutionPlan[]>([])
  let activePlans: readonly ConfigFormFlowExecutionPlan[] = []
  let activation: Promise<void> | undefined
  let configurationValid = true
  let disposed = false
  let generation = 0
  let mounted = false
  let ready = false
  let runtimeWriting = 0
  let unmounting = false
  const scopedDispatches = new Set<{ controller: AbortController, scope: ConfigFormScopePath }>()
  const invalidatedScopes = new Map<string, ConfigFormScopePath>()
  let builtinOperation: { kind: 'validate' | 'submit' | 'reset', signal: AbortSignal } | undefined
  const data = useRendererData({ ...options, canPublish, onDiagnostic: reportDiagnostic })
  const builtinActions: Record<string, ConfigFormFlowAction> = createRendererBuiltinActions({
    validate: context => runFormAction('validate', context),
    submit: context => runFormAction('submit', context),
    reset: context => runFormAction('reset', context),
    loadDataSource: data.loadFromAction,
  })

  const runtime = createConfigFormEventRuntime({
    actions: { get: ref => Object.hasOwn(builtinActions, ref) ? builtinActions[ref] : props.flowActions?.get(ref) },
    readValues: () => options.controller().getValues(),
    createTransaction: input => createRendererScopedFlowTransaction({
      controller: options.controller(),
      input,
      plan: props.plan,
      variables: data.getVariables(),
      commit: (write, variablePatch, states) => {
        input.signal.throwIfAborted()
        writeController(write)
        if (Object.keys(states).length > 0)
          fieldStates.value = mergeRecords(fieldStates.value, states)
        data.commitVariables(variablePatch)
      },
    }),
    writeValues: values => writeController(() => options.controller().setValues(values as Partial<TValues>)),
    onProjection: (next) => {
      if (canPublish())
        localProjection.value = cloneProjection(next)
    },
    onDiagnostic: diagnostic => reportDiagnostic(diagnostic),
    onTrace: (trace) => {
      if (canPublish())
        emit('flowTrace', trace)
    },
  })

  const projection = computed<ConfigFormReactionProjection<TValues>>(() => {
    const external = props.reactionProjection
    const local = localProjection.value
    return {
      values: props.model.read(),
      props: mergeRecords(external?.props ?? {}, local.props),
      states: mergeRecords(mergeRecords(external?.states ?? {}, local.states), fieldStates.value),
      validate: [...new Set([...(external?.validate ?? []), ...local.validate])],
    }
  })

  function writeController(write: () => void): void {
    runtimeWriting += 1
    try {
      write()
    }
    finally {
      runtimeWriting = Math.max(0, runtimeWriting - 1)
    }
  }

  async function runFormAction(kind: 'validate' | 'submit' | 'reset', context: ConfigFormFlowActionContext): Promise<boolean> {
    context.signal.throwIfAborted()
    const trigger = context.event.trigger.kind
    if (!ready || builtinOperation || trigger === 'form.reset'
      || (kind !== 'reset' && ['form.beforeSubmit', 'form.submit', 'form.validationSuccess', 'form.validationFailure'].includes(trigger))) {
      throw new ConfigFormRendererActionError('FLOW_ACTION_REENTRY', `Cannot run form.${kind} during ${trigger} or another form operation.`, context.node.id)
    }
    const operation = { kind, signal: context.signal }
    builtinOperation = operation
    const cancel = (): void => options.controller().clearValidate()
    if (kind !== 'reset')
      context.signal.addEventListener('abort', cancel, { once: true })
    try {
      return await (kind === 'reset' ? options.controller().resetFields() : options.controller()[kind]())
    }
    finally {
      context.signal.removeEventListener('abort', cancel)
      if (builtinOperation === operation)
        builtinOperation = undefined
    }
  }

  function canPublish(): boolean {
    return mounted && !disposed && !unmounting && props.mode !== 'design'
  }

  function isCurrent(token: number, allowUnmount = false): boolean {
    return !disposed
      && token === generation
      && props.mode !== 'design'
      && (allowUnmount ? unmounting : mounted && !unmounting)
  }

  function reportDiagnostic(diagnostic: ConfigFormFlowDiagnostic, token = generation): void {
    if (isCurrent(token))
      emit('flowError', diagnostic)
  }

  async function dispatch(
    trigger: ConfigFormFlowTrigger,
    args: readonly unknown[] = [],
    settings: RendererDispatchOptions = {},
  ): Promise<ConfigFormFlowDispatchResult | undefined> {
    const token = settings.token ?? generation
    const allowUnmount = settings.allowUnmount ?? false
    const signal = settings.signal
    const scope = settings.scope?.map(entry => ({ ...entry }))
    if (!configurationValid || !isCurrent(token, allowUnmount) || signal?.aborted || isScopeInvalidated(scope))
      return undefined

    const scoped = scope && scope.length > 0
      ? { controller: new AbortController(), scope }
      : undefined
    const abortScoped = (): void => scoped?.controller.abort('event scope cancelled')
    if (scoped) {
      if (signal?.aborted)
        abortScoped()
      else
        signal?.addEventListener('abort', abortScoped, { once: true })
      scopedDispatches.add(scoped)
    }

    try {
      const event: ConfigFormFlowEvent = {
        trigger,
        args: snapshotConfigFormEventArgs(args),
        ...(settings.field === undefined ? {} : { field: settings.field }),
        ...(scope === undefined ? {} : { scope }),
      }
      const currentRun = () => isCurrent(token, allowUnmount) && !signal?.aborted
        && !isScopeInvalidated(scope)
        && (scope === undefined || isRendererScopeActive(options.controller(), scope))
      const result = await runtime.dispatch({
        event,
        isCurrent: currentRun,
        revision: token,
        signal: scoped?.controller.signal ?? signal,
        trigger,
      })
      if ((settings.publish ?? true)
        && !['noop', 'stale'].includes(result.status)
        && currentRun()) {
        emit('flowResult', result)
      }
      return result
    }
    catch (cause) {
      if (!signal?.aborted && !isScopeInvalidated(scope)) {
        reportDiagnostic({
          code: 'FLOW_EVENT_DISPATCH_ERROR',
          message: cause instanceof Error ? cause.message : String(cause),
        }, token)
      }
      return undefined
    }
    finally {
      if (scoped) {
        scopedDispatches.delete(scoped)
        signal?.removeEventListener('abort', abortScoped)
      }
    }
  }

  function cancelScope(scope: ConfigFormScopePath): void {
    data.cancelScope(scope)
    const snapshot = scope.map(entry => ({ ...entry }))
    invalidatedScopes.set(JSON.stringify(snapshot), snapshot)
    scopedDispatches.forEach((dispatch) => {
      if (rendererScopeStartsWith(dispatch.scope, snapshot))
        dispatch.controller.abort('event scope removed')
    })
  }

  function isScopeInvalidated(scope: ConfigFormScopePath | undefined): boolean {
    return scope !== undefined && [...invalidatedScopes.values()].some(prefix =>
      rendererScopeStartsWith(scope, prefix))
  }

  const lifecycle: ConfigFormLifecycleHook<TValues> = async (kind, context) => {
    if (kind === 'form.reset') {
      generation += 1
      runtime.sync(activePlans, { reset: true })
      invalidatedScopes.clear()
      localProjection.value = emptyProjection()
      fieldStates.value = {}
      data.reset(context.fields !== undefined)
    }
    if (kind === 'form.valuesChange' && runtimeWriting > 0)
      return true
    if (kind === 'form.valuesChange')
      data.refresh()
    if (props.mode === 'design')
      return kind !== 'form.beforeSubmit' && kind !== 'form.submit'
    if (!mounted || !configurationValid || disposed)
      return false

    const token = generation
    if (kind !== 'form.initialize' && kind !== 'form.reset' && !ready) {
      const pendingActivation = activation
      if (pendingActivation)
        await pendingActivation
      if (!ready || !isCurrent(token))
        return false
    }

    const result = await dispatch(
      { kind },
      lifecycleArgs(kind, context),
      {
        scope: context.scope,
        signal: builtinOperation && builtinOperation.kind !== 'reset'
          ? AbortSignal.any([context.signal, builtinOperation.signal])
          : context.signal,
        token,
      },
    )
    if (kind === 'form.reset' && isCurrent(token)) {
      ready = result !== undefined && !BLOCKING_DISPATCH_STATUSES.has(result.status)
      if (ready)
        data.start()
    }
    return result !== undefined && !BLOCKING_DISPATCH_STATUSES.has(result.status)
  }

  function hasLifecycle(kind: ConfigFormLifecycleKind): boolean {
    if (disposed)
      return false
    if (props.mode === 'design')
      return kind === 'form.beforeSubmit' || kind === 'form.submit'
    if (mounted && kind === 'form.reset')
      return true
    if (!mounted || !configurationValid || !ready)
      return kind === 'form.beforeSubmit' || kind === 'form.submit' || kind === 'form.initialize'
    if (kind === 'form.reset' || kind === 'form.valuesChange')
      return true
    return plans.value.some(plan => plan.trigger.kind === kind)
  }

  function controllerDiagnostic(diagnostic: ConfigFormControllerDiagnostic): void {
    reportDiagnostic({
      code: diagnostic.code,
      message: diagnostic.message,
      ...(diagnostic.kind === undefined ? {} : { path: diagnostic.kind }),
    })
  }

  async function activate(): Promise<void> {
    const token = ++generation
    ready = false
    configurationValid = false
    activePlans = []
    plans.value = []
    runtime.sync([], { reset: true })
    invalidatedScopes.clear()
    localProjection.value = emptyProjection()
    fieldStates.value = {}
    data.prepare()

    if (!mounted || disposed || props.mode === 'design') {
      configurationValid = true
      return
    }

    const next = resolvePlans()
    if (!isCurrent(token))
      return

    configurationValid = true
    activePlans = next
    plans.value = next
    runtime.sync(next, { reset: true })

    const initialized = await options.controller().runLifecycle('form.initialize')
    if (!initialized || !isCurrent(token))
      return
    data.start()

    const mountedResult = await dispatch({ kind: 'page.mount' }, [], { token })
    ready = mountedResult !== undefined
      && !BLOCKING_DISPATCH_STATUSES.has(mountedResult.status)
      && isCurrent(token)
  }

  function resolvePlans(): readonly ConfigFormFlowExecutionPlan[] {
    return props.plan?.flows ?? []
  }

  function scheduleActivation(): void {
    const pending = activate()
    activation = pending
    void pending.catch((cause) => {
      reportDiagnostic({
        code: (cause as { code?: string })?.code ?? 'FLOW_RUNTIME_ACTIVATION_ERROR',
        message: cause instanceof Error ? cause.message : String(cause),
        path: (cause as { path?: string })?.path,
      })
    })
  }

  watch(
    [
      () => props.mode,
      () => props.plan,
      () => props.flowActions,
      () => props.dataSourceHost,
      () => props.fields,
    ],
    scheduleActivation,
    { deep: true },
  )

  watch(
    [() => props.mode, () => props.plan, () => props.flowActions, () => props.dataSourceHost, () => props.fields],
    data.stop,
    { deep: true, flush: 'sync' },
  )

  watch(
    () => props.model.read(),
    () => {
      if (!mounted || disposed || scopedDispatches.size === 0)
        return
      const controller = options.controller()
      scopedDispatches.forEach((dispatch) => {
        if (!isRendererScopeActive(controller, dispatch.scope))
          cancelScope(dispatch.scope)
      })
    },
    { deep: true, flush: 'sync' },
  )

  onMounted(() => {
    mounted = true
    scheduleActivation()
  })

  onBeforeUnmount(() => {
    ready = false
    data.stop()
    if (disposed)
      return
    if (props.mode === 'design' || !configurationValid) {
      mounted = false
      disposed = true
      runtime.dispose()
      options.controller().dispose()
      return
    }

    unmounting = true
    mounted = false
    const token = ++generation
    runtime.sync(activePlans)
    const deadline = new AbortController()
    let finished = false
    const finish = (): void => {
      if (finished)
        return
      finished = true
      disposed = true
      deadline.abort('renderer unmounted')
      runtime.dispose()
      options.controller().dispose()
    }
    const timer = setTimeout(finish, UNMOUNT_FLOW_BUDGET_MS)
    void dispatch(
      { kind: 'page.unmount' },
      [],
      { allowUnmount: true, publish: false, signal: deadline.signal, token },
    ).finally(() => {
      clearTimeout(timer)
      finish()
    })
  })

  function eventNames(nodeId: string): readonly string[] {
    const configured = props.plan?.flows ?? plans.value
    return [...new Set(configured.flatMap(flow => flow.trigger.kind === 'component.event'
      && flow.trigger.nodeId === nodeId && flow.trigger.event
      ? [flow.trigger.event]
      : []))]
  }

  function componentEvent(payload: ConfigFormRuntimeEventPayload<TValues>): void {
    if (!canPublish() || !isCurrentNode(payload))
      return
    const configuredEvents = payload.metadata.node.eventNames ?? []
    if (!configuredEvents.includes(payload.event) && !eventNames(payload.metadata.nodeId).includes(payload.event))
      return

    const token = generation
    let args: ReturnType<typeof snapshotConfigFormEventArgs>
    try {
      args = snapshotConfigFormEventArgs(payload.args)
    }
    catch (cause) {
      reportDiagnostic({
        code: 'FLOW_EVENT_PAYLOAD_INVALID',
        message: cause instanceof Error ? cause.message : String(cause),
      }, token)
      return
    }

    void (async () => {
      try {
        if (!isCurrent(token) || !isCurrentNode(payload))
          return
        emit('runtimeEvent', {
          ...payload,
          args,
          ...(payload.scope === undefined
            ? {}
            : { scope: payload.scope.map(entry => ({ ...entry })) }),
        })
        const trigger = {
          kind: 'component.event' as const,
          nodeId: payload.metadata.nodeId,
          event: payload.event,
        }
        const node = payload.metadata.node
        await dispatch(trigger, args, {
          field: 'field' in node ? node.field : undefined,
          scope: payload.scope,
          token,
        })
      }
      catch (cause) {
        reportDiagnostic({
          code: 'FLOW_EVENT_DISPATCH_ERROR',
          message: cause instanceof Error ? cause.message : String(cause),
        }, token)
      }
    })()
  }

  function isCurrentNode(payload: ConfigFormRuntimeEventPayload<TValues>): boolean {
    try {
      const current = collectAllConfigFormNodes(props.fields)
        .find(node => node.id === payload.metadata.nodeId)
      return current !== undefined
        && toRaw(current) === toRaw(payload.metadata.node)
        && !isScopeInvalidated(payload.scope)
        && (payload.scope === undefined || isRendererScopeActive(options.controller(), payload.scope))
    }
    catch {
      return false
    }
  }

  return {
    cancelScope,
    componentEvent,
    controllerDiagnostic,
    data,
    dispatch,
    eventNames,
    hasLifecycle,
    lifecycle,
    projection: () => projection.value,
  }
}

function lifecycleArgs<TValues extends ConfigFormValues>(
  kind: ConfigFormLifecycleKind,
  context: ConfigFormLifecycleContext<TValues>,
): readonly unknown[] {
  if (kind === 'form.validationFailure')
    return [context.values, context.errors]
  if (kind === 'form.valuesChange')
    return [context.values, context.previousValues ?? null]
  if (kind === 'form.reset')
    return context.fields === undefined ? [context.values] : [context.values, context.fields]
  return [context.values]
}

function emptyProjection(): ConfigFormReactionProjection<Record<string, unknown>> {
  return { values: {}, props: {}, states: {}, validate: [] }
}

function cloneProjection(
  projection: ConfigFormReactionProjection<Record<string, unknown>>,
): ConfigFormReactionProjection<Record<string, unknown>> {
  return {
    values: { ...projection.values },
    props: mergeRecords({}, projection.props),
    states: mergeRecords({}, projection.states),
    validate: [...projection.validate],
  }
}

function mergeRecords<T>(left: Record<string, T>, right: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .map(key => [key, { ...left[key], ...right[key] }]),
  )
}
