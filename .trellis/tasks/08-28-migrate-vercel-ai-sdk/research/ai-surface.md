# AI 迁移面调研

## 仓库调用面

### `@moluoxixi/ai-provider`

- 公开入口：`packages/ai-provider/package.json:11-27`。
- Provider 配置与状态：`packages/ai-provider/src/server/config.ts:3-63`。
- 手写 chat SSE transport：`packages/ai-provider/src/server/transport.ts:52-164`。
- 手写 embedding transport：`packages/ai-provider/src/server/transport.ts:166-231`。
- 当前生产消费者仅 `packages/ai-doc-assistant` 与 `packages/i18n-tool`。

### AI 文档助手

- Provider facade：`packages/ai-doc-assistant/src/server/ai-client.ts:1-3`、`packages/ai-doc-assistant/src/server/ai-provider.ts:15-47`。
- 服务端查询编排：`packages/ai-doc-assistant/src/server/query-handler.ts:62-163`。
- Node/Vite 流响应：`packages/ai-doc-assistant/src/server/router.ts:115-200`、`packages/ai-doc-assistant/src/server/plugin.ts:124-154`。
- 私有 wire protocol：`packages/ai-doc-assistant/src/shared/protocol.ts:253-300`。
- Vue 手写 SSE 客户端：`packages/ai-doc-assistant/src/ui/api.ts:80-141`。
- Vue 对话状态与取消：`packages/ai-doc-assistant/src/ui/views/ChatView.vue:123-210`。
- 本地 embedding 路径：`packages/ai-doc-assistant/src/core/embedder.ts:1-45`，不属于远端模型 transport。

### i18n 工具

- 共享 Provider 配置：`packages/i18n-tool/src/server/context.ts:79-98`。
- 批量翻译 transport 注入与消费：`packages/i18n-tool/src/core/translation.ts:1-10,178-197`。
- 翻译 API 路由：`packages/i18n-tool/src/server/router.ts:99-117,159-160`。
- UI 请求：`packages/i18n-tool/src/ui/api.ts:94-99`。

## 发布与验证影响

- 两个消费者都把 `@moluoxixi/ai-provider` 作为 runtime dependency 和构建 external。
- `scripts/published-package-verifier.mjs` 校验该包的 browser-safe/server 入口与密钥字符串边界。
- `scripts/__tests__/path-conventions.test.mjs`、根 coverage、`pnpm test:release` 与 `pnpm test:pack` 都包含当前包结构。
- AI 文档助手与 i18n 工具的端到端 stub 都模拟 `/v1/chat/completions`，迁移后必须改为验证 SDK adapter 和新的 UI Message Stream。

## Vercel AI SDK 官方能力

- Core `streamText`：https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- Core embeddings：https://ai-sdk.dev/docs/ai-sdk-core/embeddings
- OpenAI-compatible provider：https://ai-sdk.dev/providers/openai-compatible-providers
- Vue `useChat`：https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Node HTTP server：https://ai-sdk.dev/cookbook/api-servers/node-http-server
- 工具调用：https://ai-sdk.dev/docs/foundations/tools

截至 2026-08-28 查询的稳定版本：

- `ai@7.0.83`
- `@ai-sdk/vue@4.0.83`
- `@ai-sdk/openai-compatible@3.0.39`
- `@ai-sdk/openai@4.0.50`
- `@ai-sdk/anthropic@4.0.44`
- `@ai-sdk/google@4.0.56`

版本通过 2026-08-28 的官方 npm metadata 查询；实现时统一写入 `pnpm-workspace.yaml` catalog，并以 `pnpm-lock.yaml` 的解析结果作为复现依据。

关键约束：

- 对话 UI 应使用 `UIMessage.parts`，自定义来源与示例用类型化 data parts 表达。
- Node `ServerResponse` 可用官方 `pipeUIMessageStreamToResponse` 或文本流 bridge；Vite middleware 仍需自行从 `req` 断连生成 `AbortSignal`。
- OpenAI-compatible provider 仍需针对 coderelay 的 endpoint、流 chunk、模型名、embedding 与工具调用兼容性做真实契约测试。
- 服务端流错误默认应脱敏；原始错误只能进入受控服务端诊断，不得泄露 API key。

## 初步架构方向

- 用共享 AI runtime 包集中创建 Provider/model，并让业务包直接使用 AI SDK 的标准 `LanguageModel`、`EmbeddingModel` 与结果类型。
- 删除共享包内的手写 HTTP/SSE parser，不再包装成旧 `streamChat`/`embed` 兼容接口。
- `ai-doc-assistant` 采用完整 UI Message Stream；`i18n-tool` 采用 Core `generateText`，两者共享 Provider 工厂而不共享不合适的 UI 协议。
- 保留现有包名 `@moluoxixi/ai-provider`，将其破坏性重塑为 model factory；不保留旧 transport API。

## 本地模型迁移决策

`packages/ai-doc-assistant/src/core/embedder.ts:1-45` 使用 `@huggingface/transformers` 在本地运行 `Xenova/bge-small-zh-v1.5`。这条路径不读取 API key，也不经过 `@moluoxixi/ai-provider`，因此 Vercel AI SDK 远程 Provider 迁移不会自然替换它。

用户已确认删除本地模型并改用 AI SDK embedding。迁移必须同时处理：

- `pnpm-workspace.yaml` catalog、package dependency 与动态加载注释。
- `embedder.ts`、indexer、Orama、Qdrant、vector strategy 和固定 512 维测试。
- `IndexMeta`/health 的 Provider、model、endpoint fingerprint 和实际维度。
- Qdrant collection 按实际维度 delete-and-recreate；旧 identity 不得继续查询。
- README/CLI/status 对远程网络、费用、组件契约数据传输和 embedding key 前提的明确说明。
