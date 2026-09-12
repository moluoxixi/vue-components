import type { ConfigFormReactionProjection } from '../../reaction'
import type { ConfigFormValueContext } from '../../value-reference'
import type {
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowEvent,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowRunResult,
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTransactionFactory,
  ConfigFormFlowTrigger,
  ConfigFormFlowValueContextFactory,
  ConfigFormFlowValuePatch,
} from './contracts'


export interface ConfigFormFlowDispatchResult {
  status: 'committed' | 'noop' | 'ignored' | 'blocked' | 'aborted' | 'failure' | 'timeout' | 'stale'
  results: ConfigFormFlowRunResult[]
  valuePatch: ConfigFormFlowValuePatch
  projectionUpdates: Record<string, ConfigFormReactionProjection<Record<string, unknown>>>
  diagnostics: ConfigFormFlowDiagnostic[]
  error?: ConfigFormFlowDiagnostic
}

export interface ConfigFormFlowDispatchInput {
  trigger: ConfigFormFlowTrigger
  event?: ConfigFormFlowEvent
  revision?: number
  signal?: AbortSignal
  isCurrent?: () => boolean
}

export interface ConfigFormEventRuntimeOptions {
  actions?: ConfigFormFlowActionRegistry
  readValues: () => Record<string, unknown>
  writeValues: (values: Record<string, unknown>) => void
  /** Applies a shallow root patch atomically against the host's latest values. */
  writeValuePatch?: (patch: ConfigFormFlowValuePatch) => void
  /** Static reference context. Prefer readValueContext for fields backed by live values. */
  valueContext?: ConfigFormValueContext
  /** Called from each run with transactional values and the current event/output snapshots. */
  readValueContext?: ConfigFormFlowValueContextFactory
  /** Creates stable field/variable state for one run when it actually starts. */
  createTransaction?: ConfigFormFlowTransactionFactory
  onProjection?: (projection: ConfigFormReactionProjection<Record<string, unknown>>) => void
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
  onDiagnostic?: (diagnostic: ConfigFormFlowDiagnostic) => void
}

export interface ConfigFormEventRuntime {
  readonly projection: ConfigFormReactionProjection<Record<string, unknown>>
  sync: (plans: readonly ConfigFormFlowExecutionPlan[], options?: { reset?: boolean }) => void
  dispatch: (input: ConfigFormFlowDispatchInput) => Promise<ConfigFormFlowDispatchResult>
  clear: () => void
  dispose: () => void
}
