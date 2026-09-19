import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  PrototypeDiagnostic,
  PrototypeSessionV1,
  SurfaceInstanceId,
} from '@moluoxixi/config-form-prototype-runtime/session'
import type { Ref, ShallowRef } from 'vue'
import type {
  ExperienceRuntimeHostIdentityEvent,
  ExperienceRuntimeInstanceStateEvent,
  ExperienceRuntimeSessionEvent,
  RuntimeHostInstanceStatePayloadV7,
} from '../../runtime-host'

export type PreviewInstanceStateMap = Readonly<
  Record<SurfaceInstanceId, RuntimeHostInstanceStatePayloadV7>
>

export interface PreviewSessionAcceptInput {
  readonly compilation: ProjectCompilation
  readonly revision: string
  readonly session: PrototypeSessionV1
  readonly sessionId: string
}

export interface PreviewSession {
  readonly activeHost: ShallowRef<ExperienceRuntimeHostIdentityEvent | undefined>
  readonly compilation: ShallowRef<ProjectCompilation | undefined>
  readonly diagnostics: ShallowRef<readonly PrototypeDiagnostic[]>
  readonly error: ShallowRef<Error | undefined>
  readonly instanceStates: ShallowRef<PreviewInstanceStateMap>
  readonly mounted: Ref<boolean>
  readonly ready: Ref<boolean>
  readonly revision: ShallowRef<string>
  readonly session: ShallowRef<PrototypeSessionV1 | undefined>
  readonly sessionId: ShallowRef<string>
  accept: (input: PreviewSessionAcceptInput) => void
  clear: () => void
  dispose: () => void
  getInstanceState: (instanceId: SurfaceInstanceId) => RuntimeHostInstanceStatePayloadV7 | undefined
  handleInstanceState: (event: ExperienceRuntimeInstanceStateEvent) => void
  handleRuntimeError: (error: unknown) => void
  handleRuntimeMounted: (event: ExperienceRuntimeHostIdentityEvent) => void
  handleRuntimeReady: (event: ExperienceRuntimeHostIdentityEvent) => void
  handleSession: (event: ExperienceRuntimeSessionEvent) => void
}
