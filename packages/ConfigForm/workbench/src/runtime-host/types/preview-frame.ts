import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PrototypeTransitionSnapshotV1,
  RuntimeHostExperienceSyncPayloadV7,
  RuntimeHostInstanceStatePayloadV7,
} from './protocol'

/** Parent-side props for the Experience Runtime Host iframe. */
export interface ExperienceRuntimeHostFrameProps {
  adapter: WorkbenchAdapterId
  compilation: ProjectCompilation
  locale: string
  namespace?: string
  revision: string
  session: RuntimeHostExperienceSyncPayloadV7['session']
  sessionId: string
  title: string
}

export interface ExperienceRuntimeHostFrameEmits {
  error: [error: Error]
  instanceState: [event: ExperienceRuntimeInstanceStateEvent]
  mounted: [event: ExperienceRuntimeHostIdentityEvent]
  ready: [event: ExperienceRuntimeHostIdentityEvent]
  session: [event: ExperienceRuntimeSessionEvent]
}

export interface ExperienceRuntimeHostIdentityEvent {
  hostId: string
  projectId: string
  revision: string
  sessionId: string
}

export interface ExperienceRuntimeSessionEvent extends ExperienceRuntimeHostIdentityEvent {
  transition: PrototypeTransitionSnapshotV1
}

export interface ExperienceRuntimeInstanceStateEvent extends ExperienceRuntimeHostIdentityEvent {
  instanceId: string
  payload: RuntimeHostInstanceStatePayloadV7
}

export type ExperienceRuntimeHostFrameCompilation = ProjectCompilation
