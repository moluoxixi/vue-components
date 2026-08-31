import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../adapters'

export const RUNTIME_HOST_CHANNEL = 'mx-config-form-runtime-host'
export const RUNTIME_HOST_PROTOCOL_VERSION = 1

export interface RuntimeHostMessageBase {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: typeof RUNTIME_HOST_PROTOCOL_VERSION
  sessionId: string
  sequence: number
  revision: string
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
  modelValue: Record<string, unknown>
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  runtimeSessionKey: string
}

export interface RuntimeHostSubmitMessage extends RuntimeHostMessageBase {
  type: 'submit'
}

export interface RuntimeHostStateMessage extends RuntimeHostMessageBase {
  type: 'state'
  modelValue: Record<string, unknown>
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
    | { type: 'modelValue', value: Record<string, unknown> }
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
    && typeof value.sessionId === 'string'
    && value.sessionId.length > 0
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
    return isRecord(value.modelValue)
      && isReactionProjection(value.reactionProjection)
  }
  return value.type === 'sync'
    && (value.adapter === 'antd-vue' || value.adapter === 'element-plus')
    && isPageCompilation(value.compilation)
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
      && isRecord(value.modelValue)
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
  if (value.type === 'modelValue')
    return isRecord(value.value)
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
    origin: string
    sessionId?: string
    source: MessageEventSource | null
  },
): T | undefined {
  if (event.source !== options.source || event.origin !== options.origin || !options.guard(event.data))
    return undefined
  if (options.sessionId !== undefined && event.data.sessionId !== options.sessionId)
    return undefined
  return event.data
}
