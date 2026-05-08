import type { FieldConfig, FormRuntimePlugin, NormalizedFieldConfig, NormalizedNodeConfig } from '@moluoxixi/config-form/plugins'

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
  /** 字段组件名形如 Ant Design Vue 组件但没有映射时是否直接抛错，默认 true。 */
  strict?: boolean
}

// ===== 深合并工具 =====

type PlainObject = Record<string, unknown>

function isPlainObject(val: unknown): val is PlainObject {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

/**
 * 深合并多个普通对象，后面的对象优先级更高。
 *
 * - 两端均为普通对象时递归合并
 * - 其他情况（原始值、数组、null 等）直接用后者值覆盖
 */
function deepMergeProps(...sources: Array<PlainObject | undefined>): PlainObject {
  const result: PlainObject = {}
  for (const source of sources) {
    if (!source)
      continue
    for (const key of Object.keys(source)) {
      const srcVal = source[key]
      const resVal = result[key]
      result[key] = isPlainObject(srcVal) && isPlainObject(resVal)
        ? deepMergeProps(resVal, srcVal)
        : srcVal
    }
  }
  return result
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
export function createAntdVuePlugin(options: AntdVuePluginOptions = {}): FormRuntimePlugin {
  const bindings: Record<string, AntdVueFieldBinding> = {
    ...ANTD_VUE_FIELD_BINDINGS,
    ...(options.bindings ?? {}),
  }
  const strict = options.strict ?? true

  const plugin: FormRuntimePlugin = {
    name: options.name ?? 'antd-vue',
    transformField: (node: NormalizedNodeConfig): NormalizedNodeConfig | void => {
      // 只处理有 field 绑定的节点（跳过纯容器）
      if (!('field' in node))
        return undefined

      const field = node as NormalizedFieldConfig
      const componentName = resolveComponentName(field.component)
      if (!componentName)
        return undefined

      const binding = bindings[componentName]
      if (!binding) {
        if (strict && isAntdVueLikeComponentName(componentName))
          throw new Error(`Unknown Ant Design Vue component binding: ${componentName}`)
        return undefined
      }

      // 深合并 binding.props（绑定表默认）与字段声明的 props（用户优先）
      const mergedProps = binding.props
        ? deepMergeProps(binding.props, field.props)
        : field.props

      const transformed: NormalizedFieldConfig = {
        ...field,
        trigger: binding.trigger,
        valueProp: binding.valueProp,
        props: mergedProps,
      }
      return transformed
    },
  }

  return plugin
}
