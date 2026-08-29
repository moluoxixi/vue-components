import type {
  DesignerLocaleOptions,
  DesignerMaterialModule,
  DesignerMaterialModuleRegistry,
} from '@moluoxixi/config-form-designer'
import { createDesignerMaterialModuleRegistry, DESIGNER_ZH_CN_MESSAGES } from '@moluoxixi/config-form-designer'

const materialModules = import.meta.glob<DesignerMaterialModule>(
  './materials/*.ts',
  { eager: true, import: 'default' },
)

export const ANTD_VUE_DESIGNER_MATERIAL_REGISTRY: DesignerMaterialModuleRegistry
  = createDesignerMaterialModuleRegistry(materialModules)

export const ANTD_VUE_DESIGNER_MATERIALS
  = ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.materials

export const ANTD_VUE_DESIGNER_ZH_CN: DesignerLocaleOptions = {
  locale: 'zh-CN',
  messages: {
    ...DESIGNER_ZH_CN_MESSAGES,
    'property.reactions': '联动',
    'reaction.id': '联动标识',
    'reaction.enabled': '启用联动',
    'reaction.remove': '删除联动',
    'reaction.then': '满足条件时',
    'reaction.else': '否则',
    'reaction.effect': '联动效果',
    'reaction.target': '目标字段',
    'reaction.removeEffect': '删除效果',
    'reaction.valueSource': '值来源',
    'reaction.literal': '固定值',
    'reaction.fieldValue': '字段值',
    'reaction.sourceField': '来源字段',
    'reaction.literalType': '固定值类型',
    'reaction.complexValue': '保留结构化值',
    'reaction.propName': '属性名',
    'reaction.removeProp': '删除属性',
    'reaction.addProp': '添加属性',
    'reaction.addEffect': '添加效果',
    'reaction.add': '添加联动',
    'reaction.effect.clearValue': '清空值',
    'reaction.effect.setProps': '设置组件属性',
    'reaction.effect.setState': '设置字段状态',
    'reaction.effect.setValue': '设置值',
    'reaction.effect.validate': '触发校验',
  },
  materials: ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.locales,
}
