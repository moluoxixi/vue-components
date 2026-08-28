# 全仓迁移到 Vercel AI SDK：实施计划

## 0. 开始前

- [ ] 运行 `trellis-before-dev`，加载 ai-provider、ai-doc-assistant、i18n-tool 与跨层规范。
- [ ] 确认并保留当前工作区内与本任务无关的改动，不修改 ConfigForm 或 vitepress-theme 文件。
- [ ] 在 `pnpm-workspace.yaml` catalog 登记 Vercel AI SDK 与四个 Provider adapter，删除仅供本地 embedder 使用的 Transformers 条目；记录并以 `pnpm-lock.yaml` 的实际解析版本为准。
- [ ] 先写类型级编译探针，核对已安装 v7 的 `streamText`、`embed/embedMany`、UI Message Stream Node bridge、`DefaultChatTransport` 和 Vue `useChat` 准确签名与 import 来源。

## 1. 重构共享 Provider 工厂（回滚点 A）

- [ ] 在 `packages/ai-provider` 添加 `ai`、OpenAI、Anthropic、Google、OpenAI-compatible runtime dependencies，并更新 build external。
- [ ] 建立 chat/embedding 判别联合、运行时校验、脱敏状态和稳定错误投影。
- [ ] 实现 `createLanguageModel` 与 `createEmbeddingModel`，只返回 SDK 原生 model。
- [ ] 覆盖四类 chat factory、三类 embedding factory、缺 key、compatible 缺 baseURL、非法 Provider、状态脱敏和 browser/server export 边界。
- [ ] 暂时保留旧 transport 仅供尚未迁移的指定消费者文件编译；新增反向检索门禁，禁止任何新引用。每迁完一个消费者立即删除它的旧 import。
- [ ] 验证：`pnpm --filter @moluoxixi/ai-provider typecheck && pnpm --filter @moluoxixi/ai-provider test && pnpm --filter @moluoxixi/ai-provider build`。

## 2. 迁移 AI 文档助手配置与 embedding（回滚点 B）

- [ ] 将 chat 与 embedding 环境变量映射改为两个显式 Provider target；不提供隐式 Provider/model/relay 默认值，也不做旧变量 fallback。
- [ ] 删除本地 Hugging Face embedder和 `@huggingface/transformers`。
- [ ] 让 vector strategy 使用 `embedMany`/`embed`，移除 indexer、Orama、Qdrant 和测试中的固定维度。
- [ ] 增加 `EmbeddingIdentity` 持久化、health/status 投影与 stale 判定；兼容端点只保存无密钥指纹。
- [ ] Orama 按实际维度生成 schema；Qdrant 按实际维度 delete-and-recreate collection，重建完成前不得查询旧集合。
- [ ] 清理 CLI、context、protocol、retrieval 注释和测试中“本地 embedding、零 key、离线、固定模型”的旧语义，并更新远程数据/费用说明。
- [ ] 更新 Orama/Qdrant build、health/status、错误与测试，覆盖数量/维度、模型切换、重启 hydrate、旧 Qdrant collection、abort、远程失败。
- [ ] 验证 ai-doc provider、context、retrieval 和 vector 测试及类型检查。

## 3. 迁移 AI 文档助手 UI Message Stream（回滚点 C）

- [ ] 定义 `AiDocUIMessage` 与 `sources/example` data parts，收敛请求校验和模型消息转换。
- [ ] 用 `streamText`、UI Message Stream writer 和 Node response bridge 重写查询路由。
- [ ] 保留来源先到、无召回不调用模型、完整正文后生成示例、断连中止和错误脱敏。
- [ ] 用 `@ai-sdk/vue` `useChat`/transport 重写 ChatView 对话状态和 parts 渲染。
- [ ] 保留完成轮次历史裁剪、stopped/error 排除、partial text、Markdown/Demo/来源导航与滚动行为。
- [ ] 删除私有 SSE parser、framing、compatibility facade 和相关公开导出；把旧测试的业务断言迁移到 UI Message Stream 契约测试。
- [ ] 使用 AI SDK 官方 stream reader/decoder 验证 wire golden：`data-sources` 先于 text，`data-example` 位于正文完成后，完成/错误各只有一个终态。
- [ ] 验证：`pnpm --filter @moluoxixi/ai-doc-assistant typecheck && pnpm --filter @moluoxixi/ai-doc-assistant test && pnpm --filter @moluoxixi/ai-doc-assistant build && pnpm --filter @moluoxixi/ai-doc-assistant e2e`。

## 4. 迁移 i18n 工具（回滚点 D）

- [ ] 配置 schema 加入显式 Provider，限制 `baseUrl` 仅适用于 OpenAI-compatible。
- [ ] 删除到旧六字段 config 的映射和 `ChatTransport` 注入。
- [ ] 使用共享 factory + `generateText`，传递请求 signal，保留 JSON/Zod 校验、受保护 token 与业务重试。
- [ ] 更新 sanitized config、README、fixtures、server/context/router/translation 测试和四 Provider 选择矩阵。
- [ ] 验证：`pnpm --filter @moluoxixi/i18n-tool typecheck && pnpm --filter @moluoxixi/i18n-tool test && pnpm --filter @moluoxixi/i18n-tool build && pnpm --filter @moluoxixi/i18n-tool e2e`。

## 5. 删除旧实现并同步发布边界（回滚点 E）

- [ ] 从 ai-provider 删除旧 transport、旧 config/errors/types/tests 和所有 compatibility exports。
- [ ] 清理两个消费者的旧 imports、env、fixtures、launch scripts、docs 与测试 stub。
- [ ] 更新三个 package manifests、Vite externals、lockfile、published-package verifier、path conventions、coverage 和 pack 配置。
- [ ] ai-provider 与 i18n server/library externalize `ai`/Provider runtime；ai-doc server entries externalize server runtime，但内嵌 Vue 面板正确 bundle `@ai-sdk/vue` browser client。
- [ ] 增加 breaking changeset；三个发布包进入同一 release set。
- [ ] 更新 `.trellis/spec/ai-provider/backend/provider-contracts.md`、`.trellis/spec/ai-doc-assistant/frontend/quality-guidelines.md` 与 `.trellis/spec/i18n-tool/backend/local-service-safety.md` 的新契约。

## 6. 反向检索

- [ ] 搜索并清除非预期 `streamChat`、`ChatTransport`、`ProviderTransportOptions`、`choices[0].delta`、`AI_DOC_CHAT_*` 旧语义、私有 `SseEvent` parser、`EMBEDDING_DIM`、`EMBEDDING_MODEL_ID`、`Xenova/bge-small-zh-v1.5` 以及“本地 embedding/零 key/离线”旧文案。
- [ ] `/chat/completions`、`/embeddings` 只允许出现在明确的 OpenAI-compatible 契约 stub 或外部 SDK 文档语境中，不得存在生产 fetch。
- [ ] `@huggingface/transformers` 不再出现在 ai-doc manifest、lockfile或生产源码。
- [ ] 检查 browser bundles 和状态 DTO 不含 key、env-key 字段、server-only factory 或 Node imports。

## 7. 全量验证

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:coverage`
- [ ] `pnpm build:force`
- [ ] `pnpm test:pack`
- [ ] `pnpm test:pack:browser`
- [ ] `pnpm test:e2e:ai-doc`
- [ ] `pnpm --filter @moluoxixi/i18n-tool e2e`
- [ ] `pnpm test:release`
- [ ] `pnpm release:check`
- [ ] 对 UI Message Stream 做桌面与移动视口浏览器验证，检查 text/data parts、停止、错误和布局无回归。

## 8. 完成门禁

- [ ] 所有 PRD 验收标准有测试或检查证据。
- [ ] 不存在旧/新双轨运行路径。
- [ ] 不提交无关工作区改动或生成的临时报告。
- [ ] 发布前保留最终回滚点；完成验证后再进入 spec、commit 与归档流程。
