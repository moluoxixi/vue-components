import type {
  ConfigFormDataSourceDefinition,
  ConfigFormDataSourceRuntime,
  ConfigFormDataSourceState,
  ConfigFormJsonValue,
  ConfigFormScopePath,
  ConfigFormValueContext,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { ConfigFormFieldAddress, ConfigFormValues } from '@moluoxixi/config-form-headless'
import type { ConfigFormSurfaceRuntimeLoadOptions, ConfigFormSurfaceRuntimeOptionState } from '../../runtime'
import type { ConfigFormRendererEmits, ConfigFormRendererProps } from '../types'
import type { RendererControllerState } from '../types/internal'
import {
  cloneConfigFormDataValue,
  collectConfigFormValueReferences,
  CONFIG_FORM_DATA_SOURCE_DEFAULT_MAX_ENTRIES,
  ConfigFormDataSourceError,
  createConfigFormDataSourceRuntime,
  getConfigFormJsonSemanticHash,
  resolveConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import { shallowRef } from 'vue'
import { createRendererValueContext, isRendererScopeActive, rendererScopeStartsWith, sameRendererScope } from '../services/value-context'
import { initializeRendererVariables } from '../services/variables'

const MAX_ENTRIES = CONFIG_FORM_DATA_SOURCE_DEFAULT_MAX_ENTRIES
interface Consumer {
  key: string
  sourceId: string
  scope: ConfigFormScopePath
  address?: ConfigFormFieldAddress
  signature?: string
  requestGeneration: number
  controller?: AbortController
  state: ConfigFormDataSourceState
  order: number
}
interface RequestEntry {
  sourceId: string
  scope: ConfigFormScopePath
  signature: string
  controller: AbortController
  consumers: Set<Consumer>
  state?: ConfigFormDataSourceState
  promise?: Promise<ConfigFormDataSourceState>
  epoch: number
}

/** Vue owns consumers and lifecycle; Core remains the only request/cache engine. */
export function useRendererData<TValues extends ConfigFormValues>(options: {
  props: Readonly<ConfigFormRendererProps<TValues>>
  emit: ConfigFormRendererEmits<TValues>
  controller: () => RendererControllerState<TValues>
  canPublish: () => boolean
}) {
  const { props } = options
  const revision = shallowRef(0)
  const variables = shallowRef<Record<string, unknown>>({})
  let initialVariables: Record<string, unknown> = {}
  let engine: ConfigFormDataSourceRuntime | undefined
  let enabled = false
  let started = false
  let sequence = 0
  let overflowReported = false
  let requestEpoch = 0
  const consumers = new Map<string, Consumer>()
  const requests = new Map<string, RequestEntry>()

  function getVariables(): Readonly<Record<string, unknown>> {
    return cloneConfigFormDataValue(variables.value)
  }

  function publishVariables(next: Record<string, unknown>): void {
    variables.value = cloneConfigFormDataValue(next)
    if (options.canPublish())
      options.emit('variablesChange', getVariables())
  }

  function readContext(scope: ConfigFormScopePath = [], nodeId: string | undefined = scope.at(-1)?.scopeId): ConfigFormValueContext {
    return createRendererValueContext(
      props.plan,
      options.controller(),
      options.controller().getValues(),
      scope,
      nodeId,
      getVariables(),
    )
  }

  function prepare(): void {
    stop()
    const next = initializeRendererVariables(props.plan?.runtime.variables ?? [], readContext())
    engine = createConfigFormDataSourceRuntime({
      sources: props.plan?.runtime.dataSources ?? [],
      host: props.dataSourceHost ?? {},
      onState: (state) => {
        const entry = requests.get(state.scopeKey ?? '')
        if (!entry || entry.epoch !== requestEpoch) {
          return
        }
        entry.state = state
        publishRequest(entry, state)
      },
    })
    initialVariables = cloneConfigFormDataValue(next)
    enabled = props.mode !== 'design'
    publishVariables(next)
  }

  function reset(partial = false): void {
    clearConsumers()
    engine?.reset()
    if (!partial)
      initialVariables = initializeRendererVariables(props.plan?.runtime.variables ?? [], readContext())
    publishVariables(initialVariables)
    refresh()
  }

  function start(): void {
    started = true
    refresh()
  }

  function clearConsumers(): void {
    requestEpoch += 1
    consumers.forEach(consumer => consumer.controller?.abort('data consumers cleared'))
    consumers.clear()
    requests.forEach(entry => entry.controller.abort('data requests cleared'))
    requests.clear()
    revision.value += 1
    overflowReported = false
  }

  function stop(): void {
    enabled = false
    started = false
    clearConsumers()
    engine?.dispose()
    engine = undefined
  }

  function diagnostic(cause: unknown, path: string) {
    const detail = cause as { code?: string, path?: string }
    return {
      code: detail?.code ?? 'CONFIG_FORM_DATA_SOURCE_INPUT_INVALID',
      message: cause instanceof Error ? cause.message : String(cause),
      path: detail?.path ? `${path}:${detail.path}` : path,
    }
  }

  function errorState(sourceId: string, scope: ConfigFormScopePath, cause: unknown, path: string): ConfigFormDataSourceState {
    return { sourceId, scopeKey: JSON.stringify(scope), status: 'error', error: diagnostic(cause, path) }
  }

  function publish(consumer: Consumer, state: ConfigFormDataSourceState, requestGeneration?: number, allowAborted = false): void {
    if (!enabled || !options.canPublish() || consumers.get(consumer.key) !== consumer
      || (requestGeneration !== undefined && consumer.requestGeneration !== requestGeneration)
      || (!allowAborted && consumer.controller?.signal.aborted)) {
      return
    }
    let next: ConfigFormDataSourceState = cloneConfigFormDataValue({ ...state, scopeKey: JSON.stringify(consumer.scope) })
    if (consumer.address && ['success', 'empty'].includes(next.status) && !Array.isArray(next.data)) {
      next = errorState(consumer.sourceId, consumer.scope, new ConfigFormDataSourceError(
        'CONFIG_FORM_OPTION_SOURCE_NOT_ARRAY',
        `Data source "${consumer.sourceId}" must map to an array for field "${consumer.address.nodeId}".`,
        'mapping',
      ), `optionBindings.${consumer.address.nodeId}`)
    }
    if (JSON.stringify(consumer.state) === JSON.stringify(next))
      return
    consumer.state = next
    revision.value += 1
    options.emit('dataSourceStateChange', cloneConfigFormDataValue({
      state: next,
      scope: consumer.scope,
      consumerKey: consumer.key,
      ...(consumer.address ? { address: consumer.address } : {}),
    }))
  }

  function publishStandaloneError(
    sourceId: string,
    scope: ConfigFormScopePath,
    consumerKey: string,
    cause: unknown,
  ): void {
    if (!enabled || !options.canPublish())
      return
    options.emit('dataSourceStateChange', cloneConfigFormDataValue({
      state: errorState(sourceId, scope, cause, consumerKey),
      scope,
      consumerKey,
    }))
  }

  function publishRequest(entry: RequestEntry, state: ConfigFormDataSourceState): void {
    consumers.forEach((consumer) => {
      if (consumer.sourceId === entry.sourceId
        && consumer.signature === entry.signature
        && sameRendererScope(consumer.scope, entry.scope)) {
        publish(consumer, state, consumer.requestGeneration)
      }
    })
  }

  function createConsumer(key: string, sourceId: string, scope: ConfigFormScopePath, address?: ConfigFormFieldAddress): Consumer {
    const existing = consumers.get(key)
    if (existing)
      return existing
    if (consumers.size >= MAX_ENTRIES) {
      // Completed explicit loads are expendable; mounted option consumers are not.
      const retired = [...consumers.values()].find(item => item.key.startsWith('load:') && item.state.status !== 'loading')
      if (retired)
        remove(retired)
      else
        throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_CONSUMER_LIMIT', `At most ${MAX_ENTRIES} data consumers may be active.`, key)
    }
    const consumer: Consumer = {
      key,
      sourceId,
      scope: cloneConfigFormDataValue(scope),
      address,
      requestGeneration: 0,
      order: ++sequence,
      state: { sourceId, scopeKey: JSON.stringify(scope), status: 'idle' },
    }
    consumers.set(key, consumer)
    return consumer
  }

  function remove(consumer: Consumer): void {
    consumers.delete(consumer.key)
    consumer.controller?.abort('data consumer removed')
    revision.value += 1
  }

  function cancelScope(scope: ConfigFormScopePath): void {
    consumers.forEach((consumer) => {
      if (rendererScopeStartsWith(consumer.scope, scope))
        remove(consumer)
    })
  }

  function requireSource(sourceId: string): ConfigFormDataSourceDefinition {
    const source = props.plan?.runtime.dataSources.find(source => source.id === sourceId)
    if (!source)
      throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_MISSING', `Unknown data source: ${sourceId}`, `runtime.dataSources.${sourceId}`)
    return source
  }

  function prepareRequest(sourceId: string, params: ConfigFormSurfaceRuntimeLoadOptions['params'], context: ConfigFormValueContext) {
    const source = requireSource(sourceId)
    const request = resolveConfigFormValueInput(source.request as unknown as ConfigFormValueInput, context)
    const resolvedParams = resolveConfigFormValueInput(params ?? {}, context)
    const dependencies = resolveConfigFormValueInput(source.dependencies ?? [], context)
    // Capture referenced fields so asynchronous mapping reads one stable request snapshot.
    const fields = new Map<string, unknown>()
    const references = collectConfigFormValueReferences([
      source.request as unknown as ConfigFormValueInput,
      params ?? {},
      source.dependencies ?? [],
      source.mapping ?? null,
    ])
    for (const ref of references) {
      if (ref.kind === 'field') {
        fields.set(JSON.stringify([ref.id, ref.scope]), resolveConfigFormValueInput({
          $ref: { kind: 'field', nodeId: ref.id, scope: ref.scope },
        }, context))
      }
    }
    const snapshot: ConfigFormValueContext = {
      variables: cloneConfigFormDataValue(context.variables ?? {}),
      resolveField: (id, scope) => {
        const key = JSON.stringify([id, scope])
        return { found: fields.has(key), value: cloneConfigFormDataValue(fields.get(key)) }
      },
    }
    const mappingInputs = collectConfigFormValueReferences(source.mapping ?? null).map(ref =>
      ref.kind === 'field'
        ? fields.get(JSON.stringify([ref.id, ref.scope]))
        : snapshot.variables?.[ref.id])
    return {
      context: snapshot,
      signature: getConfigFormJsonSemanticHash({ request, params: resolvedParams, dependencies, mappingInputs } as ConfigFormJsonValue),
    }
  }

  async function loadConsumer(
    consumer: Consumer,
    settings: ConfigFormSurfaceRuntimeLoadOptions,
    prepared: ReturnType<typeof prepareRequest>,
  ): Promise<ConfigFormDataSourceState> {
    const requestGeneration = consumer.requestGeneration + 1
    consumer.requestGeneration = requestGeneration
    consumer.controller?.abort('data consumer superseded')
    const controller = new AbortController()
    consumer.controller = controller
    consumer.signature = prepared.signature
    consumer.order = ++sequence
    const key = JSON.stringify([consumer.sourceId, consumer.scope, prepared.signature, requestEpoch])
    const runtime = engine!
    let entry = requests.get(key)
    if (!entry) {
      entry = { controller: new AbortController(), consumers: new Set(), sourceId: consumer.sourceId, scope: consumer.scope, signature: prepared.signature, epoch: requestEpoch }
      requests.set(key, entry)
    }
    const shared = entry
    shared.consumers.add(consumer)
    let settleCancellation!: (state: ConfigFormDataSourceState) => void
    const cancellation = new Promise<ConfigFormDataSourceState>((resolve) => {
      settleCancellation = resolve
    })
    let released = false
    const release = (): void => {
      if (released)
        return
      released = true
      shared.consumers.delete(consumer)
      if (shared.consumers.size === 0 && requests.get(key) === shared) {
        requests.delete(key)
        shared.controller.abort('last data consumer released')
      }
    }
    const cancel = (): void => {
      release()
      const state = errorState(consumer.sourceId, consumer.scope, new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_ABORTED',
        'Data consumer cancelled.',
      ), consumer.key)
      if (settings.signal?.aborted && consumer.controller === controller)
        publish(consumer, state, requestGeneration, true)
      settleCancellation(state)
    }
    const abort = (): void => controller.abort(settings.signal?.reason)
    controller.signal.addEventListener('abort', cancel, { once: true })
    settings.signal?.addEventListener('abort', abort, { once: true })
    if (settings.signal?.aborted)
      abort()
    if (!shared.promise && !controller.signal.aborted) {
      shared.promise = runtime.load(consumer.sourceId, {
        context: prepared.context,
        params: settings.params,
        scopeKey: key,
        force: settings.force,
        signal: shared.controller.signal,
      }).catch(cause => errorState(consumer.sourceId, consumer.scope, cause, consumer.key))
    }
    if (shared.state)
      publish(consumer, shared.state, requestGeneration)
    try {
      const state = await Promise.race([shared.promise ?? cancellation, cancellation])
      if (consumer.requestGeneration === requestGeneration && consumer.controller === controller && !controller.signal.aborted) {
        // Core cache hits do not call onState.
        publishRequest(shared, state)
        return cloneConfigFormDataValue(consumer.state)
      }
      return cloneConfigFormDataValue(state)
    }
    finally {
      settings.signal?.removeEventListener('abort', abort)
      controller.signal.removeEventListener('abort', cancel)
      release()
    }
  }

  function refresh(): void {
    if (!enabled || !started || !options.canPublish())
      return
    const desired = new Set<string>()
    const schedule = (key: string, sourceId: string, scope: ConfigFormScopePath, params?: ConfigFormSurfaceRuntimeLoadOptions['params'], address?: ConfigFormFieldAddress): void => {
      let consumer: Consumer | undefined
      try {
        consumer = createConsumer(key, sourceId, scope, address)
        desired.add(key)
        const prepared = prepareRequest(sourceId, params, readContext(scope, address?.nodeId))
        if (consumer.signature !== prepared.signature)
          void loadConsumer(consumer, { params, scope }, prepared)
      }
      catch (cause) {
        if (consumer) {
          consumer.controller?.abort('invalid data input')
          consumer.controller = undefined
          consumer.signature = undefined
          publish(consumer, errorState(sourceId, scope, cause, key))
        }
        else if (!overflowReported) {
          overflowReported = true
          publishStandaloneError(sourceId, scope, key, cause)
        }
      }
    }
    const instances = options.controller().listFieldInstances()
    const bindings = props.plan?.optionBindings ?? []
    const validKeys = new Set(instances.map(instance => `option:${instance.instanceKey}`))
    consumers.forEach((consumer) => {
      if ((consumer.address && (!validKeys.has(consumer.key) || !bindings.some(binding => binding.nodeId === consumer.address?.nodeId)))
        || !isRendererScopeActive(options.controller(), consumer.scope)) {
        remove(consumer)
      }
    })
    for (const binding of bindings) {
      for (const instance of instances.filter(instance => instance.address.nodeId === binding.nodeId))
        schedule(`option:${instance.instanceKey}`, binding.source.dataSourceId, instance.address.scope, binding.source.params, instance.address)
    }
    for (const source of props.plan?.runtime.dataSources ?? []) {
      if (source.auto)
        schedule(`auto:${source.id}`, source.id, [])
    }
    consumers.forEach((consumer) => {
      if (!consumer.key.startsWith('load:') && !desired.has(consumer.key))
        remove(consumer)
    })
  }

  async function loadDataSource(sourceId: string, settings: ConfigFormSurfaceRuntimeLoadOptions = {}): Promise<ConfigFormDataSourceState> {
    const scope = settings.scope ?? []
    let consumer: Consumer | undefined
    try {
      if (!enabled || !engine || !options.canPublish())
        throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_INACTIVE', 'Data-source loading requires a mounted non-design Renderer.', sourceId)
      if (!isRendererScopeActive(options.controller(), scope))
        throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_SCOPE_REMOVED', 'The data-source row no longer exists.', sourceId)
      consumer = createConsumer(`load:${JSON.stringify([sourceId, scope])}`, sourceId, scope)
      const prepared = prepareRequest(sourceId, settings.params, readContext(scope))
      return await loadConsumer(consumer, settings, prepared)
    }
    catch (cause) {
      const state = errorState(sourceId, scope, cause, consumer?.key ?? sourceId)
      if (consumer) {
        consumer.controller?.abort('invalid explicit load')
        consumer.controller = undefined
        publish(consumer, state)
      }
      else if (options.canPublish()) {
        publishStandaloneError(sourceId, scope, sourceId, cause)
      }
      return state
    }
  }

  function getDataSourceState(sourceId: string, settings: { scope?: ConfigFormScopePath } = {}): ConfigFormDataSourceState {
    void revision.value
    const scope = settings.scope ?? []
    try {
      requireSource(sourceId)
      const latest = [...consumers.values()].filter(consumer => consumer.sourceId === sourceId && sameRendererScope(scope, consumer.scope)).sort((left, right) => right.order - left.order)[0]
      return cloneConfigFormDataValue(latest?.state ?? { sourceId, scopeKey: JSON.stringify(scope), status: 'idle' })
    }
    catch (cause) {
      return errorState(sourceId, scope, cause, sourceId)
    }
  }

  function getOptionState(address: ConfigFormFieldAddress): ConfigFormSurfaceRuntimeOptionState | undefined {
    void revision.value
    try {
      const consumer = consumers.get(`option:${options.controller().getInstanceKey(address)}`)
      if (!consumer)
        return undefined
      return cloneConfigFormDataValue({ ...consumer.state, options: Array.isArray(consumer.state.data) ? consumer.state.data : [] })
    }
    catch {
      return undefined
    }
  }

  return { cancelScope, getDataSourceState, getOptionState, getVariables, loadDataSource, prepare, refresh, reset, start, stop }
}
