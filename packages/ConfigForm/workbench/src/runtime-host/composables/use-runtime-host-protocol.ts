import type {
  ConfigFormRendererExpose,
  ConfigFormRuntimeEventPayload,
} from '@moluoxixi/config-form'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type {
  RuntimeHostRuntimeStatePayload,
  RuntimeHostSubmitResultPayload,
  RuntimeHostSyncMessage,
  RuntimeHostToParentPayload,
} from '../types'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { nextTick, onBeforeUnmount, onErrorCaptured, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { loadWorkbenchRuntimeAdapter } from '../../adapters'
import { cloneWorkbenchJson } from '../../utils'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { acceptsRuntimeHostMessageEvent, isParentToRuntimeHostMessage } from '../schemas'

interface RuntimeHostGeometryPort {
  reset: () => void
  sync: () => Promise<void>
}

export function useRuntimeHostProtocol() {
  const renderer = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('renderer')
  const active = shallowRef<VueRuntimeCompileSuccess>()
  const fallback = shallowRef<VueRuntimeCompileSuccess>()
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
  let latestRuntimeState: RuntimeHostRuntimeStatePayload = {
    values: {},
    touched: [],
    validation: {},
  }
  let geometryPort: RuntimeHostGeometryPort = {
    reset: () => {},
    sync: async () => {},
  }

  function setGeometryPort(port: RuntimeHostGeometryPort): void {
    geometryPort = port
  }

  function postMessage(message: RuntimeHostToParentPayload): void {
    if (!hostId || !currentProjectId || !currentPageId)
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

  function currentRuntimeState(): RuntimeHostRuntimeStatePayload {
    const currentRenderer = renderer.value
    const meta = currentRenderer?.getMeta()
    return {
      values: cloneWorkbenchJson(modelValue.value),
      touched: Object.entries(meta?.fields ?? {})
        .filter(([, field]) => field.touched)
        .map(([field]) => field),
      validation: cloneWorkbenchJson(currentRenderer?.getErrors() ?? {}),
    }
  }

  function postRuntimeState(): void {
    if (runtimeMode.value === 'preview' && applyingParentStateDepth === 0 && renderer.value)
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
    if (sequence !== latestStateSequence)
      return

    applyingParentStateDepth += 1
    try {
      if (!sameJsonValue(modelValue.value, state.values))
        modelValue.value = cloneWorkbenchJson(state.values)
      await nextTick()
      if (sequence !== latestStateSequence)
        return

      const currentRenderer = renderer.value
      if (currentRenderer) {
        const currentTouched = Object.entries(currentRenderer.getMeta().fields)
          .filter(([, field]) => field.touched)
          .map(([field]) => field)
          .sort()
        const nextTouched = [...state.touched].sort()
        if (JSON.stringify(currentTouched) !== JSON.stringify(nextTouched)) {
          currentRenderer.setTouched(false)
          if (nextTouched.length > 0)
            currentRenderer.setTouched(nextTouched, true)
        }
        if (!sameJsonValue(currentRenderer.getErrors(), state.validation))
          currentRenderer.setErrors(cloneWorkbenchJson(state.validation))
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
    latestSyncSequence = message.sequence
    const syncSequence = message.sequence
    submitRequestToken += 1
    activeSubmitToken = undefined
    submitInFlight = false
    submittedValues = undefined
    const nextCompilationKey = JSON.stringify(message.compilation.key)
    const sessionChanged = runtimeSessionKey.value !== message.runtimeSessionKey
    currentProjectId = message.projectId
    currentPageId = message.pageId
    currentRevision = message.revision
    document.documentElement.lang = message.locale
    runtimeMode.value = message.mode
    design.value = message.design
    geometryPort.reset()
    latestStateSequence = message.sequence
    latestRuntimeState = cloneWorkbenchJson(message.runtimeState)
    if (!sameJsonValue(modelValue.value, latestRuntimeState.values))
      modelValue.value = cloneWorkbenchJson(latestRuntimeState.values)
    reactionProjection.value = cloneWorkbenchJson(message.reactionProjection)
    namespace.value = message.namespace

    if (sessionChanged) {
      active.value = undefined
      fallback.value = undefined
      currentAdapter = ''
      currentCompilationKey = ''
      mountedRuntimeSessionKey = ''
    }

    try {
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
        fallback.value = active.value
        active.value = result
        currentAdapter = message.adapter
        currentCompilationKey = nextCompilationKey
      }

      runtimeSessionKey.value = message.runtimeSessionKey
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
    if (!message)
      return
    if (!hostId)
      hostId = message.hostId
    if (message.sequence <= lastParentSequence)
      return
    lastParentSequence = message.sequence
    if (message.type === 'sync') {
      void acceptSync(message)
      return
    }
    if (message.projectId !== currentProjectId
      || message.pageId !== currentPageId
      || message.revision !== currentRevision) {
      return
    }
    if (message.type === 'state') {
      if (message.sequence <= latestStateSequence)
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
    if (submitInFlight)
      return
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
        if (!isCurrentSubmit(requestToken, requestIdentity)) {
          return
        }
        const state = currentRuntimeState()
        const result: RuntimeHostSubmitResultPayload = {
          status: valid ? 'success' : 'invalid',
          values: cloneWorkbenchJson(valid ? (submittedValues ?? state.values) : state.values),
          touched: [...state.touched],
          validation: cloneWorkbenchJson(state.validation),
        }
        postMessage({ type: 'submitResult', payload: result })
        if (valid)
          postMessage({ type: 'submit', values: cloneWorkbenchJson(submittedValues ?? state.values) })
        postRuntimeState()
      })
      .catch((error) => {
        if (isCurrentSubmit(requestToken, requestIdentity))
          reportError('RUNTIME_SUBMIT_FAILED', error)
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
    submittedValues = cloneWorkbenchJson(values)
  }

  function isCurrentSubmit(
    requestToken: number,
    identity: {
      projectId: string
      pageId: string
      revision: string
      runtimeSessionKey: string
      syncSequence: number
    },
  ): boolean {
    return activeSubmitToken === requestToken
      && identity.projectId === currentProjectId
      && identity.pageId === currentPageId
      && identity.revision === currentRevision
      && identity.runtimeSessionKey === runtimeSessionKey.value
      && identity.syncSequence === latestSyncSequence
  }

  function fieldChange(payload: { field: string, values: Record<string, unknown> }): void {
    postMessage({
      type: 'fieldChange',
      payload: {
        field: payload.field,
        values: cloneWorkbenchJson(payload.values),
      },
    })
  }

  function runtimeEvent(payload: ConfigFormRuntimeEventPayload<Record<string, unknown>>): void {
    postMessage({
      type: 'runtimeEvent',
      payload: {
        event: payload.event,
        nodeId: payload.metadata.nodeId,
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
  onBeforeUnmount(() => window.removeEventListener('message', handleMessage))

  return {
    active,
    design,
    fieldChange,
    modelValue,
    namespace,
    postMessage,
    postRuntimeState,
    reactionProjection,
    renderer,
    runtimeError,
    runtimeEvent,
    runtimeMode,
    runtimeSessionKey,
    setGeometryPort,
    submitValues,
    updateModel,
  }
}
