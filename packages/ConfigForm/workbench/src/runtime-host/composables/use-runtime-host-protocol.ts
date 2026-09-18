import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type {
  ConfigFormDataSourceHost,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { ConfigFormFieldChangePayload } from '@moluoxixi/config-form-headless'
import type { VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type {
  RuntimeHostFieldInstance,
  RuntimeHostIdentity,
  RuntimeHostMessageBase,
  RuntimeHostRuntimeStatePayload,
  RuntimeHostSubmitResultPayload,
  RuntimeHostSyncMessage,
  RuntimeHostToParentPayload,
} from '../types'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { nextTick, onBeforeUnmount, onErrorCaptured, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { loadWorkbenchRuntimeAdapter } from '../../adapters'
import { collectCompiledPreviewContracts, emptyPreviewContracts, remapPreviewFieldState } from '../../services'
import { cloneWorkbenchJson } from '../../utils'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { acceptsRuntimeHostMessageEvent, isParentToRuntimeHostMessage } from '../schemas'
import { createRuntimeHostDataProxy } from '../services/data-rpc'

interface RuntimeHostGeometryPort {
  reset: () => void
  sync: () => Promise<void>
}

export function useRuntimeHostProtocol() {
  const renderer = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('renderer')
  const active = shallowRef<VueRuntimeCompileSuccess>()
  const fallback = shallowRef<VueRuntimeCompileSuccess>()
  const dataSourceHost = shallowRef<ConfigFormDataSourceHost>()
  const modelValue = ref<Record<string, unknown>>({})
  const reactionProjection = ref<ConfigFormReactionProjection<Record<string, unknown>>>({
    values: {},
    props: {},
    states: {},
    validate: [],
  })
  const namespace = ref<string>()
  const runtimeSessionKey = ref('')
  const runtimeError = ref('')
  const runtimeMode = ref<'design' | 'preview'>('preview')
  const design = ref<RuntimeHostSyncMessage['design']>()
  const targetOrigin = window.location.origin
  let hostId = ''
  let currentProjectId = ''
  let currentPageId = ''
  let currentRevision = ''
  let currentAdapter = ''
  let currentCompilationKey = ''
  let currentRuntimeSession = ''
  let currentContracts = emptyPreviewContracts()
  const seenSubmitRequests = new Set<string>()
  let latestSyncSequence = -1
  let latestStateSequence = -1
  let lastParentSequence = -1
  let childSequence = 0
  let mountedRuntimeSessionKey = ''
  let applyingParentStateDepth = 0
  let submitInFlight = false
  let submitRequestToken = 0
  let activeSubmitToken: number | undefined
  let submittedValues: Record<string, unknown> | undefined
  let acceptedSync = false
  let latestRuntimeState: RuntimeHostRuntimeStatePayload = {
    fields: [],
    values: {},
    touched: [],
    validation: {},
  }
  let geometryPort: RuntimeHostGeometryPort = {
    reset: () => {},
    sync: async () => {},
  }

  function identity(): RuntimeHostIdentity {
    return {
      hostId,
      pageId: currentPageId,
      projectId: currentProjectId,
      revision: currentRevision,
    }
  }

  function baseMessage(): RuntimeHostMessageBase {
    return {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: currentProjectId,
      pageId: currentPageId,
      sequence: 0,
      revision: currentRevision,
    }
  }

  function setGeometryPort(port: RuntimeHostGeometryPort): void {
    geometryPort = port
  }

  function postMessage(message: RuntimeHostToParentPayload): void {
    if (!hostId || !currentProjectId || !currentPageId || !currentRevision)
      return
    window.parent.postMessage({
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: currentProjectId,
      pageId: currentPageId,
      sequence: ++childSequence,
      revision: currentRevision,
      ...message,
    }, targetOrigin)
  }

  const dataProxy = createRuntimeHostDataProxy({
    getBase: baseMessage,
    isCurrent: next => next.hostId === hostId
      && next.projectId === currentProjectId && next.pageId === currentPageId
      && next.revision === currentRevision && runtimeMode.value === 'preview'
      && dataSourceHost.value !== undefined,
    postRequest: message => postMessage(message as RuntimeHostToParentPayload),
    postCancel: message => postMessage(message as RuntimeHostToParentPayload),
  })

  function currentFieldInstances(): RuntimeHostFieldInstance[] {
    return (renderer.value?.listFieldInstances() ?? []).map(instance => ({
      nodeId: instance.address.nodeId,
      scope: instance.address.scope.map(entry => ({ ...entry })),
      instanceKey: instance.instanceKey,
      valuePath: [...instance.valuePath],
    }))
  }

  function currentRuntimeState(): RuntimeHostRuntimeStatePayload {
    const currentRenderer = renderer.value
    const fields = currentFieldInstances()
    return {
      fields,
      values: cloneWorkbenchJson(currentRenderer?.getValues() ?? modelValue.value),
      touched: fields.filter(instance => currentRenderer?.getInstanceMeta(instance).touched)
        .map(instance => instance.instanceKey),
      validation: Object.fromEntries(fields.flatMap((instance) => {
        const errors = currentRenderer?.getInstanceErrors(instance) ?? []
        return errors.length > 0 ? [[instance.instanceKey, [...errors]]] : []
      })),
    }
  }

  function postRuntimeState(): void {
    if (runtimeMode.value === 'preview' && acceptedSync && applyingParentStateDepth === 0 && renderer.value)
      postMessage({ type: 'runtimeState', payload: currentRuntimeState() })
  }

  function sameJsonValue(left: unknown, right: unknown): boolean {
    try {
      return JSON.stringify(left) === JSON.stringify(right)
    }
    catch {
      return false
    }
  }

  async function applyRuntimeState(
    state: RuntimeHostRuntimeStatePayload,
    sequence: number,
  ): Promise<void> {
    if (sequence !== latestStateSequence
      || (runtimeMode.value === 'preview' && acceptedSync)) {
      return
    }

    applyingParentStateDepth += 1
    try {
      if (!renderer.value && !sameJsonValue(modelValue.value, state.values))
        modelValue.value = cloneWorkbenchJson(state.values)
      await nextTick()
      if (sequence !== latestStateSequence)
        return

      const currentRenderer = renderer.value
      if (currentRenderer) {
        const fields = currentFieldInstances()
        const next = remapPreviewFieldState(state, fields, currentContracts)
        const touched = new Set(next.touched)
        for (const instance of fields) {
          if (currentRenderer.getInstanceMeta(instance).touched !== touched.has(instance.instanceKey))
            currentRenderer.setInstanceTouched(instance, touched.has(instance.instanceKey))
        }
        if (!sameJsonValue(currentRenderer.getErrors(), next.validation))
          currentRenderer.setErrors(cloneWorkbenchJson(next.validation))
      }
      await nextTick()
    }
    finally {
      applyingParentStateDepth -= 1
    }
  }

  function reportError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    runtimeError.value = message
    postMessage({ type: 'error', code, message })
  }

  async function acceptSync(message: RuntimeHostSyncMessage): Promise<void> {
    if (message.sequence <= latestSyncSequence)
      return
    const previousIdentity = identity()
    const identityChanged = !acceptedSync
      || previousIdentity.projectId !== message.projectId
      || previousIdentity.pageId !== message.pageId
      || previousIdentity.revision !== message.revision
      || currentRuntimeSession !== message.runtimeSessionKey
      || currentCompilationKey !== JSON.stringify(message.compilation.key)
    if (identityChanged)
      acceptedSync = false
    dataProxy.cancelAll(new Error('Runtime structural sync invalidated pending data requests.'), true)
    latestSyncSequence = message.sequence
    const syncSequence = message.sequence
    submitRequestToken += 1
    activeSubmitToken = undefined
    submitInFlight = false
    submittedValues = undefined
    const nextCompilationKey = JSON.stringify(message.compilation.key)
    const sessionChanged = currentRuntimeSession !== message.runtimeSessionKey
    currentProjectId = message.projectId
    currentRuntimeSession = message.runtimeSessionKey
    currentPageId = message.pageId
    currentRevision = message.revision
    document.documentElement.lang = message.locale
    runtimeMode.value = message.mode
    dataSourceHost.value = message.mode === 'preview' && message.dataSourceRequest
      ? dataProxy.getDataSourceHost()
      : undefined
    design.value = message.design
    geometryPort.reset()
    latestStateSequence = message.sequence
    latestRuntimeState = cloneWorkbenchJson(message.runtimeState)
    if (identityChanged) {
      if (active.value) {
        fallback.value = active.value
        active.value = undefined
        await nextTick()
        if (syncSequence !== latestSyncSequence)
          return
      }
      modelValue.value = cloneWorkbenchJson(latestRuntimeState.values)
      reactionProjection.value = cloneWorkbenchJson(message.reactionProjection)
    }
    namespace.value = message.namespace

    if (sessionChanged) {
      active.value = undefined
      fallback.value = undefined
      currentAdapter = ''
      currentCompilationKey = ''
      mountedRuntimeSessionKey = ''
    }

    try {
      currentContracts = collectCompiledPreviewContracts(message.compilation)
      if (!active.value
        || currentAdapter !== message.adapter
        || currentCompilationKey !== nextCompilationKey) {
        const adapter = await loadWorkbenchRuntimeAdapter(message.adapter)
        if (syncSequence !== latestSyncSequence)
          return
        const result = compileCanonicalPageRuntime(
          { compilation: message.compilation },
          adapter.runtimeResolver,
        )
        if (!result.success) {
          reportError(
            result.diagnostics[0]?.code ?? 'RUNTIME_COMPILE_FAILED',
            result.diagnostics.map(diagnostic => diagnostic.message).join('\n'),
          )
          return
        }
        fallback.value = active.value ?? fallback.value
        active.value = result
        currentAdapter = message.adapter
        currentCompilationKey = nextCompilationKey
      }

      runtimeSessionKey.value = JSON.stringify([message.runtimeSessionKey, message.revision, nextCompilationKey])
      runtimeError.value = ''

      await nextTick()
      if (syncSequence !== latestSyncSequence)
        return
      await geometryPort.sync()
      await applyRuntimeState(latestRuntimeState, latestStateSequence)
      if (syncSequence !== latestSyncSequence)
        return
      if (mountedRuntimeSessionKey !== message.runtimeSessionKey) {
        mountedRuntimeSessionKey = message.runtimeSessionKey
        postMessage({ type: 'mounted' })
      }
      postMessage({ type: 'ready' })
      acceptedSync = true
      if (runtimeMode.value === 'preview')
        postRuntimeState()
    }
    catch (error) {
      if (syncSequence !== latestSyncSequence)
        return
      reportError('RUNTIME_HOST_SYNC_FAILED', error)
    }
  }

  function handleMessage(event: MessageEvent<unknown>): void {
    const message = acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: targetOrigin,
      ...(hostId ? { hostId } : {}),
      source: window.parent,
    })
    if (!message || (!hostId && message.type !== 'sync'))
      return
    if (!hostId)
      hostId = message.hostId
    if (message.type !== 'sync'
      && (message.projectId !== currentProjectId
        || message.pageId !== currentPageId
        || message.revision !== currentRevision)) {
      return
    }
    if (message.sequence <= lastParentSequence)
      return
    lastParentSequence = message.sequence
    if (message.type === 'sync') {
      void acceptSync(message)
      return
    }
    if (message.type === 'dataResult') {
      dataProxy.acceptResult(message)
      return
    }
    if (message.type === 'state') {
      if (message.sequence <= latestStateSequence || (runtimeMode.value === 'preview' && acceptedSync))
        return
      latestStateSequence = message.sequence
      latestRuntimeState = cloneWorkbenchJson(message.runtimeState)
      reactionProjection.value = cloneWorkbenchJson(message.reactionProjection)
      void applyRuntimeState(latestRuntimeState, message.sequence)
      return
    }
    const currentRenderer = renderer.value
    if (!currentRenderer) {
      reportError('RUNTIME_HOST_NOT_READY', 'Preview Runtime is not ready.')
      return
    }
    if (submitInFlight || runtimeMode.value !== 'preview' || !acceptedSync || seenSubmitRequests.has(message.requestId))
      return
    seenSubmitRequests.add(message.requestId)
    if (seenSubmitRequests.size > 200)
      seenSubmitRequests.delete(seenSubmitRequests.values().next().value!)
    const requestToken = ++submitRequestToken
    const requestIdentity = {
      projectId: currentProjectId,
      pageId: currentPageId,
      revision: currentRevision,
      runtimeSessionKey: runtimeSessionKey.value,
      syncSequence: latestSyncSequence,
    }
    activeSubmitToken = requestToken
    submitInFlight = true
    submittedValues = undefined
    void currentRenderer.submit()
      .then((valid) => {
        if (!isCurrentSubmit(requestToken, requestIdentity))
          return
        const state = currentRuntimeState()
        const hasSubmittedEvent = submittedValues !== undefined
        const status: RuntimeHostSubmitResultPayload['status'] = valid && hasSubmittedEvent
          ? 'success'
          : !valid
              ? 'invalid'
              : 'failure'
        const result: RuntimeHostSubmitResultPayload = {
          status,
          requestId: message.requestId,
          fields: state.fields,
          values: cloneWorkbenchJson(status === 'success' ? (submittedValues ?? state.values) : state.values),
          touched: [...state.touched],
          validation: cloneWorkbenchJson(state.validation),
        }
        if (status === 'success')
          postMessage({ type: 'submit', requestId: message.requestId, values: cloneWorkbenchJson(submittedValues ?? state.values) })
        postMessage({ type: 'submitResult', payload: result })
        postRuntimeState()
      })
      .catch((error) => {
        if (isCurrentSubmit(requestToken, requestIdentity)) {
          postMessage({ type: 'submitResult', payload: { ...currentRuntimeState(), requestId: message.requestId, status: 'failure' } })
          reportError('RUNTIME_SUBMIT_FAILED', error)
        }
      })
      .finally(() => {
        if (activeSubmitToken !== requestToken)
          return
        activeSubmitToken = undefined
        submitInFlight = false
        submittedValues = undefined
      })
  }

  function updateModel(value: Record<string, unknown>): void {
    modelValue.value = cloneWorkbenchJson(value)
    postRuntimeState()
  }

  function submitValues(values: Record<string, unknown>): void {
    if (submitInFlight && activeSubmitToken !== undefined)
      submittedValues = cloneWorkbenchJson(values)
  }

  function isCurrentSubmit(
    requestToken: number,
    identityValue: {
      projectId: string
      pageId: string
      revision: string
      runtimeSessionKey: string
      syncSequence: number
    },
  ): boolean {
    return activeSubmitToken === requestToken
      && identityValue.projectId === currentProjectId
      && identityValue.pageId === currentPageId
      && identityValue.revision === currentRevision
      && identityValue.runtimeSessionKey === runtimeSessionKey.value
      && identityValue.syncSequence === latestSyncSequence
  }

  function fieldChange(payload: ConfigFormFieldChangePayload<Record<string, unknown>>): void {
    if (runtimeMode.value !== 'preview' || !acceptedSync || applyingParentStateDepth > 0)
      return
    const instances = renderer.value?.listFieldInstances(payload.address?.nodeId) ?? []
    const instance = instances.find(instance => payload.address
      ? sameJsonValue(instance.address.scope, payload.address.scope)
      : instance.field === payload.field && instance.address.scope.length === 0)
    if (!instance)
      return
    postMessage({
      type: 'fieldChange',
      payload: {
        nodeId: instance.address.nodeId,
        scope: cloneWorkbenchJson([...instance.address.scope]),
        instanceKey: instance.instanceKey,
        valuePath: [...instance.valuePath],
        field: payload.field,
        values: cloneWorkbenchJson(payload.values),
      },
    })
  }

  onErrorCaptured((error, _instance, info) => {
    reportError('RUNTIME_RENDER_FAILED', `${error instanceof Error ? error.message : String(error)} (${info})`)
    if (fallback.value) {
      const previous = fallback.value
      fallback.value = undefined
      void nextTick(() => active.value = previous)
    }
    return false
  })

  onMounted(() => window.addEventListener('message', handleMessage))
  onBeforeUnmount(() => {
    acceptedSync = false
    activeSubmitToken = undefined
    latestSyncSequence += 1
    latestStateSequence += 1
    dataProxy.dispose()
    window.removeEventListener('message', handleMessage)
  })

  return {
    active,
    dataSourceHost,
    design,
    fieldChange,
    modelValue,
    namespace,
    postMessage,
    postRuntimeState,
    reactionProjection,
    renderer,
    runtimeError,
    runtimeMode,
    runtimeSessionKey,
    setGeometryPort,
    submitValues,
    updateModel,
  }
}
