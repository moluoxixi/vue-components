<script setup lang="ts">
import type {
  PreviewRuntimeHostFrameEmits,
  PreviewRuntimeHostFrameExpose,
  PreviewRuntimeHostFrameProps,
} from '../../../runtime-host'
import type { PreviewRuntimeIdentity } from '../../../session'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../utils'
import {
  acceptsRuntimeHostMessageEvent,
  isRuntimeHostToParentMessage,
} from '../../../runtime-host'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../../../runtime-host'
import {
  createRuntimeHostDataExecutor,
} from '../../../runtime-host'

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
let submitSequence = 0
let pendingSubmit: { identity: PreviewRuntimeIdentity, requestId: string, values?: Record<string, unknown> } | undefined

function currentIdentity(): PreviewRuntimeIdentity {
  return {
    hostId,
    pageId: props.compilation.snapshotIdentity.pageId,
    projectId: props.compilation.snapshotIdentity.projectId,
    revision: props.revision,
  }
}

function isCurrentIdentity(identity: PreviewRuntimeIdentity): boolean {
  const current = currentIdentity()
  return identity.hostId === current.hostId
    && identity.projectId === current.projectId
    && identity.pageId === current.pageId
    && identity.revision === current.revision
}

function postMessage(message: Record<string, unknown>): void {
  if (!loaded)
    return
  frame.value?.contentWindow?.postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: props.compilation.snapshotIdentity.projectId,
    pageId: props.compilation.snapshotIdentity.pageId,
    sequence: ++parentSequence,
    revision: props.revision,
    ...message,
  }, targetOrigin)
}

const dataExecutor = createRuntimeHostDataExecutor({
  getHost: () => props.dataSourceHost,
  isCurrent: identity => loaded && isCurrentIdentity(identity),
  postResult: message => postMessage(message),
})

function syncRuntime(): void {
  pendingSubmit = undefined
  postMessage({
    type: 'sync',
    adapter: props.adapter,
    compilation: cloneWorkbenchJson(props.compilation),
    mode: 'preview',
    dataSourceRequest: typeof props.dataSourceHost?.request === 'function',
    locale: props.locale,
    runtimeState: cloneWorkbenchJson(props.runtimeState),
    ...(props.namespace ? { namespace: props.namespace } : {}),
    reactionProjection: cloneWorkbenchJson(props.reactionProjection),
    runtimeSessionKey: props.runtimeSessionKey,
  })
}

function submit(): void {
  if (!loaded || !frame.value?.contentWindow || pendingSubmit)
    return
  const requestId = `${hostId}:submit:${++submitSequence}`
  pendingSubmit = { identity: currentIdentity(), requestId }
  emit('submit', identityEvent({ phase: 'request' as const, requestId }))
  postMessage({ type: 'submit', requestId })
}

function identityEvent<T extends object>(payload: T): T & {
  hostId: string
  pageId: string
  projectId: string
  revision: string
} {
  return {
    ...payload,
    hostId,
    pageId: props.compilation.snapshotIdentity.pageId,
    projectId: props.compilation.snapshotIdentity.projectId,
    revision: props.revision,
  }
}

function handleLoad(): void {
  dataExecutor.cancelAll(new Error('Runtime frame reloaded.'))
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
    case 'dataRequest':
      dataExecutor.handleRequest(message)
      break
    case 'dataCancel':
      dataExecutor.handleCancel(message)
      break
    case 'ready':
      emit('ready', identityEvent({}))
      break
    case 'mounted':
      emit('mounted', identityEvent({}))
      break
    case 'runtimeState':
      emit('runtimeState', identityEvent({ state: message.payload }))
      break
    case 'submit':
      if (!pendingSubmit || pendingSubmit.requestId !== message.requestId
        || !isCurrentIdentity(pendingSubmit.identity) || pendingSubmit.values !== undefined)
        break
      pendingSubmit.values = cloneWorkbenchJson(message.values)
      emit('submit', identityEvent({ phase: 'success' as const, requestId: message.requestId, values: cloneWorkbenchJson(message.values) }))
      break
    case 'submitResult': {
      if (!pendingSubmit || pendingSubmit.requestId !== message.payload.requestId
        || !isCurrentIdentity(pendingSubmit.identity))
        break
      const request = pendingSubmit
      pendingSubmit = undefined
      const result = cloneWorkbenchJson(message.payload)
      if (result.status === 'success' && (request.values === undefined
        || JSON.stringify(request.values) !== JSON.stringify(result.values)))
        result.status = 'failure'
      emit('submitResult', identityEvent({ result }))
      break
    }
    case 'fieldChange':
      emit('fieldChange', identityEvent(cloneWorkbenchJson(message.payload)))
      break
    case 'error':
      emit('error', new Error(`${message.code}: ${message.message}`))
      break
    default:
      break
  }
}

watch(
  () => [
    props.adapter,
    props.compilation,
    props.dataSourceHost,
    props.locale,
    props.namespace,
    props.revision,
    props.runtimeSessionKey,
  ],
  () => {
    syncRuntime()
  },
)

watch(
  () => [props.adapter, props.compilation, props.dataSourceHost, props.revision, props.runtimeSessionKey],
  () => dataExecutor.cancelAll(new Error('Runtime preview identity changed.')),
  { flush: 'sync' },
)

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => {
  pendingSubmit = undefined
  dataExecutor.dispose()
  loaded = false
  window.removeEventListener('message', handleMessage)
})

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
