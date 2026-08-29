import type {
  DesignerSourceLibraryBinding,
  LowCodeComponentRegistry,
  LowCodeNode,
  LowCodePageModel,
} from '@moluoxixi/config-form-designer'
import type { WorkspaceApplication } from '../application'
import type { ProjectPath, WorkspaceFile, WorkspaceProject } from '../types'
import { analyzeConfigFormFlow } from '@moluoxixi/config-form-core'
import { cloneWorkspaceApplication, parseWorkspaceApplication } from '../application'
import { normalizeProjectPath, safeProjectSlug } from '../path'
import { cloneWorkspaceProject } from '../revision'

/**
 * Files generated for the downloadable Source artifact.  The workbench
 * itself still uses ConfigForm for its runtime preview; this projection is a
 * deliberately standalone Vue project that can be installed outside the
 * monorepo without the ConfigForm packages.
 */
export interface PureSourceExport {
  project: WorkspaceProject
  files: Record<ProjectPath, WorkspaceFile>
}

export interface WorkspaceApplicationSourceExport {
  application: WorkspaceApplication
  files: Record<ProjectPath, WorkspaceFile>
}

interface PackageJson {
  [key: string]: unknown
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function textFile(content: string, language: string): WorkspaceFile {
  return { content, kind: 'text', language }
}

function quote(value: string): string {
  return scriptJson(value)
}

/**
 * JSON embedded in a Vue SFC's script block must not contain a literal closing
 * tag. The SFC parser terminates the block before JavaScript parses string
 * literals, so escaping HTML-sensitive characters keeps arbitrary JSON-safe
 * user values (for example `</script>`) buildable in the generated project.
 */
function scriptJson(value: unknown, space?: number): string {
  return (JSON.stringify(value, null, space) ?? 'undefined')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function escapeHtml(value: string): string {
  const entities = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    [String.fromCharCode(34), '&quot;'],
    [String.fromCharCode(39), '&#39;'],
  ])
  return value.replace(/[&<>'"]/g, character => entities.get(character)!)
}

function styleForNode(node: LowCodeNode, columns: number): string | undefined {
  if (node.kind !== 'field' || node.span === undefined)
    return undefined
  const span = Math.min(columns, Math.max(1, node.span))
  return `grid-column: span ${span} / span ${span}`
}

function fieldOptions(node: LowCodeNode): Array<{ label: string, value: unknown }> {
  const options = node.props.options
  if (!Array.isArray(options))
    return []
  return options.flatMap((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option))
      return []
    const record = option as Record<string, unknown>
    return typeof record.label === 'string' && Object.hasOwn(record, 'value')
      ? [{ label: record.label, value: record.value }]
      : []
  })
}

function componentDefinition(node: LowCodeNode, registry: LowCodeComponentRegistry) {
  const definition = registry.get(node.component)
  if (!definition)
    throw new Error(`Component "${node.component}" is not registered and cannot be exported.`)
  return definition
}

function sourceProps(node: LowCodeNode, registry: LowCodeComponentRegistry): Record<string, unknown> {
  const definition = componentDefinition(node, registry)
  const props = {
    ...(definition.source.staticProps ?? {}),
    ...node.props,
  }
  delete props.options
  delete props.optionSource
  return props
}

function collectInitialValues(
  nodes: LowCodeNode[],
  values: Record<string, unknown>,
  registry: LowCodeComponentRegistry,
): void {
  for (const node of nodes) {
    if (node.kind === 'field' && node.field) {
      const definition = componentDefinition(node, registry)
      const defaultValue = node.defaultValue !== undefined
        ? node.defaultValue
        : definition.defaults.defaultValue
      values[node.field] = defaultValue !== undefined
        ? structuredClone(defaultValue)
        : definition.source.configComponent === 'boolean'
          ? false
          : definition.source.configComponent === 'number' ? 0 : ''
    }
    collectInitialValues(node.children, values, registry)
    Object.values(node.slots).forEach(children => collectInitialValues(children, values, registry))
  }
}

function flowSource(model: LowCodePageModel): string {
  const serialized = scriptJson(model.flows ?? [], 2)
  return `export type FlowTrigger = { kind: 'page.mount' | 'form.submit' | 'field.change', field?: string }
export type FlowValues = Record<string, unknown>
export type FlowAction = (input: unknown, context: { flowId: string, nodeId: string, values: FlowValues, outputs: Readonly<Record<string, unknown>>, signal: AbortSignal }) => unknown | Promise<unknown>
export type GeneratedFlowNode = { id: string, type: string, ref?: string, config?: Record<string, unknown> }
export type GeneratedFlowEdge = { id: string, source: string, target: string, condition?: string }
export type GeneratedFlow = { id: string, trigger: FlowTrigger, concurrency?: 'latest' | 'queue' | 'ignore', nodes: GeneratedFlowNode[], edges: GeneratedFlowEdge[], errorPolicy?: { onError: 'failure' | 'end', timeoutMs?: number } }
export type FlowProjection = { props: Record<string, Record<string, unknown>>, states: Record<string, Record<string, boolean>>, validate: string[] }
export type FlowExecutionStatus = 'success' | 'failure' | 'end' | 'aborted' | 'timeout' | 'ignored'
export type FlowDispatchStatus = 'committed' | 'noop' | 'ignored' | 'aborted' | 'failure' | 'timeout'
export type FlowDispatchResult = { status: FlowDispatchStatus, values: FlowValues, error?: string }

export const flows = ${serialized} as readonly GeneratedFlow[]
const actions: Record<string, FlowAction> = Object.create(null)
const activeRuns = new Map<string, { controller: AbortController, promise: Promise<FlowExecutionResult> }>()
const queuedRuns = new Map<string, QueuedFlowRun[]>()
const flowProjections = new Map<string, FlowProjection>()

export function registerFlowAction(ref: string, action: FlowAction): void {
  if (!ref || typeof action !== 'function')
    throw new Error('Flow action refs must be non-empty and executable.')
  actions[ref] = action
}

export function getFlowProjection(): FlowProjection {
  const projection = emptyProjection()
  for (const flow of flows) {
    const current = flowProjections.get(flow.id)
    if (current)
      mergeProjection(projection, current)
  }
  return projection
}

class FlowTimeoutError extends Error {
  constructor() {
    super('Flow action timed out.')
    this.name = 'FlowTimeoutError'
  }
}

interface FlowExecutionResult {
  status: FlowExecutionStatus
  values: FlowValues
  projection: FlowProjection
  error?: string
}

interface QueuedFlowRun {
  flow: GeneratedFlow
  input: FlowValues
  signal?: AbortSignal
  resolve: (result: FlowExecutionResult) => void
  reject: (error: unknown) => void
  cleanup: () => void
  settled: boolean
}

function emptyProjection(): FlowProjection {
  return { props: Object.create(null), states: Object.create(null), validate: [] }
}

function cloneProjection(projection: FlowProjection): FlowProjection {
  return {
    props: Object.fromEntries(Object.entries(projection.props).map(([key, value]) => [key, { ...value }])),
    states: Object.fromEntries(Object.entries(projection.states).map(([key, value]) => [key, { ...value }])),
    validate: [...projection.validate],
  }
}

function mergeProjection(target: FlowProjection, next: FlowProjection): void {
  for (const [key, value] of Object.entries(next.props))
    target.props[key] = { ...(target.props[key] ?? {}), ...value }
  for (const [key, value] of Object.entries(next.states))
    target.states[key] = { ...(target.states[key] ?? {}), ...value }
  target.validate = [...new Set([...target.validate, ...next.validate])]
}

async function withTimeout<T>(value: T | Promise<T>, timeoutMs: number | undefined, controller: AbortController): Promise<T> {
  const signal = controller.signal
  if (signal.aborted)
    throw abortReason(signal.reason)
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const cleanup = (): void => {
      if (timer !== undefined)
        clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
    const finish = (callback: () => void): void => {
      if (settled)
        return
      settled = true
      cleanup()
      callback()
    }
    const abort = (): void => finish(() => reject(abortReason(signal.reason)))
    signal.addEventListener('abort', abort, { once: true })
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        const error = new FlowTimeoutError()
        controller.abort(error)
        finish(() => reject(error))
      }, timeoutMs)
    }
    Promise.resolve(value).then(result => finish(() => resolve(result)), error => finish(() => reject(error)))
  })
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source)
    return () => {}
  const abort = (): void => target.abort(source.reason)
  if (source.aborted) {
    abort()
    return () => {}
  }
  source.addEventListener('abort', abort, { once: true })
  return () => source.removeEventListener('abort', abort)
}

function abortReason(reason: unknown): Error {
  return reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError')
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) || Array.isArray(right))
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index]))
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  return keys.length === Object.keys(rightRecord).length && keys.every(key => Object.hasOwn(rightRecord, key) && equal(leftRecord[key], rightRecord[key]))
}

function operand(value: unknown, values: FlowValues, outputs: Record<string, unknown>): unknown {
  if (Array.isArray(value))
    return value.map(item => operand(item, values, outputs))
  if (!value || typeof value !== 'object')
    return value
  const record = value as Record<string, unknown>
  // Keep the standalone projection compatible with the Core reaction AST,
  // which uses { kind: 'field' | 'literal' } operands rather than the
  // generator's internal $field/$output shorthand.
  if (record.kind === 'field' && typeof record.field === 'string')
    return values[record.field]
  if (record.kind === 'literal' && Object.hasOwn(record, 'value'))
    return operand(record.value, values, outputs)
  if (Object.keys(record).length === 1 && typeof record.$field === 'string')
    return values[record.$field]
  if (Object.keys(record).length === 1 && typeof record.$output === 'string')
    return outputs[record.$output]
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, operand(child, values, outputs)]))
}

function condition(value: unknown, values: FlowValues): boolean {
  if (!value || typeof value !== 'object')
    return Boolean(value)
  const item = value as Record<string, unknown>
  if (item.kind === 'literal') return Boolean(item.value)
  if (item.kind === 'not') return !condition(item.expression, values)
  if (item.kind === 'and') return Array.isArray(item.expressions) && item.expressions.every(expression => condition(expression, values))
  if (item.kind === 'or') return Array.isArray(item.expressions) && item.expressions.some(expression => condition(expression, values))
  if (item.kind === 'compare') {
    const left = operand(item.left, values, {})
    const right = operand(item.right, values, {})
    switch (item.operator) {
      case 'eq': return equal(left, right)
      case 'neq': return !equal(left, right)
      case 'gt': return typeof left === typeof right && (left as any) > (right as any)
      case 'gte': return typeof left === typeof right && (left as any) >= (right as any)
      case 'lt': return typeof left === typeof right && (left as any) < (right as any)
      case 'lte': return typeof left === typeof right && (left as any) <= (right as any)
      case 'in': return Array.isArray(right) && right.some(value => equal(left, value))
      case 'contains': return typeof left === 'string' && typeof right === 'string' ? left.includes(right) : Array.isArray(left) && left.some(value => equal(value, right))
      default: return false
    }
  }
  return false
}

function reactionProjection(reactions: Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>, values: FlowValues, outputs: Record<string, unknown>): FlowProjection {
  const maxPasses = Math.max(16, reactions.length * 4)
  const seen = new Set<string>()
  let converged = false
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const before = JSON.stringify(values)
    if (before !== undefined)
      seen.add(before)
    for (const reaction of reactions) {
      if (reaction.enabled === false)
        continue
      const effects = condition(reaction.when, values) ? reaction.then : (reaction.else ?? [])
      for (const effect of effects) {
        if (effect.kind === 'setValue' && typeof effect.target === 'string')
          values[effect.target] = operand(effect.value, values, outputs)
        else if (effect.kind === 'clearValue' && typeof effect.target === 'string')
          delete values[effect.target]
      }
    }
    const after = JSON.stringify(values)
    if (before === after) {
      converged = true
      break
    }
    if (after !== undefined && seen.has(after))
      throw new Error('ConfigForm reactions did not converge because their value effects form a cycle.')
  }
  if (!converged)
    throw new Error('ConfigForm reactions exceeded the convergence limit.')

  const projection = emptyProjection()
  for (const reaction of reactions) {
    if (reaction.enabled === false)
      continue
    const effects = condition(reaction.when, values) ? reaction.then : (reaction.else ?? [])
    for (const effect of effects) {
      if (typeof effect.target !== 'string')
        continue
      if (effect.kind === 'setProps' && effect.props && typeof effect.props === 'object')
        projection.props[effect.target] = Object.fromEntries(Object.entries(effect.props).map(([key, value]) => [key, operand(value, values, outputs)]))
      else if (effect.kind === 'setState' && effect.state && typeof effect.state === 'object')
        projection.states[effect.target] = Object.fromEntries(Object.entries(effect.state).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>
      else if (effect.kind === 'validate')
        projection.validate.push(effect.target)
    }
  }
  return projection
}

export function evaluateRuntimeCondition(value: unknown, values: FlowValues): boolean {
  return condition(value, values)
}

export function projectRuntimeReactions(
  reactions: Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>,
  values: FlowValues,
): FlowProjection {
  return reactionProjection(reactions, values, {})
}

export async function invokeRegisteredAction(
  ref: string,
  input: unknown,
  context: { eventName?: string, nodeId: string, values: FlowValues, signal: AbortSignal },
): Promise<unknown> {
  const action = actions[ref]
  if (!action)
    throw new Error('Missing generated action: ' + ref)
  return action(input, {
    flowId: context.eventName ? 'event:' + context.eventName : 'manual',
    nodeId: context.nodeId,
    values: context.values,
    outputs: {},
    signal: context.signal,
  })
}

async function executeFlow(flow: GeneratedFlow, input: FlowValues, controller: AbortController): Promise<FlowExecutionResult> {
  const signal = controller.signal
  const values = { ...input }
  const outputs: Record<string, unknown> = {}
  const projection = emptyProjection()
  const byId = new Map(flow.nodes.map(node => [node.id, node]))
  const outgoing = (id: string) => flow.edges.filter(edge => edge.source === id)
  let current = flow.nodes.find(node => node.type === 'trigger')?.id
  let guard = 0
  let status: FlowExecutionStatus = 'end'
  let flowError: string | undefined
  while (current && guard++ < flow.nodes.length * 2) {
    if (signal.aborted) {
      status = 'aborted'
      break
    }
    const node = byId.get(current)
    if (!node)
      break
    if (node.type === 'condition') {
      const matches = condition(node.config?.condition, values)
      current = outgoing(current).find(edge => edge.condition === (matches ? 'true' : 'false'))?.target
    }
    else if (node.type === 'reaction') {
      const reactions = (Array.isArray(node.config?.reactions) ? node.config.reactions : []) as Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>
      mergeProjection(projection, reactionProjection(reactions, values, outputs))
      current = outgoing(current).find(edge => edge.condition === 'next')?.target ?? outgoing(current).find(edge => edge.condition === undefined)?.target
    }
    else if (node.type === 'action') {
      try {
        const action = node.ref ? actions[node.ref] : undefined
        if (!action)
          throw new Error('Missing generated flow action: ' + (node.ref ?? node.id))
        const actionController = new AbortController()
        const unlink = linkAbortSignal(signal, actionController)
        let result: unknown
        try {
          result = await withTimeout(action(operand(node.config?.input, values, outputs), { flowId: flow.id, nodeId: node.id, values, outputs, signal: actionController.signal }), flow.errorPolicy?.timeoutMs, actionController)
        }
        finally {
          unlink()
        }
        outputs[node.id] = result
        if (node.config?.output && typeof node.config.output === 'object') {
          for (const [field, mapping] of Object.entries(node.config.output))
            values[field] = operand(mapping, values, outputs)
        }
        current = outgoing(node.id).find(edge => edge.condition === 'next')?.target ?? outgoing(node.id).find(edge => edge.condition === undefined)?.target
      }
      catch (error) {
        const timeout = error instanceof FlowTimeoutError
        const aborted = signal.aborted || (error instanceof DOMException && error.name === 'AbortError')
        // Superseded/externally aborted runs must never enter a configured
        // failure branch. Timeout aborts are handled as failures below so the
        // explicit timeout policy remains observable.
        if (aborted && !timeout) {
          status = 'aborted'
          break
        }
        const failure = outgoing(node.id).find(edge => edge.condition === 'error')
        flowError = error instanceof Error ? error.message : String(error)
        if (failure && flow.errorPolicy?.onError === 'failure') {
          current = failure.target
          continue
        }
        if (flow.errorPolicy?.onError === 'end' && !timeout) {
          status = 'end'
          break
        }
        status = timeout ? 'timeout' : 'failure'
        break
      }
    }
    else if (node.type === 'success') {
      status = 'success'
      break
    }
    else if (node.type === 'failure') {
      status = 'failure'
      break
    }
    else if (node.type === 'end') {
      status = 'end'
      break
    }
    else current = outgoing(current).find(edge => edge.condition === 'next')?.target ?? outgoing(current).find(edge => edge.condition === undefined)?.target
  }
  return { status, values, projection, ...(flowError ? { error: flowError } : {}) }
}

function abortedExecution(input: FlowValues): FlowExecutionResult {
  return { status: 'aborted', values: { ...input }, projection: emptyProjection() }
}

function startFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  if (signal?.aborted)
    return Promise.resolve(abortedExecution(input))
  const controller = new AbortController()
  const unlink = linkAbortSignal(signal, controller)
  const promise = executeFlow(flow, input, controller).finally(() => {
    unlink()
    if (activeRuns.get(flow.id)?.promise !== promise)
      return
    activeRuns.delete(flow.id)
    startNextQueuedRun(flow.id)
  })
  activeRuns.set(flow.id, { controller, promise })
  return promise
}

function startNextQueuedRun(flowId: string): void {
  const queue = queuedRuns.get(flowId)
  let next = queue?.shift()
  while (next?.settled)
    next = queue?.shift()
  if (!next) {
    queuedRuns.delete(flowId)
    return
  }
  if (queue?.length === 0)
    queuedRuns.delete(flowId)
  next.settled = true
  next.cleanup()
  startFlow(next.flow, next.input, next.signal).then(next.resolve, next.reject)
}

function enqueueFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  return new Promise((resolve, reject) => {
    const queue = queuedRuns.get(flow.id) ?? []
    const entry: QueuedFlowRun = {
      cleanup: () => {},
      flow,
      input: { ...input },
      signal,
      resolve,
      reject,
      settled: false,
    }
    const abort = (): void => {
      if (entry.settled)
        return
      entry.settled = true
      entry.cleanup()
      const index = queue.indexOf(entry)
      if (index >= 0)
        queue.splice(index, 1)
      if (queue.length === 0)
        queuedRuns.delete(flow.id)
      resolve(abortedExecution(input))
    }
    if (signal) {
      signal.addEventListener('abort', abort, { once: true })
      entry.cleanup = () => signal.removeEventListener('abort', abort)
    }
    queue.push(entry)
    queuedRuns.set(flow.id, queue)
  })
}

function scheduleFlow(flow: GeneratedFlow, input: FlowValues, signal?: AbortSignal): Promise<FlowExecutionResult> {
  if (signal?.aborted)
    return Promise.resolve(abortedExecution(input))
  const active = activeRuns.get(flow.id)
  if (!active)
    return startFlow(flow, input, signal)
  const concurrency = flow.concurrency ?? 'latest'
  if (concurrency === 'ignore')
    return Promise.resolve({ status: 'ignored', values: { ...input }, projection: emptyProjection() })
  if (concurrency === 'latest') {
    active.controller.abort('superseded')
    return startFlow(flow, input, signal)
  }
  return enqueueFlow(flow, input, signal)
}

function replaceValues(target: FlowValues, source: FlowValues): void {
  for (const key of Object.keys(target)) {
    if (!Object.hasOwn(source, key))
      delete target[key]
  }
  Object.assign(target, source)
}

export function applyFlowValuePatch(target: FlowValues, before: FlowValues, after: FlowValues): void {
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key))
      delete target[key]
  }
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key) || !Object.is(before[key], value))
      target[key] = value
  }
}

export async function runFlows(trigger: FlowTrigger, input: FlowValues = {}, signal?: AbortSignal): Promise<FlowDispatchResult> {
  const values = { ...input }
  const projectionUpdates = new Map<string, FlowProjection>()
  let matched = false
  let committed = false
  let flowError: string | undefined
  for (const flow of flows) {
    if (flow.trigger.kind !== trigger.kind || (flow.trigger.field && flow.trigger.field !== trigger.field))
      continue
    matched = true
    const result = await scheduleFlow(flow, values, signal)
    if (result.status === 'success' || result.status === 'end') {
      committed = true
      replaceValues(values, result.values)
      projectionUpdates.set(flow.id, result.projection)
      flowError = result.error ?? flowError
      continue
    }
    if (result.status === 'ignored')
      continue
    return { status: result.status, values: { ...input }, ...(result.error ? { error: result.error } : {}) }
  }
  if (!matched)
    return { status: 'noop', values: { ...input } }
  if (!committed)
    return { status: 'ignored', values: { ...input } }
  for (const [flowId, projection] of projectionUpdates)
    flowProjections.set(flowId, cloneProjection(projection))
  return { status: 'committed', values, ...(flowError ? { error: flowError } : {}) }
}
`
}

function assertPortableNode(node: LowCodeNode, registry: LowCodeComponentRegistry): void {
  const definition = registry.get(node.component)
  if (!definition)
    throw new Error(`Component "${node.component}" is not registered and cannot be exported.`)

  const eventNames = new Set(definition.events.map(event => event.name))
  for (const [eventName, actions] of Object.entries(node.events)) {
    if (!eventNames.has(eventName))
      throw new Error(`Node "${node.id}" uses unregistered event "${eventName}".`)
    if (actions.some(action => typeof action.action !== 'string' || !action.action.trim()))
      throw new Error(`Node "${node.id}" event "${eventName}" contains an invalid action ref.`)
  }

  const bindingNames = new Set(definition.bindings.map(binding => binding.name))
  for (const [bindingName, binding] of Object.entries(node.bindings)) {
    if (!bindingNames.has(bindingName))
      throw new Error(`Node "${node.id}" uses unregistered binding "${bindingName}".`)
    if (typeof binding.source !== 'string' || !binding.source.trim())
      throw new Error(`Node "${node.id}" binding "${bindingName}" contains an invalid source ref.`)
  }
  node.children.forEach(child => assertPortableNode(child, registry))
  Object.values(node.slots).forEach(children => children.forEach(child => assertPortableNode(child, registry)))
}

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function sourceEventBindings(node: LowCodeNode, updateEvent?: string): string {
  const nodeId = quote(node.id)
  return Object.keys(node.events)
    .filter(eventName => kebabCase(eventName) !== updateEvent)
    .map(eventName => ` @${escapeHtml(kebabCase(eventName))}='runNodeEvent(${nodeId}, ${quote(eventName)}, $event)'`)
    .join('')
}

function renderField(
  node: LowCodeNode,
  columns: number,
  registry: LowCodeComponentRegistry,
): string {
  const definition = componentDefinition(node, registry)
  const source = definition.source
  const field = quote(node.field ?? node.id)
  const style = styleForNode(node, columns)
  const styleAttr = style ? ` style="${style}"` : ''
  const hiddenAttr = ` :hidden='fieldStates[${field}]?.visible === false'`
  const safeId = escapeHtml(node.id)
  const safeTag = escapeHtml(source.tag)
  const nodeId = quote(node.id)
  const valueProp = definition.runtime.valueProp ?? 'modelValue'
  const modelDirective = valueProp === 'modelValue'
    ? 'v-model'
    : `v-model:${kebabCase(valueProp)}`
  const updateEvent = `update:${kebabCase(valueProp)}`
  const label = node.label
    ? `\n      <label class="source-field-label">${escapeHtml(node.label)}</label>`
    : ''
  const optionBinding = source.options?.mode === 'prop'
    ? ` :options='fieldOptions[${field}]'`
    : ''
  const optionChildren = source.options?.mode === 'children' && source.options.optionTag
    ? `\n        <${escapeHtml(source.options.optionTag)} v-for='option in fieldOptions[${field}]' :key="String(option.value)" :${escapeHtml(source.options.labelProp ?? 'label')}="option.label" :${escapeHtml(source.options.valueProp ?? 'value')}="option.value" />\n      `
    : ''
  const eventBindings = sourceEventBindings(node, updateEvent)
  const updateBinding = `@${updateEvent}='handleFieldUpdate(${nodeId}, ${field}, ${quote(definition.runtime.trigger ?? `update:${valueProp}`)}, $event)'`
  const modelBinding = `${modelDirective}='model[fieldModelKeys[${field}]]'`
  const control = optionChildren
    ? `<${safeTag} class="source-control" v-bind='fieldProps[${field}]' ${modelBinding} ${updateBinding}${eventBindings}${optionBinding}>${optionChildren}</${safeTag}>`
    : `<${safeTag} class="source-control" v-bind='fieldProps[${field}]' ${modelBinding} ${updateBinding}${eventBindings}${optionBinding} />`
  return `    <div class="source-field" data-node-id="${safeId}" data-component="${escapeHtml(node.component)}" data-source-tag="${safeTag}"${hiddenAttr}${styleAttr}>${label}\n      ${control}\n    </div>`
}

function defaultChildren(node: LowCodeNode): LowCodeNode[] {
  return node.children.length > 0 ? node.children : (node.slots.default ?? [])
}

function renderContainer(
  node: LowCodeNode,
  columns: number,
  registry: LowCodeComponentRegistry,
): string {
  const definition = componentDefinition(node, registry)
  const source = definition.source
  const safeId = escapeHtml(node.id)
  const safeTag = escapeHtml(source.tag)
  const nodeKey = quote(node.id)
  const children = defaultChildren(node)
  const defaultMarkup = renderNodes(children, columns, registry)
  const namedSlots = Object.entries(node.slots)
    .filter(([name]) => name !== 'default')
    .map(([name, slotChildren]) => `      <template #${escapeHtml(name)}>\n${renderNodes(slotChildren, columns, registry)}\n      </template>`)
    .join('\n')
  const content = [defaultMarkup, namedSlots].filter(Boolean).join('\n')
  const common = `class="source-layout source-layout-${source.render}" data-node-id="${safeId}" data-component="${escapeHtml(node.component)}" data-source-tag="${safeTag}" v-bind='nodeProps[${nodeKey}]' :style='nodeStyles[${nodeKey}]' :hidden='nodeHidden[${nodeKey}]'${sourceEventBindings(node)}`
  if (source.render === 'section') {
    const title = typeof node.props.title === 'string'
      ? node.props.title
      : typeof node.props.header === 'string' ? node.props.header : undefined
    return `    <section ${common}>${title ? `\n      <h2>${escapeHtml(title)}</h2>` : ''}\n${content}\n    </section>`
  }
  return `    <${safeTag} ${common}>\n${content}\n    </${safeTag}>`
}

function renderNodes(
  nodes: LowCodeNode[],
  columns: number,
  registry: LowCodeComponentRegistry,
): string {
  return nodes.map(node => node.kind === 'field'
    ? renderField(node, columns, registry)
    : renderContainer(node, columns, registry)).join('\n')
}

function layoutStyle(node: LowCodeNode, registry: LowCodeComponentRegistry): Record<string, string> {
  const render = componentDefinition(node, registry).source.render
  const numericGap = typeof node.props.gap === 'number' && Number.isFinite(node.props.gap)
    ? Math.max(0, node.props.gap)
    : 0
  if (render === 'layout-flex') {
    const direction = node.props.direction === 'column' ? 'column' : 'row'
    const justify = ['flex-start', 'center', 'flex-end', 'space-between'].includes(String(node.props.justify))
      ? String(node.props.justify)
      : 'flex-start'
    const align = ['flex-start', 'center', 'flex-end', 'stretch'].includes(String(node.props.align))
      ? String(node.props.align)
      : 'stretch'
    return {
      alignItems: align,
      display: 'flex',
      flexDirection: direction,
      flexWrap: node.props.wrap === false ? 'nowrap' : 'wrap',
      gap: `${numericGap}px`,
      justifyContent: justify,
    }
  }
  if (render === 'layout-grid') {
    const columns = typeof node.props.columns === 'number' && Number.isInteger(node.props.columns)
      ? Math.min(12, Math.max(1, node.props.columns))
      : 1
    return {
      display: 'grid',
      gap: `${numericGap}px`,
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    }
  }
  return {}
}

function appSource(
  model: LowCodePageModel,
  registry: LowCodeComponentRegistry,
  flowImport = './flows',
): string {
  const initialValues: Record<string, unknown> = {}
  collectInitialValues(model.nodes, initialValues, registry)
  const props: Record<string, Record<string, unknown>> = {}
  const options: Record<string, Array<{ label: string, value: unknown }>> = {}
  const nodeProps: Record<string, Record<string, unknown>> = {}
  const nodeStyles: Record<string, Record<string, string>> = {}
  const fieldModelKeys: Record<string, string> = {}
  const fieldConditions: Record<string, LowCodeNode['conditions']> = {}
  const nodeConditions: Record<string, LowCodeNode['conditions']> = {}
  const nodeEvents: Record<string, LowCodeNode['events']> = {}
  const runtimeReactions: NonNullable<LowCodeNode['reactions']> = []
  const collectProps = (nodes: LowCodeNode[]): void => {
    nodes.forEach((node) => {
      nodeEvents[node.id] = node.events
      if (node.reactions)
        runtimeReactions.push(...node.reactions)
      if (node.kind === 'field') {
        // Reaction targets use the headless field key (not the designer node
        // id), so keep generated projection maps keyed by the same contract.
        const target = node.field ?? node.id
        props[target] = sourceProps(node, registry)
        options[target] = fieldOptions(node)
        const definition = componentDefinition(node, registry)
        const valueBinding = definition.bindings.find(binding => binding.valueProp === (definition.runtime.valueProp ?? 'modelValue'))
        const bindingSource = valueBinding ? node.bindings[valueBinding.name]?.source.trim() : undefined
        fieldModelKeys[target] = bindingSource && Object.hasOwn(initialValues, bindingSource)
          ? bindingSource
          : target
        fieldConditions[target] = node.conditions
      }
      else {
        nodeProps[node.id] = sourceProps(node, registry)
        nodeStyles[node.id] = layoutStyle(node, registry)
        nodeConditions[node.id] = node.conditions
      }
      collectProps(node.children)
      Object.values(node.slots).forEach(collectProps)
    })
  }
  collectProps(model.nodes)
  const columns = model.form.columns ?? 24
  return `<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { applyFlowValuePatch, evaluateRuntimeCondition, getFlowProjection, invokeRegisteredAction, projectRuntimeReactions, registerFlowAction, runFlows, type FlowTrigger } from '${flowImport}'

const model = reactive<Record<string, unknown>>(${scriptJson(initialValues, 2)})
const baseFieldProps = ${scriptJson(props, 2)} as Record<string, Record<string, unknown>>
const fieldProps = reactive<Record<string, Record<string, unknown>>>({ ...baseFieldProps })
const fieldOptions = ${scriptJson(options, 2)} as Record<string, Array<{ label: string, value: unknown }>>
const fieldModelKeys = ${scriptJson(fieldModelKeys, 2)} as Record<string, string>
const fieldConditions = ${scriptJson(fieldConditions, 2)} as Record<string, Record<string, unknown> | undefined>
const nodeProps = ${scriptJson(nodeProps, 2)} as Record<string, Record<string, unknown>>
const nodeStyles = ${scriptJson(nodeStyles, 2)} as Record<string, Record<string, string>>
const nodeConditions = ${scriptJson(nodeConditions, 2)} as Record<string, Record<string, unknown> | undefined>
const nodeEvents = ${scriptJson(nodeEvents, 2)} as Record<string, Record<string, Array<{ action: string, [key: string]: unknown }>>>
const runtimeReactions = ${scriptJson(runtimeReactions, 2)} as Array<{ when: unknown, then: Array<Record<string, unknown>>, else?: Array<Record<string, unknown>>, enabled?: boolean }>
const fieldStates = reactive<Record<string, Record<string, boolean>>>({})
const nodeHidden = reactive<Record<string, boolean>>({})
const flowValidation = ref<string[]>([])
const submitted = ref('')
const flowLifecycle = new AbortController()

registerFlowAction('notify', async (input, context) => {
  if (context.signal.aborted)
    throw context.signal.reason
  const message = typeof input === 'string' ? input : JSON.stringify(input)
  submitted.value = message ?? String(input)
  return { notified: submitted.value }
})

function applyRuntimeProjection(): void {
  const before = { ...model }
  const reactionValues = { ...model }
  const reactionProjection = projectRuntimeReactions(runtimeReactions, reactionValues)
  applyFlowValuePatch(model, before, reactionValues)
  const flowProjection = getFlowProjection()
  const projections = [reactionProjection, flowProjection]
  flowValidation.value = [...new Set(projections.flatMap(projection => projection.validate))]

  for (const key of Object.keys(fieldProps))
    delete fieldProps[key]
  for (const [key, value] of Object.entries(baseFieldProps))
    fieldProps[key] = { ...value }
  for (const key of Object.keys(fieldStates))
    delete fieldStates[key]

  for (const [field, conditions] of Object.entries(fieldConditions)) {
    if (!conditions)
      continue
    const state: Record<string, boolean> = {}
    if (conditions.visible !== undefined)
      state.visible = evaluateRuntimeCondition(conditions.visible, model)
    if (conditions.hidden !== undefined)
      state.visible = !evaluateRuntimeCondition(conditions.hidden, model)
    for (const key of ['disabled', 'readonly', 'required'] as const) {
      if (conditions[key] !== undefined)
        state[key] = evaluateRuntimeCondition(conditions[key], model)
    }
    fieldStates[field] = state
  }

  for (const [nodeId, conditions] of Object.entries(nodeConditions)) {
    const visible = conditions?.visible === undefined || evaluateRuntimeCondition(conditions.visible, model)
    const hidden = conditions?.hidden !== undefined && evaluateRuntimeCondition(conditions.hidden, model)
    nodeHidden[nodeId] = !visible || hidden
  }

  for (const projection of projections) {
    for (const [target, nextProps] of Object.entries(projection.props))
      fieldProps[target] = { ...(fieldProps[target] ?? {}), ...nextProps }
    for (const [target, nextState] of Object.entries(projection.states))
      fieldStates[target] = { ...(fieldStates[target] ?? {}), ...nextState }
  }

  for (const [field, state] of Object.entries(fieldStates)) {
    const nextProps = fieldProps[field] ?? (fieldProps[field] = {})
    if (state.disabled !== undefined)
      nextProps.disabled = state.disabled
    if (state.readonly !== undefined)
      nextProps.readonly = state.readonly
    if (state.required !== undefined)
      nextProps.required = state.required
  }
}

async function runTrigger(trigger: { kind: FlowTrigger['kind'], field?: string }): Promise<void> {
  const snapshot = { ...model }
  try {
    const result = await runFlows(trigger, snapshot, flowLifecycle.signal)
    if (result.status === 'aborted' || result.status === 'ignored' || result.status === 'noop')
      return
    if (result.status === 'failure' || result.status === 'timeout') {
      submitted.value = result.error ?? 'Flow execution failed.'
      return
    }
    applyFlowValuePatch(model, snapshot, result.values)
    applyRuntimeProjection()
    if (result.error)
      submitted.value = result.error
  }
  catch (error) {
    submitted.value = error instanceof Error ? error.message : String(error)
  }
}

function runFieldChange(field: string): void {
  applyRuntimeProjection()
  void runTrigger({ kind: 'field.change', field })
}

async function runNodeEvent(nodeId: string, eventName: string, payload: unknown): Promise<void> {
  const actions = nodeEvents[nodeId]?.[eventName] ?? []
  for (const action of actions) {
    try {
      const input = Object.hasOwn(action, 'input') ? action.input : payload
      await invokeRegisteredAction(action.action, input, {
        eventName,
        nodeId,
        signal: flowLifecycle.signal,
        values: { ...model },
      })
    }
    catch (error) {
      submitted.value = error instanceof Error ? error.message : String(error)
      return
    }
  }
}

function handleFieldUpdate(nodeId: string, field: string, eventName: string, payload: unknown): void {
  runFieldChange(field)
  void runNodeEvent(nodeId, eventName, payload)
}

function handleSubmit(): void {
  submitted.value = JSON.stringify(model, null, 2)
  void runTrigger({ kind: 'form.submit' })
}

onMounted(() => {
  applyRuntimeProjection()
  void runTrigger({ kind: 'page.mount' })
})
onBeforeUnmount(() => flowLifecycle.abort('page-unmounted'))
</script>

<template>
  <main class="source-page">
    <header class="source-header">
      <p class="source-kicker">Generated Vue page</p>
      <h1>${escapeHtml(model.name)}</h1>
      <p>Standalone source generated from the committed design model.</p>
    </header>
    <form class="source-form" @submit.prevent="handleSubmit">
      <div class="source-grid" style="grid-template-columns: repeat(${columns}, minmax(0, 1fr));">
${renderNodes(model.nodes, columns, registry)}
      </div>
      <button class="source-submit" type="submit">Save</button>
    </form>
      <p v-if="flowValidation.length" class="source-validation" role="status">Validation requested for: {{ flowValidation.join(', ') }}</p>
      <pre v-if="submitted" class="source-result" aria-live="polite">{{ submitted }}</pre>
  </main>
</template>
`
}

function sourceStyles(): string {
  return `:root { color: #18212b; background: #eef2f6; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
button, input, select, textarea { font: inherit; }
.source-page { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 64px; }
.source-header { margin-bottom: 28px; }
.source-kicker { margin: 0 0 8px; color: #2563eb; font-size: 12px; font-weight: 700; text-transform: uppercase; }
.source-header h1 { margin: 0; font-size: 32px; }
.source-header p:last-child { color: #586574; }
.source-form { padding: 24px; border: 1px solid #d5dce5; border-radius: 8px; background: #fff; }
.source-grid { display: grid; gap: 16px; }
.source-field { min-width: 0; }
.source-field-label { display: block; margin-bottom: 6px; color: #3d4b59; font-size: 13px; }
.source-control { width: 100%; }
.source-layout { min-width: 0; padding: 14px; border: 1px solid #d5dce5; border-radius: 7px; background: #f8fafc; }
.source-layout-layout-flex, .source-layout-layout-grid { padding: 0; border: 0; background: transparent; }
.source-slot { display: grid; gap: 12px; min-width: 0; }
.source-submit { min-height: 38px; margin-top: 20px; padding: 0 16px; color: #fff; border: 0; border-radius: 5px; background: #1d4ed8; cursor: pointer; }
.source-validation { margin: 14px 0 0; padding: 10px 12px; color: #92400e; border: 1px solid #fbbf24; border-radius: 5px; background: #fffbeb; }
.source-result { margin-top: 20px; padding: 16px; overflow: auto; color: #d7f9e4; border-radius: 5px; background: #17212b; }
@media (max-width: 640px) { .source-page { width: min(100% - 20px, 920px); padding-top: 24px; } .source-form { padding: 16px; } .source-grid { grid-template-columns: 1fr !important; } .source-field { grid-column: 1 / -1 !important; } .source-header h1 { font-size: 26px; } }
`
}

function collectSourceLibraries(
  nodes: LowCodeNode[],
  registry: LowCodeComponentRegistry,
  target = new Map<string, DesignerSourceLibraryBinding>(),
): Map<string, DesignerSourceLibraryBinding> {
  for (const node of nodes) {
    const library = componentDefinition(node, registry).source.library
    if (library) {
      const existing = target.get(library.packageName)
      if (existing && (existing.plugin !== library.plugin || existing.stylesheet !== library.stylesheet))
        throw new Error(`Source library "${library.packageName}" has conflicting plugin bindings.`)
      target.set(library.packageName, { ...library })
    }
    collectSourceLibraries(node.children, registry, target)
    Object.values(node.slots).forEach(children => collectSourceLibraries(children, registry, target))
  }
  return target
}

const SOURCE_LIBRARY_FALLBACK_VERSIONS: Readonly<Record<string, string>> = Object.freeze({
  'ant-design-vue': '4.2.6',
  'element-plus': '2.9.1',
})

function portableDependencyVersion(packageName: string, dependencies: Record<string, string>): string {
  const version = dependencies[packageName] ?? SOURCE_LIBRARY_FALLBACK_VERSIONS[packageName]
  if (!version || /^(?:workspace:|catalog:)/.test(version))
    throw new Error(`Source dependency "${packageName}" requires a portable version.`)
  return version
}

function sourcePackage(
  project: Pick<WorkspaceProject, 'files' | 'name'>,
  libraries: ReadonlyMap<string, DesignerSourceLibraryBinding>,
  declaredDependencies: Record<string, string>,
): string {
  const packageFile = project.files[normalizeProjectPath('package.json')]
  const original = packageFile?.kind === 'text' ? JSON.parse(packageFile.content) as PackageJson : {}
  const dependencies = { ...(original.dependencies ?? {}), ...declaredDependencies }
  const devDependencies = original.devDependencies ?? {}
  const runtimeDependencies = Object.fromEntries([...libraries.keys()].sort().map(packageName => [
    packageName,
    portableDependencyVersion(packageName, dependencies),
  ]))
  const manifest = {
    name: original.name ?? project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    private: true,
    type: 'module',
    version: original.version ?? '0.0.0',
    packageManager: original.packageManager,
    scripts: {
      build: 'vue-tsc -p tsconfig.json --noEmit && vite build',
      dev: 'vite',
      typecheck: 'vue-tsc -p tsconfig.json --noEmit',
    },
    dependencies: {
      vue: portableDependencyVersion('vue', { vue: dependencies.vue ?? '3.5.33' }),
      ...runtimeDependencies,
    },
    devDependencies: {
      '@vitejs/plugin-vue': devDependencies['@vitejs/plugin-vue'] ?? '5.2.3',
      'typescript': devDependencies.typescript ?? '5.8.2',
      'vite': devDependencies.vite ?? '6.2.0',
      'vue-tsc': devDependencies['vue-tsc'] ?? '2.2.8',
    },
  }
  if (!manifest.packageManager)
    delete manifest.packageManager
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function applicationPackage(
  application: WorkspaceApplication,
  libraries: ReadonlyMap<string, DesignerSourceLibraryBinding>,
): string {
  const manifest = JSON.parse(sourcePackage(application, libraries, application.manifest.dependencies)) as PackageJson
  manifest.dependencies = {
    ...manifest.dependencies,
    'vue-router': '4.5.1',
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function mainSource(
  libraries: ReadonlyMap<string, DesignerSourceLibraryBinding>,
  withRouter: boolean,
): string {
  const entries = [...libraries.values()].sort((left, right) => left.packageName.localeCompare(right.packageName))
  const imports = entries.flatMap(library => [
    `import ${library.plugin} from ${quote(library.packageName)}`,
    ...(library.stylesheet ? [`import ${quote(library.stylesheet)}`] : []),
  ])
  const appUses = [
    ...(withRouter ? ['router'] : []),
    ...entries.map(library => library.plugin),
  ].map(plugin => `.use(${plugin})`).join('')
  return `import { createApp } from 'vue'
import App from './App.vue'
${withRouter ? `import { router } from './router'\n` : ''}${imports.join('\n')}${imports.length ? '\n' : ''}import './styles.css'

createApp(App)${appUses}.mount('#app')
`
}

function applicationAppSource(): string {
  return `<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
`
}

function applicationRouterSource(
  application: WorkspaceApplication,
  pageDirectories: ReadonlyMap<string, string>,
): string {
  const imports = application.pages.map((page, index) => `import Page${index + 1} from './pages/${pageDirectories.get(page.id)}/Page.vue'`).join('\n')
  const routes = application.pages.map((page, index) => `  { path: ${quote(page.route)}, name: ${quote(page.id)}, component: Page${index + 1} },`).join('\n')
  const home = application.pages.find(page => page.id === application.homePageId)!
  const redirect = home.route === '/'
    ? ''
    : `\n  { path: '/', redirect: ${quote(home.route)} },`
  return `import { createRouter, createWebHistory } from 'vue-router'
${imports}

export const router = createRouter({
  history: createWebHistory(),
  routes: [${redirect}
${routes}
  ],
})
`
}

function uniquePageDirectories(application: WorkspaceApplication): ReadonlyMap<string, string> {
  const used = new Set<string>()
  return new Map(application.pages.map((page) => {
    const base = safeProjectSlug(page.id)
    let directory = base
    let suffix = 2
    while (used.has(directory)) {
      directory = `${base}-${suffix}`
      suffix += 1
    }
    used.add(directory)
    return [page.id, directory]
  }))
}

function isReplacedApplicationFile(path: ProjectPath): boolean {
  return path === normalizeProjectPath('package.json')
    || path === normalizeProjectPath('src/App.vue')
    || path === normalizeProjectPath('src/main.ts')
    || path === normalizeProjectPath('src/router.ts')
    || path === normalizeProjectPath('src/styles.css')
    || path === normalizeProjectPath('src/form.config.ts')
    || path === normalizeProjectPath('src/form.designer.json')
    || path === normalizeProjectPath('src/flows.ts')
    || path === normalizeProjectPath('src/page.model.json')
    || path.startsWith('src/pages/')
}

export function createWorkspaceApplicationSourceExport(
  input: WorkspaceApplication,
  registry: LowCodeComponentRegistry,
): WorkspaceApplicationSourceExport {
  const application = parseWorkspaceApplication(input)
  const files: Record<ProjectPath, WorkspaceFile> = {}
  for (const [path, file] of Object.entries(application.files) as Array<[ProjectPath, WorkspaceFile]>) {
    if (!isReplacedApplicationFile(path))
      files[path] = structuredClone(file)
  }

  const pageDirectories = uniquePageDirectories(application)
  const libraries = new Map<string, DesignerSourceLibraryBinding>()
  for (const page of application.pages) {
    page.model.nodes.forEach(node => assertPortableNode(node, registry))
    collectSourceLibraries(page.model.nodes, registry, libraries)
    for (const flow of page.model.flows ?? []) {
      const result = analyzeConfigFormFlow(flow)
      if (!result.success)
        throw new Error(result.diagnostics[0]?.message ?? `Flow on page "${page.name}" is invalid.`)
    }
    const directory = pageDirectories.get(page.id)!
    files[normalizeProjectPath(`src/pages/${directory}/Page.vue`)] = textFile(appSource(page.model, registry), 'vue')
    files[normalizeProjectPath(`src/pages/${directory}/flows.ts`)] = textFile(flowSource(page.model), 'typescript')
  }

  files[normalizeProjectPath('package.json')] = textFile(applicationPackage(application, libraries), 'json')
  files[normalizeProjectPath('src/App.vue')] = textFile(applicationAppSource(), 'vue')
  files[normalizeProjectPath('src/router.ts')] = textFile(applicationRouterSource(application, pageDirectories), 'typescript')
  files[normalizeProjectPath('src/main.ts')] = textFile(mainSource(libraries, true), 'typescript')
  files[normalizeProjectPath('src/styles.css')] = textFile(sourceStyles(), 'css')

  return {
    application: cloneWorkspaceApplication(application),
    files,
  }
}

export function createPureSourceExport(project: WorkspaceProject, model: LowCodePageModel, registry: LowCodeComponentRegistry): PureSourceExport {
  model.nodes.forEach(node => assertPortableNode(node, registry))
  if (model.flows !== undefined && !Array.isArray(model.flows))
    throw new Error('Flow export requires an array of JSON-only flows.')
  for (const flow of model.flows ?? []) {
    const result = analyzeConfigFormFlow(flow)
    if (!result.success)
      throw new Error(result.diagnostics[0]?.message ?? 'Flow is invalid and cannot be exported.')
  }
  const libraries = collectSourceLibraries(model.nodes, registry)
  const next = cloneWorkspaceProject(project)
  const files: Record<ProjectPath, WorkspaceFile> = {}
  for (const [path, file] of Object.entries(next.files) as Array<[ProjectPath, WorkspaceFile]>) {
    if (path === normalizeProjectPath('src/form.config.ts') || path === normalizeProjectPath('src/form.designer.json') || path === normalizeProjectPath('src/App.vue') || path === normalizeProjectPath('src/main.ts') || path === normalizeProjectPath('src/styles.css') || path === normalizeProjectPath('package.json'))
      continue
    files[path] = file
  }
  const appPath = normalizeProjectPath('src/App.vue')
  files[normalizeProjectPath('package.json')] = textFile(sourcePackage(project, libraries, project.manifest.dependencies), 'json')
  files[appPath] = textFile(appSource(model, registry), 'vue')
  files[normalizeProjectPath('src/main.ts')] = textFile(mainSource(libraries, false), 'typescript')
  files[normalizeProjectPath('src/styles.css')] = textFile(sourceStyles(), 'css')
  files[normalizeProjectPath('src/flows.ts')] = textFile(flowSource(model), 'typescript')
  next.files = files
  next.manifest = {
    ...next.manifest,
    dependencies: JSON.parse((files[normalizeProjectPath('package.json')] as { content: string }).content).dependencies,
    designerArtifact: appPath,
    generatedFormModule: appPath,
  }
  return { files, project: next }
}
