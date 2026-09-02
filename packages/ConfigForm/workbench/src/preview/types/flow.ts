import type {
  ConfigFormFlowDiagnostic,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTrigger,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'

export interface PreviewFlowValuePatch {
  remove: string[]
  set: Record<string, unknown>
}

export type PreviewFlowDispatchStatus
  = | 'aborted'
    | 'committed'
    | 'failure'
    | 'ignored'
    | 'noop'
    | 'stale'
    | 'timeout'

export interface PreviewFlowDispatchInput {
  isCurrent?: () => boolean
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
  plans: readonly ConfigFormFlowExecutionPlan[]
  revision: number
  signal?: AbortSignal
  trigger: ConfigFormFlowTrigger
  values: Record<string, unknown>
}

export interface PreviewFlowDispatchResult {
  error?: ConfigFormFlowDiagnostic
  projectionUpdates: Record<string, ConfigFormReactionProjection<Record<string, unknown>>>
  status: PreviewFlowDispatchStatus
  valuePatch: PreviewFlowValuePatch
}
