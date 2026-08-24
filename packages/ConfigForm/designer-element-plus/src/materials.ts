import type {
  DesignerLocaleOptions,
  DesignerMaterialModule,
  DesignerMaterialModuleRegistry,
} from '@moluoxixi/config-form-designer'
import { createDesignerMaterialModuleRegistry } from '@moluoxixi/config-form-designer'
import { ELEMENT_PLUS_DESIGNER_ZH_CN_MESSAGES } from './locale-messages'

const materialModules = import.meta.glob<DesignerMaterialModule>(
  './materials/*.ts',
  { eager: true, import: 'default' },
)

export const ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY: DesignerMaterialModuleRegistry
  = createDesignerMaterialModuleRegistry(materialModules)

export const ELEMENT_PLUS_DESIGNER_MATERIALS
  = ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.materials

export const ELEMENT_PLUS_DESIGNER_ZH_CN: DesignerLocaleOptions = {
  locale: 'zh-CN',
  messages: ELEMENT_PLUS_DESIGNER_ZH_CN_MESSAGES,
  materials: ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.locales,
}
