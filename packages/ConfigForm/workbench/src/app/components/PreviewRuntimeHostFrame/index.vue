<script setup lang="ts">
import type {
  ExperienceRuntimeHostFrameEmits,
  ExperienceRuntimeHostFrameExpose,
  ExperienceRuntimeHostFrameProps,
  RuntimeHostToParentMessageV7,
} from '../../../runtime-host'
import {
  createPrototypeProjectContext,
  readPrototypeSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { cloneWorkbenchJson } from '../../../utils'
import { acceptsRuntimeHostMessageEvent, isRuntimeHostToParentMessage } from '../../../runtime-host'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../../../runtime-host'

const props = defineProps<ExperienceRuntimeHostFrameProps>()
const emit = defineEmits<ExperienceRuntimeHostFrameEmits>()
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const frameSource = `${import.meta.env.BASE_URL}runtime-host.html`
const targetOrigin = window.location.origin
const hostId = typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `experience-runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let loaded = false
let disposed = false
let parentSequence = 0
let lastChildSequence = -1
let lastInstanceRevision = new Map<string, number>()
let liveSession = cloneWorkbenchJson(props.session)
let latestChildSessionFingerprint: string | undefined

function sessionFingerprint(session: ExperienceRuntimeHostFrameProps['session']): string {
  return JSON.stringify(session)
}

function postMessage(message: Record<string, unknown>): void {
  if (!loaded || disposed)
    return
  frame.value?.contentWindow?.postMessage({
    channel: RUNTIME_HOST_CHANNEL,
    version: RUNTIME_HOST_PROTOCOL_VERSION,
    hostId,
    projectId: props.compilation.key.projectId,
    revision: props.revision,
    sequence: ++parentSequence,
    ...message,
  }, targetOrigin)
}

function syncRuntime(): void {
  latestChildSessionFingerprint = undefined
  lastInstanceRevision = new Map()
  liveSession = cloneWorkbenchJson(props.session)
  postMessage({
    type: 'experience.sync',
    sessionId: props.sessionId,
    payload: {
      adapter: props.adapter,
      compilation: cloneWorkbenchJson(props.compilation),
      locale: props.locale,
      ...(props.namespace ? { namespace: props.namespace } : {}),
      session: cloneWorkbenchJson(props.session),
    },
  })
}

function dispatch(command: unknown): void {
  postMessage({ type: 'experience.command', sessionId: props.sessionId, command: cloneWorkbenchJson(command) })
}

function identityEvent() {
  return {
    hostId,
    projectId: props.compilation.key.projectId,
    revision: props.revision,
    sessionId: props.sessionId,
  }
}

function handleLoad(): void {
  loaded = true
  lastChildSequence = -1
  syncRuntime()
}

function isExperienceRuntimeMessage(value: unknown): value is RuntimeHostToParentMessageV7 {
  const context = createPrototypeProjectContext(props.compilation)
  return context.success && isRuntimeHostToParentMessage(value, context.data)
}

function handleMessage(event: MessageEvent<unknown>): void {
  const message = acceptsRuntimeHostMessageEvent(event, {
    guard: isExperienceRuntimeMessage,
    hostId,
    origin: targetOrigin,
    projectId: props.compilation.key.projectId,
    revision: props.revision,
    source: frame.value?.contentWindow ?? null,
  })
  if (!message || message.sequence <= lastChildSequence)
    return
  if (message.type === 'ready' || message.type === 'mounted') {
    if (message.mode !== 'experience')
      return
    lastChildSequence = message.sequence
    if (message.type === 'ready')
      emit('ready', identityEvent())
    else
      emit('mounted', identityEvent())
    return
  }
  if (message.type === 'experience.session') {
    if (message.sessionId !== props.sessionId
      || message.transition.session.projectId !== props.compilation.key.projectId)
      return
    const context = createPrototypeProjectContext(props.compilation)
    if (!context.success)
      return
    const session = readPrototypeSession(message.transition.session, context.data)
    if (!session.success)
      return
    lastChildSequence = message.sequence
    liveSession = cloneWorkbenchJson(session.data)
    latestChildSessionFingerprint = sessionFingerprint(liveSession)
    for (const instanceId of lastInstanceRevision.keys()) {
      if (!liveSession.instancesById[instanceId])
        lastInstanceRevision.delete(instanceId)
    }
    emit('session', {
      ...identityEvent(),
      transition: cloneWorkbenchJson({
        ...message.transition,
        session: session.data,
      }),
    })
    return
  }
  if (message.type === 'experience.instanceState') {
    if (message.sessionId !== props.sessionId)
      return
    const liveInstance = liveSession.instancesById[message.instanceId]
    if (!liveInstance || liveInstance.surfaceId !== message.payload.surfaceId)
      return
    const previous = lastInstanceRevision.get(message.instanceId)
    if (previous !== undefined && message.payload.stateRevision <= previous)
      return
    lastChildSequence = message.sequence
    lastInstanceRevision.set(message.instanceId, message.payload.stateRevision)
    emit('instanceState', {
      ...identityEvent(),
      instanceId: message.instanceId,
      payload: cloneWorkbenchJson(message.payload),
    })
    return
  }
  if (message.type === 'error') {
    lastChildSequence = message.sequence
    emit('error', new Error(`${message.code}: ${message.message}`))
  }
}

watch(
  () => [
    props.adapter,
    props.compilation,
    props.locale,
    props.namespace,
    props.revision,
    props.session,
    props.sessionId,
  ] as const,
  (next, previous) => {
    const identityUnchanged = previous !== undefined
      && next[0] === previous[0]
      && next[1] === previous[1]
      && next[2] === previous[2]
      && next[3] === previous[3]
      && next[4] === previous[4]
      && next[6] === previous[6]
    if (identityUnchanged
      && latestChildSessionFingerprint !== undefined
      && sessionFingerprint(next[5]) === latestChildSessionFingerprint) {
      liveSession = cloneWorkbenchJson(next[5])
      return
    }
    syncRuntime()
  },
)
onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => {
  disposed = true
  loaded = false
  window.removeEventListener('message', handleMessage)
})

defineExpose<ExperienceRuntimeHostFrameExpose>({ dispatch })
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
