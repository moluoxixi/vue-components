import type { ComponentRegistry, FormRuntime, FormRuntimeOptions, FormRuntimePlugin } from './types'
import FormLayout from '@/components/FormLayout'
import { createTransform } from './transform'

/** 内置组件注册表；用户 components 可以覆盖内置 key，插件不能覆盖用户 key。 */
const BUILT_IN_COMPONENTS: ComponentRegistry = {
  FormLayout,
}

/** 创建表单运行时实例，合并组件注册和字段转换插件。 */
export function createFormRuntime(options: FormRuntimeOptions = {}): FormRuntime {
  const plugins: FormRuntimePlugin[] = [...(options.plugins ?? [])]
  const components: ComponentRegistry = { ...BUILT_IN_COMPONENTS, ...(options.components ?? {}) }

  const seenPluginNames = new Set<string>()
  for (const plugin of plugins) {
    if (seenPluginNames.has(plugin.name))
      throw new Error(`Duplicate plugin name: ${plugin.name}`)

    seenPluginNames.add(plugin.name)

    for (const [key, component] of Object.entries(plugin.components ?? {})) {
      if (Object.hasOwn(components, key))
        throw new Error(`Component key conflict: ${key}`)
      components[key] = component
    }
  }

  const transform = createTransform(components, plugins)

  return {
    resolveField: transform.resolveField,
    transformField: transform.transformField,
    transformFields: transform.transformFields,
  }
}
