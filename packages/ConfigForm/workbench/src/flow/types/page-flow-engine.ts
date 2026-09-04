import type {
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTrigger,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { ComputedRef } from 'vue'
import type { PreviewFlowDispatchResult } from './flow'

export interface PageFlowEngineSyncInput {
  pageKey: string
  plans: readonly ConfigFormFlowExecutionPlan[]
}

export interface PageFlowEngineDispatchInput {
  isCurrent?: () => boolean
  revision: number
  signal?: AbortSignal
  trigger: ConfigFormFlowTrigger
  values: Record<string, unknown>
}

export interface PageFlowEngineOptions {
  actions: ConfigFormFlowActionRegistry
  onDiagnostic?: (diagnostic: ConfigFormFlowDiagnostic) => void
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
  readValues: () => Record<string, unknown>
  writeValues: (values: Record<string, unknown>) => void
}

export interface WorkbenchPageFlowEngineOptions extends Omit<PageFlowEngineOptions, 'actions'> {
  onNotify?: (message: string) => void
}

export interface PageFlowEngine {
  readonly projection: ComputedRef<ConfigFormReactionProjection<Record<string, unknown>>>
  clear: () => void
  dispatch: (input: PageFlowEngineDispatchInput) => Promise<PreviewFlowDispatchResult>
  dispose: () => void
  sync: (input: PageFlowEngineSyncInput) => void
}
