import type { FieldConfig } from '@moluoxixi/config-form/plugins'

/**
 * shadcn-vue 字段组件的双向绑定协议。
 *
 * shadcn-vue 组件通常由业务项目生成到本地目录；插件只维护组件 key 到
 * ConfigForm 字段绑定协议的映射，不直接依赖任何生成组件路径。
 */
export type ShadcnVueFieldBinding = Required<Pick<FieldConfig, 'valueProp' | 'trigger'>> & Pick<FieldConfig, 'props'>

/** 当前插件内置支持的 shadcn-vue 字段组件绑定表。 */
export const SHADCN_VUE_FIELD_BINDINGS: Readonly<Record<string, ShadcnVueFieldBinding>> = Object.freeze({
  Input: { valueProp: 'modelValue', trigger: 'update:modelValue' },
  NativeSelect: { valueProp: 'modelValue', trigger: 'update:modelValue' },
  Textarea: { valueProp: 'modelValue', trigger: 'update:modelValue' },
})
