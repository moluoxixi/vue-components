<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type {
  DesignRuntimeHostFrameEmits,
  DesignRuntimeHostFrameProps,
  RuntimeHostFormStateSnapshotV7,
  RuntimeHostGeometryPayload,
} from '../../../runtime-host'
import type { DesignerRuntimeRect } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../utils'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
} from '../../../runtime-host'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../../../runtime-host'

const props = defineProps<DesignRuntimeHostFrameProps>()
const emit = defineEmits<DesignRuntimeHostFrameEmits>()
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameHeight = ref(1)
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const hostId = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `design-runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const compilation = computed(() => props.resolveCompilation(props.command) ?? props.resolveCompilation())
const surfaceId = computed(() => compilation.value?.key.surfaceId ?? '')
const revision = computed(() => compilation.value
  ? `${compilation.value.snapshotIdentity.projectId}:${compilation.value.snapshotIdentity.surfaceId}:${JSON.stringify(compilation.value.key)}`
  : 'design-runtime-unavailable')
const runtimeSessionKey = computed(() => compilation.value
  ? `${compilation.value.snapshotIdentity.projectId}:${surfaceId.value}:design:${props.variant}`
  : `design:${props.variant}`)
const frameStyle = computed<CSSProperties>(() => props.variant === 'canvas'
  ? { height: `${Math.max(1, frameHeight.value)}px` }
  : {
      height: `${100 / props.cameraScale}%`,
      transform: `scale(${props.cameraScale})`,
      transformOrigin: 'top left',
      width: `${100 / props.cameraScale}%`,
    })

let loaded = false
let parentSequence = 0
let lastChildSequence = -1
let syncAcknowledged = false
let syncAttempts = 0
let syncRetryTimer: ReturnType<typeof setTimeout> | undefined
let geometryRefreshFrame: number | undefined
let lastGeometry: { payload: RuntimeHostGeometryPayload, revision: string } | undefined
let disposed = false
const SYNC_RETRY_INTERVAL_MS = 400
const SYNC_RETRY_LIMIT = 25
const compilationCloneCache = new WeakMap<object, unknown>()
const stateCloneCache = new WeakMap<object, unknown>()

function cloneCompilation<T extends object>(value: T): T {
  const cached = compilationCloneCache.get(value)
  if (cached)
    return cached as T
  const clone = cloneWorkbenchJson(value)
  compilationCloneCache.set(value, clone as object)
  return clone
}

function cloneState<T extends object>(value: T): T {
  const raw = toRaw(value)
  const cached = stateCloneCache.get(raw)
  if (cached)
    return cached as T
  const clone = cloneWorkbenchJson(raw)
  stateCloneCache.set(raw, clone as object)
  return clone
}

function designRuntimeState(): RuntimeHostFormStateSnapshotV7 {
  return { fields: [], touched: [], validation: {}, values: cloneState(props.modelValue) }
}

function postMessage(message: Record<string, unknown>): void {
  if (!loaded || disposed || !compilation.value)
    return
  frame.value?.contentWindow?.postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: compilation.value.snapshotIdentity.projectId,
    revision: revision.value,
    sequence: ++parentSequence,
    ...message,
  }, targetOrigin)
}

function syncRuntime(): void {
  const current = compilation.value
  if (!current)
    return
  postMessage({
    type: 'design.sync',
    surfaceId: surfaceId.value,
    payload: {
      adapter: props.adapter,
      breakpoint: props.breakpoint,
      ...(props.candidateId ? { candidateId: props.candidateId } : {}),
      ...(props.candidateUsesFallback ? { candidateUsesFallback: true } : {}),
      ...(props.canvasWidth ? { canvasWidth: props.canvasWidth } : {}),
      compilation: cloneCompilation(current),
      locale: props.locale,
      ...(props.namespace ? { namespace: props.namespace } : {}),
      runtimeSessionKey: runtimeSessionKey.value,
      runtimeState: designRuntimeState(),
      variant: props.variant,
    },
  })
}

function syncRuntimeState(): void {
  if (!compilation.value)
    return
  postMessage({
    type: 'design.state',
    surfaceId: surfaceId.value,
    payload: designRuntimeState(),
  })
}

function stopSyncRetry(): void {
  if (syncRetryTimer !== undefined) {
    clearTimeout(syncRetryTimer)
    syncRetryTimer = undefined
  }
  syncAttempts = 0
}

function scheduleSyncRetry(): void {
  if (disposed || syncAcknowledged || !loaded || syncRetryTimer !== undefined)
    return
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = undefined
    if (disposed || syncAcknowledged || !loaded || syncAttempts >= SYNC_RETRY_LIMIT)
      return
    syncAttempts += 1
    syncRuntime()
    scheduleSyncRetry()
  }, SYNC_RETRY_INTERVAL_MS)
}

function frameScale(frameRect: DOMRect): { x: number, y: number } {
  const element = frame.value
  return {
    x: element?.clientWidth ? frameRect.width / element.clientWidth : props.cameraScale,
    y: element?.clientHeight ? frameRect.height / element.clientHeight : props.cameraScale,
  }
}

function parentRect(rect: DesignerRuntimeRect, frameRect: DOMRect, scale: { x: number, y: number }): DesignerRuntimeRect {
  return {
    bottom: frameRect.top + rect.bottom * scale.y,
    height: rect.height * scale.y,
    left: frameRect.left + rect.left * scale.x,
    right: frameRect.left + rect.right * scale.x,
    top: frameRect.top + rect.top * scale.y,
    width: rect.width * scale.x,
  }
}

function emitGeometry(payload: RuntimeHostGeometryPayload, messageRevision: string): void {
  const frameRect = frame.value?.getBoundingClientRect()
  if (!frameRect || messageRevision !== revision.value)
    return
  const scale = frameScale(frameRect)
  emit('geometry', {
    revision: messageRevision,
    viewport: payload.viewport,
    surfaceRect: parentRect(payload.surfaceRect, frameRect, scale),
    ...(payload.layoutRect ? { layoutRect: parentRect(payload.layoutRect, frameRect, scale) } : {}),
    nodes: payload.nodes.map(node => ({ ...node, rect: parentRect(node.rect, frameRect, scale) })),
  })
}

function handleLoad(): void {
  loaded = true
  lastChildSequence = -1
  syncAcknowledged = false
  stopSyncRetry()
  syncRuntime()
  scheduleSyncRetry()
}

function handleMessage(event: MessageEvent<unknown>): void {
  const message = acceptsRuntimeHostMessageEvent(event, {
    guard: isRuntimeHostToParentMessage,
    hostId,
    origin: targetOrigin,
    projectId: compilation.value?.snapshotIdentity.projectId,
    revision: revision.value,
    source: frame.value?.contentWindow ?? null,
  })
  if (!message || message.sequence <= lastChildSequence)
    return
  if (message.type === 'mounted' || message.type === 'ready') {
    if (message.mode !== 'design')
      return
    lastChildSequence = message.sequence
    syncAcknowledged = true
    stopSyncRetry()
    return
  }
  if (message.type === 'design.runtimeState') {
    if (message.surfaceId !== surfaceId.value)
      return
    lastChildSequence = message.sequence
    syncAcknowledged = true
    stopSyncRetry()
    return
  }
  if (message.type === 'design.geometry') {
    if (message.surfaceId !== surfaceId.value || props.variant !== 'canvas')
      return
    lastChildSequence = message.sequence
    syncAcknowledged = true
    stopSyncRetry()
    frameHeight.value = Math.max(1, Math.ceil(message.payload.viewport.height))
    lastGeometry = { payload: message.payload, revision: message.revision }
    void nextTick(() => emitGeometry(message.payload, message.revision))
    return
  }
  if ((message.type === 'design.pointerDown' || message.type === 'design.pointerMove'
    || message.type === 'design.pointerUp' || message.type === 'design.pointerCancel' || message.type === 'design.contextMenu')
    && message.surfaceId === surfaceId.value && props.variant === 'canvas') {
    lastChildSequence = message.sequence
    const frameRect = frame.value?.getBoundingClientRect()
    if (!frameRect)
      return
    const scale = frameScale(frameRect)
    const payload = {
      ...message.payload,
      clientX: frameRect.left + message.payload.clientX * scale.x,
      clientY: frameRect.top + message.payload.clientY * scale.y,
    }
    if (message.type === 'design.pointerDown') emit('pointerDown', payload)
    else if (message.type === 'design.pointerMove') emit('pointerMove', payload)
    else if (message.type === 'design.pointerUp') emit('pointerUp', payload)
    else if (message.type === 'design.pointerCancel') emit('pointerCancel', payload)
    else emit('contextMenu', payload)
    return
  }
  if (message.type === 'error') {
    lastChildSequence = message.sequence
    emit('error', new Error(`${message.code}: ${message.message}`))
  }
}

watch(() => [props.adapter, props.breakpoint, props.candidateId, props.candidateUsesFallback, props.canvasWidth, props.command, props.locale, props.namespace, props.variant, compilation.value], syncRuntime)
watch(() => [props.modelValue], syncRuntimeState)
watch(revision, () => {
  syncAcknowledged = false
  stopSyncRetry()
  scheduleSyncRetry()
})
watch(() => props.cameraScale, () => {
  void nextTick(() => lastGeometry && emitGeometry(lastGeometry.payload, lastGeometry.revision))
}, { flush: 'post' })

function scheduleGeometryRefresh(): void {
  if (props.variant !== 'canvas' || !lastGeometry || geometryRefreshFrame !== undefined)
    return
  geometryRefreshFrame = window.requestAnimationFrame(() => {
    geometryRefreshFrame = undefined
    if (lastGeometry)
      emitGeometry(lastGeometry.payload, lastGeometry.revision)
  })
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
  window.addEventListener('scroll', scheduleGeometryRefresh, true)
  window.addEventListener('resize', scheduleGeometryRefresh)
})
onBeforeUnmount(() => {
  disposed = true
  stopSyncRetry()
  window.removeEventListener('message', handleMessage)
  window.removeEventListener('scroll', scheduleGeometryRefresh, true)
  window.removeEventListener('resize', scheduleGeometryRefresh)
  if (geometryRefreshFrame !== undefined)
    window.cancelAnimationFrame(geometryRefreshFrame)
})
</script>

<template>
  <iframe
    v-if="compilation"
    ref="frame"
    class="design-runtime-host"
    :class="`is-${variant}`"
    data-design-runtime-host
    :data-design-runtime-variant="variant"
    referrerpolicy="same-origin"
    :src="frameSource"
    :style="frameStyle"
    :title="title"
    tabindex="-1"
    @load="handleLoad"
  />
</template>
