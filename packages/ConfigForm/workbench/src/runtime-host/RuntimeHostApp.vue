<script setup lang="ts">
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type {
  ConfigFormRendererExpose,
  ConfigFormRuntimeEventPayload,
  RuntimeEditorBridge,
  RuntimeNodeMetadata,
} from '@moluoxixi/config-form/renderer'
import type { CSSProperties } from 'vue'
import type {
  RuntimeHostRuntimeStatePayload,
  RuntimeHostSyncMessage,
  RuntimeHostToParentPayload,
} from './protocol'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { RuntimeSurface } from '@moluoxixi/config-form/renderer'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
} from 'vue'
import { loadWorkbenchRuntimeAdapter } from '../adapters'
import { cloneWorkbenchJson } from '../utils/clone'
import {
  acceptsRuntimeHostMessageEvent,
  isParentToRuntimeHostMessage,
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from './protocol'

const renderer = useTemplateRef<ConfigFormRendererExpose<Record<string, unknown>>>('renderer')
const stage = useTemplateRef<HTMLElement>('stage')
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
const ghostOffset = ref<{ x: number, y: number }>()
const registeredNodes = new Map<string, {
  element: HTMLElement
  metadata: RuntimeNodeMetadata<Record<string, unknown>>
  order: number
}>()

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
let geometryFrame: number | undefined
let nodeOrder = 0
let geometryObserver: ResizeObserver | undefined
let applyingParentStateDepth = 0
let latestRuntimeState: RuntimeHostRuntimeStatePayload = {
  values: {},
  touched: [],
  validation: {},
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

function rectPayload(rect: DOMRect) {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

function scheduleGeometry(): void {
  if (runtimeMode.value !== 'design' || design.value?.variant !== 'canvas' || geometryFrame !== undefined)
    return
  geometryFrame = window.requestAnimationFrame(emitGeometry)
}

function flushGeometry(): void {
  if (geometryFrame !== undefined)
    window.cancelAnimationFrame(geometryFrame)
  geometryFrame = undefined
  emitGeometry()
}

function emitGeometry(): void {
  geometryFrame = undefined
  const stageElement = stage.value
  if (!stageElement || runtimeMode.value !== 'design')
    return
  const form = stageElement.querySelector<HTMLElement>('form') ?? stageElement
  const layout = stageElement.querySelector<HTMLElement>('[data-config-form-responsive-layout]')
  const nodes = [...registeredNodes.values()]
    .map(registration => ({
      depth: registration.metadata.path.split('.').filter(Boolean).length,
      nodeId: registration.metadata.nodeId,
      order: registration.order,
      path: registration.metadata.path,
      rect: rectPayload(registration.element.getBoundingClientRect()),
      ...(registration.metadata.slot ? { slot: registration.metadata.slot } : {}),
    }))
  postMessage({
    type: 'geometry',
    payload: {
      ...(layout ? { layoutRect: rectPayload(layout.getBoundingClientRect()) } : {}),
      nodes,
      surfaceRect: rectPayload(form.getBoundingClientRect()),
      viewport: {
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, form.getBoundingClientRect().bottom),
        width: document.documentElement.clientWidth,
      },
    },
  })
}

function registerDesignNode(
  metadata: RuntimeNodeMetadata<Record<string, unknown>>,
  element: HTMLElement,
): () => void {
  const key = metadata.nodeId
  const current = registeredNodes.get(key)
  if (current && current.element !== element)
    geometryObserver?.unobserve(current.element)
  const registration = {
    element,
    metadata,
    order: current?.order ?? nodeOrder++,
  }
  registeredNodes.set(key, registration)
  geometryObserver?.observe(element)
  scheduleGeometry()
  return () => {
    if (registeredNodes.get(key) !== registration)
      return
    geometryObserver?.unobserve(element)
    registeredNodes.delete(key)
    scheduleGeometry()
  }
}

const designEditor: RuntimeEditorBridge<Record<string, unknown>> = {
  registerNode: registerDesignNode,
  getNodeAttrs: (metadata) => {
    const candidate = design.value?.candidateId === metadata.nodeId
    const states = [
      candidate ? 'candidate' : '',
      candidate && design.value?.candidateUsesFallback ? 'visual-source' : '',
    ].filter(Boolean).join(' ')
    return {
      'data-config-node-state': states || undefined,
      'role': 'presentation',
    }
  },
  interceptEvent: () => true,
}

const stageStyle = computed<CSSProperties | undefined>(() => {
  if (runtimeMode.value !== 'design' || design.value?.variant !== 'drag-visual')
    return undefined
  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${Math.max(1, design.value.canvasWidth ?? 1)}px`,
    transform: ghostOffset.value
      ? `translate(${-ghostOffset.value.x}px, ${-ghostOffset.value.y}px)`
      : undefined,
    transformOrigin: 'top left',
  }
})

function updateGhostOffset(): void {
  if (runtimeMode.value !== 'design' || design.value?.variant !== 'drag-visual' || !design.value.candidateId)
    return
  const stageElement = stage.value
  const candidate = [...registeredNodes.values()]
    .find(registration => registration.metadata.nodeId === design.value?.candidateId)?.element
  if (!stageElement || !candidate)
    return
  const stageRect = stageElement.getBoundingClientRect()
  const candidateRect = candidate.getBoundingClientRect()
  ghostOffset.value = {
    x: candidateRect.left - stageRect.left,
    y: candidateRect.top - stageRect.top,
  }
}

function deepestDesignNode(clientX: number, clientY: number): string | undefined {
  return [...registeredNodes.values()]
    .flatMap((registration) => {
      if (registration.metadata.nodeId === design.value?.candidateId)
        return []
      const rect = registration.element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0
        || clientX < rect.left || clientX > rect.right
        || clientY < rect.top || clientY > rect.bottom) {
        return []
      }
      return [{
        area: rect.width * rect.height,
        depth: registration.metadata.path.split('.').filter(Boolean).length,
        nodeId: registration.metadata.nodeId,
        order: registration.order,
      }]
    })
    .sort((left, right) => right.depth - left.depth || left.area - right.area || right.order - left.order)[0]?.nodeId
}

function postDesignPointer(type: 'designPointerDown' | 'designPointerMove' | 'designPointerUp' | 'designPointerCancel', event: PointerEvent): void {
  if (runtimeMode.value !== 'design' || design.value?.variant !== 'canvas')
    return
  postMessage({
    type,
    payload: {
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      nodeId: deepestDesignNode(event.clientX, event.clientY),
      pointerId: event.pointerId,
      shiftKey: event.shiftKey,
    },
  })
}

function handleDesignPointerDown(event: PointerEvent): void {
  event.preventDefault()
  postDesignPointer('designPointerDown', event)
}

async function acceptSync(message: RuntimeHostSyncMessage): Promise<void> {
  if (message.sequence <= latestSyncSequence)
    return
  latestSyncSequence = message.sequence
  const syncSequence = message.sequence
  const nextCompilationKey = JSON.stringify(message.compilation.key)
  const sessionChanged = runtimeSessionKey.value !== message.runtimeSessionKey
  currentProjectId = message.projectId
  currentPageId = message.pageId
  currentRevision = message.revision
  document.documentElement.lang = message.locale
  runtimeMode.value = message.mode
  design.value = message.design
  ghostOffset.value = undefined
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
    if (message.mode === 'design' && message.design?.variant === 'drag-visual')
      updateGhostOffset()
    else {
      if (stage.value)
        geometryObserver?.observe(stage.value)
      await nextTick()
      flushGeometry()
    }
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
  void currentRenderer.submit()
    .then(postRuntimeState)
    .catch(error => reportError('RUNTIME_SUBMIT_FAILED', error))
}

function updateModel(value: Record<string, unknown>): void {
  modelValue.value = cloneWorkbenchJson(value)
  postRuntimeState()
}

function submitValues(values: Record<string, unknown>): void {
  postMessage({ type: 'submit', values: cloneWorkbenchJson(values) })
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
      nodeId: payload.nodeId,
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

onMounted(() => {
  window.addEventListener('message', handleMessage)
  window.addEventListener('resize', scheduleGeometry)
  window.addEventListener('scroll', scheduleGeometry, true)
  if (typeof ResizeObserver !== 'undefined') {
    geometryObserver = new ResizeObserver(() => {
      if (design.value?.variant === 'drag-visual')
        updateGhostOffset()
      else
        scheduleGeometry()
    })
    if (stage.value)
      geometryObserver.observe(stage.value)
    registeredNodes.forEach(registration => geometryObserver?.observe(registration.element))
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
  window.removeEventListener('resize', scheduleGeometry)
  window.removeEventListener('scroll', scheduleGeometry, true)
  if (geometryFrame !== undefined)
    window.cancelAnimationFrame(geometryFrame)
  geometryObserver?.disconnect()
  registeredNodes.clear()
})
</script>

<template>
  <main
    class="runtime-host-root"
    :data-mode="runtimeMode"
    :data-runtime-session="runtimeSessionKey"
    :data-variant="design?.variant"
    @pointerdown.capture="handleDesignPointerDown"
    @pointermove.capture="postDesignPointer('designPointerMove', $event)"
    @pointerup.capture="postDesignPointer('designPointerUp', $event)"
    @pointercancel.capture="postDesignPointer('designPointerCancel', $event)"
  >
    <div v-if="runtimeError" class="runtime-host-error" role="alert">
      <strong>Preview Runtime error</strong>
      <p>{{ runtimeError }}</p>
    </div>
    <div v-if="active" ref="stage" class="runtime-host-stage" :style="stageStyle">
      <RuntimeSurface
        :key="runtimeSessionKey"
        ref="renderer"
        :model-value="modelValue"
        :class="runtimeMode === 'design' ? 'page-design-form' : 'page-preview-form'"
        :mode="runtimeMode"
        :breakpoint="runtimeMode === 'design' ? design?.breakpoint : undefined"
        :editor="runtimeMode === 'design' ? designEditor : undefined"
        :aria-hidden="runtimeMode === 'design' ? 'true' : undefined"
        :inert="runtimeMode === 'design' ? true : undefined"
        :namespace="namespace"
        :reaction-projection="reactionProjection"
        v-bind="active.artifact.plan.renderer"
        @update:model-value="updateModel"
        @submit="submitValues"
        @field-change="fieldChange"
        @errors-change="postRuntimeState"
        @meta-change="postRuntimeState"
        @runtime-event="runtimeEvent"
      />
    </div>
  </main>
</template>
