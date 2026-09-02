import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitResultEvent,
} from '../../session'
import type { RuntimeHostRuntimeStatePayload } from './protocol'

export interface PreviewRuntimeHostFrameProps {
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  locale: string
  namespace?: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
  title: string
}

export interface PreviewRuntimeHostFrameEmits {
  error: [error: Error]
  fieldChange: [payload: { field: string, values: Record<string, unknown> }]
  mounted: [event: PreviewRuntimeIdentity]
  ready: [event: PreviewRuntimeIdentity]
  runtimeEvent: [payload: { event: string, nodeId: string }]
  runtimeState: [event: PreviewRuntimeStateEvent]
  submit: [values: Record<string, unknown>]
  submitResult: [event: PreviewRuntimeSubmitResultEvent]
}
