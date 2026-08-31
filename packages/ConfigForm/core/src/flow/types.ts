import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReaction,
  ConfigFormReactionCondition,
  ConfigFormReactionProjection,
} from '../types'

export const CONFIG_FORM_FLOW_VERSION = 1 as const
export const CONFIG_FORM_FLOW_PLAN_VERSION = 1 as const
/** Observable scheduler/interpreter contract shared by Preview and generated Source. */
export const CONFIG_FORM_FLOW_RUNTIME_VERSION = 1 as const

export type ConfigFormFlowTriggerKind = 'page.mount' | 'form.submit' | 'field.change' | 'component.event'
export type ConfigFormFlowConcurrency = 'latest' | 'queue' | 'ignore'
export type ConfigFormFlowNodeType = 'trigger' | 'condition' | 'reaction' | 'action' | 'success' | 'failure' | 'end'
export type ConfigFormFlowEdgeCondition = 'next' | 'true' | 'false' | 'error'

export interface ConfigFormFlowTrigger {
  kind: ConfigFormFlowTriggerKind
  field?: string
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
