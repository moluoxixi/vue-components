import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTrigger,
} from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type {
  PageFlowEngine,
} from '../../flow'
import type {
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
  PreviewRuntimeSubmitResultEvent,
  PreviewSession,
  PreviewSessionAcceptInput,
  PreviewSubmission,
  PreviewValidationState,
} from '../types'
import { createDesignPreviewModel, walkDesignGraph } from '@moluoxixi/config-form-designer'
import { computed, ref, shallowRef } from 'vue'
import {
  createWorkbenchPageFlowEngine,
} from '../../flow'
import { cloneWorkbenchJson } from '../../utils'
import { PREVIEW_TRACE_LIMIT } from '../constants'
import { createPageProjectionCoordinator } from './projection-coordinator'

function scopeKey(input: Pick<PreviewSessionAcceptInput, 'adapter' | 'pageId' | 'projectId'>): string {
  return `${input.projectId}:${input.adapter}:${input.pageId}`
}

function collectFieldContracts(
  graph: PageGraph,
  compilation?: PageCompilation,
): PreviewFieldContracts {
  const contracts: PreviewFieldContracts = Object.create(null)
  const registryUsage = new Map(compilation?.registryUsage.map(component => [component.key, component]))
  walkDesignGraph(graph, ({ node }) => {
    if (node.kind !== 'field')
      return
    const component = registryUsage.get(node.component)
    contracts[node.field] = JSON.stringify([
      node.id,
      node.component,
      component?.contractVersion ?? '',
      component?.fingerprint ?? '',
    ])
  })
  return contracts
}

function reconcileValues(
  graph: PageGraph,
  compilation: PageCompilation | undefined,
  previousValues: Record<string, unknown>,
  previousContracts: PreviewFieldContracts,
  reset: boolean,
): { contracts: PreviewFieldContracts, values: Record<string, unknown> } {
  const defaults = createDesignPreviewModel(graph)
  const contracts = collectFieldContracts(graph, compilation)
  const values: Record<string, unknown> = {}

  for (const [field, contract] of Object.entries(contracts)) {
    if (!reset && previousContracts[field] === contract && Object.hasOwn(previousValues, field))
      values[field] = cloneWorkbenchJson(previousValues[field])
    else if (Object.hasOwn(defaults, field))
      values[field] = cloneWorkbenchJson(defaults[field])
  }

  return { contracts, values }
}

function reconcileRuntimeFieldState(
  contracts: PreviewFieldContracts,
  previousContracts: PreviewFieldContracts,
  previousState: RuntimeHostRuntimeStatePayload,
  reset: boolean,
): Pick<RuntimeHostRuntimeStatePayload, 'touched' | 'validation'> {
  if (reset)
    return { touched: [], validation: {} }
  const retainedContractFields = new Set(Object.entries(contracts)
    .filter(([field, contract]) => previousContracts[field] === contract)
    .map(([field]) => field))
  return {
    touched: previousState.touched.filter(field => retainedContractFields.has(field)),
    validation: Object.fromEntries(Object.entries(previousState.validation)
      .filter(([field]) => retainedContractFields.has(field))
      .map(([field, errors]) => [field, [...errors]])),
  }
}

function cloneRuntimeState(state: RuntimeHostRuntimeStatePayload): RuntimeHostRuntimeStatePayload {
  return {
    values: cloneWorkbenchJson(state.values),
    touched: [...state.touched],
    validation: cloneWorkbenchJson(state.validation),
  }
}

function sameRuntimeFieldState(
  left: Pick<RuntimeHostRuntimeStatePayload, 'touched' | 'validation'>,
  right: Pick<RuntimeHostRuntimeStatePayload, 'touched' | 'validation'>,
): boolean {
  return JSON.stringify([...left.touched].sort()) === JSON.stringify([...right.touched].sort())
    && JSON.stringify(left.validation) === JSON.stringify(right.validation)
}

export function createPreviewSession(options: CreatePreviewSessionOptions): PreviewSession {
  const projectionCoordinator = createPageProjectionCoordinator()
  const values = ref<Record<string, unknown>>({})
  const touched = shallowRef<readonly string[]>([])
  const validation = shallowRef<Readonly<PreviewValidationState>>({})
  const lastSubmission = shallowRef<PreviewSubmission>()
  const trace = shallowRef<readonly ConfigFormFlowTraceEvent[]>([])
  const projection = shallowRef<PagePreviewProjection>()
  const revisionKey = computed(() => projection.value?.current.revisionKey ?? '')
  let currentCompilation: PageCompilation | undefined
  let currentScopeKey = ''
  let liveFieldContracts: PreviewFieldContracts = Object.create(null)
  const lastReadyPreview = shallowRef<LastReadyPreview>()
  let activeHostId = ''
  let lastMountIdentity = ''
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
        values: values.value,
        touched: [...touched.value],
        validation: cloneWorkbenchJson(validation.value),
      }
    }
    return fallbackForCurrentScope()?.runtimeState ?? {
      values: values.value,
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

  function updateRuntimeModel(value: Record<string, unknown>): void {
    if (disposed)
      return
    const next = cloneWorkbenchJson(value)
    if (projection.value?.compileResult.success) {
      values.value = next
      const ready = fallbackForCurrentScope()
      if (ready && ready.compilation === currentCompilation) {
        lastReadyPreview.value = {
          ...ready,
          runtimeState: { ...ready.runtimeState, values: cloneWorkbenchJson(next) },
        }
      }
      return
    }
    const fallback = fallbackForCurrentScope()
    if (fallback) {
      lastReadyPreview.value = {
        ...fallback,
        runtimeState: { ...fallback.runtimeState, values: next },
      }
    }
  }

  const flowEngine = options.createFlowEngine({
    readValues: getRuntimeModel,
    writeValues: updateRuntimeModel,
    onTrace: (event) => {
      trace.value = [...trace.value, cloneWorkbenchJson(event)].slice(-PREVIEW_TRACE_LIMIT)
      options.onTrace?.(event)
    },
  })

  function accept(input: PreviewSessionAcceptInput): PagePreviewProjection | undefined {
    if (disposed)
      return undefined
    if (input.runtime.success && !input.compilation)
      throw new TypeError('A successful Preview Runtime requires its PageCompilation.')

    const previousRevisionKey = projection.value?.current.revisionKey
    const nextScopeKey = scopeKey(input)
    const scopeChanged = currentScopeKey !== nextScopeKey
    const reconciled = reconcileValues(
      input.graph,
      input.compilation,
      getRuntimeModel(),
      activeFieldContracts(),
      scopeChanged,
    )
    const reconciledFieldState = reconcileRuntimeFieldState(
      reconciled.contracts,
      activeFieldContracts(),
      getRuntimeState(),
      scopeChanged,
    )

    if (scopeChanged) {
      lastReadyPreview.value = undefined
      lastMountIdentity = ''
      activeHostId = ''
      trace.value = []
    }
    currentScopeKey = nextScopeKey
    currentCompilation = input.compilation
    liveFieldContracts = reconciled.contracts
    values.value = reconciled.values
    touched.value = reconciledFieldState.touched
    validation.value = reconciledFieldState.validation
    projection.value = projectionCoordinator.publish({
      adapter: input.adapter,
      editVersion: input.editVersion,
      pageId: input.pageId,
      projectId: input.projectId,
      repositoryRevision: input.repositoryRevision,
    }, () => input.runtime)
    if (scopeChanged || previousRevisionKey !== projection.value.current.revisionKey || !input.runtime.success)
      lastSubmission.value = undefined

    const displayedCompilation = input.runtime.success
      ? input.compilation
      : fallbackForCurrentScope()?.compilation
    flowEngine.sync({
      pageKey: nextScopeKey,
      plans: displayedCompilation?.page.flows.map(flow => flow.plan) ?? [],
    })
    return projection.value
  }

  function dispatch(
    triggerOrKind: ConfigFormFlowTrigger['kind'] | ConfigFormFlowTrigger,
    nextValues = getRuntimeModel(),
    field?: string,
  ): ReturnType<PageFlowEngine['dispatch']> | undefined {
    const current = projection.value
    if (disposed || !current)
      return undefined
    const capturedScopeKey = currentScopeKey
    const capturedRevision = current.current.editVersion
    const capturedRevisionKey = current.current.revisionKey
    const signal = current.signal
    const trigger: ConfigFormFlowTrigger = typeof triggerOrKind === 'string'
      ? { kind: triggerOrKind, ...(field ? { field } : {}) }
      : triggerOrKind

    return flowEngine.dispatch({
      trigger,
      values: cloneWorkbenchJson(nextValues),
      revision: capturedRevision,
      signal,
      isCurrent: () => currentScopeKey === capturedScopeKey
        && projection.value?.current.editVersion === capturedRevision
        && projectionCoordinator.isCurrent(capturedRevisionKey)
        && !signal.aborted,
    })
  }

  function isCurrentRuntimeIdentity(event: PreviewRuntimeIdentity): boolean {
    const current = projection.value?.current
    return !!current
      && event.projectId === current.projectId
      && event.pageId === current.pageId
      && event.revision === current.revisionKey
      && projectionCoordinator.isCurrent(event.revision)
  }

  function handleFieldChange(payload: {
    field: string
    values: Record<string, unknown>
  }): ReturnType<PageFlowEngine['dispatch']> | undefined {
    if (disposed || !projection.value)
      return undefined
    updateRuntimeModel(payload.values)
    return dispatch('field.change', payload.values, payload.field)
  }

  function handleRuntimeEvent(payload: {
    event: string
    nodeId: string
  }): ReturnType<PageFlowEngine['dispatch']> | undefined {
    return dispatch({
      kind: 'component.event',
      nodeId: payload.nodeId,
      event: payload.event,
    })
  }

  function handleSubmit(
    submittedValues: Record<string, unknown>,
  ): ReturnType<PageFlowEngine['dispatch']> | undefined {
    if (disposed || !projection.value)
      return undefined
    updateRuntimeModel(submittedValues)
    return dispatch('form.submit', submittedValues)
  }

  function handleRuntimeReady(event: PreviewRuntimeIdentity): void {
    const current = projection.value
    if (!current?.compileResult.success
      || !currentCompilation
      || event.hostId !== activeHostId
      || !isCurrentRuntimeIdentity(event)) {
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
    if (event.hostId !== activeHostId || !isCurrentRuntimeIdentity(event))
      return
    const contracts = activeFieldContracts()
    const currentContractFields = new Set(Object.keys(contracts))
    const nextFieldState = {
      touched: event.state.touched.filter(field => currentContractFields.has(field)),
      validation: Object.fromEntries(Object.entries(event.state.validation)
        .filter(([field]) => currentContractFields.has(field))
        .map(([field, errors]) => [field, [...errors]])),
    }
    updateRuntimeModel(event.state.values)
    if (projection.value?.compileResult.success) {
      if (!sameRuntimeFieldState({
        touched: [...touched.value],
        validation: cloneWorkbenchJson(validation.value),
      }, nextFieldState)) {
        touched.value = nextFieldState.touched
        validation.value = nextFieldState.validation
      }
      const ready = fallbackForCurrentScope()
      if (ready && ready.compilation === currentCompilation) {
        lastReadyPreview.value = {
          ...ready,
          runtimeState: cloneRuntimeState({
            values: values.value,
            ...nextFieldState,
          }),
        }
      }
      return
    }
    const fallback = fallbackForCurrentScope()
    if (fallback) {
      lastReadyPreview.value = {
        ...fallback,
        runtimeState: cloneRuntimeState({
          values: event.state.values,
          ...nextFieldState,
        }),
      }
    }
  }

  function handleSubmitResult(event: PreviewRuntimeSubmitResultEvent): void {
    const current = projection.value?.current
    if (disposed || !current || event.hostId !== activeHostId || !isCurrentRuntimeIdentity(event))
      return

    const contracts = activeFieldContracts()
    const currentContractFields = new Set(Object.keys(contracts))
    const nextTouched = event.result.touched.filter(field => currentContractFields.has(field))
    const nextValidation = Object.fromEntries(Object.entries(event.result.validation)
      .filter(([field]) => currentContractFields.has(field))
      .map(([field, errors]) => [field, [...errors]]))
    const values = cloneWorkbenchJson(event.result.values)

    updateRuntimeModel(values)
    touched.value = nextTouched
    validation.value = nextValidation
    lastSubmission.value = {
      status: event.result.status,
      values,
      touched: [...nextTouched],
      validation: cloneWorkbenchJson(nextValidation),
      revisionKey: current.revisionKey,
      submittedAt: Date.now(),
    }
  }

  function handleRuntimeMounted(
    event: PreviewRuntimeIdentity,
  ): ReturnType<PageFlowEngine['dispatch']> | undefined {
    const current = projection.value
    if (!current || !isCurrentRuntimeIdentity(event))
      return undefined
    activeHostId = event.hostId
    const mountIdentity = `${event.hostId}:${current.current.runtimeSessionKey}`
    if (mountIdentity === lastMountIdentity)
      return undefined
    lastMountIdentity = mountIdentity
    return dispatch('page.mount')
  }

  function reset(reason: unknown): void {
    projectionCoordinator.invalidate(reason)
    flowEngine.clear()
    currentCompilation = undefined
    currentScopeKey = ''
    activeHostId = ''
    lastMountIdentity = ''
    lastReadyPreview.value = undefined
    liveFieldContracts = Object.create(null)
    projection.value = undefined
    values.value = {}
    touched.value = []
    validation.value = {}
    lastSubmission.value = undefined
    trace.value = []
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
    flowEngine.dispose()
  }

  return {
    flowProjection: flowEngine.projection,
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
    dispatch,
    dispose,
    getCompilation,
    getRuntimeModel,
    handleFieldChange,
    handleRuntimeEvent,
    handleRuntimeMounted,
    handleRuntimeReady,
    handleRuntimeState,
    handleSubmitResult,
    clearSubmission: () => lastSubmission.value = undefined,
    handleSubmit,
    updateRuntimeModel,
  }
}

export function createWorkbenchPreviewSession(
  options: CreateWorkbenchPreviewSessionOptions = {},
): PreviewSession {
  return createPreviewSession({
    onTrace: options.onTrace,
    createFlowEngine: ports => createWorkbenchPageFlowEngine({
      ...options,
      ...ports,
    }),
  })
}
