# 仓库调研结论

## 产品形态

- `packages/ai-doc-assistant/package.json:11-47` 已证明“可发布 Node 包 + 包内 Vue SPA + CLI”可以在同一包内构建与发布。
- `packages/ai-doc-assistant/src/server/plugin.ts:121-153` 和 `src/shared/protocol.ts:10-36` 提供同源 BFF、共享协议与 UI 静态资源托管范式。
- `packages/ConfigForm/playground/package.json:2-10` 是纯静态 playground，没有安全保存密钥或写入本地文件的 Node 边界，因此不适合作为本工具主体。
- `docs/vitepress/.vitepress/catalog/utility-manifest.ts:1-81` 的 utility 页面是 README/Markdown 入口，不承担本地服务状态与文件写回。

## AI 配置与兼容边界

- `packages/ai-doc-assistant/src/server/ai-provider.ts:18-87` 定义 `ProviderConfig`、`AI_DOC_*` 环境变量、默认模型和脱敏状态；chat key 缺失时 fail closed，embedding key 可缺失。
- `packages/ai-doc-assistant/src/server/ai-client.ts:17-108` 实现 OpenAI-compatible chat/embedding transport 与 `AbortSignal` 传播，但尚无稳定错误分类和完整脱敏。
- `packages/ai-doc-assistant/index.ts:30-37` 已公开导出 AI 配置与 chat transport；迁移后必须保留兼容 re-export。
- `.trellis/spec/ai-doc-assistant/frontend/quality-guidelines.md:38-53` 固化 SSE 终态与取消语义，新共享 transport 与翻译流不得退化。

## 配置与 CLI

- `packages/vitepress-theme-element-plus/src/node/project/load-config.ts:9-78` 已使用 `jiti` 加载 `.ts/.mts/.js/.mjs` 配置，支持显式路径、向上发现、配置目录和 git 根解析。
- `packages/vitepress-theme-element-plus/src/project/config.ts:206-219` 将纯类型 `defineConfig` 与运行时 `resolveConfig` 分离。
- `packages/vitepress-theme-element-plus/src/node/cli.ts:9-64` 的严格参数解析、未知参数拒绝和端口校验优于现有 AI 文档助手 CLI，应作为新 CLI 基线。

## 国际化资源

- `packages/vite-config/src/config/base/addons/i18n.ts:7-18` 已约定 Vue I18n 默认扫描 `locales/**`。
- `packages/vite-config/test/fixtures/real-app/locales/en.json:1-3` 是 locale-per-file JSON 证据。
- `packages/vitepress-theme-element-plus/src/i18n/component/translation.json:1-4` 是 locale-first JSON 证据。
- 仓库没有 i18next fixture；MVP 必须新增 namespace、plural、context 和插值测试夹具。
- 统一模型必须保留真实 JSON path，不能只用 dotted key，否则 nested `{a:{b:...}}` 与 literal `{"a.b":...}` 无法无损区分。

## 文件安全

- `packages/ConfigForm/devtools-vite-plugin/src/openInEditor.ts:337-400` 提供私有请求头、Origin/Referer 同源校验和仅 POST 副作用范式。
- `packages/vitepress-theme-element-plus/src/node/content.ts:36-58,89-109` 提供目标不存在时最近存在祖先的 canonical path 解析思路。
- `packages/vitepress-theme-element-plus/src/node/repository/atomic-write.ts:7-34` 提供同目录临时文件 + rename + 失败清理的原子 JSON 写入范式。
- 现有仓库没有 locale `scan -> preview -> apply`、baseline hash、diff 或写回并发锁，需要由新服务建立完整协议。

## 推荐任务拆分

1. 共享 AI Provider 包与 AI 文档助手迁移。
2. 国际化资源模型、JSON 适配器与 AI 翻译核心。
3. 本地服务、CLI 与安全写回协议。
4. Vue 工作台与端到端集成。

依赖顺序为 `1 -> 2 -> 3 -> 4`；父任务只负责源需求、跨子任务验收和最终集成评审。
