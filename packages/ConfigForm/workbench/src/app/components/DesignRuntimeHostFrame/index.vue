<script setup lang="ts">
import type {
  DesignerRuntimeRect,
} from '@moluoxixi/config-form-designer'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { CSSProperties } from 'vue'
import type {
  DesignRuntimeHostFrameEmits,
  DesignRuntimeHostFrameProps,
  RuntimeHostGeometryPayload,
  RuntimeHostRuntimeStatePayload,
} from '../../../runtime-host'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../utils'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
} from '../../../runtime-host'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../../../runtime-host'

const props = defineProps<DesignRuntimeHostFrameProps>()

const emit = defineEmits<DesignRuntimeHostFrameEmits>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameHeight = ref(1)
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const hostId = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `design-runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const compilation = computed(() => (
  props.resolveCompilation(props.command)
  ?? props.resolveCompilation()
))
const revision = computed(() => {
  const current = compilation.value
  return current
    ? `${current.snapshotIdentity.projectId}:${current.snapshotIdentity.pageId}:${JSON.stringify(current.key)}`
    : 'design-runtime-unavailable'
})
const runtimeSessionKey = computed(() => {
  const current = compilation.value
  return current
    ? `${current.snapshotIdentity.projectId}:${current.snapshotIdentity.pageId}:design:${props.variant}`
    : `design:${props.variant}`
})
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
let lastGeometry: { payload: RuntimeHostGeometryPayload, revision: string } | undefined
let geometryRefreshFrame: number | undefined
// A sync is fire-and-forget: the frame can reload (HMR or a fresh document) or still be
// evaluating its module graph when the message is posted, and a message delivered before
// the child attaches its listener is lost for good. Retry until the child answers so a
// missed sync cannot leave the canvas blank forever.
let syncAcknowledged = false
let syncAttempts = 0
let syncRetryTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
const SYNC_RETRY_INTERVAL_MS = 400
const SYNC_RETRY_LIMIT = 25
// Compilations are immutable per revision; cache the proxy-free clone so
// repeated syncs (candidate churn during drags) do not re-clone the page.
const compilationCloneCache = new WeakMap<object, unknown>()

function cloneCompilation<T extends object>(current: T): T {
  const cached = compilationCloneCache.get(current)
  if (cached)
    return cached as T
  const clone = cloneWorkbenchJson(current)
  compilationCloneCache.set(current, clone as object)
  return clone
}

// Runtime state props are immutable projections replaced wholesale on model
// edits, so clones can be reused by reference across repeated syncs. The
// runtime host re-clones every message payload and never keeps references
// into it, which makes sharing one clone between fields safe.
const stateCloneCache = new WeakMap<object, unknown>()

function cloneState<T extends object>(value: T): T {
  const raw = toRaw(value)
  const cached = stateCloneCache.get(raw)
  if (cached)
    return cached as T
  const clone = cloneWorkbenchJson(raw)
  stateCloneCache.set(raw, clone as object)
  return clone
}

function postMessage(message: Record<string, unknown>): void {
  if (!loaded || disposed)
    return
  frame.value?.contentWindow?.postMessage(message, targetOrigin)
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
    if (disposed || syncAcknowledged || !loaded)
      return
    if (syncAttempts >= SYNC_RETRY_LIMIT)
      return
    syncAttempts += 1
    syncRuntime()
    scheduleSyncRetry()
  }, SYNC_RETRY_INTERVAL_MS)
}

/**
 * Design mode renders inside the frame, so the parent has no instance list to mirror and
 * `fields` stays empty. It is still a required part of the protocol payload: the host
 * guard rejects any sync whose runtime state omits it, which silently blanked the canvas.
 * Typing the builder keeps that field from being dropped again.
 */
function designRuntimeState(): RuntimeHostRuntimeStatePayload {
  return {
    fields: [],
    touched: [],
    validation: {},
    values: cloneState(props.modelValue) as Record<string, unknown>,
  }
}

function syncRuntime(): void {
  const current = compilation.value
  if (!current)
    return
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: current.snapshotIdentity.projectId,
    pageId: current.snapshotIdentity.pageId,
    sequence: ++parentSequence,
    revision: revision.value,
    type: 'sync',
    adapter: props.adapter,
    compilation: cloneCompilation(current),
    mode: 'design',
    design: {
      breakpoint: props.breakpoint,
      ...(props.candidateId ? { candidateId: props.candidateId } : {}),
      ...(props.candidateUsesFallback ? { candidateUsesFallback: true } : {}),
      ...(props.canvasWidth ? { canvasWidth: props.canvasWidth } : {}),
      variant: props.variant,
    },
    locale: props.locale,
    runtimeState: designRuntimeState(),
    ...(props.namespace ? { namespace: props.namespace } : {}),
    reactionProjection: {
      values: cloneState(props.modelValue),
      props: cloneState(props.reactionProps),
      states: cloneState(props.reactionStates),
      validate: [],
    },
    runtimeSessionKey: runtimeSessionKey.value,
  })
}

function syncRuntimeState(): void {
  const current = compilation.value
  if (!current)
    return
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: current.snapshotIdentity.projectId,
    pageId: current.snapshotIdentity.pageId,
    sequence: ++parentSequence,
    revision: revision.value,
    type: 'state',
    runtimeState: designRuntimeState(),
    reactionProjection: {
      values: cloneState(props.modelValue),
      props: cloneState(props.reactionProps),
      states: cloneState(props.reactionStates),
      validate: [],
    },
  })
}

function frameScale(frameRect: DOMRect): { x: number, y: number } {
  const element = frame.value
  return {
    x: element?.clientWidth ? frameRect.width / element.clientWidth : props.cameraScale,
    y: element?.clientHeight ? frameRect.height / element.clientHeight : props.cameraScale,
  }
}

function parentRect(
  rect: DesignerRuntimeRect,
  frameRect: DOMRect,
  scale: { x: number, y: number },
): DesignerRuntimeRect {
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
    viewport: {
      height: payload.viewport.height,
      width: payload.viewport.width,
    },
    surfaceRect: parentRect(payload.surfaceRect, frameRect, scale),
    ...(payload.layoutRect
      ? { layoutRect: parentRect(payload.layoutRect, frameRect, scale) }
      : {}),
    nodes: payload.nodes.map(node => ({
      ...node,
      rect: parentRect(node.rect, frameRect, scale),
    })),
  })
}

function handleLoad(): void {
  loaded = true
  lastChildSequence = -1
  // A new document has no listener yet, so the previous acknowledgement is meaningless.
  syncAcknowledged = false
  stopSyncRetry()
  syncRuntime()
  scheduleSyncRetry()
}

function acknowledgeChild(): void {
  syncAcknowledged = true
  stopSyncRetry()
}

function handleMessage(event: MessageEvent<unknown>): void {
  const message = acceptsRuntimeHostMessageEvent(event, {
    guard: isRuntimeHostToParentMessage,
    hostId,
    origin: targetOrigin,
    pageId: compilation.value?.snapshotIdentity.pageId,
    projectId: compilation.value?.snapshotIdentity.projectId,
    revision: revision.value,
    source: frame.value?.contentWindow ?? null,
  })
  if (!message || message.sequence <= lastChildSequence)
    return
  lastChildSequence = message.sequence
  // `mounted`/`ready` are the child's proof that it accepted a sync; `runtimeState` and
  // `geometry` follow the accepted sync, so any of them means the handshake completed.
  if (message.type === 'mounted' || message.type === 'ready' || message.type === 'runtimeState' || message.type === 'geometry')
    acknowledgeChild()
  if (message.type === 'geometry' && props.variant === 'canvas') {
    frameHeight.value = Math.max(1, Math.ceil(message.payload.viewport.height))
    lastGeometry = { payload: message.payload, revision: message.revision }
    void nextTick(() => emitGeometry(message.payload, message.revision))
    return
  }
  if ((message.type === 'designPointerDown'
    || message.type === 'designPointerMove'
    || message.type === 'designPointerUp'
    || message.type === 'designPointerCancel'
    || message.type === 'designContextMenu')
    && props.variant === 'canvas') {
    const frameRect = frame.value?.getBoundingClientRect()
    if (!frameRect)
      return
    const scale = frameScale(frameRect)
    const payload = {
      ...message.payload,
      clientX: frameRect.left + message.payload.clientX * scale.x,
      clientY: frameRect.top + message.payload.clientY * scale.y,
    }
    if (message.type === 'designPointerDown')
      emit('pointerDown', payload)
    else if (message.type === 'designPointerMove')
      emit('pointerMove', payload)
    else if (message.type === 'designPointerUp')
      emit('pointerUp', payload)
    else if (message.type === 'designContextMenu')
      emit('contextMenu', payload)
    else
      emit('pointerCancel', payload)
    return
  }
  if (message.type === 'error')
    emit('error', new Error(`${message.code}: ${message.message}`))
}

watch(
  () => [
    props.adapter,
    props.breakpoint,
    props.candidateId,
    props.candidateUsesFallback,
    props.canvasWidth,
    props.command,
    props.locale,
    props.namespace,
    props.variant,
    compilation.value,
  ],
  syncRuntime,
)

// The state props are computed projections of the immutable design graph;
// edits always swap the object references, so a reference watch replaces the
// previous `deep: true` traversal that re-walked the whole model per flush.
watch(
  () => [props.modelValue, props.reactionProps, props.reactionStates],
  syncRuntimeState,
)

// A new revision needs a fresh acknowledgement before the retry loop can stop.
watch(revision, () => {
  syncAcknowledged = false
  stopSyncRetry()
  scheduleSyncRetry()
})

watch(() => props.cameraScale, () => {
  void nextTick(() => {
    if (lastGeometry)
      emitGeometry(lastGeometry.payload, lastGeometry.revision)
  })
}, { flush: 'post' })

// Node rects are translated into parent coordinates when the geometry message
// arrives; ancestor scrolling or window resizing invalidates that translation,
// so re-project the last payload against the fresh frame rect.
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
