import type {
  DesignerLocaleOptions,
  DesignerMaterialModule,
  DesignerMaterialModuleRegistry,
} from '@moluoxixi/config-form-designer'
import {
  createDesignerMaterialModuleRegistry,
  DESIGNER_ZH_CN_MESSAGES,
} from '@moluoxixi/config-form-designer'

const materialModules = import.meta.glob<DesignerMaterialModule>(
  ['./*.ts', '!./index.ts', '!./registry.ts', '!./shared.ts'],
  { eager: true, import: 'default' },
)

export const ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY: DesignerMaterialModuleRegistry
  = createDesignerMaterialModuleRegistry(materialModules)

export const ELEMENT_PLUS_DESIGNER_MATERIALS
  = ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.materials

export const ELEMENT_PLUS_DESIGNER_ZH_CN: DesignerLocaleOptions = {
  locale: 'zh-CN',
  messages: DESIGNER_ZH_CN_MESSAGES,
  materials: ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.locales,
}
