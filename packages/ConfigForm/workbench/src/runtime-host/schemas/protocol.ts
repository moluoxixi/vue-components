import type { ProjectCompilation, SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type {
  PrototypeNodeAddressV1,
  PrototypeProjectContextV1,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type {
  ParentToRuntimeHostMessageV7,
  PrototypeTransitionSnapshotV1,
  RuntimeHostDesignPointerPayload,
  RuntimeHostFieldInstanceV7,
  RuntimeHostFormStateSnapshotV7,
  RuntimeHostGeometryPayload,
  RuntimeHostInstanceStatePayloadV7,
  RuntimeHostMessageBaseV7,
  RuntimeHostMessageEventOptionsV7,
  RuntimeHostRectPayload,
  RuntimeHostToParentMessageV7,
} from '../types'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
  hasOnlyCurrentCanonicalSurfaceKeys,
} from '@moluoxixi/config-form-compiler'
import {
  parseProjectCompilationSnapshot,
  parseRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import {
  createPrototypeProjectContext,
  readPrototypeSession,
  readPrototypeSessionCommand,
} from '@moluoxixi/config-form-prototype-runtime/session'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { isRuntimeHostJson as isJsonValue } from './json'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_STRING_LENGTH = 16_384
const BASE_KEYS = ['channel', 'version', 'hostId', 'projectId', 'revision', 'sequence']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH
}

function isSafeKey(value: unknown): value is string {
  return isSafeText(value) && !UNSAFE_KEYS.has(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && isJsonValue(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional])
  const keys = Object.keys(value)
  return required.every(key => Object.hasOwn(value, key))
    && keys.every(key => allowed.has(key))
}

function hasMessageBase(value: unknown): value is RuntimeHostMessageBaseV7 & Record<string, unknown> {
  if (!isRecord(value) || !isJsonValue(value))
    return false
  return BASE_KEYS.every(key => Object.hasOwn(value, key))
    && value.channel === RUNTIME_HOST_CHANNEL
    && value.version === RUNTIME_HOST_PROTOCOL_VERSION
    && isSafeText(value.hostId)
    && isSafeText(value.projectId)
    && isSafeText(value.revision)
    && Number.isSafeInteger(value.sequence)
    && (value.sequence as number) >= 0
}

function isSurfaceSnapshotIdentity(value: unknown, surfaceId: string, projectId: string): boolean {
  if (!isRecord(value) || !isJsonValue(value) || !isSafeText(value.source)
    || !isSafeText(value.projectId) || !isSafeText(value.surfaceId)
    || value.projectId !== projectId || value.surfaceId !== surfaceId) {
    return false
  }
  const record = value as Record<string, unknown>
  if (record.source === 'committed') {
    return hasExactKeys(record, ['source', 'projectId', 'surfaceId', 'contentHash', 'editVersion'])
      && isSafeText(record.contentHash) && Number.isSafeInteger(record.editVersion) && (record.editVersion as number) >= 0
  }
  if (record.source === 'draft') {
    return hasExactKeys(record, ['source', 'projectId', 'surfaceId', 'contentHash', 'baseEditVersion', 'draftId'])
      && isSafeText(record.contentHash) && isSafeText(record.draftId)
      && Number.isSafeInteger(record.baseEditVersion) && (record.baseEditVersion as number) >= 0
  }
  return false
}

function isSurfaceKey(value: unknown, projectId: string, surfaceId: string): boolean {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, [
      'irVersion',
      'projectId',
      'surfaceId',
      'registryAdapter',
      'registryAdapterVersion',
      'registryUsageHash',
      'compilerVersion',
      'environmentHash',
      'semanticHash',
    ])
    && value.irVersion === CANONICAL_PROJECT_IR_VERSION
    && value.projectId === projectId
    && value.surfaceId === surfaceId
    && value.compilerVersion === CONFIG_FORM_COMPILER_VERSION
    && isSafeText(value.registryAdapter)
    && isSafeText(value.registryAdapterVersion)
    && isSafeText(value.registryUsageHash)
    && isSafeText(value.environmentHash)
    && isSafeText(value.semanticHash)
}

function isSurfaceCompilation(value: unknown): value is SurfaceCompilation {
  if (!isRecord(value) || !isJsonValue(value)
    || !hasExactKeys(value, ['snapshotIdentity', 'registryUsage', 'key', 'surface', 'theme', 'datasetsById'])
    || !isRecord(value.surface) || !isRecord(value.key) || !isRecord(value.snapshotIdentity)) {
    return false
  }
  const surface = value.surface as Record<string, unknown>
  const key = value.key as Record<string, unknown>
  const snapshotIdentity = value.snapshotIdentity as Record<string, unknown>
  const surfaceId = surface.id
  const projectId = snapshotIdentity.projectId
  return isSafeText(surfaceId)
    && isSafeText(projectId)
    && isSurfaceSnapshotIdentity(snapshotIdentity, surfaceId, projectId)
    && isSurfaceKey(key, projectId, surfaceId)
    && key.projectId === snapshotIdentity.projectId
    && key.surfaceId === snapshotIdentity.surfaceId
    && hasOnlyCurrentCanonicalSurfaceKeys(surface)
    && isJsonRecord(value.theme)
    && isJsonRecord(value.datasetsById)
    && Array.isArray(value.registryUsage)
    && (value.registryUsage as unknown[]).every(item => isRecord(item)
      && hasExactKeys(item, ['key', 'contractVersion', 'fingerprint'])
      && isSafeText(item.key) && isSafeText(item.contractVersion) && isSafeText(item.fingerprint))
}

function isProjectIdentity(value: unknown): value is ProjectCompilation['key'] {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, [
      'projectId',
      'contentHash',
      'registryAdapter',
      'registryAdapterVersion',
      'registryFingerprint',
      'compilerVersion',
      'environmentHash',
      'irHash',
    ])
    && isSafeText(value.projectId)
    && isSafeText(value.contentHash)
    && isSafeText(value.registryAdapter)
    && isSafeText(value.registryAdapterVersion)
    && isSafeText(value.registryFingerprint)
    && value.compilerVersion === CONFIG_FORM_COMPILER_VERSION
    && isSafeText(value.environmentHash)
    && isSafeText(value.irHash)
}

function isProjectIr(value: unknown, projectId: string): value is ProjectCompilation['ir'] {
  const identity = isRecord(value) && isRecord(value.identity)
    ? value.identity
    : undefined
  if (!isRecord(value) || !isJsonValue(value)
    || !hasExactKeys(value, [
      'version',
      'identity',
      'name',
      'homeSurfaceId',
      'surfaceOrder',
      'surfacesById',
      'datasetOrder',
      'datasetsById',
      'resources',
      'theme',
      'settings',
      'environment',
    ])
    || value.version !== CANONICAL_PROJECT_IR_VERSION
    || !isProjectIdentity(identity)
    || identity.projectId !== projectId
    || !isSafeText(value.name)
    || !isSafeText(value.homeSurfaceId)
    || !Array.isArray(value.surfaceOrder)
    || !isJsonRecord(value.surfacesById)
    || !Array.isArray(value.datasetOrder)
    || !isJsonRecord(value.datasetsById)
    || !isJsonRecord(value.resources)
    || !isJsonRecord(value.theme)
    || !isJsonRecord(value.settings)
    || !isJsonRecord(value.environment)) {
    return false
  }
  const surfaceOrder = value.surfaceOrder
  const surfacesById = value.surfacesById
  if (!surfaceOrder.every(isSafeText) || !surfaceOrder.includes(value.homeSurfaceId))
    return false
  const surfaceIds = Object.keys(surfacesById)
  return surfaceIds.length === surfaceOrder.length
    && surfaceOrder.every(id => Object.hasOwn(surfacesById, id)
      && isRecord(surfacesById[id])
      && hasOnlyCurrentCanonicalSurfaceKeys(surfacesById[id]))
}

function hasMatchingProjectIdentity(
  left: ProjectCompilation['key'],
  right: ProjectCompilation['key'],
): boolean {
  return left.projectId === right.projectId
    && left.contentHash === right.contentHash
    && left.registryAdapter === right.registryAdapter
    && left.registryAdapterVersion === right.registryAdapterVersion
    && left.registryFingerprint === right.registryFingerprint
    && left.compilerVersion === right.compilerVersion
    && left.environmentHash === right.environmentHash
    && left.irHash === right.irHash
}

function isProjectCompilation(value: unknown): value is ProjectCompilation {
  if (!isRecord(value) || !isJsonValue(value)
    || !hasExactKeys(value, ['snapshot', 'registry', 'origin', 'key', 'ir'])
    || !isRecord(value.key) || !isRecord(value.ir) || !isRecord(value.origin)
    || !isRecord(value.snapshot) || !isJsonRecord(value.registry)) {
    return false
  }
  const snapshotResult = parseProjectCompilationSnapshot(value.snapshot)
  const registryResult = parseRegistryContractSnapshot(value.registry)
  if (!snapshotResult.success || !registryResult.success)
    return false

  const key = value.key
  const ir = value.ir
  const origin = value.origin
  if (!isProjectIdentity(key) || !isProjectIr(ir, key.projectId)
    || !hasMatchingProjectIdentity(key, ir.identity)) {
    return false
  }

  const snapshot = snapshotResult.data
  const registry = registryResult.data
  if (snapshot.document.id !== key.projectId
    || snapshot.document.registryLock.adapter !== registry.adapter
    || snapshot.document.registryLock.version !== registry.adapterVersion
    || snapshot.document.registryLock.fingerprint !== registry.fingerprint
    || key.registryAdapter !== registry.adapter
    || key.registryAdapterVersion !== registry.adapterVersion
    || key.registryFingerprint !== registry.fingerprint) {
    return false
  }

  if ('kind' in snapshot) {
    if (origin.kind !== 'draft'
      || !hasExactKeys(origin, ['kind', 'baseEditVersion', 'draftId'])
      || !isNonNegativeSafeInteger(origin.baseEditVersion)
      || !isSafeText(origin.draftId)
      || origin.baseEditVersion !== snapshot.base.editVersion
      || origin.draftId !== snapshot.draftId
      || key.contentHash !== snapshot.draftHash) {
      return false
    }
  }
  else {
    if (origin.kind !== 'committed'
      || !hasExactKeys(origin, ['kind', 'editVersion'])
      || !isNonNegativeSafeInteger(origin.editVersion)
      || origin.editVersion !== snapshot.editVersion
      || key.contentHash !== snapshot.contentHash) {
      return false
    }
  }
  return true
}

function isScopePath(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 32
    && value.every(entry => isRecord(entry)
      && hasExactKeys(entry, ['scopeId', 'rowId'])
      && isSafeKey(entry.scopeId) && isSafeKey(entry.rowId))
    && new Set(value.map(entry => (entry as Record<string, unknown>).scopeId)).size === value.length
}

function isNodeAddress(value: unknown): value is PrototypeNodeAddressV1 {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['nodeId', 'scope'])
    && isSafeKey(value.nodeId) && isScopePath(value.scope)
}

export function isRuntimeHostFieldInstance(value: unknown): value is RuntimeHostFieldInstanceV7 {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['address', 'instanceKey', 'valuePath'])
    && isNodeAddress(value.address)
    && isSafeKey(value.instanceKey)
    && Array.isArray(value.valuePath)
    && value.valuePath.length > 0 && value.valuePath.length <= 65
    && value.valuePath.every(part => isSafeKey(part)
      || (typeof part === 'number' && Number.isSafeInteger(part) && part >= 0 && part < 10_000))
    && value.valuePath.filter(part => typeof part === 'number').length === value.address.scope.length
}

function isRuntimeHostFieldInstances(value: unknown): value is RuntimeHostFieldInstanceV7[] {
  return Array.isArray(value)
    && value.length <= 2048
    && value.every(isRuntimeHostFieldInstance)
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

function isProjection(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > 4096)
    return false
  const addresses = new Set<string>()
  return value.every((item) => {
    if (!isRecord(item) || !isJsonValue(item)
      || !hasExactKeys(item, ['address', 'states', 'properties'])
      || !isNodeAddress(item.address) || !isRecord(item.states) || !Array.isArray(item.properties)
      || Object.keys(item.states).some(key => !['visible', 'disabled', 'readonly', 'required'].includes(key))
      || Object.values(item.states).some(state => typeof state !== 'boolean')) {
      return false
    }
    const addressKey = JSON.stringify(item.address)
    if (addresses.has(addressKey))
      return false
    addresses.add(addressKey)
    return item.properties.every(property => isRecord(property) && isJsonValue(property)
      && hasExactKeys(property, ['path', 'value']) && Array.isArray(property.path)
      && property.path.length > 0 && property.path.every(isSafeKey))
  })
}

export function isRuntimeHostRuntimeState(value: unknown): value is RuntimeHostFormStateSnapshotV7 {
  if (!isRecord(value) || !isJsonValue(value)
    || !hasExactKeys(value, ['fields', 'touched', 'validation', 'values'])
    || !isJsonRecord(value.values) || !isRuntimeHostFieldInstances(value.fields)
    || !Array.isArray(value.touched) || !isRecord(value.validation)) {
    return false
  }
  const fields = value.fields
  const keys = new Set(fields.map(field => field.instanceKey))
  return keys.size === fields.length
    && new Set(fields.map(field => JSON.stringify(field.address))).size === fields.length
    && new Set(fields.map(field => JSON.stringify(field.valuePath))).size === fields.length
    && fields.every(field => hasValueContainer(value.values as Record<string, unknown>, field.valuePath))
    && new Set(value.touched).size === value.touched.length
    && value.touched.every(key => isSafeKey(key) && keys.has(key))
    && Object.entries(value.validation).every(([key, errors]) => keys.has(key)
      && Array.isArray(errors) && errors.length <= 128 && errors.every(isSafeText))
}

function isRuntimeHostRect(value: unknown): value is RuntimeHostRectPayload {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['bottom', 'height', 'left', 'right', 'top', 'width'])
    && isFiniteNumber(value.bottom) && isFiniteNumber(value.height)
    && isFiniteNumber(value.left) && isFiniteNumber(value.right)
    && isFiniteNumber(value.top) && isFiniteNumber(value.width)
    && value.height >= 0 && value.width >= 0
    && value.bottom >= value.top && value.right >= value.left
}

function isRuntimeHostGeometry(value: unknown): value is RuntimeHostGeometryPayload {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['nodes', 'surfaceRect', 'viewport'], ['layoutRect'])
    && isRuntimeHostRect(value.surfaceRect)
    && (value.layoutRect === undefined || isRuntimeHostRect(value.layoutRect))
    && isRecord(value.viewport) && hasExactKeys(value.viewport, ['height', 'width'])
    && isFiniteNumber(value.viewport.height) && isFiniteNumber(value.viewport.width)
    && value.viewport.height >= 0 && value.viewport.width >= 0
    && Array.isArray(value.nodes)
    && value.nodes.every((item) => {
      if (!isRecord(item) || !isJsonValue(item)
        || !hasExactKeys(item, ['depth', 'nodeId', 'order', 'path', 'rect'], ['slot'])) {
        return false
      }
      const depth = item.depth
      const order = item.order
      return isSafeText(item.nodeId) && typeof item.path === 'string'
        && Number.isSafeInteger(depth) && (depth as number) >= 0
        && Number.isSafeInteger(order) && (order as number) >= 0
        && (item.slot === undefined || isSafeText(item.slot))
        && isRuntimeHostRect(item.rect)
    })
}

function isPointer(value: unknown): value is RuntimeHostDesignPointerPayload {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['button', 'clientX', 'clientY', 'ctrlKey', 'metaKey', 'pointerId', 'shiftKey'], ['nodeId'])
    && isFiniteNumber(value.clientX) && isFiniteNumber(value.clientY)
    && Number.isSafeInteger(value.button) && Number.isSafeInteger(value.pointerId) && (value.pointerId as number) >= 0
    && typeof value.ctrlKey === 'boolean' && typeof value.metaKey === 'boolean'
    && typeof value.shiftKey === 'boolean'
    && (value.nodeId === undefined || isSafeText(value.nodeId))
}

function isTransition(
  value: unknown,
  context: PrototypeProjectContextV1 | undefined,
): value is PrototypeTransitionSnapshotV1 {
  if (!isRecord(value) || !isJsonValue(value) || !hasExactKeys(value, ['session', 'diagnostics']))
    return false
  if (!context)
    return false
  const session = readPrototypeSession(value.session, context)
  return session.success
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(item => isRecord(item) && isJsonValue(item)
      && hasExactKeys(item, ['code', 'message'], ['path', 'context'])
      && isSafeText(item.code) && isSafeText(item.message)
      && (item.path === undefined || (Array.isArray(item.path) && item.path.every(part => isSafeKey(part) || (typeof part === 'number' && Number.isSafeInteger(part)))))
      && (item.context === undefined || isJsonRecord(item.context)))
}

function isInstanceState(value: unknown): value is RuntimeHostInstanceStatePayloadV7 {
  return isRecord(value) && isJsonValue(value)
    && hasExactKeys(value, ['fields', 'touched', 'validation', 'values', 'surfaceId', 'stateRevision', 'projection'], ['focusedAddress'])
    && isRuntimeHostRuntimeState({
      fields: value.fields,
      touched: value.touched,
      validation: value.validation,
      values: value.values,
    })
    && isSafeText(value.surfaceId)
    && Number.isSafeInteger(value.stateRevision) && (value.stateRevision as number) >= 0
    && (value.focusedAddress === undefined || isNodeAddress(value.focusedAddress))
    && isProjection(value.projection)
}

function isParentDesignSync(value: Record<string, unknown>): boolean {
  if (!hasExactKeys(value, [...BASE_KEYS, 'type', 'surfaceId', 'payload'])
    || value.type !== 'design.sync' || !isSafeText(value.surfaceId)
    || !isRecord(value.payload) || !hasExactKeys(value.payload, [
    'adapter',
    'breakpoint',
    'compilation',
    'locale',
    'runtimeSessionKey',
    'runtimeState',
    'variant',
  ], ['candidateId', 'candidateUsesFallback', 'canvasWidth', 'namespace'])
  || !['antd-vue', 'element-plus'].includes(String(value.payload.adapter))
  || !['desktop', 'tablet', 'mobile'].includes(String(value.payload.breakpoint))
  || !['canvas', 'drag-visual'].includes(String(value.payload.variant))
  || !isSurfaceCompilation(value.payload.compilation)
  || value.payload.compilation.key.surfaceId !== value.surfaceId
  || !isSafeText(value.payload.locale) || !isSafeText(value.payload.runtimeSessionKey)
  || !isRuntimeHostRuntimeState(value.payload.runtimeState)) {
    return false
  }
  return (value.payload.candidateId === undefined || isSafeText(value.payload.candidateId))
    && (value.payload.candidateUsesFallback === undefined || typeof value.payload.candidateUsesFallback === 'boolean')
    && (value.payload.canvasWidth === undefined || (isFiniteNumber(value.payload.canvasWidth) && value.payload.canvasWidth >= 0))
    && (value.payload.namespace === undefined || isSafeText(value.payload.namespace))
}

export function isParentToRuntimeHostMessage(value: unknown): value is ParentToRuntimeHostMessageV7 {
  if (!hasMessageBase(value) || !isRecord(value))
    return false
  if (value.type === 'design.sync')
    return isParentDesignSync(value)
  if (value.type === 'design.state') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'surfaceId', 'payload'])
      && isSafeText(value.surfaceId) && isRuntimeHostRuntimeState(value.payload)
  }
  if (value.type === 'experience.sync') {
    if (!hasExactKeys(value, [...BASE_KEYS, 'type', 'sessionId', 'payload'])
      || !isSafeText(value.sessionId) || !isRecord(value.payload)) {
      return false
    }
    const payload = value.payload as Record<string, unknown>
    if (!hasExactKeys(payload, ['adapter', 'compilation', 'locale', 'session'], ['namespace'])
      || !['antd-vue', 'element-plus'].includes(String(payload.adapter))
      || !isProjectCompilation(payload.compilation)
      || !isSafeText(payload.locale)
      || (payload.namespace !== undefined && !isSafeText(payload.namespace))) {
      return false
    }
    const context = createPrototypeProjectContext(payload.compilation)
    if (!context.success)
      return false
    const session = readPrototypeSession(payload.session, context.data)
    return session.success
  }
  if (value.type === 'experience.command') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'sessionId', 'command'])
      && isSafeText(value.sessionId)
      && readPrototypeSessionCommand(value.command).success
  }
  return false
}

export function isRuntimeHostToParentMessage(
  value: unknown,
  context?: PrototypeProjectContextV1,
): value is RuntimeHostToParentMessageV7 {
  if (!hasMessageBase(value) || !isRecord(value))
    return false
  if (value.type === 'ready' || value.type === 'mounted') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'mode'])
      && (value.mode === 'design' || value.mode === 'experience')
  }
  if (value.type === 'design.geometry') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'surfaceId', 'payload'])
      && isSafeText(value.surfaceId) && isRuntimeHostGeometry(value.payload)
  }
  if (value.type === 'design.pointerDown' || value.type === 'design.pointerMove'
    || value.type === 'design.pointerUp' || value.type === 'design.pointerCancel'
    || value.type === 'design.contextMenu') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'surfaceId', 'payload'])
      && isSafeText(value.surfaceId) && isPointer(value.payload)
  }
  if (value.type === 'design.runtimeState') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'surfaceId', 'payload'])
      && isSafeText(value.surfaceId) && isRuntimeHostRuntimeState(value.payload)
  }
  if (value.type === 'experience.session') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'sessionId', 'transition'])
      && isSafeText(value.sessionId) && isTransition(value.transition, context)
  }
  if (value.type === 'experience.instanceState') {
    return hasExactKeys(value, [...BASE_KEYS, 'type', 'sessionId', 'instanceId', 'payload'])
      && isSafeText(value.sessionId) && isSafeText(value.instanceId)
      && isInstanceState(value.payload)
  }
  return value.type === 'error'
    && hasExactKeys(value, [...BASE_KEYS, 'type', 'code', 'message'])
    && isSafeText(value.code) && isSafeText(value.message)
}

export function acceptsRuntimeHostMessageEvent<T extends RuntimeHostMessageBaseV7>(
  event: MessageEvent<unknown>,
  options: RuntimeHostMessageEventOptionsV7<T>,
): T | undefined {
  if (event.source !== options.source || event.origin !== options.origin || !options.guard(event.data))
    return undefined
  const data = event.data
  if (options.hostId !== undefined && data.hostId !== options.hostId)
    return undefined
  if (options.projectId !== undefined && data.projectId !== options.projectId)
    return undefined
  if (options.revision !== undefined && data.revision !== options.revision)
    return undefined
  return data
}

// Explicit exports are useful to parent/child tests without exposing the
// implementation helpers above as a second protocol reader.
export { isProjectCompilation, isSurfaceCompilation }
