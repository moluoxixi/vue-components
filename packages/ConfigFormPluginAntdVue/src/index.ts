import type {
  FieldConfig,
  FormFieldDefaultConfig,
  FormNodeConfig,
  FormRuntimePlugin,
  ReadonlyAdapterRegistry,
} from '@moluoxixi/config-form/plugins'
import { ConfigFormError } from '@moluoxixi/config-form'
import { hasFieldBinding } from '@moluoxixi/config-form/plugins'
import { ANTD_VUE_READONLY_ADAPTERS } from './readonly'

/**
 * Ant Design Vue 字段组件的双向绑定协议。
 *
 * 直接复用 `FieldConfig` 中的同名字段：`valueProp`、`trigger` 必填，`props` 可选，
 * 语义与 `defineField` 参数保持一致。
 */
export type AntdVueFieldBinding = Required<Pick<FieldConfig, 'valueProp' | 'trigger'>> & Pick<FieldConfig, 'props'>

/** Ant Design Vue 插件配置。 */
export interface AntdVuePluginOptions {
  /** runtime 插件名称，默认 "antd-vue"。 */
  name?: string
  /** 额外组件绑定或内置绑定覆盖项，key 必须是 Ant Design Vue 组件 name。 */
  bindings?: Record<string, AntdVueFieldBinding>
  /** 额外只读适配器或内置适配器覆盖项，key 必须是 Ant Design Vue 组件 name。 */
  readonlyAdapters?: ReadonlyAdapterRegistry
  /** 字段组件名形如 Ant Design Vue 组件但没有映射时是否直接抛错，默认 true。 */
  strict?: boolean
}

/** 当前插件内置支持的 Ant Design Vue 字段组件绑定表。 */
export const ANTD_VUE_FIELD_BINDINGS: Readonly<Record<string, AntdVueFieldBinding>> = Object.freeze({
  AAutoComplete: { valueProp: 'value', trigger: 'update:value' },
  ACascader: { valueProp: 'value', trigger: 'update:value' },
  ACheckbox: { valueProp: 'checked', trigger: 'update:checked' },
  ACheckboxGroup: { valueProp: 'value', trigger: 'update:value' },
  ADatePicker: { valueProp: 'value', trigger: 'update:value' },
  AInput: { valueProp: 'value', trigger: 'update:value' },
  AInputNumber: { valueProp: 'value', trigger: 'update:value' },
  AInputPassword: { valueProp: 'value', trigger: 'update:value' },
  AInputSearch: { valueProp: 'value', trigger: 'update:value' },
  ARangePicker: { valueProp: 'value', trigger: 'update:value' },
  ARate: { valueProp: 'value', trigger: 'update:value' },
  ARadioGroup: { valueProp: 'value', trigger: 'update:value' },
  ASelect: { valueProp: 'value', trigger: 'update:value' },
  ASlider: { valueProp: 'value', trigger: 'update:value' },
  ASwitch: {
    valueProp: 'checked',
    trigger: 'update:checked',
    props: { style: { width: '44px' } },
  },
  ATextarea: { valueProp: 'value', trigger: 'update:value' },
  ATimePicker: { valueProp: 'value', trigger: 'update:value' },
  ATimeRangePicker: { valueProp: 'value', trigger: 'update:value' },
  ATreeSelect: { valueProp: 'value', trigger: 'update:value' },
})

/**
 * 读取组件的名称。
 *
 * - 字符串组件直接返回
 * - 对象/函数组件统一读 `.name`：对象组件应显式声明 `name`，
 *   函数组件的 `.name` 由 JS 引擎根据函数声明或变量赋值自动注入，无需调用
 */
function resolveComponentName(component: FieldConfig['component']): string | undefined {
  if (typeof component === 'string')
    return component

  if (!component)
    return undefined

  const name = (component as { name?: unknown }).name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

/**
 * 判断组件名是否像 Ant Design Vue 组件名。
 *
 * 该判断仅用于 strict 诊断，不参与默认适配，避免误伤自定义组件。
 */
function isAntdVueLikeComponentName(name: string): boolean {
  return /^A[A-Z]/.test(name)
}

/**
 * 创建 Ant Design Vue 字段绑定适配插件。
 *
 * 插件提供 Ant Design Vue 绑定默认值；用户在字段上显式声明的同名配置由 core 保持最高优先级。
 *
 * 若绑定项中声明了 `props`，则以深合并方式注入到字段 props 中，
 * 用户在字段配置中声明的同名 props 具有更高优先级。
 */
export function createAntdVuePlugin(config: AntdVuePluginOptions = {}): FormRuntimePlugin {
  const bindings: Record<string, AntdVueFieldBinding> = {
    ...ANTD_VUE_FIELD_BINDINGS,
    ...(config.bindings ?? {}),
  }
  const readonlyAdapters: ReadonlyAdapterRegistry = {
    ...ANTD_VUE_READONLY_ADAPTERS,
    ...(config.readonlyAdapters ?? {}),
  }
  const strict = config.strict ?? true

  /** 根据字段组件名返回 Ant Design Vue 绑定默认值；用户字段声明由 core 合并覆盖。 */
  function getDefaultField(node: FormNodeConfig): FormFieldDefaultConfig | void {
    if (!hasFieldBinding(node))
      return undefined

    const componentName = resolveComponentName(node.component)
    if (!componentName)
      return undefined

    const binding = bindings[componentName]
    if (!binding) {
      if (strict && isAntdVueLikeComponentName(componentName)) {
        throw new ConfigFormError(
          'CONFIG_FORM_ANTD_VUE_UNKNOWN_BINDING',
          `Unknown Ant Design Vue component binding: ${componentName}`,
          { componentName },
        )
      }
      return undefined
    }

    return {
      ...(binding.props ? { props: binding.props } : {}),
      trigger: binding.trigger,
      valueProp: binding.valueProp,
    }
  }

  const plugin: FormRuntimePlugin = {
    name: config.name ?? 'antd-vue',
    getDefaultField,
    readonlyAdapters,
  }

  return plugin
}

export { ANTD_VUE_READONLY_ADAPTERS } from './readonly'
