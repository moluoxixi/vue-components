import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ParentToRuntimeHostMessage,
  RuntimeHostFieldInstance,
  RuntimeHostGeometryPayload,
  RuntimeHostMessageBase,
  RuntimeHostMessageEventOptions,
  RuntimeHostRectPayload,
  RuntimeHostRuntimeStatePayload,
  RuntimeHostToParentMessage,
} from '../types'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
  hasOnlyCurrentCanonicalPageKeys,
} from '@moluoxixi/config-form-compiler'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { isRuntimeHostDataDiagnostic, isRuntimeHostDataInput, isRuntimeHostDataOutput } from './data-rpc'
import { isRuntimeHostJson as isJsonValue } from './json'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_STRING_LENGTH = 16_384

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH
}

function isMessageJson(value: Record<string, unknown>): boolean {
  return isJsonValue(value)
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
  const projectId = value.snapshotIdentity.projectId
  const nodesById = value.page.nodesById
  return isSafeText(pageId)
    && isSafeText(projectId)
    && value.snapshotIdentity.pageId === pageId
    && value.key.projectId === projectId
    && value.key.pageId === pageId
    && value.key.irVersion === CANONICAL_PROJECT_IR_VERSION
    && value.key.compilerVersion === CONFIG_FORM_COMPILER_VERSION
    && isSafeText(value.key.registryAdapter)
    && Array.isArray(value.page.rootIds)
    && value.page.rootIds.every(item => isSafeText(item))
    && hasOnlyCurrentCanonicalPageKeys(value.page)
    && isJsonRecord(nodesById)
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
  return fields.every((field) => {
    let rowIndex = 0
    return field.valuePath.every((part, pathIndex) => {
      if (typeof part !== 'number')
        return true
      const row = JSON.stringify(field.scope.slice(0, ++rowIndex).map(entry => [entry.scopeId, entry.rowId]))
      const path = JSON.stringify(field.valuePath.slice(0, pathIndex + 1))
      if ((pathsByRow.has(row) && pathsByRow.get(row) !== path)
        || (rowsByPath.has(path) && rowsByPath.get(path) !== row)) {
        return false
      }
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

export function isParentToRuntimeHostMessage(value: unknown): value is ParentToRuntimeHostMessage {
  if (!hasMessageBase(value))
    return false
  if (value.type === 'dataResult') {
    return isSafeKey(value.requestId) && (value.success === true
      ? value.diagnostic === undefined && isRuntimeHostDataOutput(value.output)
      : value.success === false && value.output === undefined && isRuntimeHostDataDiagnostic(value.diagnostic))
  }
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
