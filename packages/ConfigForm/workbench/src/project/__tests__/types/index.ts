import type { PageCompilation, ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectDocument, ProjectSnapshot } from '@moluoxixi/config-form-model'
import type { VueRuntimeArtifact, VueRuntimeBindingResolver, VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../../adapters'
import type { CanonicalConfigExport, CanonicalProjectSourceExport } from '../../export'

/** 业务场景套件覆盖的页面集合。 */
export type BusinessScenario = 'profile' | 'order' | 'submission'

/** `createBusinessScenariosFixture` 的完整产物面。 */
export interface BusinessScenariosFixture {
  provider: WorkbenchAdapterId
  adapter: WorkbenchAdapter
  document: ProjectDocument
  originalSnapshot: ProjectSnapshot
  persistedJSON: string
  snapshot: ProjectSnapshot
  compilation: ProjectCompilation
  runtimeResolver: VueRuntimeBindingResolver
  /** 以页为单位直接编译运行时（Direct 路径）。 */
  direct: (pageId: BusinessScenario) => VueRuntimeArtifact
  exportConfig: () => CanonicalConfigExport
  exportSource: () => CanonicalProjectSourceExport
}

/** `compileDataFixture` 的产物面：数据源/Flow 联动的最小可编译工程。 */
export interface DataRuntimeFixture {
  compilation: PageCompilation
  runtime: VueRuntimeCompileSuccess
  resolver: VueRuntimeBindingResolver
  exportSource: () => CanonicalProjectSourceExport
}
