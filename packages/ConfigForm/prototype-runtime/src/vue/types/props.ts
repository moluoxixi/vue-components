import type {
  PrototypeProjectContextV1,
  PrototypeSessionV1,
  SurfaceInstanceId,
} from '../../session/types'
import type {
  PrototypeVueInstanceIdFactory,
  PrototypeVueRowIdFactory,
  PrototypeVueRuntimeSnapshotFactory,
  PrototypeVueSurfaceArtifact,
} from './contracts'

export interface PrototypeSurfaceHostProps {
  context: PrototypeProjectContextV1
  artifactsBySurfaceId: Readonly<Record<string, PrototypeVueSurfaceArtifact>>
  homeInstanceId?: SurfaceInstanceId
  session?: PrototypeSessionV1
  teleportTo?: string | HTMLElement | false
  createInstanceId?: PrototypeVueInstanceIdFactory
  createRowId?: PrototypeVueRowIdFactory
  createRuntimeSnapshot?: PrototypeVueRuntimeSnapshotFactory
}
