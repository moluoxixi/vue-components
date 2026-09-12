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
  ConfigFormValueContext,
  ConfigFormValueInput,
  ConfigFormValueReferenceScope,
} from '../../value-reference'
import type { ConfigFormScopePath } from '../../value-scope'
import type {
  CONFIG_FORM_FLOW_PLAN_VERSION,
  CONFIG_FORM_FLOW_RUNTIME_VERSION,
  CONFIG_FORM_FLOW_TRIGGER_KINDS,
  CONFIG_FORM_FLOW_VERSION,
} from '../constants'

export type ConfigFormFlowTriggerKind = typeof CONFIG_FORM_FLOW_TRIGGER_KINDS[number]
export type ConfigFormFlowConcurrency = 'latest' | 'queue' | 'ignore'
export type ConfigFormFlowNodeType = 'trigger' | 'condition' | 'reaction' | 'action' | 'success' | 'failure' | 'end' | 'blocked'
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

export interface ConfigFormFlowNodePolicy {
  when?: ConfigFormReactionCondition
  stopWhen?: ConfigFormReactionCondition
  onError?: 'continue' | 'failure'
  /** Overrides the flow timeout. Zero explicitly disables the timeout. */
  timeoutMs?: number
}

export interface ConfigFormFlowNode {
  id: string
  type: ConfigFormFlowNodeType
  /** Registry key for action nodes. */
  ref?: string
  /** JSON-only node configuration. */
  config?: ConfigFormJsonObject
  policy?: ConfigFormFlowNodePolicy
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
  severity?: 'error' | 'warning'
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
  /** Aborted on cancellation, timeout, or runtime-observed rejection/completion of this action. */
  signal: AbortSignal
  values: Readonly<Record<string, unknown>>
  outputs: Readonly<Record<string, unknown>>
  event: ConfigFormFlowEvent
  form: ConfigFormFlowFormApi
}

/** Serializable event snapshot; live component instances never enter a run. */
export interface ConfigFormFlowEvent {
  trigger: Readonly<ConfigFormFlowTrigger>
  args: readonly ConfigFormJsonValue[]
  field?: string
  /** Array row identity chain captured when the event was emitted. */
  scope?: ConfigFormScopePath
}

export type ConfigFormFlowValueContextFactory = (
  values: Readonly<Record<string, unknown>>,
  event: ConfigFormFlowEvent,
  outputs: Readonly<Record<string, unknown>>,
) => ConfigFormValueContext

/** Stable field and variable operations supplied by a mounted form runtime. */
export interface ConfigFormFlowStructuredFormApi {
  getField: (nodeId: string, scope?: ConfigFormValueReferenceScope) => unknown
  setField: (nodeId: string, value: unknown, scope?: ConfigFormValueReferenceScope) => void
  getVariable: (variableId: string) => unknown
  setVariable: (variableId: string, value: unknown) => void
  setFieldState: (
    nodeId: string,
    state: 'visible' | 'disabled' | 'readonly',
    value: boolean,
    scope?: ConfigFormValueReferenceScope,
  ) => void
}

/**
 * Writes stay run-local. Action access expires when the runtime observes settlement or abort;
 * retained methods synchronously throw FLOW_ACTION_INACTIVE before touching state.
 * Read results and write inputs are defensive copies, including structured methods.
 */
export interface ConfigFormFlowFormApi extends Partial<ConfigFormFlowStructuredFormApi> {
  getValue: (field: string) => unknown
  getValues: () => Record<string, unknown>
  setValue: (field: string, value: unknown) => void
  setValues: (values: Record<string, unknown>) => void
}

export interface ConfigFormFlowValuePatch {
  remove: string[]
  set: Record<string, unknown>
}

/**
 * Per-run adapter for non-root form state. It is created when a queued run
 * actually starts and commits only after the complete Flow succeeds.
 * Its form methods are exposed to each action through node-lifetime guards;
 * readValueContext and commit remain interpreter/runtime-owned capabilities.
 */
export interface ConfigFormFlowTransaction {
  form: ConfigFormFlowStructuredFormApi
  readValueContext?: (outputs: Readonly<Record<string, unknown>>) => ConfigFormValueContext
  commit: (valuePatch: ConfigFormFlowValuePatch) => void | Promise<void>
}

export interface ConfigFormFlowTransactionFactoryInput {
  values: Record<string, unknown>
  event: ConfigFormFlowEvent
  signal: AbortSignal
}

export type ConfigFormFlowTransactionFactory = (
  input: ConfigFormFlowTransactionFactoryInput,
) => ConfigFormFlowTransaction

export type ConfigFormFlowActionParameterControl
  = | 'text'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'value'
    | 'field'
    | 'variable'
    | 'dataSource'
    | 'object'
    | 'array'

export interface ConfigFormFlowActionParameterOption {
  title: string
  value: ConfigFormJsonValue
}

/** JSON-only authoring metadata; it never carries an execute function. */
export interface ConfigFormFlowActionParameter {
  name: string
  title: string
  control: ConfigFormFlowActionParameterControl
  required?: boolean
  description?: string
  defaultValue?: ConfigFormJsonValue
  options?: ConfigFormFlowActionParameterOption[]
}

export interface ConfigFormFlowActionOutput {
  name: string
  title: string
  description?: string
}

export interface ConfigFormFlowActionDescriptor {
  ref: string
  title: string
  category: string
  parameters: ConfigFormFlowActionParameter[]
  outputs: ConfigFormFlowActionOutput[]
  capabilities: string[]
}

export interface ConfigFormFlowAction {
  descriptor?: ConfigFormFlowActionDescriptor
  /** Returns cloneable Flow data (including undefined) or a native Promise of it, never a custom thenable. */
  execute: (input: unknown, context: ConfigFormFlowActionContext) => unknown | Promise<unknown>
}

export interface ConfigFormFlowActionRegistry {
  get: (ref: string) => ConfigFormFlowAction | undefined
  /** Optional for trusted execute-only hosts; authoring surfaces diagnose its absence. */
  list?: () => readonly ConfigFormFlowActionDescriptor[]
  describe?: (ref: string) => ConfigFormFlowActionDescriptor | undefined
}

/** Refs of the executable built-in action library shipped with the flow runtime. */
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

export type ConfigFormFlowRunStatus = 'success' | 'failure' | 'end' | 'blocked' | 'aborted' | 'timeout' | 'ignored'

export interface ConfigFormFlowTraceEvent {
  type: 'start' | 'enter' | 'exit' | 'error' | 'abort' | 'finish'
  flowId: string
  runId: string
  revision: number
  nodeId?: string
  status?: ConfigFormFlowRunStatus
  error?: string
  /** Optional in fixtures; every runtime-emitted event includes one. */
  timestamp?: number
  durationMs?: number
  input?: ConfigFormJsonValue
  output?: ConfigFormJsonValue
  valuePatch?: ConfigFormJsonObject
  truncated?: boolean
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
  diagnostics: ConfigFormFlowDiagnostic[]
  error?: ConfigFormFlowDiagnostic
}

export interface ConfigFormFlowRunOptions {
  revision?: number
  runId?: string
  values?: Record<string, unknown>
  signal?: AbortSignal
  onTrace?: (event: ConfigFormFlowTraceEvent) => void
  /** Scheduler identity in addition to Flow ID; mounted renderers derive it from stable row scope. */
  concurrencyKey?: string
  event?: ConfigFormFlowEvent
  /** Static reference context. Use readValueContext for fields backed by transactional values. */
  valueContext?: ConfigFormValueContext
  /** Rebuilt at each resolution with the current run-local values, event, and outputs. */
  readValueContext?: ConfigFormFlowValueContextFactory
  /** Optional mounted-runtime transaction for stable field instances and variables. */
  createTransaction?: ConfigFormFlowTransactionFactory
  /** Read when a queued run actually starts. */
  readValues?: () => Record<string, unknown>
  /** Runs and settles before the next queued item starts. */
  onComplete?: (result: ConfigFormFlowRunResult) => void | Promise<void>
}

export interface ConfigFormFlowReactionNodeConfig {
  reactions: ConfigFormReaction[]
}

export interface ConfigFormFlowConditionNodeConfig {
  condition: ConfigFormReactionCondition
}

export interface ConfigFormFlowActionNodeConfig {
  input?: ConfigFormValueInput
  output?: Record<string, ConfigFormValueInput>
}
