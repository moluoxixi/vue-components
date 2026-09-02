<script setup lang="ts">
import type {
  PreviewRuntimeHostFrameEmits,
  PreviewRuntimeHostFrameExpose,
  PreviewRuntimeHostFrameProps,
} from '../types'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../utils'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
} from '../schemas'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../constants'

const props = defineProps<PreviewRuntimeHostFrameProps>()

const emit = defineEmits<PreviewRuntimeHostFrameEmits>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const hostId = typeof crypto.randomUUID === 'function'
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
    hostId,
    projectId: props.compilation.snapshotIdentity.projectId,
    pageId: props.compilation.snapshotIdentity.pageId,
    sequence: ++parentSequence,
    revision: props.revision,
    type: 'sync',
    adapter: props.adapter,
    compilation: cloneWorkbenchJson(props.compilation),
    mode: 'preview',
    locale: props.locale,
    runtimeState: cloneWorkbenchJson(props.runtimeState),
    ...(props.namespace ? { namespace: props.namespace } : {}),
    reactionProjection: cloneWorkbenchJson(props.reactionProjection),
    runtimeSessionKey: props.runtimeSessionKey,
  })
}

function syncRuntimeState(): void {
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: props.compilation.snapshotIdentity.projectId,
    pageId: props.compilation.snapshotIdentity.pageId,
    sequence: ++parentSequence,
    revision: props.revision,
    type: 'state',
    runtimeState: cloneWorkbenchJson(props.runtimeState),
    reactionProjection: cloneWorkbenchJson(props.reactionProjection),
  })
}

function submit(): void {
  postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: props.compilation.snapshotIdentity.projectId,
    pageId: props.compilation.snapshotIdentity.pageId,
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
    hostId,
    origin: targetOrigin,
    pageId: props.compilation.snapshotIdentity.pageId,
    projectId: props.compilation.snapshotIdentity.projectId,
    revision: props.revision,
    source: frame.value?.contentWindow ?? null,
  })
  if (!message || message.sequence <= lastChildSequence)
    return
  lastChildSequence = message.sequence

  switch (message.type) {
    case 'ready':
      emit('ready', {
        hostId: message.hostId,
        pageId: message.pageId,
        projectId: message.projectId,
        revision: message.revision,
      })
      break
    case 'mounted':
      emit('mounted', {
        hostId: message.hostId,
        pageId: message.pageId,
        projectId: message.projectId,
        revision: message.revision,
      })
      break
    case 'runtimeState':
      emit('runtimeState', {
        hostId: message.hostId,
        pageId: message.pageId,
        projectId: message.projectId,
        revision: message.revision,
        state: message.payload,
      })
      break
    case 'submit':
      emit('submit', message.values)
      break
    case 'submitResult':
      emit('submitResult', {
        hostId: message.hostId,
        pageId: message.pageId,
        projectId: message.projectId,
        revision: message.revision,
        result: message.payload,
      })
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
  () => [props.runtimeState, props.reactionProjection],
  syncRuntimeState,
  { deep: true },
)

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => window.removeEventListener('message', handleMessage))

defineExpose<PreviewRuntimeHostFrameExpose>({ submit })
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
