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
} from '../types'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../utils'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
} from '../schemas'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../constants'

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

function postMessage(message: Record<string, unknown>): void {
  if (!loaded)
    return
  frame.value?.contentWindow?.postMessage(message, targetOrigin)
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
    compilation: cloneWorkbenchJson(current),
    mode: 'design',
    design: {
      breakpoint: props.breakpoint,
      ...(props.candidateId ? { candidateId: props.candidateId } : {}),
      ...(props.candidateUsesFallback ? { candidateUsesFallback: true } : {}),
      ...(props.canvasWidth ? { canvasWidth: props.canvasWidth } : {}),
      variant: props.variant,
    },
    locale: props.locale,
    runtimeState: {
      values: cloneWorkbenchJson(props.modelValue),
      touched: [],
      validation: {},
    },
    ...(props.namespace ? { namespace: props.namespace } : {}),
    reactionProjection: {
      values: cloneWorkbenchJson(props.modelValue),
      props: cloneWorkbenchJson(props.reactionProps),
      states: cloneWorkbenchJson(props.reactionStates),
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
    runtimeState: {
      values: cloneWorkbenchJson(props.modelValue),
      touched: [],
      validation: {},
    },
    reactionProjection: {
      values: cloneWorkbenchJson(props.modelValue),
      props: cloneWorkbenchJson(props.reactionProps),
      states: cloneWorkbenchJson(props.reactionStates),
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
  syncRuntime()
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
  if (message.type === 'geometry' && props.variant === 'canvas') {
    frameHeight.value = Math.max(1, Math.ceil(message.payload.viewport.height))
    lastGeometry = { payload: message.payload, revision: message.revision }
    void nextTick(() => emitGeometry(message.payload, message.revision))
    return
  }
  if ((message.type === 'designPointerDown'
    || message.type === 'designPointerMove'
    || message.type === 'designPointerUp'
    || message.type === 'designPointerCancel')
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

watch(
  () => [props.modelValue, props.reactionProps, props.reactionStates],
  syncRuntimeState,
  { deep: true },
)

watch(() => props.cameraScale, () => {
  void nextTick(() => {
    if (lastGeometry)
      emitGeometry(lastGeometry.payload, lastGeometry.revision)
  })
}, { flush: 'post' })

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => window.removeEventListener('message', handleMessage))
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
