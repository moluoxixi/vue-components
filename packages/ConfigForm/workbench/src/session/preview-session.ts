import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowTrigger,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type {
  PageFlowEngine,
  WorkbenchPageFlowEngineOptions,
} from '../flow/page-flow-engine'
import type { PagePreviewProjection } from './projection-coordinator'
import { createDesignPreviewModel, walkDesignGraph } from '@moluoxixi/config-form-designer'
import { computed, ref, shallowRef } from 'vue'
import {
  createWorkbenchPageFlowEngine,
} from '../flow/page-flow-engine'
import { cloneWorkbenchJson } from '../utils/clone'
import { createPageProjectionCoordinator } from './projection-coordinator'

type PreviewFieldContracts = Record<string, string>

interface LastReadyPreview {
  readonly compilation: PageCompilation
  readonly fieldContracts: PreviewFieldContracts
  readonly modelValue: Record<string, unknown>
  readonly scopeKey: string
}

export interface PreviewSessionAcceptInput {
  readonly adapter: string
  readonly compilation?: PageCompilation
  readonly editVersion: number
  readonly graph: PageGraph
  readonly pageId: string
  readonly projectId: string
  readonly repositoryRevision: number
  readonly runtime: VueRuntimeCompileResult
}

export interface PreviewRuntimeMountedEvent {
  readonly hostId: string
  readonly revision: string
}

export interface PreviewSessionValuePorts {
  readonly readValues: () => Record<string, unknown>
  readonly writeValues: (values: Record<string, unknown>) => void
}

export interface CreatePreviewSessionOptions {
  readonly createFlowEngine: (ports: PreviewSessionValuePorts) => PageFlowEngine
}

export type CreateWorkbenchPreviewSessionOptions = Pick<
  WorkbenchPageFlowEngineOptions,
  'onDiagnostic' | 'onNotify' | 'onTrace'
>

export interface PreviewSession {
  readonly flowProjection: ComputedRef<ConfigFormReactionProjection<Record<string, unknown>>>
  readonly projection: ShallowRef<PagePreviewProjection | undefined>
  readonly revisionKey: ComputedRef<string>
  readonly values: Ref<Record<string, unknown>>
  accept: (input: PreviewSessionAcceptInput) => PagePreviewProjection | undefined
  clear: (reason?: unknown) => void
  dispatch: (
    triggerOrKind: ConfigFormFlowTrigger['kind'] | ConfigFormFlowTrigger,
    values?: Record<string, unknown>,
    field?: string,
  ) => ReturnType<PageFlowEngine['dispatch']> | undefined
  dispose: () => void
  getCompilation: () => PageCompilation | undefined
  getRuntimeModel: () => Record<string, unknown>
  handleRuntimeMounted: (
    event: PreviewRuntimeMountedEvent,
  ) => ReturnType<PageFlowEngine['dispatch']> | undefined
  handleRuntimeReady: (revision: string) => void
  updateRuntimeModel: (value: Record<string, unknown>) => void
}

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

export function createPreviewSession(options: CreatePreviewSessionOptions): PreviewSession {
  const projectionCoordinator = createPageProjectionCoordinator()
  const values = ref<Record<string, unknown>>({})
  const projection = shallowRef<PagePreviewProjection>()
  const revisionKey = computed(() => projection.value?.current.revisionKey ?? '')
  let currentCompilation: PageCompilation | undefined
  let currentScopeKey = ''
  let liveFieldContracts: PreviewFieldContracts = Object.create(null)
  let lastReadyPreview: LastReadyPreview | undefined
  let lastMountIdentity = ''
  let disposed = false

  function fallbackForCurrentScope(): LastReadyPreview | undefined {
    return lastReadyPreview?.scopeKey === currentScopeKey ? lastReadyPreview : undefined
  }

  function getCompilation(): PageCompilation | undefined {
    if (projection.value?.compileResult.success)
      return currentCompilation
    return fallbackForCurrentScope()?.compilation
  }

  function getRuntimeModel(): Record<string, unknown> {
    if (projection.value?.compileResult.success)
      return values.value
    return fallbackForCurrentScope()?.modelValue ?? values.value
  }

  function activeFieldContracts(): PreviewFieldContracts {
    if (projection.value?.compileResult.success)
      return liveFieldContracts
    return fallbackForCurrentScope()?.fieldContracts ?? liveFieldContracts
  }

  function updateRuntimeModel(value: Record<string, unknown>): void {
    const next = cloneWorkbenchJson(value)
    if (projection.value?.compileResult.success) {
      values.value = next
      const ready = fallbackForCurrentScope()
      if (ready && ready.compilation === currentCompilation)
        lastReadyPreview = { ...ready, modelValue: cloneWorkbenchJson(next) }
      return
    }
    const fallback = fallbackForCurrentScope()
    if (fallback)
      lastReadyPreview = { ...fallback, modelValue: next }
  }

  const flowEngine = options.createFlowEngine({
    readValues: getRuntimeModel,
    writeValues: updateRuntimeModel,
  })

  function accept(input: PreviewSessionAcceptInput): PagePreviewProjection | undefined {
    if (disposed)
      return undefined
    if (input.runtime.success && !input.compilation)
      throw new TypeError('A successful Preview Runtime requires its PageCompilation.')

    const nextScopeKey = scopeKey(input)
    const scopeChanged = currentScopeKey !== nextScopeKey
    const reconciled = reconcileValues(
      input.graph,
      input.compilation,
      getRuntimeModel(),
      activeFieldContracts(),
      scopeChanged,
    )

    if (scopeChanged) {
      lastReadyPreview = undefined
      lastMountIdentity = ''
    }
    currentScopeKey = nextScopeKey
    currentCompilation = input.compilation
    liveFieldContracts = reconciled.contracts
    values.value = reconciled.values
    projection.value = projectionCoordinator.publish({
      adapter: input.adapter,
      editVersion: input.editVersion,
      pageId: input.pageId,
      projectId: input.projectId,
      repositoryRevision: input.repositoryRevision,
    }, () => input.runtime)

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

  function handleRuntimeReady(revision: string): void {
    const current = projection.value
    if (!current?.compileResult.success
      || !currentCompilation
      || !projectionCoordinator.isCurrent(revision)) {
      return
    }
    lastReadyPreview = {
      compilation: currentCompilation,
      fieldContracts: { ...liveFieldContracts },
      modelValue: cloneWorkbenchJson(values.value),
      scopeKey: currentScopeKey,
    }
  }

  function handleRuntimeMounted(
    event: PreviewRuntimeMountedEvent,
  ): ReturnType<PageFlowEngine['dispatch']> | undefined {
    const current = projection.value
    if (!current || !projectionCoordinator.isCurrent(event.revision))
      return undefined
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
    lastMountIdentity = ''
    lastReadyPreview = undefined
    liveFieldContracts = Object.create(null)
    projection.value = undefined
    values.value = {}
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
    projection,
    revisionKey,
    values,
    accept,
    clear,
    dispatch,
    dispose,
    getCompilation,
    getRuntimeModel,
    handleRuntimeMounted,
    handleRuntimeReady,
    updateRuntimeModel,
  }
}

export function createWorkbenchPreviewSession(
  options: CreateWorkbenchPreviewSessionOptions = {},
): PreviewSession {
  return createPreviewSession({
    createFlowEngine: ports => createWorkbenchPageFlowEngine({
      ...ports,
      ...options,
    }),
  })
}
