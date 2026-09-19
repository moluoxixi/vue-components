import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'

export interface SurfaceRuntimeArtifactCache {
  clear: () => void
  resolve: (
    compilation: SurfaceCompilation,
    compile: () => VueRuntimeCompileResult,
  ) => VueRuntimeCompileResult
}
