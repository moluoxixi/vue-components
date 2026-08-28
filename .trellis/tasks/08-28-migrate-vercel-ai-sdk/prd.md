# 全仓迁移到 Vercel AI SDK

## 目标

将仓库内全部远程 AI 调用、对话流和 embedding 统一到 Vercel AI SDK，删除自研 OpenAI-compatible transport 与本地 Hugging Face embedding，为多 Provider、结构化输出、工具调用和统一可观测能力建立可长期演进的基础。

## 背景

- `@moluoxixi/ai-provider` 当前同时承担配置、密钥状态、手写 chat SSE 和 embedding HTTP；生产消费者是 `packages/ai-doc-assistant` 与 `packages/i18n-tool`。
- `ai-doc-assistant` 另有本地 `Xenova/bge-small-zh-v1.5` embedding，以及私有 `sources -> token* -> example? -> done/error` 浏览器流协议。
- `i18n-tool` 复用共享 chat transport 完成批量翻译，但自身 HTTP API 不是对话流。
- 发布校验、包入口、构建 external、测试、文档和端到端 stub 均依赖当前实现，必须作为同一次迁移处理。

## 需求

### R1. 统一运行时

- 使用 Vercel AI SDK Core 执行文本生成和 embedding。
- `@moluoxixi/ai-provider` 保留为共享 Provider/model 工厂，但不再包装文本生成、SSE、HTTP 或 embedding 调用。
- 业务包直接使用 AI SDK 标准 API；不得重新创建与 `streamText`、`generateText`、`embed`、`embedMany` 等价的仓库私有抽象。

### R2. Provider 与配置

- chat 首期正式支持 OpenAI、Anthropic、Google 和 OpenAI-compatible。
- embedding 与 chat 独立配置，正式支持 OpenAI、Google 和 OpenAI-compatible；Anthropic 不提供 embedding 选项。
- Provider 必须显式选择，不通过模型名猜测；OpenAI-compatible 必须显式配置 `baseURL`。
- API key 只存在于服务端配置和内存，不进入浏览器 bundle、请求负载、响应、日志或公开状态 DTO。

### R3. AI 文档助手

- Vue 对话 UI 使用 `@ai-sdk/vue`、`UIMessage` 与 UI Message Stream。
- 来源引用和示例代码使用类型化 custom data parts，保留“来源先到、正文流式、示例后到”的交互能力。
- 保留完整轮次历史、停止后保留局部正文但不进入后续历史、清空/卸载中止、无召回时不调用 chat 模型等现有行为。
- 删除私有 SSE framing、手写浏览器 stream parser 和 compatibility facade。
- 删除本地 Hugging Face embedding，vector 模式通过独立的 AI SDK embedding Provider 执行；切换 Provider 或模型后必须重建索引。
- vector 模式会把组件契约正文发送给所选远程 embedding Provider；README、配置说明和运行状态必须明确这一数据边界与费用前提。

### R4. i18n 工具

- 批量翻译通过 AI SDK Core 执行，不引入对话 UI 协议。
- 保留现有模型输出校验、受保护 token、preview/apply、路径边界、并发限制和取消语义。
- 配置增加显式 Provider；只有 OpenAI-compatible 允许自定义 `baseUrl`。

### R5. 破坏性清理与发布

- 不保留旧 `streamChat`、`embed`、`ChatTransport`、六字段 `ProviderConfig`、旧环境变量别名或私有 SSE 兼容层。
- 删除 `@huggingface/transformers` 及不再使用的代码、导出、测试和文档。
- 同步更新 package manifests、lockfile、build externals、发布校验、环境示例、README、changeset 和 Trellis 规范。

## 验收标准

- [ ] AC1：全仓生产代码不存在手写 `/chat/completions`、`/embeddings` 或模型 SSE 解析；chat 与 embedding 均由 AI SDK 执行。
- [ ] AC2：OpenAI、Anthropic、Google、OpenAI-compatible chat model factory 均有配置与契约测试；OpenAI、Google、OpenAI-compatible embedding factory 同样覆盖。
- [ ] AC3：`ai-doc-assistant` 通过 `@ai-sdk/vue` 消费类型化 UI messages/data parts，来源、正文、示例、停止、错误和多轮历史通过端到端测试。
- [ ] AC4：vector 模式使用远程 embedding，索引构建与查询使用同一 Provider/model；旧本地模型依赖和固定维度假设被移除。
- [ ] AC5：`i18n-tool` 通过 AI SDK Core 完成翻译，原有安全、校验、取消、preview/apply 行为回归通过。
- [ ] AC6：任何浏览器产物、响应、日志和公开状态均不包含 API key、API key 环境变量名或 server-only Provider 对象；vector 文档明确披露组件契约会发送给远程 embedding Provider。
- [ ] AC7：旧 API、旧环境变量、旧流协议和双轨兼容代码的反向检索无非预期命中。
- [ ] AC8：相关 lint、类型检查、单元测试、coverage、build、pack、browser-pack、release check 和两个 E2E 套件全部通过。

## 范围外

- 本任务不新增具体工具调用、agent 工作流、图片/音频生成或新的 AI 产品功能。
- 不保证旧内部 API、旧环境变量、旧自定义 SSE 帧或旧向量索引兼容。
- 不为 Anthropic 虚构 embedding 支持；需要 embedding 时必须单独选择受支持的 Provider。
