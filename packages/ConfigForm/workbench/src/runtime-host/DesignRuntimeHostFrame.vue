<script setup lang="ts">
import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  DesignerRuntimeGeometrySnapshot,
  DesignerRuntimePointerPayload,
  DesignerRuntimeRect,
} from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { CSSProperties } from 'vue'
import type { WorkbenchAdapterId } from '../adapters'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../utils/clone'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from './protocol'
import type { RuntimeHostGeometryPayload } from './protocol'

const props = defineProps<{
  adapter: WorkbenchAdapterId
  breakpoint: ConfigFormBreakpoint
  cameraScale: number
  candidateId?: string
  candidateUsesFallback?: boolean
  canvasWidth?: number
  command?: ProjectCommand
  locale: string
  modelValue: Record<string, unknown>
  namespace?: string
  reactionProps: Record<string, Record<string, unknown>>
  reactionStates: Record<string, Record<string, unknown>>
  resolveCompilation: (command?: ProjectCommand) => PageCompilation | undefined
  title: string
  variant: 'canvas' | 'drag-visual'
}>()

const emit = defineEmits<{
  error: [error: Error]
  geometry: [snapshot: DesignerRuntimeGeometrySnapshot]
  pointerCancel: [payload: DesignerRuntimePointerPayload]
  pointerDown: [payload: DesignerRuntimePointerPayload]
  pointerMove: [payload: DesignerRuntimePointerPayload]
  pointerUp: [payload: DesignerRuntimePointerPayload]
}>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameHeight = ref(1)
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const sessionId = typeof crypto.randomUUID === 'function'
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
    sessionId,
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
    modelValue: cloneWorkbenchJson(props.modelValue),
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
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    sessionId,
    sequence: ++parentSequence,
    revision: revision.value,
    type: 'state',
    modelValue: cloneWorkbenchJson(props.modelValue),
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
    origin: targetOrigin,
    sessionId,
    source: frame.value?.contentWindow ?? null,
  })
  if (!message || message.sequence <= lastChildSequence)
    return
  lastChildSequence = message.sequence
  if (message.revision !== revision.value)
    return

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
