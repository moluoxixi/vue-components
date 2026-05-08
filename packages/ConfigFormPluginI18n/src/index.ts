import type {
  FormRuntimePlugin,
  NormalizedFieldConfig,
  NormalizedNodeConfig,
} from '@moluoxixi/config-form/plugins'

type PlainRecord = Record<string, unknown>

/** i18n 插件可递归解析的对象配置。 */
export interface I18nResolvableRecord {
  [key: string]: I18nResolvableValue
}

/** i18n 文案描述；只存在于插件配置中，不进入字段声明或渲染组件。 */
export interface I18nMessageRef {
  /** 当前 locale 下查找的文案 key。 */
  key: string
  /** 语言包缺失该 key 时使用的显式默认文案。 */
  defaultMessage?: string
  /** 文案模板插值参数；仅支持静态值，运行时表单状态由具体字段组件消费。 */
  params?: Record<string, unknown>
}

/** i18n 插件可递归转换的值。 */
export type I18nResolvableValue
  = | I18nMessageRef
    | I18nResolvableValue[]
    | I18nResolvableRecord
    | string
    | number
    | boolean
    | null
    | undefined

/** 按 field key 配置的字段文案与默认 props。 */
export interface I18nFieldMessages {
  /** 插件要补充的字段 label；用户字段显式 label 始终优先。 */
  label?: I18nMessageRef
  /** 插件要补充的 props，可递归包含 i18n 文案描述。 */
  props?: I18nResolvableRecord
}

/** locale 输入形态；插件每次转换字段时按需读取当前语言。 */
export type I18nLocale = string | (() => string | undefined)

/** 动态语言包文案解析函数，可基于 params 和 locale 生成文案。 */
export type I18nMessageResolver = (
  params: Record<string, unknown> | undefined,
  locale: string | undefined,
) => string

/** 语言包中单条文案的存储形态。 */
export type I18nMessage = string | I18nMessageResolver

/** createI18nPlugin(...) 消费的按 locale 索引语言包。 */
export type I18nMessages = Record<string, Record<string, I18nMessage>>

/** 可选自定义翻译器；返回 undefined 时继续走语言包查找。 */
export type I18nTranslate = (
  key: string,
  params: Record<string, unknown> | undefined,
  defaultMessage: string | undefined,
  locale: string | undefined,
) => string | undefined

/** 缺少语言包文案和 defaultMessage 时、正式抛错前调用的回调。 */
export type I18nMissingHandler = (
  key: string,
  params: Record<string, unknown> | undefined,
  defaultMessage: string | undefined,
  locale: string | undefined,
) => void

/** ConfigForm i18n 字段转换插件选项。 */
export interface I18nPluginOptions {
  /** runtime 插件名称，默认 "i18n"。 */
  name?: string
  /** 静态 locale，或每次转换字段时读取的 getter。 */
  locale?: I18nLocale
  /** 默认翻译器使用的按 locale 索引语言包。 */
  messages?: I18nMessages
  /** 按字段名索引的文案配置；插件只处理匹配到的字段。 */
  fields?: Record<string, I18nFieldMessages>
  /** 自定义翻译 hook；返回 undefined 时回到 messages 查找。 */
  translate?: I18nTranslate
  /** 缺失文案时、resolver 抛错前调用的 hook。 */
  missing?: I18nMissingHandler
}

/** 创建基于 field key 的 ConfigForm i18n 转换插件。 */
export function createI18nPlugin(config: I18nPluginOptions = {}): FormRuntimePlugin {
  return {
    name: config.name ?? 'i18n',
    transformField: (node: NormalizedNodeConfig): NormalizedNodeConfig | void => {
      if (!hasFieldBinding(node))
        return undefined

      const fieldMessages = config.fields?.[node.field]
      if (!fieldMessages)
        return undefined

      const locale = resolveLocale(config.locale)
      const translated: Partial<NormalizedFieldConfig> = {}

      if (fieldMessages.label)
        translated.label = translateMessageRef(fieldMessages.label, config, locale, `fields.${node.field}.label`)

      if (fieldMessages.props)
        translated.props = resolveI18nValue(fieldMessages.props, config, locale, `fields.${node.field}.props`) as Record<string, unknown>

      return {
        ...node,
        ...translated,
      }
    },
  }
}

/** 判断标准化节点是否是带表单值绑定的字段节点。 */
function hasFieldBinding(node: NormalizedNodeConfig): node is NormalizedFieldConfig {
  return typeof (node as { field?: unknown }).field === 'string'
}

/** 解析当前 locale；getter 抛出的异常保持向上传递。 */
function resolveLocale(locale?: I18nLocale): string | undefined {
  return typeof locale === 'function' ? locale() : locale
}

/** 递归解析插件配置值中的 i18n 文案描述。 */
function resolveI18nValue(
  value: I18nResolvableValue,
  config: I18nPluginOptions,
  locale: string | undefined,
  path: string,
): unknown {
  if (isMessageRef(value))
    return translateMessageRef(value, config, locale, path)

  if (Array.isArray(value))
    return value.map((item, index) => resolveI18nValue(item, config, locale, `${path}[${index}]`))

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveI18nValue(item as I18nResolvableValue, config, locale, `${path}.${key}`),
      ]),
    )
  }

  return value
}

/** 判断未知值是否是 i18n 文案描述对象。 */
function isMessageRef(value: unknown): value is I18nMessageRef {
  return isPlainRecord(value) && Object.hasOwn(value, 'key')
}

/** 断言并返回普通对象，失败时抛出带路径的 TypeError。 */
function assertRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainRecord(value))
    throw new TypeError(`${path} must be an object`)
  return value
}

/** 校验文案描述对象的运行时形态，避免错误配置被静默跳过。 */
function assertMessageRef(ref: I18nMessageRef, path: string): void {
  if (typeof ref.key !== 'string' || ref.key.length === 0)
    throw new TypeError('i18n key must be a non-empty string')
  if (ref.defaultMessage !== undefined && typeof ref.defaultMessage !== 'string')
    throw new TypeError('i18n defaultMessage must be a string')
  if (ref.params !== undefined)
    assertRecord(ref.params, `${path}.params`)
}

/** 解析单个文案描述，查找失败时显式抛错而不是返回 key。 */
function translateMessageRef(
  ref: I18nMessageRef,
  config: I18nPluginOptions,
  locale: string | undefined,
  path: string,
): string {
  assertMessageRef(ref, path)

  const { defaultMessage, key, params } = ref
  const custom = config.translate?.(key, params, defaultMessage, locale)
  if (custom !== undefined)
    return assertString(custom, `translate(${key})`)

  const message = findMessage(config.messages, locale, key)
  if (message !== undefined)
    return renderMessage(message, params, locale, `messages.${locale}.${key}`)

  if (defaultMessage !== undefined)
    return renderMessage(defaultMessage, params, locale, `${path}.defaultMessage`)

  config.missing?.(key, params, defaultMessage, locale)

  throw new Error(`Missing i18n message: ${key}`)
}

/** 渲染语言包文案，字符串文案支持 `{name}` 形式的浅层 params 插值。 */
function renderMessage(
  message: I18nMessage,
  params: Record<string, unknown> | undefined,
  locale: string | undefined,
  path: string,
): string {
  if (typeof message === 'function')
    return assertString(message(params, locale), path)

  return message.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key.trim()]
    return value == null ? '' : String(value)
  })
}

/** 从语言包中查找指定 locale 和 key 的文案。 */
function findMessage(
  messages: I18nMessages | undefined,
  locale: string | undefined,
  key: string,
): I18nMessage | undefined {
  if (!locale)
    return undefined
  return messages?.[locale]?.[key]
}

/** 判断值是否可作为插件配置的普通对象递归遍历。 */
function isPlainRecord(value: unknown): value is PlainRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 校验动态翻译结果必须是字符串，避免错误结果继续进入渲染层。 */
function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string')
    throw new TypeError(`${path} must return a string`)
  return value
}
