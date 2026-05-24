import type { ComponentRegistry, FormRuntime, FormRuntimeOptions, FormRuntimePlugin } from './types'
import FormLayout from '@/components/FormLayout'
import { ConfigFormError } from '@/errors'
import { createFieldPipeline } from './transform'

/** 内置组件注册表；用户 components 可以覆盖内置 key，插件不能覆盖用户 key。 */
const BUILT_IN_COMPONENTS: ComponentRegistry = {
  FormLayout,
}

/** 创建表单运行时实例，合并组件注册和字段生命周期插件。 */
export function createFormRuntime(runtimeConfig: FormRuntimeOptions = {}): FormRuntime {
  const plugins: FormRuntimePlugin[] = [...(runtimeConfig.plugins ?? [])]
  const components: ComponentRegistry = { ...BUILT_IN_COMPONENTS, ...(runtimeConfig.components ?? {}) }

  const seenPluginNames = new Set<string>()
  for (const plugin of plugins) {
    if (seenPluginNames.has(plugin.name)) {
      throw new ConfigFormError(
        'CONFIG_FORM_DUPLICATE_PLUGIN_NAME',
        `Duplicate plugin name: ${plugin.name}`,
        { pluginName: plugin.name },
      )
    }

    seenPluginNames.add(plugin.name)

    /** 运行时启动阶段先把插件组件并入注册表；这里专门拦截重复 key，避免后续解析时出现来源不明的覆盖关系。 */
    for (const [key, component] of Object.entries(plugin.components ?? {})) {
      if (Object.hasOwn(components, key)) {
        throw new ConfigFormError(
          'CONFIG_FORM_COMPONENT_KEY_CONFLICT',
          `Component key conflict: ${key}`,
          { componentKey: key, pluginName: plugin.name },
        )
      }
      components[key] = component
    }
  }

  const fieldPipeline = createFieldPipeline(components, plugins)

  return {
    getFieldDefaults: fieldPipeline.getFieldDefaults,
    transformField: fieldPipeline.transformField,
  }
}
