import type {
  DesignerLocaleOptions,
  DesignerMaterialModule,
  DesignerMaterialModuleRegistry,
} from '@moluoxixi/config-form-designer'
import { createDesignerMaterialModuleRegistry, DESIGNER_ZH_CN_MESSAGES } from '@moluoxixi/config-form-designer'

const materialModules = import.meta.glob<DesignerMaterialModule>(
  ['./*.ts', '!./index.ts', '!./registry.ts'],
  { eager: true, import: 'default' },
)

export const ANTD_VUE_DESIGNER_MATERIAL_REGISTRY: DesignerMaterialModuleRegistry
  = createDesignerMaterialModuleRegistry(materialModules)

export const ANTD_VUE_DESIGNER_MATERIALS
  = ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.materials

export const ANTD_VUE_DESIGNER_ZH_CN: DesignerLocaleOptions = {
  locale: 'zh-CN',
  messages: DESIGNER_ZH_CN_MESSAGES,
  materials: ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.locales,
}
