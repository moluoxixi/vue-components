export interface SelectorPrefixPluginOptions {
  /** 待匹配的 class/id 名称前缀，例如 `el-`；调用方需传入非空字符串。 */
  fromPrefix: string
  /** 替换后的 class/id 名称前缀，例如 `moluoxixi-`；允许空字符串以支持显式移除前缀。 */
  toPrefix: string
}
