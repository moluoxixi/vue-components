# 共享 AI Provider 包与文档助手迁移实施计划

- [x] 新建 `packages/ai-provider` manifest、exports、Vite build、tsconfig 与测试基座。
- [x] 实现 shared DTO、server config loader、redactor、稳定错误与 OpenAI-compatible transport。
- [x] 迁移 provider/client 通用测试，并补 URL/header/model/secret/error/abort 覆盖。
- [x] 在 AI 文档助手中实现 `AI_DOC_*` mapping/defaults 与旧路径 facade。
- [x] 更新 AI 文档助手内部 imports 和根入口兼容 re-export。
- [x] 核验 health/query/SSE、context 构造、断连取消和 UI 行为无回归。
- [x] 更新 workspace 依赖、coverage filter、Changeset 和发布声明验证。
- [x] 运行新包 test/typecheck/build/pack 与 AI 文档助手 test/typecheck/build/e2e。

## 回滚点

- 在切换 AI 文档助手 imports 前单独验证共享包。
- 兼容测试失败时恢复原内部实现，但保留共享包与新增测试以便修正。
