import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aiDocAssistant } from '@moluoxixi/ai-doc-assistant/plugin'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../..')

/**
 * 把仓库根 .env.local 加载进 server 进程的 process.env，并映射到 BFF 期望的键名。
 *
 * 架构（ADR-0006）：组件库为小知识库，全量契约喂 chat 模型，不依赖 embedding。
 * 故 chat 映射到 A社 claude（AI_ANTHROPIC_*，经 coderelay.cn 的 OpenAI 兼容
 * /v1/chat/completions 调用，实测 claude 系列可用）。embedding 字段不再强制，
 * 若 .env.local 提供 AI_OPENAI_* 则一并映射（备未来启用），缺失不影响服务。
 * 密钥仅进 server 进程内存，绝不进客户端 bundle。
 */
function loadLocalEnv(): void {
  const envPath = resolve(repoRoot, '.env.local')
  if (!existsSync(envPath))
    return
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (value && !process.env[key])
      process.env[key] = value
  }

  // chat → A社 claude（OpenAI 兼容端点需带 /v1 后缀）
  const anthropicBase = process.env.AI_ANTHROPIC_BASE_URL
  const anthropicKey = process.env.AI_ANTHROPIC_API_KEY
  if (anthropicKey) {
    const base = (anthropicBase ?? 'https://coderelay.cn').replace(/\/+$/, '')
    process.env.AI_DOC_CHAT_BASE_URL ??= `${base}/v1`
    process.env.AI_DOC_CHAT_API_KEY ??= anthropicKey
    process.env.AI_DOC_CHAT_MODEL ??= 'claude-sonnet-4-5-20250929'
  }

  // embedding（可选，备未来启用）→ OpenAI 兼容
  const openaiBase = process.env.AI_OPENAI_BASE_URL
  const openaiKey = process.env.AI_OPENAI_API_KEY
  if (openaiKey) {
    process.env.AI_DOC_EMBEDDING_BASE_URL ??= openaiBase ?? 'https://coderelay.cn/v1'
    process.env.AI_DOC_EMBEDDING_API_KEY ??= openaiKey
  }
}

loadLocalEnv()

/**
 * AI 文档调试台 playground。
 * 挂 aiDocAssistant BFF 插件：组件源指向 monorepo 的 @moluoxixi/components。
 * 全量契约持有内存，无索引持久化目录。
 */
export default defineConfig({
  plugins: [
    Vue(),
    aiDocAssistant({
      root: repoRoot,
      componentGlobs: ['packages/components/src/**/index.vue'],
    }),
  ],
})
