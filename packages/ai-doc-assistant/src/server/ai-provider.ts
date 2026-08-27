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
import type { ProviderConfig, ProviderDefaults, ProviderEnvKeys } from '@moluoxixi/ai-provider/server'
import process from 'node:process'
import { loadProviderConfig as loadSharedProviderConfig } from '@moluoxixi/ai-provider/server'

export type { ProviderConfig, ProviderStatus } from '@moluoxixi/ai-provider/server'
export { providerStatusOf } from '@moluoxixi/ai-provider/server'

/** 环境变量名常量——集中管理，便于文档引用与测试覆盖。 */
export const ENV_KEYS = {
  chatBaseUrl: 'AI_DOC_CHAT_BASE_URL',
  chatApiKey: 'AI_DOC_CHAT_API_KEY',
  chatModel: 'AI_DOC_CHAT_MODEL',
  embeddingBaseUrl: 'AI_DOC_EMBEDDING_BASE_URL',
  embeddingApiKey: 'AI_DOC_EMBEDDING_API_KEY',
  embeddingModel: 'AI_DOC_EMBEDDING_MODEL',
} as const satisfies ProviderEnvKeys

/** 默认值（非密钥项可有默认；密钥项无默认，缺失即视为未配置）。 */
const DEFAULTS = {
  chatBaseUrl: 'https://coderelay.cn/v1',
  chatModel: 'gpt-4o-mini',
  embeddingBaseUrl: 'https://coderelay.cn/v1',
  embeddingModel: 'text-embedding-3-small',
} satisfies ProviderDefaults

/**
 * 从环境变量构建 ProviderConfig。
 * 这是系统边界（环境变量进入系统），对 chat 密钥做显式存在性校验：
 * 缺失时返回 null（chat 是核心能力，无 key 无法服务），不静默用空串伪装已配置。
 * embedding 密钥可选，缺失不影响返回（当前架构不依赖）。
 */
export function loadProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  return loadSharedProviderConfig(env, { defaults: DEFAULTS, envKeys: ENV_KEYS })
}
