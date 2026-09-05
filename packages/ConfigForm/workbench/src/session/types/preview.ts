import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTrigger,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type {
  PageFlowEngine,
  WorkbenchPageFlowEngineOptions,
} from '../../flow'
import type {
  RuntimeHostRuntimeStatePayload,
  RuntimeHostSubmitResultPayload,
} from '../../runtime-host'
import type { PagePreviewProjection } from './projection'

export type PreviewFieldContracts = Record<string, string>
export type PreviewValidationState = Record<string, string[]>

export interface LastReadyPreview {
  readonly compilation: PageCompilation
  readonly fieldContracts: PreviewFieldContracts
  readonly runtimeState: RuntimeHostRuntimeStatePayload
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

export interface PreviewRuntimeIdentity {
  readonly hostId: string
  readonly pageId: string
  readonly projectId: string
  readonly revision: string
}

export interface PreviewRuntimeStateEvent extends PreviewRuntimeIdentity {
  readonly state: RuntimeHostRuntimeStatePayload
}

export interface PreviewRuntimeSubmitResultEvent extends PreviewRuntimeIdentity {
  readonly result: RuntimeHostSubmitResultPayload
}

export interface PreviewSubmission {
  readonly revisionKey: string
  readonly status: 'invalid' | 'success'
  readonly submittedAt: number
  readonly touched: readonly string[]
  readonly validation: Readonly<PreviewValidationState>
  readonly values: Record<string, unknown>
}

export interface PreviewSessionValuePorts {
  readonly readValues: () => Record<string, unknown>
  readonly writeValues: (values: Record<string, unknown>) => void
}

export interface PreviewSessionFlowPorts extends PreviewSessionValuePorts {
  readonly onTrace: (event: ConfigFormFlowTraceEvent) => void
}

export interface CreatePreviewSessionOptions {
  readonly createFlowEngine: (ports: PreviewSessionFlowPorts) => PageFlowEngine
  readonly onTrace?: (event: ConfigFormFlowTraceEvent) => void
}

export type CreateWorkbenchPreviewSessionOptions = Pick<
  WorkbenchPageFlowEngineOptions,
  'onDiagnostic' | 'onNotify' | 'onTrace'
>

export interface PreviewSession {
  readonly flowProjection: ComputedRef<ConfigFormReactionProjection<Record<string, unknown>>>
  readonly lastSubmission: ShallowRef<PreviewSubmission | undefined>
  readonly projection: ShallowRef<PagePreviewProjection | undefined>
  readonly revisionKey: ComputedRef<string>
  readonly runtimeState: ComputedRef<RuntimeHostRuntimeStatePayload>
  readonly touched: ShallowRef<readonly string[]>
  readonly trace: ShallowRef<readonly ConfigFormFlowTraceEvent[]>
  readonly validation: ShallowRef<Readonly<PreviewValidationState>>
  readonly values: Ref<Record<string, unknown>>
  accept: (input: PreviewSessionAcceptInput) => PagePreviewProjection | undefined
  clear: (reason?: unknown) => void
  clearSubmission: () => void
  dispatch: (
    triggerOrKind: ConfigFormFlowTrigger['kind'] | ConfigFormFlowTrigger,
    values?: Record<string, unknown>,
  ) => ReturnType<PageFlowEngine['dispatch']> | undefined
  dispose: () => void
  getCompilation: () => PageCompilation | undefined
  getRuntimeModel: () => Record<string, unknown>
  handleFieldChange: (payload: {
    field: string
    values: Record<string, unknown>
  }) => ReturnType<PageFlowEngine['dispatch']> | undefined
  handleRuntimeEvent: (payload: {
    event: string
    nodeId: string
  }) => ReturnType<PageFlowEngine['dispatch']> | undefined
  handleRuntimeMounted: (
    event: PreviewRuntimeIdentity,
  ) => ReturnType<PageFlowEngine['dispatch']> | undefined
  handleRuntimeReady: (event: PreviewRuntimeIdentity) => void
  handleRuntimeState: (event: PreviewRuntimeStateEvent) => void
  handleSubmit: (
    values: Record<string, unknown>,
  ) => ReturnType<PageFlowEngine['dispatch']> | undefined
  handleSubmitResult: (event: PreviewRuntimeSubmitResultEvent) => void
  updateRuntimeModel: (value: Record<string, unknown>) => void
}
