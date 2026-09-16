import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowTraceEvent,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchFlowActionHooks } from '../../flow'
import type {
  PreviewRuntimeFlowDiagnosticEvent,
  PreviewRuntimeFlowProjectionEvent,
  PreviewRuntimeFlowResultEvent,
  PreviewRuntimeFlowTraceEvent,
  RuntimeHostFieldInstance,
  RuntimeHostRuntimeStatePayload,
  RuntimeHostSubmitResultPayload,
} from '../../runtime-host'
import type { PreviewFieldContracts } from '../../types'
import type { PagePreviewProjection } from './projection'

export type { PreviewFieldContract, PreviewFieldContracts, PreviewScopeContract } from '../../types'
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

export type PreviewRuntimeSubmitEvent = PreviewRuntimeIdentity & { requestId: string } & (
  | { phase: 'request' }
  | { phase: 'success', values: Record<string, unknown> }
)

export interface PreviewRuntimeStateEvent extends PreviewRuntimeIdentity {
  readonly state: RuntimeHostRuntimeStatePayload
}

export interface PreviewRuntimeSubmitResultEvent extends PreviewRuntimeIdentity {
  readonly result: RuntimeHostSubmitResultPayload
}

export interface PreviewSubmission {
  readonly requestId: string
  readonly fields: readonly RuntimeHostFieldInstance[]
  readonly revisionKey: string
  readonly status: 'blocked' | 'failure' | 'invalid' | 'success'
  readonly submittedAt: number
  readonly touched: readonly string[]
  readonly validation: Readonly<PreviewValidationState>
  readonly values: Record<string, unknown>
}

export interface CreatePreviewSessionOptions {
  readonly actions?: ConfigFormFlowActionRegistry
  readonly onDiagnostic?: (diagnostic: ConfigFormFlowDiagnostic) => void
  readonly onTrace?: (event: ConfigFormFlowTraceEvent) => void
}

export type CreateWorkbenchPreviewSessionOptions = WorkbenchFlowActionHooks & {
  readonly actions?: ConfigFormFlowActionRegistry
  readonly onDiagnostic?: (diagnostic: ConfigFormFlowDiagnostic) => void
  readonly onTrace?: (event: ConfigFormFlowTraceEvent) => void
}

export interface PreviewSession {
  /** Trusted action registry supplied to the parent RuntimeHost capability port. */
  readonly actions: ConfigFormFlowActionRegistry
  readonly flowDiagnostics: ShallowRef<readonly ConfigFormFlowDiagnostic[]>
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
  dispose: () => void
  getCompilation: () => PageCompilation | undefined
  getRuntimeModel: () => Record<string, unknown>
  handleFieldChange: (payload: import('../../runtime-host').PreviewRuntimeFieldChangeEvent) => void
  handleFlowError: (event: PreviewRuntimeFlowDiagnosticEvent) => void
  handleFlowProjection: (event: PreviewRuntimeFlowProjectionEvent) => void
  handleFlowResult: (event: PreviewRuntimeFlowResultEvent) => void
  handleFlowTrace: (event: PreviewRuntimeFlowTraceEvent) => void
  handleRuntimeEvent: (payload: import('../../runtime-host').PreviewRuntimeComponentEvent) => void
  handleRuntimeMounted: (event: PreviewRuntimeIdentity) => void
  handleRuntimeReady: (event: PreviewRuntimeIdentity) => void
  handleRuntimeState: (event: PreviewRuntimeStateEvent) => void
  handleSubmit: (event: PreviewRuntimeSubmitEvent) => void
  handleSubmitResult: (event: PreviewRuntimeSubmitResultEvent) => void
  updateRuntimeModel: (value: Record<string, unknown>) => void
}
