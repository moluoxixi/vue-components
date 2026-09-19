import type {
  DesignerLocaleOptions,
  DesignerRegistry,
} from '@moluoxixi/config-form-designer'
import type {
  ComponentContractRegistry,
  RegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import type { SourceProviderResolver } from '@moluoxixi/config-form-source/generator'
import type { VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'

export type WorkbenchAdapterId = 'antd-vue' | 'element-plus'

export interface WorkbenchAdapter {
  componentRegistry: ComponentContractRegistry
  designerRegistry: DesignerRegistry
  locale: DesignerLocaleOptions
  registrySnapshot: RegistryContractSnapshot
  runtimeResolver: VueRuntimeBindingResolver
  sourceProviderResolver: SourceProviderResolver
}

export interface WorkbenchRuntimeAdapter {
  runtimeResolver: VueRuntimeBindingResolver
}
