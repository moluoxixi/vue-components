# 共享 AI Provider 包与文档助手迁移

## 目标

新增可发布包 `@moluoxixi/ai-provider`，承载通用 AI Provider 配置、OpenAI-compatible transport、取消传播、稳定错误分类与脱敏契约；迁移 `@moluoxixi/ai-doc-assistant` 使用该包，同时保持现有公开 API、环境变量、默认值、安全边界和主要运行行为兼容。

## 需求

### R1. 共享包边界

- 根入口或 `./shared` 只导出无密钥、无 Node 副作用的 DTO、消息类型、Provider 状态和稳定错误类型。
- `./server` 导出含密钥的运行时配置、显式环境变量映射 loader、OpenAI-compatible chat/embedding transport 和脱敏工具。
- 共享包不得依赖 AI 文档助手或国际化工具，不包含 prompt、检索、翻译编排或 UI 状态。
- 浏览器代码不得导入 `./server`，并通过构建 smoke test 防止含密钥类型或 server-only 代码进入前端产物。

### R2. Transport 与错误

- chat transport 保留流式 token 与 `AbortSignal`，正常流、上游错误、reader cancel 和调用方取消具有确定终态。
- embedding transport 保留为 server-only 能力，但不扩大 AI 文档助手现有公共 API。
- 上游错误映射为稳定错误码与脱敏摘要，不能把响应正文、Authorization、API key 或含密钥 URL 直接返回 UI 或写入日志。
- 流开始后不透明重试；取消期间不重试。

### R3. AI 文档助手兼容迁移

- 保留 `AI_DOC_CHAT_*` 与 `AI_DOC_EMBEDDING_*` 环境变量名。
- 保留默认 base URL/model、chat key 缺失返回未配置、embedding key 可缺失的语义。
- `@moluoxixi/ai-doc-assistant` 根入口继续导出 `streamChat`、`ChatMessage`、`ENV_KEYS`、`loadProviderConfig`、`providerStatusOf`、`ProviderConfig` 和 `ProviderStatus`。
- 文档检索、system prompt、query/SSE 领域事件、来源引用、示例生成与 UI 协议保留在 AI 文档助手中。
- 现有 `/health` 继续只暴露脱敏 chat 状态，现有 query、索引、导入导出和构建契约不变。

### R4. 包与发布

- 新包使用仓库现有 `source/types/import` exports、Vite library build、声明整理、Changesets 和 pack 验证约定。
- AI 文档助手通过 `workspace:*` 依赖共享包；依赖方向不可反转。

## 验收标准

- [x] 新包单元测试、类型检查、构建、声明整理和 pack 验证通过。
- [x] 配置 loader 覆盖默认值、显式映射、缺 key、脱敏状态和不含 secret 的序列化。
- [x] transport 测试断言 URL、header、model、流解析、错误分类、脱敏、取消和 reader 释放。
- [x] 浏览器构建只能消费无密钥 shared DTO，产物扫描不含 sentinel secret 或 API key 字段值。
- [x] AI 文档助手现有 provider/client/context/router/UI 测试与 E2E 通过。
- [x] AI 文档助手旧公共导出可继续从原包名导入，`AI_DOC_*` 兼容行为不变。

## 范围外

- AI Provider 配置的浏览器持久化或密钥管理 UI。
- 国际化翻译 prompt、结构校验与资源适配。
- 新增非 OpenAI-compatible 上游协议。
- 改变 AI 文档助手的检索或聊天产品行为。

## 依赖

- 无前置子任务；这是父任务的第一阶段。
