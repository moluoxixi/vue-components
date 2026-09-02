import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RuntimeHostRuntimeStatePayload } from '../../runtime-host'

export interface IsolatedProjectPreview {
  adapter: WorkbenchAdapterId
  compilation: PageCompilation
  namespace: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
}
