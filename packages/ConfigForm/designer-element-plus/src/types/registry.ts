import type {
  DesignerMaterialDefinition,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'
import type { ElementPlusOptionResolverContext } from './options'

export interface ElementPlusDesignerRegistryOptions {
  layers?: readonly DesignerRegistryLayer[]
  materials?: Iterable<DesignerMaterialDefinition>
  optionResolver?: ElementPlusOptionResolverContext
}
