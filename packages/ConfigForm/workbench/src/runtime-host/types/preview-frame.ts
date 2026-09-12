import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormDataSourceHost,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowDispatchResult,
  ConfigFormFlowTraceEvent,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitEvent,
  PreviewRuntimeSubmitResultEvent,
} from '../../session'
import type { RuntimeHostComponentEventPayload, RuntimeHostFieldChangePayload, RuntimeHostRuntimeStatePayload } from './protocol'

export interface PreviewRuntimeFieldChangeEvent extends PreviewRuntimeIdentity, RuntimeHostFieldChangePayload {}
export interface PreviewRuntimeComponentEvent extends PreviewRuntimeIdentity, RuntimeHostComponentEventPayload {}

export interface PreviewRuntimeFlowTraceEvent extends PreviewRuntimeIdentity {
  readonly trace: ConfigFormFlowTraceEvent
}

export interface PreviewRuntimeFlowDiagnosticEvent extends PreviewRuntimeIdentity {
  readonly diagnostic: ConfigFormFlowDiagnostic
}

export interface PreviewRuntimeFlowProjectionEvent extends PreviewRuntimeIdentity {
  readonly projection: ConfigFormReactionProjection<Record<string, unknown>>
}

export interface PreviewRuntimeFlowResultEvent extends PreviewRuntimeIdentity {
  readonly result: ConfigFormFlowDispatchResult
}

export interface PreviewRuntimeHostFrameProps {
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  dataSourceHost?: ConfigFormDataSourceHost
  flowActions?: ConfigFormFlowActionRegistry
  locale: string
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
  title: string
}

export interface PreviewRuntimeHostFrameEmits {
  error: [error: Error]
  fieldChange: [payload: PreviewRuntimeFieldChangeEvent]
  flowError: [event: PreviewRuntimeFlowDiagnosticEvent]
  flowProjection: [event: PreviewRuntimeFlowProjectionEvent]
  flowResult: [event: PreviewRuntimeFlowResultEvent]
  flowTrace: [event: PreviewRuntimeFlowTraceEvent]
  mounted: [event: PreviewRuntimeIdentity]
  ready: [event: PreviewRuntimeIdentity]
  runtimeEvent: [payload: PreviewRuntimeComponentEvent]
  runtimeState: [event: PreviewRuntimeStateEvent]
  submit: [event: PreviewRuntimeSubmitEvent]
  submitResult: [event: PreviewRuntimeSubmitResultEvent]
}
