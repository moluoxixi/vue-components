import type {
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowEvent,
  ConfigFormFlowExecutionPlan,
  ConfigFormFlowTraceEvent,
  ConfigFormFlowTrigger,
  ConfigFormFlowUiConfirmInput,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { ComputedRef } from 'vue'
import type { PreviewFlowDispatchResult } from './flow'

export interface PageFlowEngineSyncInput {
  pageKey: string
  plans: readonly ConfigFormFlowExecutionPlan[]
}

export interface PageFlowEngineDispatchInput {
  event?: ConfigFormFlowEvent
  isCurrent?: () => boolean
  revision: number
  signal?: AbortSignal
  trigger: ConfigFormFlowTrigger
}

export interface PageFlowEngineOptions {
  actions: ConfigFormFlowActionRegistry
  onDiagnostic?: (diagnostic: ConfigFormFlowDiagnostic) => void
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
  readValues: () => Record<string, unknown>
  writeValues: (values: Record<string, unknown>) => void
}

export interface WorkbenchFlowActionHooks {
  onConfirm?: (input: ConfigFormFlowUiConfirmInput) => boolean | Promise<boolean>
  onNotify?: (message: string) => void
  onRequest?: typeof globalThis.fetch
  onOpenUrl?: (url: string, target: '_blank' | '_self') => void
}

export interface WorkbenchPageFlowEngineOptions extends Omit<PageFlowEngineOptions, 'actions'>, WorkbenchFlowActionHooks {}

export interface PageFlowEngine {
  readonly projection: ComputedRef<ConfigFormReactionProjection<Record<string, unknown>>>
  clear: () => void
  dispatch: (input: PageFlowEngineDispatchInput) => Promise<PreviewFlowDispatchResult>
  dispose: () => void
  sync: (input: PageFlowEngineSyncInput) => void
}
