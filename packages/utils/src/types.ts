export interface NamedPluginLike {
  name: string
}

export type PluginFactoryResult
  = | NamedPluginLike
    | readonly PluginFactoryResult[]
    | false
    | null
    | undefined

/**
 * 提取插件工厂函数的第一入参配置对象类型；非插件形态函数不会满足约束。
 */
export type PluginOptions<T extends (...args: never[]) => PluginFactoryResult> = NonNullable<Parameters<T>[0]>
