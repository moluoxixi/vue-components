import type {
  FormFieldDefaultConfig,
  FormNodeConfig,
  FormRuntimePlugin,
  ReadonlyAdapterRegistry,
} from '@moluoxixi/config-form/plugins'
import { ConfigFormError } from '@moluoxixi/config-form'
import { hasFieldBinding } from '@moluoxixi/config-form/plugins'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { SHADCN_VUE_READONLY_ADAPTERS } from './readonly'

export interface ShadcnVuePluginOptions {
  /** runtime 插件名称，默认 "shadcn-vue"。 */
  name?: string
  /** 额外只读适配器或内置适配器覆盖项。 */
  readonlyAdapters?: ReadonlyAdapterRegistry
  /** 字段组件名形如 shadcn-vue 组件但没有映射时是否直接抛错，默认 true。 */
  strict?: boolean
}

const SHADCN_VUE_COMPONENTS = {
  Input,
  NativeSelect,
  Textarea,
}

const SHADCN_VUE_FIELD_DEFAULTS = Object.freeze({
  Input: { valueProp: 'modelValue', trigger: 'update:modelValue' },
  NativeSelect: { valueProp: 'modelValue', trigger: 'update:modelValue' },
  Textarea: { valueProp: 'modelValue', trigger: 'update:modelValue' },
} satisfies Readonly<Record<string, FormFieldDefaultConfig>>)

type ShadcnVueFieldComponentName = keyof typeof SHADCN_VUE_FIELD_DEFAULTS

/**
 * 创建 shadcn-vue playground 字段绑定适配插件。
 *
 * 插件只注册本示例用到的 shadcn-vue 本地组件，并补齐它们的 v-model 绑定协议。
 */
export function createShadcnVuePlugin(config: ShadcnVuePluginOptions = {}): FormRuntimePlugin {
  const strict = config.strict ?? true
  const readonlyAdapters: ReadonlyAdapterRegistry = {
    ...SHADCN_VUE_READONLY_ADAPTERS,
    ...(config.readonlyAdapters ?? {}),
  }

  function getDefaultField(node: FormNodeConfig): FormFieldDefaultConfig | void {
    if (!hasFieldBinding(node))
      return undefined

    const componentName = typeof node.component === 'string' ? node.component : undefined
    if (!componentName)
      return undefined

    const defaults = isShadcnVueFieldComponentName(componentName)
      ? SHADCN_VUE_FIELD_DEFAULTS[componentName]
      : undefined
    if (!defaults) {
      if (strict && isShadcnVueLikeComponentName(componentName)) {
        throw new ConfigFormError(
          'CONFIG_FORM_SHADCN_VUE_UNKNOWN_BINDING',
          `Unknown shadcn-vue component binding: ${componentName}`,
          { componentName },
        )
      }
      return undefined
    }

    return defaults
  }

  return {
    name: config.name ?? 'shadcn-vue',
    components: SHADCN_VUE_COMPONENTS,
    getDefaultField,
    readonlyAdapters,
  }
}

function isShadcnVueLikeComponentName(name: string): boolean {
  return Object.hasOwn(SHADCN_VUE_COMPONENTS, name)
}

function isShadcnVueFieldComponentName(name: string): name is ShadcnVueFieldComponentName {
  return Object.hasOwn(SHADCN_VUE_FIELD_DEFAULTS, name)
}
