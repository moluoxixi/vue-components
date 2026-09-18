import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import type { RuntimeHostDataCancelMessage, RuntimeHostDataRequestMessage, RuntimeHostDataResultMessage } from './data-rpc'

export interface RuntimeHostIdentity {
  hostId: string
  pageId: string
  projectId: string
  revision: string
}

export interface RuntimeHostMessageBase extends RuntimeHostIdentity {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: typeof RUNTIME_HOST_PROTOCOL_VERSION
  sequence: number
}

export interface RuntimeHostFieldInstance {
  nodeId: string
  scope: Array<{ scopeId: string, rowId: string }>
  instanceKey: string
  valuePath: Array<string | number>
}

export interface RuntimeHostRuntimeStatePayload {
  /** Captured only from Renderer.listFieldInstances(). Keys are opaque. */
  fields: RuntimeHostFieldInstance[]
  touched: string[]
  validation: Record<string, string[]>
  values: Record<string, unknown>
}

export type RuntimeSubmitStatus = 'blocked' | 'failure' | 'invalid' | 'success'

export interface RuntimeHostSubmitResultPayload extends RuntimeHostRuntimeStatePayload {
  status: RuntimeSubmitStatus
  requestId: string
}

export interface RuntimeHostSyncMessage extends RuntimeHostMessageBase {
  type: 'sync'
  adapter: WorkbenchAdapterId
  /** Only advertises an explicit parent request capability; never carries a function. */
  dataSourceRequest?: boolean
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
  requestId: string
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
    | RuntimeHostDataResultMessage

export interface RuntimeHostFieldChangePayload extends RuntimeHostFieldInstance {
  field: string
  values: Record<string, unknown>
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
    | { type: 'designPointerDown' | 'designPointerMove' | 'designPointerUp' | 'designPointerCancel' | 'designContextMenu', payload: RuntimeHostDesignPointerPayload }
    | { type: 'runtimeState', payload: RuntimeHostRuntimeStatePayload }
    | { type: 'submitResult', payload: RuntimeHostSubmitResultPayload }
    | { type: 'submit', requestId: string, values: Record<string, unknown> }
    | { type: 'fieldChange', payload: RuntimeHostFieldChangePayload }
    | RuntimeHostDataRequestMessage
    | RuntimeHostDataCancelMessage
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
