import type {
  DefinedFormNodeConfig,
  FieldConfig,
  FormNodeConfig,
  NormalizedNodeConfig,
} from '@/types'

/** 运行时可按字符串 key 解析的组件注册表。 */
export type ComponentRegistry = Record<string, FieldConfig['component']>

/** 字段转换 hook：接收已补齐默认值的节点，返回转换后的节点或 undefined。 */
export type FormFieldTransform = (
  field: NormalizedNodeConfig,
) => DefinedFormNodeConfig | NormalizedNodeConfig | void

/** runtime 插件：用于注册组件或转换字段声明。 */
export interface FormRuntimePlugin {
  /** 插件唯一名称；重复名称会直接抛错，避免插件注册互相覆盖。 */
  name: string
  /** 本插件注册的组件 key。 */
  components?: ComponentRegistry
  /** 字段补默认值后调用；只接收 field，不接收表单状态上下文。 */
  transformField?: FormFieldTransform
}

/** 创建 FormRuntime 时可配置的选项。 */
export interface FormRuntimeOptions {
  /** 全局组件注册表；用户注册优先于内置组件。 */
  components?: ComponentRegistry
  /** 运行时插件列表；按用户注册顺序执行。 */
  plugins?: FormRuntimePlugin[]
}

/** 表单运行时实例，负责把声明式表单配置转换为渲染层可直接消费的结构。 */
export interface FormRuntime {
  /** 补齐单个节点的内置默认值，不执行用户插件。 */
  resolveField: (field: FormNodeConfig) => NormalizedNodeConfig
  /** 执行 resolveField、用户插件、内置默认值和递归 slot 处理。 */
  transformField: (field: FormNodeConfig) => NormalizedNodeConfig
  /** 批量转换顶层字段配置。 */
  transformFields: (fields: readonly FormNodeConfig[]) => NormalizedNodeConfig[]
}
