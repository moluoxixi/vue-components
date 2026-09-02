import type {
  DesignerLocaleOptions,
  DesignerRegistry,
} from '@moluoxixi/config-form-designer'
import type {
  ComponentContractRegistry,
  RegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeBindingResolver } from '@moluoxixi/config-form-vue-backend'
import type { CanonicalSourceBindingResolver } from '../../project/export'

export type WorkbenchAdapterId = 'antd-vue' | 'element-plus'

export interface WorkbenchAdapter {
  componentRegistry: ComponentContractRegistry
  designerRegistry: DesignerRegistry
  locale: DesignerLocaleOptions
  registrySnapshot: RegistryContractSnapshot
  runtimeResolver: VueRuntimeBindingResolver
  sourceResolver: CanonicalSourceBindingResolver
}

export interface WorkbenchRuntimeAdapter {
  runtimeResolver: VueRuntimeBindingResolver
}
