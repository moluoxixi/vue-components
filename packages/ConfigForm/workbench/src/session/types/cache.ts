import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { VueRuntimeCompileResult } from '@moluoxixi/config-form-vue-backend'

export interface PageRuntimeArtifactCache {
  clear: () => void
  resolve: (
    compilation: PageCompilation,
    compile: () => VueRuntimeCompileResult,
  ) => VueRuntimeCompileResult
}
