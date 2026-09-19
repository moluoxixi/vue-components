import type {
  ProjectCompilation,
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  ModelJsonObject,
  ProjectId,
  SurfaceId,
} from '@moluoxixi/config-form-model'
import type {
  PrototypeDiagnostic,
  PrototypeInstanceProjectionV1,
  PrototypeNodeAddressV1,
  PrototypeSessionCommand,
  PrototypeSessionV1,
  SurfaceInstanceId,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'

/** Stable identity shared by both directions of a Runtime Host connection. */
export interface RuntimeHostIdentityV7 {
  hostId: string
  projectId: ProjectId
  revision: string
}

export interface RuntimeHostMessageBaseV7 extends RuntimeHostIdentityV7 {
  channel: typeof RUNTIME_HOST_CHANNEL
  version: typeof RUNTIME_HOST_PROTOCOL_VERSION
  sequence: number
}

export interface RuntimeHostFieldInstanceV7 {
  address: PrototypeNodeAddressV1
  instanceKey: string
  valuePath: readonly (string | number)[]
}

export interface RuntimeHostFormStateSnapshotV7 {
  fields: readonly RuntimeHostFieldInstanceV7[]
  touched: readonly string[]
  validation: Readonly<Record<string, readonly string[]>>
  values: ModelJsonObject
}

export interface RuntimeHostDesignSyncPayloadV7 {
  adapter: WorkbenchAdapterId
  breakpoint: 'desktop' | 'tablet' | 'mobile'
  candidateId?: string
  candidateUsesFallback?: boolean
  canvasWidth?: number
  compilation: SurfaceCompilation
  locale: string
  namespace?: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostFormStateSnapshotV7
  variant: 'canvas' | 'drag-visual'
}

export interface RuntimeHostExperienceSyncPayloadV7 {
  adapter: WorkbenchAdapterId
  compilation: ProjectCompilation
  locale: string
  namespace?: string
  session: PrototypeSessionV1
}

export interface RuntimeHostInstanceStatePayloadV7 extends RuntimeHostFormStateSnapshotV7 {
  surfaceId: SurfaceId
  stateRevision: number
  focusedAddress?: PrototypeNodeAddressV1
  projection: PrototypeInstanceProjectionV1
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
  nodes: readonly {
    depth: number
    nodeId: string
    order: number
    path: string
    rect: RuntimeHostRectPayload
    slot?: string
  }[]
  surfaceRect: RuntimeHostRectPayload
  viewport: { height: number, width: number }
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

export type ParentToRuntimeHostMessageV7 = RuntimeHostMessageBaseV7 & (
  | {
    type: 'design.sync'
    surfaceId: SurfaceId
    payload: RuntimeHostDesignSyncPayloadV7
  }
  | {
    type: 'design.state'
    surfaceId: SurfaceId
    payload: RuntimeHostFormStateSnapshotV7
  }
  | {
    type: 'experience.sync'
    sessionId: string
    payload: RuntimeHostExperienceSyncPayloadV7
  }
  | {
    type: 'experience.command'
    sessionId: string
    command: PrototypeSessionCommand
  }
)

export interface PrototypeTransitionSnapshotV1 {
  session: PrototypeSessionV1
  diagnostics: readonly PrototypeDiagnostic[]
}

export type RuntimeHostToParentMessageV7 = RuntimeHostMessageBaseV7 & (
  | { type: 'ready' | 'mounted', mode: 'design' | 'experience' }
  | {
    type: 'design.geometry'
    surfaceId: SurfaceId
    payload: RuntimeHostGeometryPayload
  }
  | {
    type: 'design.pointerDown' | 'design.pointerMove' | 'design.pointerUp' | 'design.pointerCancel' | 'design.contextMenu'
    surfaceId: SurfaceId
    payload: RuntimeHostDesignPointerPayload
  }
  | {
    type: 'design.runtimeState'
    surfaceId: SurfaceId
    payload: RuntimeHostFormStateSnapshotV7
  }
  | {
    type: 'experience.session'
    sessionId: string
    transition: PrototypeTransitionSnapshotV1
  }
  | {
    type: 'experience.instanceState'
    sessionId: string
    instanceId: SurfaceInstanceId
    payload: RuntimeHostInstanceStatePayloadV7
  }
  | { type: 'error', code: string, message: string }
)

export interface RuntimeHostMessageEventOptionsV7<T extends RuntimeHostMessageBaseV7> {
  guard: (value: unknown) => value is T
  hostId?: string
  origin: string
  projectId?: ProjectId
  revision?: string
  source: MessageEventSource | null
}

/** Payload helper used by parent/child writers after the base is injected. */
export type RuntimeHostPayloadV7<T> = T extends RuntimeHostMessageBaseV7
  ? Omit<T, keyof RuntimeHostMessageBaseV7>
  : never
