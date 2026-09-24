import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelJsonObject } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../adapters'

export interface IsolatedProjectPreview {
  adapter: WorkbenchAdapterId
  compilation: SurfaceCompilation
  namespace: string
  revision: string
  values: ModelJsonObject
}
