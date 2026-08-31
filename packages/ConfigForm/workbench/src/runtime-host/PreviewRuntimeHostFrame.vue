<script setup lang="ts">
import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../adapters'
import type { PreviewRuntimeMountedEvent } from '../session'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../utils/clone'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from './protocol'

const props = defineProps<{
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  locale: string
  modelValue: Record<string, unknown>
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  title: string
}>()

const emit = defineEmits<{
  error: [error: Error]
  fieldChange: [payload: { field: string, values: Record<string, unknown> }]
  modelValue: [value: Record<string, unknown>]
  mounted: [event: PreviewRuntimeMountedEvent]
  ready: [revision: string]
  runtimeEvent: [payload: { event: string, nodeId: string }]
  submit: [values: Record<string, unknown>]
}>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const sessionId = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let loaded = false
let parentSequence = 0
let lastChildSequence = -1

function postMessage(message: Record<string, unknown>): void {
  if (!loaded)
    return
  frame.value?.contentWindow?.postMessage(message, targetOrigin)
}

function syncRuntime(): void {
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    sessionId,
    sequence: ++parentSequence,
    revision: props.revision,
    type: 'sync',
    adapter: props.adapter,
    compilation: cloneWorkbenchJson(props.compilation),
    mode: 'preview',
    locale: props.locale,
    modelValue: cloneWorkbenchJson(props.modelValue),
    ...(props.namespace ? { namespace: props.namespace } : {}),
    reactionProjection: cloneWorkbenchJson(props.reactionProjection),
    runtimeSessionKey: props.runtimeSessionKey,
  })
}

function syncRuntimeState(): void {
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    sessionId,
    sequence: ++parentSequence,
    revision: props.revision,
    type: 'state',
    modelValue: cloneWorkbenchJson(props.modelValue),
    reactionProjection: cloneWorkbenchJson(props.reactionProjection),
  })
}

function submit(): void {
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    sessionId,
    sequence: ++parentSequence,
    revision: props.revision,
    type: 'submit',
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

  switch (message.type) {
    case 'ready':
      emit('ready', message.revision)
      break
    case 'mounted':
      emit('mounted', { hostId: sessionId, revision: message.revision })
      break
    case 'modelValue':
      emit('modelValue', message.value)
      break
    case 'submit':
      emit('submit', message.values)
      break
    case 'fieldChange':
      emit('fieldChange', message.payload)
      break
    case 'runtimeEvent':
      emit('runtimeEvent', message.payload)
      break
    case 'error':
      emit('error', new Error(`${message.code}: ${message.message}`))
      break
  }
}

watch(
  () => [
    props.adapter,
    props.compilation,
    props.locale,
    props.namespace,
    props.revision,
    props.runtimeSessionKey,
  ],
  syncRuntime,
)

watch(
  () => [props.modelValue, props.reactionProjection],
  syncRuntimeState,
  { deep: true },
)

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => window.removeEventListener('message', handleMessage))

defineExpose({ submit })
</script>

<template>
  <iframe
    ref="frame"
    class="preview-runtime-host"
    data-preview-runtime-host
    referrerpolicy="same-origin"
    :src="frameSource"
    :title="title"
    @load="handleLoad"
  />
</template>
