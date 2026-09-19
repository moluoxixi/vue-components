import type {
  DesignerMaterialDefinition,
  DesignerRegistryLayer,
} from '@moluoxixi/config-form-designer'

export interface AntdVueDesignerRegistryOptions {
  layers?: readonly DesignerRegistryLayer[]
  materials?: Iterable<DesignerMaterialDefinition>
}
