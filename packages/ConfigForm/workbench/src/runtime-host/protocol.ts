import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../adapters'

export const RUNTIME_HOST_CHANNEL = 'mx-config-form-runtime-host'
export const RUNTIME_HOST_PROTOCOL_VERSION = 3

export interface RuntimeHostMessageBase {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: typeof RUNTIME_HOST_PROTOCOL_VERSION
  hostId: string
  projectId: string
  pageId: string
  sequence: number
  revision: string
}

export interface RuntimeHostRuntimeStatePayload {
  values: Record<string, unknown>
  touched: string[]
  validation: Record<string, string[]>
}

export type RuntimeSubmitStatus = 'success' | 'invalid'

export interface RuntimeHostSubmitResultPayload extends RuntimeHostRuntimeStatePayload {
  status: RuntimeSubmitStatus
}

export interface RuntimeHostSyncMessage extends RuntimeHostMessageBase {
  type: 'sync'
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  mode: 'design' | 'preview'
  design?: {
    breakpoint: 'desktop' | 'mobile' | 'tablet'
    candidateId?: string
    candidateUsesFallback?: boolean
    canvasWidth?: number
    variant: 'canvas' | 'drag-visual'
  }
  locale: string
  runtimeState: RuntimeHostRuntimeStatePayload
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  runtimeSessionKey: string
}

export interface RuntimeHostSubmitMessage extends RuntimeHostMessageBase {
  type: 'submit'
}

export interface RuntimeHostStateMessage extends RuntimeHostMessageBase {
  type: 'state'
  runtimeState: RuntimeHostRuntimeStatePayload
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
}

export type ParentToRuntimeHostMessage
  = | RuntimeHostSubmitMessage
    | RuntimeHostStateMessage
    | RuntimeHostSyncMessage

export interface RuntimeHostFieldChangePayload {
  field: string
  values: Record<string, unknown>
}

export interface RuntimeHostComponentEventPayload {
  event: string
  nodeId: string
}

export interface RuntimeHostRectPayload {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface RuntimeHostGeometryPayload {
  layoutRect?: RuntimeHostRectPayload
  nodes: Array<{
    depth: number
    nodeId: string
    order: number
    path: string
    rect: RuntimeHostRectPayload
    slot?: string
  }>
  surfaceRect: RuntimeHostRectPayload
  viewport: {
    height: number
    width: number
  }
}

export interface RuntimeHostDesignPointerPayload {
  button: number
  clientX: number
  clientY: number
  ctrlKey: boolean
  metaKey: boolean
  nodeId?: string
  pointerId: number
  shiftKey: boolean
}

export type RuntimeHostToParentPayload
  = | { type: 'ready' | 'mounted' }
    | { type: 'geometry', payload: RuntimeHostGeometryPayload }
    | { type: 'designPointerDown' | 'designPointerMove' | 'designPointerUp' | 'designPointerCancel', payload: RuntimeHostDesignPointerPayload }
    | { type: 'runtimeState', payload: RuntimeHostRuntimeStatePayload }
    | { type: 'submitResult', payload: RuntimeHostSubmitResultPayload }
    | { type: 'submit', values: Record<string, unknown> }
    | { type: 'fieldChange', payload: RuntimeHostFieldChangePayload }
    | { type: 'runtimeEvent', payload: RuntimeHostComponentEventPayload }
    | { type: 'error', code: string, message: string }

export type RuntimeHostToParentMessage = RuntimeHostMessageBase & RuntimeHostToParentPayload

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasMessageBase(value: unknown): value is RuntimeHostMessageBase & Record<string, unknown> {
  if (!isRecord(value))
    return false
  return value.channel === RUNTIME_HOST_CHANNEL
    && value.version === RUNTIME_HOST_PROTOCOL_VERSION
    && typeof value.hostId === 'string'
    && value.hostId.length > 0
    && typeof value.projectId === 'string'
    && value.projectId.length > 0
    && typeof value.pageId === 'string'
    && value.pageId.length > 0
    && Number.isSafeInteger(value.sequence)
    && Number(value.sequence) >= 0
    && typeof value.revision === 'string'
}

function isPageCompilation(value: unknown): value is PageCompilation {
  if (!isRecord(value) || !isRecord(value.snapshotIdentity) || !isRecord(value.key) || !isRecord(value.page))
    return false
  const pageId = value.page.id
  return typeof pageId === 'string'
    && pageId.length > 0
    && value.snapshotIdentity.pageId === pageId
    && value.key.pageId === pageId
    && typeof value.key.registryAdapter === 'string'
    && Array.isArray(value.page.rootIds)
    && isRecord(value.page.nodesById)
}

function isReactionProjection(value: unknown): value is ConfigFormReactionProjection<Record<string, unknown>> {
  return isRecord(value)
    && isRecord(value.values)
    && isRecord(value.props)
    && isRecord(value.states)
    && Array.isArray(value.validate)
    && value.validate.every(field => typeof field === 'string')
}

function isRuntimeState(value: unknown): value is RuntimeHostRuntimeStatePayload {
  return isRecord(value)
    && isRecord(value.values)
    && Array.isArray(value.touched)
    && value.touched.every(field => typeof field === 'string' && field.length > 0)
    && isRecord(value.validation)
    && Object.entries(value.validation).every(([field, errors]) => field.length > 0
      && Array.isArray(errors)
      && errors.every(error => typeof error === 'string'))
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
      && typeof node.nodeId === 'string'
      && node.nodeId.length > 0
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
  if (value.type === 'submit')
    return true
  if (value.type === 'state') {
    return isRuntimeState(value.runtimeState)
      && isReactionProjection(value.reactionProjection)
  }
  return value.type === 'sync'
    && (value.adapter === 'antd-vue' || value.adapter === 'element-plus')
    && isPageCompilation(value.compilation)
    && value.projectId === value.compilation.snapshotIdentity.projectId
    && value.pageId === value.compilation.snapshotIdentity.pageId
    && (value.mode === 'design' || value.mode === 'preview')
    && (value.mode === 'preview'
      ? value.design === undefined
      : isRecord(value.design)
        && (value.design.breakpoint === 'desktop' || value.design.breakpoint === 'tablet' || value.design.breakpoint === 'mobile')
        && (value.design.variant === 'canvas' || value.design.variant === 'drag-visual')
        && (value.design.candidateId === undefined || (typeof value.design.candidateId === 'string' && value.design.candidateId.length > 0))
        && (value.design.candidateUsesFallback === undefined || typeof value.design.candidateUsesFallback === 'boolean')
        && (value.design.canvasWidth === undefined || (isFiniteNumber(value.design.canvasWidth) && value.design.canvasWidth >= 0)))
      && typeof value.locale === 'string'
      && isRuntimeState(value.runtimeState)
      && (value.namespace === undefined || typeof value.namespace === 'string')
      && isReactionProjection(value.reactionProjection)
      && typeof value.runtimeSessionKey === 'string'
      && value.runtimeSessionKey.length > 0
}

export function isRuntimeHostToParentMessage(value: unknown): value is RuntimeHostToParentMessage {
  if (!hasMessageBase(value) || typeof value.type !== 'string')
    return false
  if (value.type === 'ready' || value.type === 'mounted')
    return true
  if (value.type === 'geometry')
    return isRecord(value.payload) && isRuntimeHostGeometry(value.payload)
  if (value.type === 'designPointerDown'
    || value.type === 'designPointerMove'
    || value.type === 'designPointerUp'
    || value.type === 'designPointerCancel') {
    return isRecord(value.payload)
      && isFiniteNumber(value.payload.clientX)
      && isFiniteNumber(value.payload.clientY)
      && Number.isSafeInteger(value.payload.button)
      && Number.isSafeInteger(value.payload.pointerId)
      && Number(value.payload.pointerId) >= 0
      && typeof value.payload.ctrlKey === 'boolean'
      && typeof value.payload.metaKey === 'boolean'
      && typeof value.payload.shiftKey === 'boolean'
      && (value.payload.nodeId === undefined || (typeof value.payload.nodeId === 'string' && value.payload.nodeId.length > 0))
  }
  if (value.type === 'runtimeState')
    return isRuntimeState(value.payload)
  if (value.type === 'submitResult') {
    return isRecord(value.payload)
      && (value.payload.status === 'success' || value.payload.status === 'invalid')
      && isRuntimeState(value.payload)
  }
  if (value.type === 'submit')
    return isRecord(value.values)
  if (value.type === 'fieldChange') {
    return isRecord(value.payload)
      && typeof value.payload.field === 'string'
      && isRecord(value.payload.values)
  }
  if (value.type === 'runtimeEvent') {
    return isRecord(value.payload)
      && typeof value.payload.nodeId === 'string'
      && value.payload.nodeId.length > 0
      && typeof value.payload.event === 'string'
      && value.payload.event.length > 0
  }
  return value.type === 'error'
    && typeof value.code === 'string'
    && typeof value.message === 'string'
}

export function acceptsRuntimeHostMessageEvent<T extends RuntimeHostMessageBase>(
  event: MessageEvent<unknown>,
  options: {
    guard: (value: unknown) => value is T
    hostId?: string
    origin: string
    pageId?: string
    projectId?: string
    revision?: string
    source: MessageEventSource | null
  },
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
