# @moluoxixi/ai-provider

基于 Vercel AI SDK 的共享 Provider 契约与模型工厂。包只负责校验 Provider target、创建 SDK 原生模型和投影无敏感信息的运行状态；生成、流式响应、embedding 编排、重试和产品环境变量由调用方负责。

## 入口

| 入口                            | 用途                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| `@moluoxixi/ai-provider`        | browser-safe Provider ID、状态 DTO、稳定错误与类型守卫     |
| `@moluoxixi/ai-provider/shared` | 与根入口等价的显式 browser-safe 入口                       |
| `@moluoxixi/ai-provider/server` | secret-bearing target、SDK 模型工厂、诊断 cause 与脱敏工具 |

浏览器代码只能使用根入口或 `./shared`。API key、compatible endpoint、模型 target 和错误 cause 只能存在于服务端。

## 创建模型

```ts
import { createLanguageModel } from '@moluoxixi/ai-provider/server'
import { streamText } from 'ai'

const model = createLanguageModel({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
})

const result = streamText({ model, prompt: '你好' })
```

Chat 支持 `openai`、`anthropic`、`google` 和 `openai-compatible`；embedding 支持 `openai`、`google` 和 `openai-compatible`，不提供 Anthropic embedding 分支。

调用方必须显式传入 Provider、API key 和模型名。本包不读取产品环境变量，也不根据模型名推断 Provider。

## OpenAI-compatible

`openai-compatible` target 还必须提供 `baseURL`：

```ts
import { createEmbeddingModel } from '@moluoxixi/ai-provider/server'

const model = createEmbeddingModel({
  provider: 'openai-compatible',
  apiKey: process.env.EMBEDDING_API_KEY!,
  baseURL: 'https://relay.example/v1',
  model: 'text-embedding-3-small',
})
```

`baseURL` 必须是绝对 HTTP(S) URL，不能包含用户名、密码、query 或 fragment。配置不合法时抛出 `AiProviderError('INVALID_PROVIDER_CONFIG')`，不会静默切换 Provider。

## 状态与错误

`aiRuntimeStatusOf` 只返回 capability 的 `availability`、`provider` 和 `model`，不会返回 API key 或 endpoint。`AiProviderError` 是可跨边界传递的稳定错误；原始 cause 只可通过 `./server` 的 `getAiProviderErrorCause` 读取，不应序列化给浏览器。

需要记录上游错误文本时，先使用 `redactSensitiveText` 清除 raw、URI encoded 和 form encoded secret。
