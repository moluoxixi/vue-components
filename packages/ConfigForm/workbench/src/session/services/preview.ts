import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowTraceEvent,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type {
  PreviewRuntimeComponentEvent,
  PreviewRuntimeFieldChangeEvent,
  PreviewRuntimeFlowDiagnosticEvent,
  PreviewRuntimeFlowProjectionEvent,
  PreviewRuntimeFlowResultEvent,
  PreviewRuntimeFlowTraceEvent,
  RuntimeHostFieldInstance,
  RuntimeHostRuntimeStatePayload,
} from '../../runtime-host'
import type {
  CreatePreviewSessionOptions,
  CreateWorkbenchPreviewSessionOptions,
  LastReadyPreview,
  PagePreviewProjection,
  PreviewFieldContracts,
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitEvent,
  PreviewRuntimeSubmitResultEvent,
  PreviewSession,
  PreviewSessionAcceptInput,
  PreviewSubmission,
  PreviewValidationState,
} from '../types'
import { computed, ref, shallowRef } from 'vue'
import { createWorkbenchFlowActionRegistry } from '../../flow'
import { isRuntimeHostFieldInstance, isRuntimeHostRuntimeState } from '../../runtime-host/schemas/protocol'
import { cloneWorkbenchJson } from '../../utils'
import { PREVIEW_TRACE_LIMIT } from '../constants'
import { collectPreviewContracts, emptyPreviewContracts, filterPreviewState, matchesPreviewInstance, reconcilePreviewState } from './preview-instance-state'
import { createPageProjectionCoordinator } from './projection-coordinator'

function scopeKey(input: Pick<PreviewSessionAcceptInput, 'adapter' | 'pageId' | 'projectId'>): string {
  return `${input.projectId}:${input.adapter}:${input.pageId}`
}

function cloneRuntimeState(state: RuntimeHostRuntimeStatePayload): RuntimeHostRuntimeStatePayload {
  return {
    fields: cloneWorkbenchJson(state.fields),
    values: cloneWorkbenchJson(state.values),
    touched: [...state.touched],
    validation: cloneWorkbenchJson(state.validation),
  }
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function sameRuntimeFieldState(
  left: { touched: readonly string[], validation: Readonly<Record<string, readonly string[]>> },
  right: { touched: readonly string[], validation: Readonly<Record<string, readonly string[]>> },
): boolean {
  if (!sameStringArray([...left.touched].sort(), [...right.touched].sort()))
    return false
  const fields = Object.keys(left.validation)
  if (fields.length !== Object.keys(right.validation).length)
    return false
  return fields.every((field) => {
    const rightErrors = right.validation[field]
    return !!rightErrors && sameStringArray(left.validation[field]!, rightErrors)
  })
}

function emptyProjection(): ConfigFormReactionProjection<Record<string, unknown>> {
  return { values: {}, props: {}, states: {}, validate: [] }
}

function identityKey(identity: PreviewRuntimeIdentity): string {
  return `${identity.hostId}:${identity.projectId}:${identity.pageId}:${identity.revision}`
}

function traceKey(trace: ConfigFormFlowTraceEvent): string {
  return [trace.flowId, trace.runId, trace.type, trace.nodeId ?? '', trace.timestamp ?? '', trace.status ?? ''].join(':')
}

function diagnosticKey(diagnostic: ConfigFormFlowDiagnostic): string {
  return JSON.stringify([
    diagnostic.code,
    diagnostic.message,
    diagnostic.path ?? '',
    diagnostic.nodeId ?? '',
    diagnostic.edgeId ?? '',
    diagnostic.severity ?? '',
  ])
}

export function createPreviewSession(options: CreatePreviewSessionOptions = {}): PreviewSession {
  const projectionCoordinator = createPageProjectionCoordinator()
  const values = ref<Record<string, unknown>>({})
  const fields = shallowRef<RuntimeHostFieldInstance[]>([])
  const touched = shallowRef<readonly string[]>([])
  const validation = shallowRef<Readonly<PreviewValidationState>>({})
  const lastSubmission = shallowRef<PreviewSubmission>()
  const trace = shallowRef<readonly ConfigFormFlowTraceEvent[]>([])
  const flowDiagnostics = shallowRef<readonly ConfigFormFlowDiagnostic[]>([])
  const flowProjectionMirror = shallowRef<ConfigFormReactionProjection<Record<string, unknown>>>(emptyProjection())
  const projection = shallowRef<PagePreviewProjection>()
  const revisionKey = computed(() => projection.value?.current.revisionKey ?? '')
  const flowProjection = computed(() => flowProjectionMirror.value)
  const actions: ConfigFormFlowActionRegistry = options.actions ?? { get: () => undefined }
  let currentCompilation: PageCompilation | undefined
  let currentScopeKey = ''
  let liveFieldContracts = emptyPreviewContracts()
  const lastReadyPreview = shallowRef<LastReadyPreview>()
  let activeHostId = ''
  const retiredHostIds = new Set<string>()
  let lastMountIdentity = ''
  let pendingSubmit: { key: string, requestId: string, values?: Record<string, unknown> } | undefined
  const usedSubmitRequests = new Set<string>()
  let disposed = false

  function fallbackForCurrentScope(): LastReadyPreview | undefined {
    return lastReadyPreview.value?.scopeKey === currentScopeKey ? lastReadyPreview.value : undefined
  }

  function getCompilation(): PageCompilation | undefined {
    if (projection.value?.compileResult.success)
      return currentCompilation
    return fallbackForCurrentScope()?.compilation
  }

  function getRuntimeModel(): Record<string, unknown> {
    return getRuntimeState().values
  }

  function getRuntimeState(): RuntimeHostRuntimeStatePayload {
    if (projection.value?.compileResult.success) {
      return {
        fields: cloneWorkbenchJson(fields.value),
        values: cloneWorkbenchJson(values.value),
        touched: [...touched.value],
        validation: cloneWorkbenchJson(validation.value),
      }
    }
    return fallbackForCurrentScope()?.runtimeState ?? {
      fields: cloneWorkbenchJson(fields.value),
      values: cloneWorkbenchJson(values.value),
      touched: [...touched.value],
      validation: cloneWorkbenchJson(validation.value),
    }
  }

  const runtimeState = computed(() => cloneRuntimeState(getRuntimeState()))

  function activeFieldContracts(): PreviewFieldContracts {
    if (projection.value?.compileResult.success)
      return liveFieldContracts
    return fallbackForCurrentScope()?.fieldContracts ?? liveFieldContracts
  }

  function updateReadyMirror(): void {
    const ready = fallbackForCurrentScope()
    const displayingReady = projection.value?.compileResult.success
      ? ready?.compilation === currentCompilation
      : !!ready
    if (ready && displayingReady) {
      lastReadyPreview.value = {
        ...ready,
        runtimeState: cloneRuntimeState({
          fields: fields.value,
          values: values.value,
          touched: [...touched.value],
          validation: cloneWorkbenchJson(validation.value),
        }),
      }
    }
  }

  function updateRuntimeModel(value: Record<string, unknown>): void {
    if (disposed)
      return
    values.value = cloneWorkbenchJson(value)
    updateReadyMirror()
  }

  function appendTrace(event: ConfigFormFlowTraceEvent): void {
    if (disposed)
      return
    const key = traceKey(event)
    if (trace.value.some(existing => traceKey(existing) === key))
      return
    trace.value = [...trace.value, cloneWorkbenchJson(event)].slice(-PREVIEW_TRACE_LIMIT)
    options.onTrace?.(event)
  }

  function appendDiagnostic(diagnostic: ConfigFormFlowDiagnostic): void {
    if (disposed)
      return
    const key = diagnosticKey(diagnostic)
    if (flowDiagnostics.value.some(existing => diagnosticKey(existing) === key))
      return
    flowDiagnostics.value = [
      ...flowDiagnostics.value,
      cloneWorkbenchJson(diagnostic),
    ].slice(-PREVIEW_TRACE_LIMIT)
    options.onDiagnostic?.(diagnostic)
  }

  function matchesCurrentRevision(event: PreviewRuntimeIdentity): boolean {
    const current = projection.value?.current
    return !!current
      && event.projectId === current.projectId
      && event.pageId === current.pageId
      && event.revision === current.revisionKey
      && projectionCoordinator.isCurrent(event.revision)
  }

  function isCurrentRuntimeIdentity(event: PreviewRuntimeIdentity): boolean {
    return matchesCurrentRevision(event)
      && activeHostId !== ''
      && event.hostId === activeHostId
  }

  function accept(input: PreviewSessionAcceptInput): PagePreviewProjection | undefined {
    if (disposed)
      return undefined
    if (input.runtime.success && !input.compilation)
      throw new TypeError('A successful Preview Runtime requires its PageCompilation.')

    const previousRevisionKey = projection.value?.current.revisionKey
    const nextScopeKey = scopeKey(input)
    const scopeChanged = currentScopeKey !== nextScopeKey
    const revisionChanged = previousRevisionKey !== undefined
      && previousRevisionKey !== `${input.projectId}:${input.repositoryRevision}:${input.pageId}:${input.editVersion}`
    const ready = lastReadyPreview.value?.scopeKey === nextScopeKey ? lastReadyPreview.value : undefined
    const preserveReady = !scopeChanged && !input.runtime.success && ready !== undefined
    const previousState = preserveReady ? ready.runtimeState : getRuntimeState()
    const previousContracts = preserveReady ? ready.fieldContracts : activeFieldContracts()
    const contracts = preserveReady ? ready.fieldContracts : collectPreviewContracts(input.graph, input.compilation)
    const reconciled = reconcilePreviewState(contracts, previousContracts, previousState, scopeChanged)

    if (scopeChanged) {
      lastReadyPreview.value = undefined
      lastMountIdentity = ''
      activeHostId = ''
      retiredHostIds.clear()
      pendingSubmit = undefined
      usedSubmitRequests.clear()
    }
    if (scopeChanged || revisionChanged) {
      pendingSubmit = undefined
      trace.value = []
      flowDiagnostics.value = []
      flowProjectionMirror.value = emptyProjection()
    }
    currentScopeKey = nextScopeKey
    currentCompilation = input.compilation
    liveFieldContracts = contracts
    values.value = reconciled.values
    fields.value = reconciled.fields
    touched.value = reconciled.touched
    validation.value = reconciled.validation
    projection.value = projectionCoordinator.publish({
      adapter: input.adapter,
      editVersion: input.editVersion,
      pageId: input.pageId,
      projectId: input.projectId,
      repositoryRevision: input.repositoryRevision,
    }, () => input.runtime)
    if (scopeChanged || previousRevisionKey !== projection.value.current.revisionKey || !input.runtime.success)
      lastSubmission.value = undefined
    return projection.value
  }

  function handleFieldChange(payload: PreviewRuntimeFieldChangeEvent): void {
    if (disposed || !isCurrentRuntimeIdentity(payload)
      || !isRuntimeHostFieldInstance(payload)
      || !matchesPreviewInstance(payload, activeFieldContracts(), payload.values)) {
      return
    }
    updateRuntimeModel(payload.values)
  }

  function handleRuntimeEvent(payload: PreviewRuntimeComponentEvent): void {
    if (disposed || !isCurrentRuntimeIdentity(payload))
      return
    if (payload.field !== undefined && (!isRuntimeHostFieldInstance(payload)
      || !matchesPreviewInstance(payload, activeFieldContracts(), payload.values))) {
      return
    }
    updateRuntimeModel(payload.values)
  }

  function handleRuntimeMounted(event: PreviewRuntimeIdentity): void {
    if (disposed || !matchesCurrentRevision(event) || retiredHostIds.has(event.hostId))
      return
    if (activeHostId && activeHostId !== event.hostId) {
      retiredHostIds.add(activeHostId)
      if (retiredHostIds.size > PREVIEW_TRACE_LIMIT)
        retiredHostIds.delete(retiredHostIds.values().next().value!)
    }
    activeHostId = event.hostId
    const mountIdentity = `${event.hostId}:${projection.value!.current.runtimeSessionKey}`
    if (mountIdentity !== lastMountIdentity) {
      lastMountIdentity = mountIdentity
      pendingSubmit = undefined
    }
  }

  function handleRuntimeReady(event: PreviewRuntimeIdentity): void {
    if (!isCurrentRuntimeIdentity(event)
      || !projection.value?.compileResult.success
      || !currentCompilation) {
      return
    }
    lastReadyPreview.value = {
      compilation: currentCompilation,
      fieldContracts: { ...liveFieldContracts },
      runtimeState: cloneRuntimeState(getRuntimeState()),
      scopeKey: currentScopeKey,
    }
  }

  function handleRuntimeState(event: PreviewRuntimeStateEvent): void {
    if (disposed || !isCurrentRuntimeIdentity(event) || !isRuntimeHostRuntimeState(event.state))
      return
    const next = filterPreviewState(event.state, activeFieldContracts())
    fields.value = next.fields
    values.value = next.values
    if (!sameRuntimeFieldState({ touched: touched.value, validation: validation.value }, next)) {
      touched.value = next.touched
      validation.value = next.validation
    }
    updateReadyMirror()
  }

  function handleSubmit(event: PreviewRuntimeSubmitEvent): void {
    if (disposed || !isCurrentRuntimeIdentity(event) || !event.requestId)
      return
    const key = JSON.stringify([identityKey(event), event.requestId])
    if (event.phase === 'request') {
      if (usedSubmitRequests.has(key))
        return
      usedSubmitRequests.add(key)
      if (usedSubmitRequests.size > PREVIEW_TRACE_LIMIT)
        usedSubmitRequests.delete(usedSubmitRequests.values().next().value!)
      pendingSubmit = { key, requestId: event.requestId }
    }
    else if (pendingSubmit?.key === key && pendingSubmit.values === undefined) {
      pendingSubmit.values = cloneWorkbenchJson(event.values)
    }
  }

  function handleSubmitResult(event: PreviewRuntimeSubmitResultEvent): void {
    const current = projection.value?.current
    const key = JSON.stringify([identityKey(event), event.result.requestId])
    if (disposed || !current || !isCurrentRuntimeIdentity(event)
      || !pendingSubmit || pendingSubmit.key !== key || !isRuntimeHostRuntimeState(event.result)) {
      return
    }
    const request = pendingSubmit
    pendingSubmit = undefined
    const status = event.result.status === 'success' && (request.values === undefined
      || JSON.stringify(request.values) !== JSON.stringify(event.result.values))
      ? 'failure'
      : event.result.status
    const next = filterPreviewState(event.result, activeFieldContracts())
    values.value = next.values
    fields.value = next.fields
    touched.value = next.touched
    validation.value = next.validation
    updateReadyMirror()
    lastSubmission.value = {
      ...next,
      requestId: request.requestId,
      status,
      revisionKey: current.revisionKey,
      submittedAt: Date.now(),
    }
  }

  function handleFlowTrace(event: PreviewRuntimeFlowTraceEvent): void {
    if (isCurrentRuntimeIdentity(event))
      appendTrace(event.trace)
  }

  function handleFlowError(event: PreviewRuntimeFlowDiagnosticEvent): void {
    if (isCurrentRuntimeIdentity(event))
      appendDiagnostic(event.diagnostic)
  }

  function handleFlowProjection(event: PreviewRuntimeFlowProjectionEvent): void {
    if (isCurrentRuntimeIdentity(event))
      flowProjectionMirror.value = cloneWorkbenchJson(event.projection)
  }

  function handleFlowResult(event: PreviewRuntimeFlowResultEvent): void {
    if (!isCurrentRuntimeIdentity(event))
      return
    const result = event.result
    for (const run of result.results) {
      if (run.projection)
        flowProjectionMirror.value = cloneWorkbenchJson(run.projection)
      run.trace.forEach(appendTrace)
      run.diagnostics.forEach(appendDiagnostic)
      if (run.error)
        appendDiagnostic(run.error)
    }
    result.diagnostics.forEach(appendDiagnostic)
    if (result.error)
      appendDiagnostic(result.error)
  }

  function reset(reason: unknown): void {
    projectionCoordinator.invalidate(reason)
    currentCompilation = undefined
    currentScopeKey = ''
    activeHostId = ''
    retiredHostIds.clear()
    lastMountIdentity = ''
    pendingSubmit = undefined
    usedSubmitRequests.clear()
    lastReadyPreview.value = undefined
    liveFieldContracts = emptyPreviewContracts()
    projection.value = undefined
    values.value = {}
    fields.value = []
    touched.value = []
    validation.value = {}
    lastSubmission.value = undefined
    trace.value = []
    flowDiagnostics.value = []
    flowProjectionMirror.value = emptyProjection()
  }

  function clear(reason: unknown = 'preview-session-cleared'): void {
    if (!disposed)
      reset(reason)
  }

  function dispose(): void {
    if (disposed)
      return
    reset('preview-session-disposed')
    disposed = true
  }

  return {
    actions,
    flowDiagnostics,
    flowProjection,
    lastSubmission,
    projection,
    revisionKey,
    runtimeState,
    touched,
    trace,
    validation,
    values,
    accept,
    clear,
    clearSubmission: () => lastSubmission.value = undefined,
    dispose,
    getCompilation,
    getRuntimeModel,
    handleFieldChange,
    handleFlowError,
    handleFlowProjection,
    handleFlowResult,
    handleFlowTrace,
    handleRuntimeEvent,
    handleRuntimeMounted,
    handleRuntimeReady,
    handleRuntimeState,
    handleSubmit,
    handleSubmitResult,
    updateRuntimeModel,
  }
}

export function createWorkbenchPreviewSession(
  options: CreateWorkbenchPreviewSessionOptions = {},
): PreviewSession {
  return createPreviewSession({
    actions: options.actions ?? createWorkbenchFlowActionRegistry(options),
    onDiagnostic: options.onDiagnostic,
    onTrace: options.onTrace,
  })
}
