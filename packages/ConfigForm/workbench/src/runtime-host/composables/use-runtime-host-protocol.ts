import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type {
  ProjectCompilation,
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type {
  PrototypeProjectContextV1,
  PrototypeSessionCommand,
  PrototypeSessionV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type {
  PrototypeSurfaceHostExpose,
  PrototypeVueTransitionSnapshot,
} from '@moluoxixi/config-form-prototype-runtime/vue'
import type { VueSurfaceRuntimeArtifact } from '@moluoxixi/config-form-vue-backend'
import type {
  ParentToRuntimeHostMessageV7,
  RuntimeHostDesignSyncPayloadV7,
  RuntimeHostFieldInstanceV7,
  RuntimeHostFormStateSnapshotV7,
  RuntimeHostInstanceStatePayloadV7,
  RuntimeHostMessageBaseV7,
  RuntimeHostPayloadV7,
  RuntimeHostToParentMessageV7,
} from '../types'
import {
  createPrototypeProjectContext,
  readPrototypeSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { compileCanonicalSurfaceRuntime } from '@moluoxixi/config-form-vue-backend'
import { nextTick, onBeforeUnmount, onErrorCaptured, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { loadWorkbenchRuntimeAdapter } from '../../adapters'
import { cloneWorkbenchJson } from '../../utils'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import {
  acceptsRuntimeHostMessageEvent,
  isParentToRuntimeHostMessage,
  isRuntimeHostJsonObject,
} from '../schemas'

interface RuntimeHostGeometryPort {
  reset: () => void
  sync: () => Promise<void>
}

interface ExperienceState {
  adapter: 'antd-vue' | 'element-plus'
  compilation: ProjectCompilation
  session: PrototypeSessionV1
  sessionId: string
}

export function useRuntimeHostProtocol() {
  const renderer = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('renderer')
  const prototypeHost = useTemplateRef<PrototypeSurfaceHostExpose>('prototypeHost')
  const active = shallowRef<Awaited<ReturnType<typeof compileCanonicalSurfaceRuntime>> extends infer T
    ? T extends { success: true } ? T : never
    : never>()
  const modelValue = ref<ModelJsonObject>({})
  const namespace = ref<string>()
  const runtimeSessionKey = ref('')
  const runtimeError = ref('')
  const runtimeMode = ref<'design' | 'experience'>('design')
  const design = shallowRef<RuntimeHostDesignSyncPayloadV7>()
  const surfaceId = ref('')
  const experience = shallowRef<ExperienceState>()
  const experienceArtifacts = shallowRef<Record<string, VueSurfaceRuntimeArtifact>>({})
  const experienceContext = shallowRef<PrototypeProjectContextV1>()
  const experienceGeneration = ref(0)
  const runtimeState = shallowRef<RuntimeHostFormStateSnapshotV7>({ fields: [], touched: [], validation: {}, values: {} })
  const targetOrigin = window.location.origin
  let hostId = ''
  let currentProjectId = ''
  let currentRevision = ''
  let currentSessionId = ''
  let latestSyncSequence = -1
  let latestStateSequence = -1
  let lastParentSequence = -1
  let childSequence = 0
  let acceptedSync = false
  let geometryPort: RuntimeHostGeometryPort = { reset: () => {}, sync: async () => {} }
  const instanceRevisions = new Map<string, number>()

  function baseMessage(): RuntimeHostMessageBaseV7 {
    return {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: currentProjectId,
      revision: currentRevision,
      sequence: 0,
    }
  }

  function setGeometryPort(port: RuntimeHostGeometryPort): void {
    geometryPort = port
  }

  function postMessage(message: RuntimeHostPayloadV7<RuntimeHostToParentMessageV7>): void {
    if (!hostId || !currentProjectId || !currentRevision)
      return
    window.parent.postMessage({
      ...baseMessage(),
      sequence: ++childSequence,
      ...message,
    }, targetOrigin)
  }

  function fieldInstances(): RuntimeHostFieldInstanceV7[] {
    return (renderer.value?.listFieldInstances() ?? []).map(instance => ({
      address: cloneWorkbenchJson(instance.address),
      instanceKey: instance.instanceKey,
      valuePath: [...instance.valuePath],
    }))
  }

  function currentRuntimeState(): RuntimeHostFormStateSnapshotV7 {
    const currentRenderer = renderer.value
    const fields = fieldInstances()
    const currentValues = currentRenderer?.getValues() ?? modelValue.value
    const values = isRuntimeHostJsonObject(currentValues)
      ? cloneWorkbenchJson(currentValues)
      : cloneWorkbenchJson(modelValue.value)
    if (!isRuntimeHostJsonObject(currentValues))
      reportError('RUNTIME_VALUES_INVALID', 'Runtime values must be a JSON-safe object.')
    return {
      fields,
      values,
      touched: fields.filter(field => currentRenderer?.getInstanceMeta(field.address).touched)
        .map(field => field.instanceKey),
      validation: Object.fromEntries(fields.flatMap((field) => {
        const errors = currentRenderer?.getInstanceErrors(field.address) ?? []
        return errors.length > 0 ? [[field.instanceKey, [...errors]]] : []
      })),
    }
  }

  function postDesignRuntimeState(): void {
    if (runtimeMode.value !== 'design' || !acceptedSync || !surfaceId.value)
      return
    const state = currentRuntimeState()
    runtimeState.value = state
    postMessage({ type: 'design.runtimeState', surfaceId: surfaceId.value, payload: cloneWorkbenchJson(state) })
  }

  async function applyDesignState(state: RuntimeHostFormStateSnapshotV7, sequence: number): Promise<void> {
    if (sequence !== latestStateSequence || runtimeMode.value !== 'design')
      return
    modelValue.value = cloneWorkbenchJson(state.values)
    await nextTick()
    if (sequence !== latestStateSequence)
      return
    const currentRenderer = renderer.value
    if (!currentRenderer)
      return
    const touched = new Set(state.touched)
    currentRenderer.setValues(cloneWorkbenchJson(state.values))
    fieldInstances().forEach((field) => {
      currentRenderer.setInstanceTouched(field.address, touched.has(field.instanceKey))
    })
    currentRenderer.setErrors(cloneWorkbenchJson(state.validation) as Record<string, string[]>)
  }

  function reportError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    runtimeError.value = message
    if (hostId)
      postMessage({ type: 'error', code, message })
  }

  async function compileSurface(
    compilation: SurfaceCompilation | ProjectCompilation,
    nextSurfaceId: string,
    adapterId: 'antd-vue' | 'element-plus',
    sequence: number,
  ): Promise<boolean> {
    const adapter = await loadWorkbenchRuntimeAdapter(adapterId)
    if (sequence !== latestSyncSequence)
      return false
    const result = compileCanonicalSurfaceRuntime(
      'surface' in compilation
        ? { compilation }
        : { compilation, surfaceId: nextSurfaceId },
      adapter.runtimeResolver,
    )
    if (!result.success) {
      reportError(result.diagnostics[0]?.code ?? 'RUNTIME_COMPILE_FAILED', result.diagnostics.map(item => item.message).join('\n'))
      return false
    }
    active.value = result
    return true
  }

  async function compileExperience(
    compilation: ProjectCompilation,
    adapterId: 'antd-vue' | 'element-plus',
    sequence: number,
  ): Promise<boolean> {
    const adapter = await loadWorkbenchRuntimeAdapter(adapterId)
    if (sequence !== latestSyncSequence)
      return false
    const artifacts: Record<string, VueSurfaceRuntimeArtifact> = {}
    for (const nextSurfaceId of compilation.ir.surfaceOrder) {
      const result = compileCanonicalSurfaceRuntime(
        { compilation, surfaceId: nextSurfaceId },
        adapter.runtimeResolver,
      )
      if (!result.success) {
        reportError(
          result.diagnostics[0]?.code ?? 'RUNTIME_COMPILE_FAILED',
          result.diagnostics.map(item => item.message).join('\n'),
        )
        return false
      }
      artifacts[nextSurfaceId] = result.artifact
    }
    if (sequence !== latestSyncSequence)
      return false
    experienceArtifacts.value = artifacts
    return true
  }

  function handleExperienceTransition(snapshot: PrototypeVueTransitionSnapshot): void {
    const current = experience.value
    if (!current || runtimeMode.value !== 'experience')
      return
    experience.value = { ...current, session: snapshot.session }
    const activeInstanceId = snapshot.session.overlayStack.at(-1) ?? snapshot.session.pageHistory.at(-1)
    surfaceId.value = activeInstanceId
      ? snapshot.session.instancesById[activeInstanceId]?.surfaceId ?? ''
      : ''
    for (const liveInstanceId of instanceRevisions.keys()) {
      if (!snapshot.session.instancesById[liveInstanceId])
        instanceRevisions.delete(liveInstanceId)
    }
    if (!acceptedSync)
      return
    postMessage({
      type: 'experience.session',
      sessionId: current.sessionId,
      transition: {
        session: cloneWorkbenchJson(snapshot.session),
        diagnostics: cloneWorkbenchJson(snapshot.diagnostics),
      },
    })
  }

  async function acceptSync(message: Extract<ParentToRuntimeHostMessageV7, { type: 'design.sync' | 'experience.sync' }>): Promise<void> {
    if (message.sequence <= latestSyncSequence)
      return
    latestSyncSequence = message.sequence
    latestStateSequence = message.sequence
    acceptedSync = false
    hostId = message.hostId
    currentProjectId = message.projectId
    currentRevision = message.revision
    instanceRevisions.clear()
    geometryPort.reset()
    runtimeError.value = ''
    if (message.type === 'design.sync') {
      runtimeMode.value = 'design'
      surfaceId.value = message.surfaceId
      design.value = message.payload
      namespace.value = message.payload.namespace
      runtimeSessionKey.value = message.payload.runtimeSessionKey
      runtimeState.value = cloneWorkbenchJson(message.payload.runtimeState)
      modelValue.value = cloneWorkbenchJson(message.payload.runtimeState.values)
      experience.value = undefined
      experienceContext.value = undefined
      experienceArtifacts.value = {}
      experienceGeneration.value += 1
      const compiled = await compileSurface(message.payload.compilation, message.surfaceId, message.payload.adapter, message.sequence)
      if (!compiled)
        return
      await nextTick()
      await geometryPort.sync()
      if (message.sequence !== latestSyncSequence)
        return
      postMessage({ type: 'mounted', mode: 'design' })
      postMessage({ type: 'ready', mode: 'design' })
      acceptedSync = true
      return
    }
    runtimeMode.value = 'experience'
    design.value = undefined
    active.value = undefined
    currentSessionId = message.sessionId
    namespace.value = message.payload.namespace
    runtimeSessionKey.value = `${message.sessionId}:${message.revision}`
    const context = createPrototypeProjectContext(message.payload.compilation)
    if (!context.success) {
      reportError(
        context.diagnostics[0]?.code ?? 'PROTOTYPE_CONTEXT_INVALID',
        context.diagnostics.map(item => item.message).join('\n'),
      )
      return
    }
    const session = readPrototypeSession(message.payload.session, context.data)
    if (!session.success) {
      reportError(
        session.diagnostics[0]?.code ?? 'PROTOTYPE_SESSION_INVALID',
        session.diagnostics.map(item => item.message).join('\n'),
      )
      return
    }
    const nextSession = session.data
    experience.value = {
      adapter: message.payload.adapter,
      compilation: message.payload.compilation,
      session: nextSession,
      sessionId: message.sessionId,
    }
    experienceContext.value = context.data
    experienceGeneration.value += 1
    const activeInstanceId = nextSession.overlayStack.at(-1) ?? nextSession.pageHistory.at(-1)
    surfaceId.value = activeInstanceId
      ? nextSession.instancesById[activeInstanceId]?.surfaceId ?? ''
      : ''
    const compiled = await compileExperience(
      message.payload.compilation,
      message.payload.adapter,
      message.sequence,
    )
    if (!compiled)
      return
    await nextTick()
    if (message.sequence !== latestSyncSequence)
      return
    postMessage({ type: 'mounted', mode: 'experience' })
    postMessage({ type: 'ready', mode: 'experience' })
    acceptedSync = true
  }

  function dispatchExperience(command: PrototypeSessionCommand): void {
    if (!experience.value || runtimeMode.value !== 'experience' || !acceptedSync)
      return
    prototypeHost.value?.dispatch(command)
  }

  function handleMessage(event: MessageEvent<unknown>): void {
    const message = acceptsRuntimeHostMessageEvent(event, {
      guard: isParentToRuntimeHostMessage,
      origin: targetOrigin,
      ...(hostId ? { hostId } : {}),
      source: window.parent,
    })
    if (!message || (!hostId && message.type !== 'design.sync' && message.type !== 'experience.sync'))
      return
    if (message.sequence <= lastParentSequence)
      return
    if (message.type === 'design.sync' || message.type === 'experience.sync') {
      lastParentSequence = message.sequence
      void acceptSync(message)
      return
    }
    if (!acceptedSync || message.projectId !== currentProjectId || message.revision !== currentRevision)
      return
    if (message.type === 'design.state') {
      if (runtimeMode.value !== 'design' || message.surfaceId !== surfaceId.value || message.sequence <= latestStateSequence)
        return
      lastParentSequence = message.sequence
      latestStateSequence = message.sequence
      runtimeState.value = cloneWorkbenchJson(message.payload)
      void applyDesignState(message.payload, message.sequence)
      return
    }
    if (message.type === 'experience.command') {
      if (runtimeMode.value !== 'experience' || message.sessionId !== currentSessionId)
        return
      lastParentSequence = message.sequence
      dispatchExperience(message.command)
    }
  }

  function updateModel(value: Record<string, unknown>): void {
    if (!isRuntimeHostJsonObject(value)) {
      reportError('RUNTIME_VALUES_INVALID', 'Runtime values must be a JSON-safe object.')
      return
    }
    modelValue.value = cloneWorkbenchJson(value)
    if (runtimeMode.value === 'design')
      postDesignRuntimeState()
  }

  function fieldChange(payload: { values?: Record<string, unknown> }): void {
    if (payload.values)
      updateModel(payload.values)
  }

  function postExperienceInstanceState(event: {
    focusedAddress?: RuntimeHostInstanceStatePayloadV7['focusedAddress']
    instanceId: string
    state: RuntimeHostFormStateSnapshotV7
    surfaceId: string
  }): void {
    if (runtimeMode.value !== 'experience' || !experience.value || !acceptedSync)
      return
    const instance = experience.value.session.instancesById[event.instanceId]
    if (!instance || instance.surfaceId !== event.surfaceId)
      return
    const nextRevision = (instanceRevisions.get(event.instanceId) ?? 0) + 1
    const payload: RuntimeHostInstanceStatePayloadV7 = {
      ...cloneWorkbenchJson(event.state),
      surfaceId: instance.surfaceId,
      stateRevision: nextRevision,
      projection: cloneWorkbenchJson(instance.projection),
      ...(event.focusedAddress
        ? { focusedAddress: cloneWorkbenchJson(event.focusedAddress) }
        : {}),
    }
    instanceRevisions.set(event.instanceId, nextRevision)
    postMessage({
      type: 'experience.instanceState',
      sessionId: currentSessionId,
      instanceId: event.instanceId,
      payload,
    })
  }

  function reportExperienceError(error: Error): void {
    reportError('PROTOTYPE_RENDER_FAILED', error)
  }

  onErrorCaptured((error, _instance, info) => {
    reportError('RUNTIME_RENDER_FAILED', `${error instanceof Error ? error.message : String(error)} (${info})`)
    return false
  })

  onMounted(() => window.addEventListener('message', handleMessage))
  onBeforeUnmount(() => {
    acceptedSync = false
    latestSyncSequence += 1
    window.removeEventListener('message', handleMessage)
  })

  return {
    active,
    design,
    experienceArtifacts,
    experienceContext,
    experienceGeneration,
    experience,
    fieldChange,
    handleExperienceTransition,
    modelValue,
    namespace,
    postMessage,
    postExperienceInstanceState,
    postRuntimeState: postDesignRuntimeState,
    prototypeHost,
    reportExperienceError,
    runtimeError,
    runtimeMode,
    runtimeSessionKey,
    setGeometryPort,
    surfaceId,
    updateModel,
    dispatchExperience,
    renderer,
  }
}
