import type {
  ComponentRegistry,
  FormFieldDefaultConfig,
  FormNodeConfig,
  FormRuntimePlugin,
  ReadonlyAdapterRegistry,
} from '@moluoxixi/config-form/plugins'
import type { ShadcnVueFieldBinding } from './bindings'
import { ConfigFormError } from '@moluoxixi/config-form'
import { hasFieldBinding } from '@moluoxixi/config-form/plugins'
import { SHADCN_VUE_FIELD_BINDINGS } from './bindings'
import { SHADCN_VUE_READONLY_ADAPTERS } from './readonly'

/** shadcn-vue 插件配置。 */
export interface ShadcnVuePluginOptions {
  /** runtime 插件名称，默认 "shadcn-vue"。 */
  name?: string
  /** 调用方本地生成的 shadcn-vue 组件注册表，供字符串组件 key 解析使用。 */
  components?: ComponentRegistry
  /** 额外组件绑定或内置绑定覆盖项，key 必须与字段声明中的组件名一致。 */
  bindings?: Record<string, ShadcnVueFieldBinding>
  /** 额外只读适配器或内置适配器覆盖项，key 必须与字段声明中的组件名一致。 */
  readonlyAdapters?: ReadonlyAdapterRegistry
  /** 已注册组件缺少绑定映射时是否直接抛错，默认 true。 */
  strict?: boolean
}

/**
 * 创建 shadcn-vue 字段绑定适配插件。
 *
 * 插件只维护 ConfigForm runtime 协议，不导入 shadcn-vue 生成组件；
 * 使用字符串组件名时，调用方通过 `components` 注入本地生成的组件。
 */
export function createShadcnVuePlugin(config: ShadcnVuePluginOptions = {}): FormRuntimePlugin {
  const bindings: Record<string, ShadcnVueFieldBinding> = {
    ...SHADCN_VUE_FIELD_BINDINGS,
    ...(config.bindings ?? {}),
  }
  const readonlyAdapters: ReadonlyAdapterRegistry = {
    ...SHADCN_VUE_READONLY_ADAPTERS,
    ...(config.readonlyAdapters ?? {}),
  }
  const registeredComponentNames = new Set(Object.keys(config.components ?? {}))
  const strict = config.strict ?? true

  /** 根据字段组件名返回 shadcn-vue 绑定默认值；用户字段声明由 core 合并覆盖。 */
  function getDefaultField(node: FormNodeConfig): FormFieldDefaultConfig | void {
    if (!hasFieldBinding(node))
      return undefined

    const componentName = resolveComponentName(node.component)
    const binding = bindings[componentName]
    if (!binding) {
      if (strict && registeredComponentNames.has(componentName)) {
        throw new ConfigFormError(
          'CONFIG_FORM_SHADCN_VUE_UNKNOWN_BINDING',
          `Unknown shadcn-vue component binding: ${componentName}`,
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

  return {
    name: config.name ?? 'shadcn-vue',
    components: config.components,
    getDefaultField,
    readonlyAdapters,
  }
}

function resolveComponentName(component: FormNodeConfig['component']): string {
  return ((component as { name?: string }).name ?? component) as string
}

export { SHADCN_VUE_FIELD_BINDINGS } from './bindings'
export type { ShadcnVueFieldBinding } from './bindings'
export { SHADCN_VUE_READONLY_ADAPTERS } from './readonly'
