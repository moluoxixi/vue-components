# 全仓迁移到 Vercel AI SDK：技术设计

## 1. 设计原则

1. AI SDK 拥有模型调用、流解析、重试和标准结果类型；仓库只拥有产品配置、业务编排和安全投影。
2. chat 与 embedding 是两个独立能力，可选择不同 Provider、模型和凭据。
3. 浏览器只接触 UI message 与脱敏状态，永远不接触 Provider 实例或密钥。
4. 最终状态只有一套实现；迁移期间可按阶段接线，但完成前删除全部旧兼容面。

## 2. 目标结构

```text
ai-doc-assistant Vue
  -> @ai-sdk/vue useChat / UIMessage Stream
  -> Vite Node route
  -> retrieval + typed data parts + streamText
  -> @moluoxixi/ai-provider model factory
  -> OpenAI | Anthropic | Google | OpenAI-compatible

ai-doc-assistant vector mode
  -> embed/embedMany
  -> independent embedding model factory
  -> OpenAI | Google | OpenAI-compatible

i18n-tool HTTP API
  -> translation orchestration + existing validation
  -> generateText
  -> shared language model factory
```

## 3. 共享 Provider 包

保留包名 `@moluoxixi/ai-provider`。该名称仍准确描述其职责，避免没有产品收益的发布重命名；包内部进行破坏性重构，不保留旧 API。

### 3.1 导出边界

- `.` / `./shared`：仅导出 `AiProviderId`、无密钥配置输入类型、脱敏状态 DTO 和稳定错误码。
- `./server`：导出 secret-bearing resolved config、配置校验、redaction、`createLanguageModel()` 与 `createEmbeddingModel()`。
- 不重导出 AI SDK 大面积 API。业务包直接从 `ai` 导入标准调用函数和结果类型。
- 不导出 `streamChat`、仓库自定义 `ChatMessage`、`embed` transport 或 fetch/SSE option。

### 3.2 配置模型

使用判别联合表达模型目标：

```ts
type ChatModelTarget =
  | { provider: 'openai'; apiKey: string; model: string }
  | { provider: 'anthropic'; apiKey: string; model: string }
  | { provider: 'google'; apiKey: string; model: string }
  | { provider: 'openai-compatible'; apiKey: string; baseURL: string; model: string }

type EmbeddingModelTarget =
  | { provider: 'openai'; apiKey: string; model: string }
  | { provider: 'google'; apiKey: string; model: string }
  | { provider: 'openai-compatible'; apiKey: string; baseURL: string; model: string }
```

`createLanguageModel(target)` 和 `createEmbeddingModel(target)` 分别调用官方 `@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/google`、`@ai-sdk/openai-compatible` factory，并返回 SDK 原生 model。共享包不得读取产品级环境变量；环境变量映射由各消费者负责。

公开状态仅包含 `provider`、`model`、`configured/missing`，不得包含 key、key 的环境变量名或完整 secret-bearing config。

### 3.3 依赖归属

- Vercel AI SDK 版本统一登记在 `pnpm-workspace.yaml` catalog，各 package manifest 使用 `catalog:`，lockfile 固化实际解析版本。
- `packages/ai-provider`：`ai` 和四个 Provider adapter 为 runtime dependencies，并在 library build 中 external。
- `packages/ai-doc-assistant`：直接声明 `ai`、`@ai-sdk/vue` 和 `@moluoxixi/ai-provider`。library 的 server entries externalize `ai` 与 Provider 包；由 Vite 生成的内嵌浏览器面板必须 bundle `@ai-sdk/vue` 及其 browser-safe client 依赖，不得留下浏览器无法解析的 bare import。
- `packages/i18n-tool`：直接声明 `ai` 和 `@moluoxixi/ai-provider`，server/library build externalize二者；其浏览器 UI 不引入 AI SDK。
- 删除 `packages/ai-doc-assistant` 的 `@huggingface/transformers`。
- 三个包分别通过 Node pack smoke 与 browser-pack 检查依赖可解析性、入口分类和 server-only 代码隔离。

## 4. 产品配置

### 4.1 AI 文档助手

使用显式且互相独立的环境变量组：

```text
AI_DOC_CHAT_PROVIDER
AI_DOC_CHAT_API_KEY
AI_DOC_CHAT_MODEL
AI_DOC_CHAT_BASE_URL          # 仅 openai-compatible

AI_DOC_EMBEDDING_PROVIDER
AI_DOC_EMBEDDING_API_KEY
AI_DOC_EMBEDDING_MODEL
AI_DOC_EMBEDDING_BASE_URL     # 仅 openai-compatible
```

不设置隐式 Provider、模型或 relay 默认值。启用 chat 时必须显式提供 chat provider/model/key；启用 `vector` 时还必须显式提供 embedding provider/model/key，OpenAI-compatible 两组配置都必须提供对应 `baseURL`。缺失时返回明确的未配置状态。旧六字段配置语义、coderelay 默认值和 `.env` 映射不做兼容 fallback。

### 4.2 i18n 工具

配置改为：

```ts
interface I18nToolAiConfigInput {
  provider: 'openai' | 'anthropic' | 'google' | 'openai-compatible'
  apiKeyEnv?: string
  model?: string
  baseUrl?: string // 仅 openai-compatible
}
```

`provider` 必填，缺失或未知值在配置校验阶段失败，不使用默认值或模型名推断。继续由 `apiKeyEnv` 在服务端读取密钥；sanitized config 只暴露 provider、model、兼容端点和 configured 状态。

## 5. AI 文档助手对话流

### 5.1 共享消息类型

```ts
type AiDocDataParts = {
  sources: SourceRef[]
  example: { blocks: ExampleBlock[] }
}

type AiDocUIMessage = UIMessage<never, AiDocDataParts>
```

服务端验证请求尺寸、消息角色、文本 parts、完整轮次和现有 20 条/20,000 字符历史上限。模型输入由已验证 UI messages 转换，不允许浏览器 data/tool parts 注入 system prompt 或检索上下文。

### 5.2 服务端顺序

1. 校验请求、Provider 和索引状态。
2. 从最后一个 user text part 提取问题，执行检索。
3. 立即写 `data-sources`。
4. 无召回时写固定正文并正常结束，不调用模型。
5. 有召回时调用 `streamText`，通过官方 UI Message Stream writer/merge API 输出 text parts。
6. 完整正文可用后生成示例块，写 `data-example`，再完成消息。

Node/Vite 使用 AI SDK 官方 Node response bridge。`IncomingMessage` 的 `aborted` 与 `ServerResponse` 的 `close` 共同驱动单请求 `AbortController`，signal 传给检索 embedding 和 `streamText`。断连不再追加错误帧。

预流失败继续返回结构化 JSON 错误；进入 UI stream 后只向客户端暴露脱敏错误，原始 cause 仅用于受控服务端诊断。

### 5.3 Vue 状态

`ChatView` 使用 `@ai-sdk/vue` 的 `useChat`、`DefaultChatTransport`、`messages/status/error/sendMessage/stop`。渲染按 `UIMessage.parts` 区分 text、`data-sources` 和 `data-example`。

完成轮次才进入下一次模型历史；停止或失败轮次保留已经显示的正文，但从请求历史中过滤。现有 Markdown 安全、DemoPreview、来源导航、自动滚动、清空和卸载中止语义保持不变。

## 6. 远程 embedding 与索引

- 删除 `src/core/embedder.ts` 的本地 pipeline 和固定 `EMBEDDING_DIM`。
- vector strategy 注入 SDK `EmbeddingModel`；文档批量使用 `embedMany`，问题使用 `embed`。
- 定义 `EmbeddingIdentity = { provider, model, endpointFingerprint, dimension }`。`endpointFingerprint` 对 OpenAI-compatible 的规范化 `baseURL` 做无密钥哈希；原始 URL 不进入公开状态。
- `EmbeddingIdentity` 写入 `IndexMeta` 和持久化索引元数据，并参与 source stale 判定。启动 hydrate 或运行中配置改变时，身份不一致的 vector 索引进入 `stale`/不可查询状态，直到全量重建。
- 以第一批返回向量的实际维度动态生成 Orama schema，并校验同一构建和查询向量维度一致。
- Qdrant build 继续采用 delete-and-recreate，但 collection size 改用实际维度；只有重建成功后状态才进入 ready，避免查询旧 collection。
- Qdrant/Orama build、数量一致性、空向量、维度漂移和 abort 都必须显式失败，不静默截断或降级到 content 模式。
- vector 文档明确说明组件契约正文会发送给远程 Provider，并提示网络、费用和供应商数据策略。

## 7. i18n 翻译

`i18n-tool` 通过共享 factory 取得 `LanguageModel`，使用 `generateText` 完成当前原子批次。保留既有 JSON 提取/Zod 校验和业务重试边界，避免把 provider 原生 structured-output 支持变成四 Provider 的共同前提。

客户端断连 signal 传给 `generateText`。模型输出仍只能填充服务端签发的 opaque unit IDs，不得影响路径、locale 或写操作。

## 8. 删除与迁移

最终删除：

- 手写 OpenAI-compatible HTTP/SSE transport 及专项 parser 测试。
- `streamChat`、旧 `embed`、`ChatTransport`、旧 `ChatMessage` 和六字段 `ProviderConfig`。
- AI 文档助手私有 `SseEvent` framing、`streamQuery` parser 和 compatibility facade。
- 本地 Hugging Face embedder、模型依赖和固定维度常量。
- 旧环境变量、fixtures、README 表述和无消费者导出。

同时更新 build external、published-package verifier、path conventions、coverage、pack/browser-pack、changeset 和相关 Trellis spec，使发布物继续隔离 server-only 代码与密钥。

## 9. 风险与回滚

- OpenAI-compatible relay 的流、embedding、工具参数支持必须用真实形状 stub/契约测试验证，不能只验证 model factory 创建成功。
- 远程 embedding 引入网络、费用和速率限制；批量大小、AI SDK retry、取消和错误提示必须可控。
- UI Message Stream 改变 wire contract，必须以 server bridge + Vue E2E 一起验收。
- 实现必须以已安装 v7 类型声明为准，先用编译测试确认 `streamText`、UI Message Stream writer/Node bridge、`DefaultChatTransport` 和 `useChat` 的准确 import 与签名，禁止按旧版记忆拼接 API。
- 迁移期间不发布。每个阶段保持可测试；若阶段失败，回滚该阶段而非恢复最终旧兼容层。发布后以 breaking release 交付。
