import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigFormDataSourceHost,
  ConfigFormReactionProjection,
} from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type {
  PreviewRuntimeIdentity,
  PreviewRuntimeStateEvent,
  PreviewRuntimeSubmitEvent,
  PreviewRuntimeSubmitResultEvent,
} from '../../session'
import type { RuntimeHostFieldChangePayload, RuntimeHostRuntimeStatePayload } from './protocol'

export interface PreviewRuntimeFieldChangeEvent extends PreviewRuntimeIdentity, RuntimeHostFieldChangePayload {}

export interface PreviewRuntimeHostFrameProps {
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  dataSourceHost?: ConfigFormDataSourceHost
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
  fieldChange: [payload: PreviewRuntimeFieldChangeEvent]
  mounted: [event: PreviewRuntimeIdentity]
  ready: [event: PreviewRuntimeIdentity]
  runtimeState: [event: PreviewRuntimeStateEvent]
  submit: [event: PreviewRuntimeSubmitEvent]
  submitResult: [event: PreviewRuntimeSubmitResultEvent]
}
