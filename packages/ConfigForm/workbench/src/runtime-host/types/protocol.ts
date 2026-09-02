import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'

export interface RuntimeHostMessageBase {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: typeof RUNTIME_HOST_PROTOCOL_VERSION
  hostId: string
  pageId: string
  projectId: string
  revision: string
  sequence: number
}

export interface RuntimeHostRuntimeStatePayload {
  touched: string[]
  validation: Record<string, string[]>
  values: Record<string, unknown>
}

export type RuntimeSubmitStatus = 'invalid' | 'success'

export interface RuntimeHostSubmitResultPayload extends RuntimeHostRuntimeStatePayload {
  status: RuntimeSubmitStatus
}

export interface RuntimeHostSyncMessage extends RuntimeHostMessageBase {
  type: 'sync'
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  design?: {
    breakpoint: 'desktop' | 'mobile' | 'tablet'
    candidateId?: string
    candidateUsesFallback?: boolean
    canvasWidth?: number
    variant: 'canvas' | 'drag-visual'
  }
  locale: string
  mode: 'design' | 'preview'
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
}

export interface RuntimeHostSubmitMessage extends RuntimeHostMessageBase {
  type: 'submit'
}

export interface RuntimeHostStateMessage extends RuntimeHostMessageBase {
  type: 'state'
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  runtimeState: RuntimeHostRuntimeStatePayload
}

export type ParentToRuntimeHostMessage
  = | RuntimeHostStateMessage
    | RuntimeHostSubmitMessage
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

export interface RuntimeHostMessageEventOptions<T extends RuntimeHostMessageBase> {
  guard: (value: unknown) => value is T
  hostId?: string
  origin: string
  pageId?: string
  projectId?: string
  revision?: string
  source: MessageEventSource | null
}
