import type {
  DesignerMaterialDefinition,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'

export interface ElementPlusDesignerRegistryOptions {
  layers?: readonly DesignerRegistryLayer[]
  materials?: Iterable<DesignerMaterialDefinition>
}
