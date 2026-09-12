import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ParentToRuntimeHostMessage,
  RuntimeHostActionContext,
  RuntimeHostFieldInstance,
  RuntimeHostGeometryPayload,
  RuntimeHostMessageBase,
  RuntimeHostMessageEventOptions,
  RuntimeHostRectPayload,
  RuntimeHostRuntimeStatePayload,
  RuntimeHostToParentMessage,
  RuntimeHostValuePatch,
} from '../types'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { isRuntimeHostDataDiagnostic, isRuntimeHostDataInput, isRuntimeHostDataOutput } from './data-rpc'
import { isRuntimeHostJson as isJsonValue } from './json'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const FLOW_STATUSES = new Set(['success', 'failure', 'end', 'blocked', 'aborted', 'timeout', 'ignored'])
const TRACE_TYPES = new Set(['start', 'enter', 'exit', 'error', 'abort', 'finish'])
const NODE_TYPES = new Set(['trigger', 'condition', 'reaction', 'action', 'success', 'failure', 'end', 'blocked'])
const MAX_STRING_LENGTH = 16_384

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH
}

function isMessageJson(value: Record<string, unknown>): boolean {
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const type = descriptors.type?.value
  // Existing action envelopes treat explicit undefined optional fields as omitted.
  const optional = type === 'actionResult'
    ? ['diagnostic', 'output', 'valuePatch']
    : type === 'actionRequest' ? ['input'] : []
  for (const key of optional) {
    if (descriptors[key] && Object.hasOwn(descriptors[key], 'value') && descriptors[key].value === undefined)
      delete descriptors[key]
  }
  return isJsonValue(Object.defineProperties(Object.create(Object.getPrototypeOf(value)), descriptors))
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isJsonValue(value)
}

function hasMessageBase(value: unknown): value is RuntimeHostMessageBase & Record<string, unknown> {
  if (!isRecord(value) || !isMessageJson(value))
    return false
  return value.channel === RUNTIME_HOST_CHANNEL
    && value.version === RUNTIME_HOST_PROTOCOL_VERSION
    && isSafeText(value.hostId)
    && isSafeText(value.projectId)
    && isSafeText(value.pageId)
    && Number.isSafeInteger(value.sequence)
    && Number(value.sequence) >= 0
    && isSafeText(value.revision)
}

function isPageCompilation(value: unknown): value is PageCompilation {
  if (!isRecord(value) || !isRecord(value.snapshotIdentity) || !isRecord(value.key) || !isRecord(value.page))
    return false
  const pageId = value.page.id
  return isSafeText(pageId)
    && value.snapshotIdentity.pageId === pageId
    && value.key.pageId === pageId
    && isSafeText(value.key.registryAdapter)
    && Array.isArray(value.page.rootIds)
    && value.page.rootIds.every(item => isSafeText(item))
    && isJsonRecord(value.page.nodesById)
    && isJsonValue(value.page.flows ?? [])
}

function isReactionProjection(value: unknown): value is ConfigFormReactionProjection<Record<string, unknown>> {
  return isRecord(value)
    && isJsonRecord(value.values)
    && isJsonRecord(value.props)
    && isJsonRecord(value.states)
    && Array.isArray(value.validate)
    && value.validate.every(field => isSafeText(field))
}

function isSafeKey(value: unknown): value is string {
  return isSafeText(value) && !UNSAFE_KEYS.has(value)
}

function isScopePath(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 32
    && value.every(entry => isRecord(entry) && isSafeKey(entry.scopeId) && isSafeKey(entry.rowId))
    && new Set(value.map(entry => entry.scopeId)).size === value.length
}

export function isRuntimeHostFieldInstance(value: unknown): value is RuntimeHostFieldInstance {
  return isRecord(value) && isJsonValue(value)
    && isSafeKey(value.nodeId) && isSafeKey(value.instanceKey) && isScopePath(value.scope)
    && Array.isArray(value.valuePath) && value.valuePath.length > 0 && value.valuePath.length <= 65
    && value.valuePath.every(part => isSafeKey(part)
      || (typeof part === 'number' && Number.isSafeInteger(part) && part >= 0 && part < 10_000))
    && value.valuePath.filter(part => typeof part === 'number').length === (value.scope as unknown[]).length
}

function hasValueContainer(values: Record<string, unknown>, path: readonly (string | number)[]): boolean {
  let current: unknown = values
  return path.every((part, index) => {
    if (typeof part === 'number' ? !Array.isArray(current) || part >= current.length : !isRecord(current))
      return false
    if (index === path.length - 1)
      return typeof part === 'string'
    if (!Object.hasOwn(current as object, part))
      return false
    current = (current as Record<string | number, unknown>)[part]
    return true
  })
}

function hasConsistentRows(fields: readonly RuntimeHostFieldInstance[]): boolean {
  const pathsByRow = new Map<string, string>()
  const rowsByPath = new Map<string, string>()
  return fields.every(field => {
    let rowIndex = 0
    return field.valuePath.every((part, pathIndex) => {
      if (typeof part !== 'number')
        return true
      const row = JSON.stringify(field.scope.slice(0, ++rowIndex).map(entry => [entry.scopeId, entry.rowId]))
      const path = JSON.stringify(field.valuePath.slice(0, pathIndex + 1))
      if ((pathsByRow.has(row) && pathsByRow.get(row) !== path)
        || (rowsByPath.has(path) && rowsByPath.get(path) !== row))
        return false
      pathsByRow.set(row, path)
      rowsByPath.set(path, row)
      return true
    })
  })
}

export function isRuntimeHostRuntimeState(value: unknown): value is RuntimeHostRuntimeStatePayload {
  if (!isRecord(value) || !isJsonValue(value) || !isJsonRecord(value.values)
    || !Array.isArray(value.fields) || value.fields.length > 2_048
    || !value.fields.every(isRuntimeHostFieldInstance)
    || !Array.isArray(value.touched) || !isRecord(value.validation)) {
    return false
  }
  const fields = value.fields as RuntimeHostFieldInstance[]
  const keys = new Set(fields.map(field => field.instanceKey))
  return keys.size === fields.length
    && new Set(fields.map(field => JSON.stringify([field.nodeId, field.scope.map(entry => [entry.scopeId, entry.rowId])]))).size === fields.length
    && new Set(fields.map(field => JSON.stringify(field.valuePath))).size === fields.length
    && hasConsistentRows(fields)
    && fields.every(field => hasValueContainer(value.values as Record<string, unknown>, field.valuePath))
    && new Set(value.touched).size === value.touched.length
    && value.touched.every(key => isSafeKey(key) && keys.has(key))
    && Object.entries(value.validation).every(([key, errors]) => keys.has(key)
      && Array.isArray(errors) && errors.length <= 128 && errors.every(isSafeText))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRuntimeHostRect(value: unknown): value is RuntimeHostRectPayload {
  return isRecord(value)
    && isFiniteNumber(value.bottom)
    && isFiniteNumber(value.height)
    && isFiniteNumber(value.left)
    && isFiniteNumber(value.right)
    && isFiniteNumber(value.top)
    && isFiniteNumber(value.width)
    && value.height >= 0
    && value.width >= 0
    && value.bottom >= value.top
    && value.right >= value.left
}

function isRuntimeHostGeometry(value: unknown): value is RuntimeHostGeometryPayload {
  return isRecord(value)
    && isRuntimeHostRect(value.surfaceRect)
    && (value.layoutRect === undefined || isRuntimeHostRect(value.layoutRect))
    && isRecord(value.viewport)
    && isFiniteNumber(value.viewport.height)
    && isFiniteNumber(value.viewport.width)
    && value.viewport.height >= 0
    && value.viewport.width >= 0
    && Array.isArray(value.nodes)
    && value.nodes.every(node => isRecord(node)
      && isSafeText(node.nodeId)
      && typeof node.path === 'string'
      && Number.isSafeInteger(node.depth)
      && Number(node.depth) >= 0
      && Number.isSafeInteger(node.order)
      && Number(node.order) >= 0
      && (node.slot === undefined || typeof node.slot === 'string')
      && isRuntimeHostRect(node.rect))
}

function isTrigger(value: unknown): boolean {
  return isRecord(value)
    && isSafeText(value.kind)
    && (value.nodeId === undefined || isSafeText(value.nodeId))
    && (value.event === undefined || isSafeText(value.event))
}

function isFlowEvent(value: unknown): boolean {
  return isRecord(value)
    && isTrigger(value.trigger)
    && (value.scope === undefined || isScopePath(value.scope))
    && Array.isArray(value.args)
    && value.args.every(arg => isJsonValue(arg))
    && (value.field === undefined || isSafeText(value.field))
}

function isActionContext(value: unknown): value is RuntimeHostActionContext {
  if (!isRecord(value))
    return false
  if ('signal' in value || 'form' in value)
    return false
  const flow = value.flow
  const node = value.node
  return isRecord(flow)
    && Number.isSafeInteger(flow.runtimeVersion)
    && Number.isSafeInteger(flow.version)
    && isSafeText(flow.id)
    && isSafeText(flow.name)
    && isTrigger(flow.trigger)
    && (flow.concurrency === undefined || ['latest', 'queue', 'ignore'].includes(String(flow.concurrency)))
    && (flow.errorPolicy === undefined || isJsonValue(flow.errorPolicy))
    && isRecord(node)
    && isSafeText(node.id)
    && typeof node.type === 'string'
    && NODE_TYPES.has(node.type)
    && (node.ref === undefined || isSafeText(node.ref))
    && (node.config === undefined || isJsonValue(node.config))
    && (node.policy === undefined || isJsonValue(node.policy))
    && Array.isArray(node.incoming)
    && Array.isArray(node.outgoing)
    && isJsonValue(node.incoming)
    && isJsonValue(node.outgoing)
    && Number.isSafeInteger(value.revision)
    && isSafeText(value.runId)
    && isFlowEvent(value.event)
    && isJsonRecord(value.values)
    && isJsonRecord(value.outputs)
}

function isValuePatch(value: unknown): value is RuntimeHostValuePatch {
  if (!isRecord(value) || !isJsonRecord(value.set) || !Array.isArray(value.remove))
    return false
  if (!value.remove.every(field => isSafeKey(field)))
    return false
  const remove = value.remove as string[]
  if (new Set(remove).size !== remove.length)
    return false
  const setKeys = Object.keys(value.set)
  return setKeys.every(key => isSafeText(key))
    && !setKeys.some(key => remove.includes(key))
}

function isDiagnostic(value: unknown): boolean {
  return isRecord(value)
    && isSafeText(value.code)
    && isSafeText(value.message)
    && (value.path === undefined || (typeof value.path === 'string' && value.path.length <= MAX_STRING_LENGTH))
    && (value.nodeId === undefined || isSafeText(value.nodeId))
    && (value.edgeId === undefined || isSafeText(value.edgeId))
    && (value.severity === undefined || value.severity === 'error' || value.severity === 'warning')
}

function isActionRequest(value: Record<string, unknown>): boolean {
  return value.type === 'actionRequest'
    && isSafeText(value.requestId)
    && isSafeText(value.ref)
    && (value.input === undefined || isJsonValue(value.input))
    && isActionContext(value.context)
}

function isActionCancel(value: Record<string, unknown>): boolean {
  return value.type === 'actionCancel' && isSafeText(value.requestId)
}

function isActionResult(value: Record<string, unknown>): boolean {
  if (value.type !== 'actionResult' || !isSafeText(value.requestId) || typeof value.success !== 'boolean')
    return false
  if (value.success) {
    return value.diagnostic === undefined
      && isValuePatch(value.valuePatch)
      && (value.output === undefined || isJsonValue(value.output))
  }
  return isDiagnostic(value.diagnostic)
    && value.output === undefined
    && value.valuePatch === undefined
}

function isFlowTrace(value: unknown): boolean {
  return isRecord(value)
    && typeof value.type === 'string'
    && TRACE_TYPES.has(value.type)
    && isSafeText(value.flowId)
    && isSafeText(value.runId)
    && Number.isSafeInteger(value.revision)
    && (value.nodeId === undefined || isSafeText(value.nodeId))
    && (value.status === undefined || (typeof value.status === 'string' && FLOW_STATUSES.has(value.status)))
    && (value.error === undefined || typeof value.error === 'string')
    && (value.timestamp === undefined || isFiniteNumber(value.timestamp))
    && (value.durationMs === undefined || (isFiniteNumber(value.durationMs) && value.durationMs >= 0))
    && (value.input === undefined || isJsonValue(value.input))
    && (value.output === undefined || isJsonValue(value.output))
    && (value.valuePatch === undefined || isJsonValue(value.valuePatch))
    && (value.truncated === undefined || typeof value.truncated === 'boolean')
}

function isFlowRunResult(value: unknown): boolean {
  return isRecord(value)
    && typeof value.status === 'string'
    && FLOW_STATUSES.has(value.status)
    && isSafeText(value.flowId)
    && isSafeText(value.runId)
    && Number.isSafeInteger(value.revision)
    && isJsonRecord(value.values)
    && isJsonRecord(value.outputs)
    && isReactionProjection(value.projection)
    && Array.isArray(value.trace)
    && value.trace.every(trace => isFlowTrace(trace))
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(diagnostic => isDiagnostic(diagnostic))
    && (value.error === undefined || isDiagnostic(value.error))
}

function isFlowDispatchResult(value: unknown): boolean {
  return isRecord(value)
    && typeof value.status === 'string'
    && new Set(['committed', 'noop', 'ignored', 'blocked', 'aborted', 'failure', 'timeout', 'stale']).has(value.status)
    && Array.isArray(value.results)
    && value.results.every(result => isFlowRunResult(result))
    && isValuePatch(value.valuePatch)
    && isRecord(value.projectionUpdates)
    && Object.values(value.projectionUpdates).every(projection => isReactionProjection(projection))
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(diagnostic => isDiagnostic(diagnostic))
    && (value.error === undefined || isDiagnostic(value.error))
}

export function isParentToRuntimeHostMessage(value: unknown): value is ParentToRuntimeHostMessage {
  if (!hasMessageBase(value))
    return false
  if (value.type === 'dataResult') {
    return isSafeKey(value.requestId) && (value.success === true
      ? value.diagnostic === undefined && isRuntimeHostDataOutput(value.output)
      : value.success === false && value.output === undefined && isRuntimeHostDataDiagnostic(value.diagnostic))
  }
  if (value.type === 'actionResult')
    return isActionResult(value)
  if (value.type === 'submit')
    return isSafeKey(value.requestId)
  if (value.type === 'state') {
    return isRuntimeHostRuntimeState(value.runtimeState)
      && isReactionProjection(value.reactionProjection)
  }
  return value.type === 'sync'
    && (value.adapter === 'antd-vue' || value.adapter === 'element-plus')
    && isPageCompilation(value.compilation)
    && value.projectId === value.compilation.snapshotIdentity.projectId
    && value.pageId === value.compilation.snapshotIdentity.pageId
    && (value.mode === 'design' || value.mode === 'preview')
    && (value.dataSourceRequest === undefined || typeof value.dataSourceRequest === 'boolean')
    && (value.mode !== 'design' || value.dataSourceRequest !== true)
    && (value.mode === 'preview'
      ? value.design === undefined
      : isRecord(value.design)
        && (value.design.breakpoint === 'desktop' || value.design.breakpoint === 'tablet' || value.design.breakpoint === 'mobile')
        && (value.design.variant === 'canvas' || value.design.variant === 'drag-visual')
        && (value.design.candidateId === undefined || isSafeText(value.design.candidateId))
        && (value.design.candidateUsesFallback === undefined || typeof value.design.candidateUsesFallback === 'boolean')
        && (value.design.canvasWidth === undefined || (isFiniteNumber(value.design.canvasWidth) && value.design.canvasWidth >= 0)))
      && typeof value.locale === 'string'
      && isRuntimeHostRuntimeState(value.runtimeState)
      && (value.namespace === undefined || typeof value.namespace === 'string')
      && isReactionProjection(value.reactionProjection)
      && isSafeText(value.runtimeSessionKey)
}

export function isRuntimeHostToParentMessage(value: unknown): value is RuntimeHostToParentMessage {
  if (!hasMessageBase(value) || typeof value.type !== 'string')
    return false
  if (value.type === 'dataRequest')
    return isSafeKey(value.requestId) && isRuntimeHostDataInput(value.input)
  if (value.type === 'dataCancel')
    return isSafeKey(value.requestId)
  if (value.type === 'actionRequest')
    return isActionRequest(value)
  if (value.type === 'actionCancel')
    return isActionCancel(value)
  if (value.type === 'ready' || value.type === 'mounted')
    return true
  if (value.type === 'geometry')
    return isRuntimeHostGeometry(value.payload)
  if (value.type === 'designPointerDown'
    || value.type === 'designPointerMove'
    || value.type === 'designPointerUp'
    || value.type === 'designPointerCancel'
    || value.type === 'designContextMenu') {
    return isRecord(value.payload)
      && isFiniteNumber(value.payload.clientX)
      && isFiniteNumber(value.payload.clientY)
      && Number.isSafeInteger(value.payload.button)
      && Number.isSafeInteger(value.payload.pointerId)
      && Number(value.payload.pointerId) >= 0
      && typeof value.payload.ctrlKey === 'boolean'
      && typeof value.payload.metaKey === 'boolean'
      && typeof value.payload.shiftKey === 'boolean'
      && (value.payload.nodeId === undefined || isSafeText(value.payload.nodeId))
  }
  if (value.type === 'runtimeState')
    return isRuntimeHostRuntimeState(value.payload)
  if (value.type === 'submitResult') {
    return isRecord(value.payload)
      && (value.payload.status === 'success'
        || value.payload.status === 'invalid'
        || value.payload.status === 'blocked'
        || value.payload.status === 'failure')
      && isSafeKey(value.payload.requestId)
      && isRuntimeHostRuntimeState(value.payload)
  }
  if (value.type === 'submit')
    return isSafeKey(value.requestId) && isJsonRecord(value.values)
  if (value.type === 'fieldChange') {
    return isRecord(value.payload)
      && isRuntimeHostFieldInstance(value.payload)
      && isSafeKey(value.payload.field)
      && isJsonRecord(value.payload.values)
      && hasValueContainer(value.payload.values, value.payload.valuePath)
  }
  if (value.type === 'runtimeEvent') {
    return isRecord(value.payload)
      && isJsonValue(value.payload)
      && isScopePath(value.payload.scope)
      && (value.payload.field === undefined
        ? value.payload.instanceKey === undefined && value.payload.valuePath === undefined
        : isRuntimeHostFieldInstance(value.payload)
          && isJsonRecord(value.payload.values) && hasValueContainer(value.payload.values, value.payload.valuePath))
        && isSafeText(value.payload.nodeId)
        && isSafeText(value.payload.event)
        && Array.isArray(value.payload.args)
        && value.payload.args.every(arg => isJsonValue(arg))
        && isJsonRecord(value.payload.values)
        && (value.payload.field === undefined || isSafeText(value.payload.field))
  }
  if (value.type === 'flowTrace')
    return isFlowTrace(value.payload)
  if (value.type === 'flowError')
    return isDiagnostic(value.payload)
  if (value.type === 'flowProjection')
    return isReactionProjection(value.payload)
  if (value.type === 'flowResult')
    return isFlowDispatchResult(value.payload)
  return value.type === 'error'
    && isSafeText(value.code)
    && isSafeText(value.message)
}

export function acceptsRuntimeHostMessageEvent<T extends RuntimeHostMessageBase>(
  event: MessageEvent<unknown>,
  options: RuntimeHostMessageEventOptions<T>,
): T | undefined {
  if (event.source !== options.source || event.origin !== options.origin || !options.guard(event.data))
    return undefined
  if (options.hostId !== undefined && event.data.hostId !== options.hostId)
    return undefined
  if (options.projectId !== undefined && event.data.projectId !== options.projectId)
    return undefined
  if (options.pageId !== undefined && event.data.pageId !== options.pageId)
    return undefined
  if (options.revision !== undefined && event.data.revision !== options.revision)
    return undefined
  return event.data
}
