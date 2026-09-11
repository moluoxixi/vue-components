import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
} from '../../json'
import type {
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionProjection,
} from '../../reaction'
import type {
  CONFIG_FORM_FLOW_PLAN_VERSION,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_VERSION,
} from '../constants'

export type ConfigFormFlowTriggerKind = 'page.mount' | 'form.submit' | 'component.event'
export type ConfigFormFlowConcurrency = 'latest' | 'queue' | 'ignore'
export type ConfigFormFlowNodeType = 'trigger' | 'condition' | 'reaction' | 'action' | 'success' | 'failure' | 'end'
export type ConfigFormFlowEdgeCondition = 'next' | 'true' | 'false' | 'error'

export interface ConfigFormFlowTrigger {
  kind: ConfigFormFlowTriggerKind
  /** Stable PageGraph node id for component.event triggers. */
  nodeId?: string
  /** Registry event name for component.event triggers. */
  event?: string
}

export interface ConfigFormFlowErrorPolicy {
  onError: 'failure' | 'end'
  timeoutMs?: number
}

export interface ConfigFormFlowNode {
  id: string
  type: ConfigFormFlowNodeType
  /** Registry key for action nodes. */
  ref?: string
  /** JSON-only node configuration. */
  config?: ConfigFormJsonObject
  /** Presentation-only position; excluded from semantic hashes and execution. */
  position?: { x: number, y: number }
}

export type ConfigFormFlowSemanticNode = Omit<ConfigFormFlowNode, 'position'>

export interface ConfigFormFlowEdge {
  id: string
  source: string
  target: string
  condition?: ConfigFormFlowEdgeCondition
}

export interface ConfigFormFlow {
  version: typeof CONFIG_FORM_FLOW_VERSION
  id: string
  name: string
  trigger: ConfigFormFlowTrigger
  concurrency?: ConfigFormFlowConcurrency
  errorPolicy?: ConfigFormFlowErrorPolicy
  nodes: ConfigFormFlowNode[]
  edges: ConfigFormFlowEdge[]
}

export interface ConfigFormFlowDiagnostic {
  code: string
  message: string
  path?: string
  nodeId?: string
  edgeId?: string
}

export interface ConfigFormFlowPlanNode extends Omit<ConfigFormFlowNode, 'position'> {
  outgoing: ConfigFormFlowEdge[]
  incoming: ConfigFormFlowEdge[]
}

interface ConfigFormFlowExecutionPlanDocument {
  version: typeof CONFIG_FORM_FLOW_PLAN_VERSION
  flowId: string
  name: string
  trigger: ConfigFormFlowTrigger
  concurrency?: ConfigFormFlowConcurrency
  errorPolicy?: ConfigFormFlowErrorPolicy
  triggerNodeId: string
  topologicalOrder: string[]
  nodes: ConfigFormFlowPlanNode[]
}

type FlowDeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly FlowDeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: FlowDeepReadonly<T[Key]> }
      : T

export type ConfigFormFlowExecutionPlan = FlowDeepReadonly<ConfigFormFlowExecutionPlanDocument>

export interface ConfigFormFlowRuntimeDescriptor {
  readonly runtimeVersion: typeof CONFIG_FORM_FLOW_RUNTIME_VERSION
  readonly version: typeof CONFIG_FORM_FLOW_VERSION
  readonly id: string
  readonly name: string
  readonly trigger: Readonly<ConfigFormFlowTrigger>
  readonly concurrency?: ConfigFormFlowConcurrency
  readonly errorPolicy?: Readonly<ConfigFormFlowErrorPolicy>
}

export interface ConfigFormFlowPlanSuccess {
  success: true
  flow: ConfigFormFlow
  plan: ConfigFormFlowExecutionPlan
  diagnostics: ConfigFormFlowDiagnostic[]
}

export interface ConfigFormFlowPlanFailure {
  success: false
  flow: ConfigFormFlow
  diagnostics: ConfigFormFlowDiagnostic[]
}

export type ConfigFormFlowPlanResult = ConfigFormFlowPlanSuccess | ConfigFormFlowPlanFailure

export interface ConfigFormFlowActionContext {
  flow: ConfigFormFlowRuntimeDescriptor
  node: ConfigFormFlowExecutionPlan['nodes'][number]
  revision: number
  runId: string
  signal: AbortSignal
  values: Readonly<Record<string, unknown>>
  outputs: Readonly<Record<string, unknown>>
}

export interface ConfigFormFlowAction {
  execute: (input: unknown, context: ConfigFormFlowActionContext) => unknown | Promise<unknown>
}

export interface ConfigFormFlowActionRegistry {
  get: (ref: string) => ConfigFormFlowAction | undefined
}

/** Refs of the built-in action library shipped with the flow runtime. */
export type ConfigFormFlowBuiltinActionRef
  = | 'builtin.http.request'
    | 'builtin.delay'
    | 'builtin.nav.open'
    | 'builtin.ui.message'
    | 'builtin.ui.confirm'

export interface ConfigFormFlowHttpRequestInput {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  body?: ConfigFormJsonValue
  responseType?: 'json' | 'text'
}

export interface ConfigFormFlowHttpRequestOutput {
  status: number
  ok: boolean
  data: unknown
}

export interface ConfigFormFlowDelayInput {
  ms: number
}

export interface ConfigFormFlowNavOpenInput {
  url: string
  target?: '_blank' | '_self'
}

export interface ConfigFormFlowUiMessageInput {
  message: string
  type?: 'success' | 'warning' | 'error' | 'info'
}

export interface ConfigFormFlowUiConfirmInput {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
}

/**
 * Host capabilities the built-in actions delegate to. Every hook is optional:
 * missing hooks make the corresponding action fail with a diagnostic instead
 * of silently doing nothing.
 */
export interface ConfigFormFlowActionHost {
  fetch?: typeof globalThis.fetch
  openUrl?: (url: string, target: '_blank' | '_self') => void
  message?: (input: ConfigFormFlowUiMessageInput) => void | Promise<void>
  confirm?: (input: ConfigFormFlowUiConfirmInput) => boolean | Promise<boolean>
}

export type ConfigFormFlowRunStatus = 'success' | 'failure' | 'end' | 'aborted' | 'timeout' | 'ignored'

export interface ConfigFormFlowTraceEvent {
  type: 'start' | 'enter' | 'exit' | 'error' | 'abort' | 'finish'
  flowId: string
  runId: string
  revision: number
  nodeId?: string
  status?: ConfigFormFlowRunStatus
  error?: string
}

export interface ConfigFormFlowRunResult {
  status: ConfigFormFlowRunStatus
  flowId: string
  runId: string
  revision: number
  values: Record<string, unknown>
  outputs: Record<string, unknown>
  /** Atomic transient projection produced by reaction nodes in this run. */
  projection: ConfigFormReactionProjection<Record<string, unknown>>
  trace: ConfigFormFlowTraceEvent[]
  error?: ConfigFormFlowDiagnostic
}

export interface ConfigFormFlowRunOptions {
  revision?: number
  runId?: string
  values?: Record<string, unknown>
  signal?: AbortSignal
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
}

export interface ConfigFormFlowReactionNodeConfig {
  reactions: ConfigFormReaction[]
}

export interface ConfigFormFlowConditionNodeConfig {
  condition: ConfigFormReactionCondition
}

export interface ConfigFormFlowActionNodeConfig {
  input?: ConfigFormJsonValue
  output?: ConfigFormJsonObject
}
