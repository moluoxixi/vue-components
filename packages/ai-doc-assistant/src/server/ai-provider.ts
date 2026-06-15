/**
 * 服务端 AI Provider：封装 chat（流式）上游调用配置。
 *
 * 架构（ADR-0006 默认 + ADR-0007 可选增强）：默认 content 只做本地结构化关键词
 * topK 检索，chat 调用仍由第三方 provider 完成；embedding 字段保留为可选兼容配置，
 * 仅 vector 增强路径会使用本地 embedding，缺失远端 embedding key 不影响服务可用。
 *
 * 安全红线（ADR-0002）：
 * - 密钥仅从环境变量读取，只存在于 server 进程内存，绝不进入任何响应体或日志。
 * - 浏览器永远不直接触达上游，所有调用经本模块代理。
 *
 * chat 上游走 OpenAI 兼容的 /chat/completions 协议。coderelay.cn 代理下，
 * A社 claude 系列模型亦经此协议调用（实测 claude-haiku/sonnet/opus 均可）。
 */
import process from 'node:process'

/** Provider 运行时配置。密钥字段仅在内存中流转。 */
export interface ProviderConfig {
  /** chat 上游 baseURL（OpenAI 兼容）。 */
  chatBaseUrl: string
  /** chat 密钥。 */
  chatApiKey: string
  /** chat 模型名。 */
  chatModel: string
  /** embedding 上游 baseURL（OpenAI 兼容）；当前架构未使用，保留兼容。 */
  embeddingBaseUrl: string
  /** embedding 密钥；可空（缺失不影响 chat 服务）。 */
  embeddingApiKey: string
  /** embedding 模型名；当前架构未使用，保留兼容。 */
  embeddingModel: string
}

/** 配置态（供 health 暴露，不含密钥值）。 */
export interface ProviderStatus {
  chat: 'configured' | 'missing'
  embedding: 'configured' | 'missing'
}

/** 环境变量名常量——集中管理，便于文档引用与测试覆盖。 */
export const ENV_KEYS = {
  chatBaseUrl: 'AI_DOC_CHAT_BASE_URL',
  chatApiKey: 'AI_DOC_CHAT_API_KEY',
  chatModel: 'AI_DOC_CHAT_MODEL',
  embeddingBaseUrl: 'AI_DOC_EMBEDDING_BASE_URL',
  embeddingApiKey: 'AI_DOC_EMBEDDING_API_KEY',
  embeddingModel: 'AI_DOC_EMBEDDING_MODEL',
} as const

/** 默认值（非密钥项可有默认；密钥项无默认，缺失即视为未配置）。 */
const DEFAULTS = {
  chatBaseUrl: 'https://coderelay.cn/v1',
  chatModel: 'gpt-4o-mini',
  embeddingBaseUrl: 'https://coderelay.cn/v1',
  embeddingModel: 'text-embedding-3-small',
}

/**
 * 从环境变量构建 ProviderConfig。
 * 这是系统边界（环境变量进入系统），对 chat 密钥做显式存在性校验：
 * 缺失时返回 null（chat 是核心能力，无 key 无法服务），不静默用空串伪装已配置。
 * embedding 密钥可选，缺失不影响返回（当前架构不依赖）。
 */
export function loadProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  const chatApiKey = env[ENV_KEYS.chatApiKey]

  // chat 密钥是核心边界输入，缺失即判定未配置
  if (!chatApiKey)
    return null

  return {
    chatBaseUrl: env[ENV_KEYS.chatBaseUrl] || DEFAULTS.chatBaseUrl,
    chatApiKey,
    chatModel: env[ENV_KEYS.chatModel] || DEFAULTS.chatModel,
    embeddingBaseUrl: env[ENV_KEYS.embeddingBaseUrl] || DEFAULTS.embeddingBaseUrl,
    embeddingApiKey: env[ENV_KEYS.embeddingApiKey] || '',
    embeddingModel: env[ENV_KEYS.embeddingModel] || DEFAULTS.embeddingModel,
  }
}

/** 计算配置态（不暴露密钥值，仅 configured/missing）。 */
export function providerStatusOf(config: ProviderConfig | null): ProviderStatus {
  if (!config)
    return { chat: 'missing', embedding: 'missing' }
  return {
    chat: config.chatApiKey ? 'configured' : 'missing',
    embedding: config.embeddingApiKey ? 'configured' : 'missing',
  }
}
