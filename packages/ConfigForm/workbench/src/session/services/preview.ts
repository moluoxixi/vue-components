import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  PrototypeSessionV1,
  SurfaceInstanceId,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type {
  ExperienceRuntimeHostIdentityEvent,
  ExperienceRuntimeInstanceStateEvent,
  ExperienceRuntimeSessionEvent,
} from '../../runtime-host'
import type {
  PreviewSession,
  PreviewSessionAcceptInput,
} from '../types'
import {
  createPrototypeProjectContext,
  readPrototypeSession,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { ref, shallowRef } from 'vue'
import {
  emptyPreviewInstanceStates,
  retainLivePreviewInstanceStates,
  updatePreviewInstanceState,
} from '../../services'
import { cloneWorkbenchJson } from '../../utils'
import { PREVIEW_SESSION_HISTORY_LIMIT } from '../constants'

function assertAcceptInput(input: PreviewSessionAcceptInput): void {
  if (!input.revision.trim())
    throw new TypeError('Preview revision must not be empty.')
  if (!input.sessionId.trim())
    throw new TypeError('Preview sessionId must not be empty.')
  if (input.compilation.key.projectId !== input.session.projectId)
    throw new TypeError('Preview compilation and Prototype Session must belong to the same project.')
}

function readSessionForCompilation(
  compilation: ProjectCompilation,
  input: unknown,
): PrototypeSessionV1 | undefined {
  const context = createPrototypeProjectContext(compilation)
  if (!context.success)
    return undefined
  const session = readPrototypeSession(input, context.data)
  return session.success ? session.data : undefined
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function createPreviewSession(): PreviewSession {
  const activeHost = shallowRef<ExperienceRuntimeHostIdentityEvent>()
  const compilation = shallowRef<ProjectCompilation>()
  const diagnostics = shallowRef<PreviewSession['diagnostics']['value']>([])
  const error = shallowRef<Error>()
  const instanceStates = shallowRef(emptyPreviewInstanceStates())
  const mounted = ref(false)
  const ready = ref(false)
  const revision = shallowRef('')
  const session = shallowRef<PrototypeSessionV1>()
  const sessionId = shallowRef('')
  const retiredHostIds = new Set<string>()
  let disposed = false

  function matchesPreview(event: ExperienceRuntimeHostIdentityEvent): boolean {
    return !disposed
      && compilation.value !== undefined
      && session.value !== undefined
      && event.projectId === compilation.value.key.projectId
      && event.revision === revision.value
      && event.sessionId === sessionId.value
  }

  function matchesActiveHost(event: ExperienceRuntimeHostIdentityEvent): boolean {
    return matchesPreview(event)
      && activeHost.value !== undefined
      && event.hostId === activeHost.value.hostId
  }

  function reset(): void {
    activeHost.value = undefined
    compilation.value = undefined
    diagnostics.value = []
    error.value = undefined
    instanceStates.value = emptyPreviewInstanceStates()
    mounted.value = false
    ready.value = false
    revision.value = ''
    session.value = undefined
    sessionId.value = ''
    retiredHostIds.clear()
  }

  function accept(input: PreviewSessionAcceptInput): void {
    if (disposed)
      return
    assertAcceptInput(input)
    const parsed = readSessionForCompilation(input.compilation, input.session)
    if (!parsed)
      throw new TypeError('Preview requires a valid Prototype Session for the supplied ProjectCompilation.')

    const identityChanged = compilation.value?.key.projectId !== input.compilation.key.projectId
      || revision.value !== input.revision
      || sessionId.value !== input.sessionId
    if (identityChanged) {
      activeHost.value = undefined
      instanceStates.value = emptyPreviewInstanceStates()
      mounted.value = false
      ready.value = false
      retiredHostIds.clear()
    }
    else {
      instanceStates.value = retainLivePreviewInstanceStates(instanceStates.value, parsed)
    }
    compilation.value = input.compilation
    diagnostics.value = []
    error.value = undefined
    revision.value = input.revision
    session.value = parsed
    sessionId.value = input.sessionId
  }

  function handleRuntimeMounted(event: ExperienceRuntimeHostIdentityEvent): void {
    if (!matchesPreview(event) || retiredHostIds.has(event.hostId))
      return
    const previousHostId = activeHost.value?.hostId
    if (previousHostId && previousHostId !== event.hostId) {
      retiredHostIds.add(previousHostId)
      if (retiredHostIds.size > PREVIEW_SESSION_HISTORY_LIMIT)
        retiredHostIds.delete(retiredHostIds.values().next().value!)
    }
    activeHost.value = cloneWorkbenchJson(event)
    error.value = undefined
    mounted.value = true
    ready.value = false
  }

  function handleRuntimeReady(event: ExperienceRuntimeHostIdentityEvent): void {
    if (!mounted.value || !matchesActiveHost(event))
      return
    ready.value = true
  }

  function handleSession(event: ExperienceRuntimeSessionEvent): void {
    if (!matchesActiveHost(event) || !compilation.value)
      return
    const parsed = readSessionForCompilation(compilation.value, event.transition.session)
    if (!parsed)
      return
    session.value = parsed
    diagnostics.value = cloneWorkbenchJson(event.transition.diagnostics)
    instanceStates.value = retainLivePreviewInstanceStates(instanceStates.value, parsed)
  }

  function handleInstanceState(event: ExperienceRuntimeInstanceStateEvent): void {
    if (!matchesActiveHost(event) || !session.value)
      return
    instanceStates.value = updatePreviewInstanceState(
      instanceStates.value,
      session.value,
      event.instanceId,
      event.payload,
    )
  }

  function handleRuntimeError(runtimeError: unknown): void {
    if (disposed || !compilation.value)
      return
    error.value = normalizeError(runtimeError)
    ready.value = false
  }

  function clear(): void {
    if (!disposed)
      reset()
  }

  function dispose(): void {
    if (disposed)
      return
    reset()
    disposed = true
  }

  function getInstanceState(instanceId: SurfaceInstanceId) {
    return instanceStates.value[instanceId]
  }

  return {
    activeHost,
    compilation,
    diagnostics,
    error,
    instanceStates,
    mounted,
    ready,
    revision,
    session,
    sessionId,
    accept,
    clear,
    dispose,
    getInstanceState,
    handleInstanceState,
    handleRuntimeError,
    handleRuntimeMounted,
    handleRuntimeReady,
    handleSession,
  }
}

export function createWorkbenchPreviewSession(): PreviewSession {
  return createPreviewSession()
}
