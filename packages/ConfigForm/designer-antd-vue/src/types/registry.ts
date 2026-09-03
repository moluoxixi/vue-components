import type {
  DesignerMaterialDefinition,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { AntdVueOptionResolverContext } from './options'

export interface AntdVueDesignerRegistryOptions {
  layers?: readonly DesignerRegistryLayer[]
  materials?: Iterable<DesignerMaterialDefinition>
  optionResolver?: AntdVueOptionResolverContext
}
