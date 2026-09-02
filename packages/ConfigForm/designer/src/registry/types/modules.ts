import type {
  ConfigFormNamedModule,
  ConfigFormNamedModuleMap,
  ConfigFormNamedModuleRegistry,
} from '@moluoxixi/config-form-core'
import type { DesignerMaterialLocale } from '../../locale'
import type {
  DesignerMaterialCapabilityRegistry,
  DesignerMaterialDefinition,
} from './domain'

export interface DesignerMaterialModuleValue {
  material: DesignerMaterialDefinition
  locale?: DesignerMaterialLocale
}

export type DesignerMaterialModule = ConfigFormNamedModule<DesignerMaterialModuleValue>
export type DesignerMaterialModuleMap = ConfigFormNamedModuleMap<DesignerMaterialModuleValue>

export interface DesignerMaterialModuleRegistry extends DesignerMaterialCapabilityRegistry {
  modules: ConfigFormNamedModuleRegistry<DesignerMaterialModuleValue>
  materials: DesignerMaterialDefinition[]
  locales: Record<string, DesignerMaterialLocale>
}
