import type { ConfigFormField } from '@moluoxixi/config-form-core'
import type { Component } from 'vue'

/**
 * Ant Design Vue 字段组件的默认双向绑定协议。
 *
 * `antdConfigForm` 本身不接入 runtime 插件系统，但这里保留 UI adapter 的集中映射，
 * 让 Switch、Checkbox 这类 checked 协议组件不需要在每个字段上重复声明。
 */
export interface AntdConfigFormFieldBinding {
  trigger: string
  valueProp: string
}

const ANTD_CONFIG_FORM_FIELD_BINDINGS: Readonly<Record<string, AntdConfigFormFieldBinding>> = Object.freeze({
  ACheckbox: { valueProp: 'checked', trigger: 'update:checked' },
  ASwitch: { valueProp: 'checked', trigger: 'update:checked' },
})

function resolveComponentName(component: Component | string): string | undefined {
  if (typeof component === 'string')
    return component

  return (component as { name?: string }).name
}

/** 根据 Ant Design Vue 组件名读取字段默认绑定；未命中时继续使用 antdConfigForm 的 value/update:value 默认值。 */
export function resolveAntdConfigFormFieldBinding<TValues extends Record<string, unknown>>(
  field: ConfigFormField<TValues, Component | string>,
): AntdConfigFormFieldBinding | undefined {
  const componentName = resolveComponentName(field.component)

  return componentName ? ANTD_CONFIG_FORM_FIELD_BINDINGS[componentName] : undefined
}
