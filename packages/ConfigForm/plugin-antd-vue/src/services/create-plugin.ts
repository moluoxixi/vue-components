import type {
  FormFieldDefaultConfig,
  FormNodeConfig,
  FormRuntimePlugin,
  ReadonlyAdapterRegistry,
} from '@moluoxixi/config-form/plugins'
import type { AntdVueFieldBinding, AntdVuePluginOptions } from '../types/index.js'
import { ConfigFormError } from '@moluoxixi/config-form'
import { hasFieldBinding } from '@moluoxixi/config-form/plugins'
import { ANTD_VUE_READONLY_ADAPTERS } from '../readonly/index.js'
import { ANTD_VUE_FIELD_BINDINGS } from '../registries/index.js'
import { isAntdVueLikeComponentName, resolveComponentName } from '../utils/index.js'

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
