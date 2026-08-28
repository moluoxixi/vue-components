---
"@moluoxixi/ai-provider": major
"@moluoxixi/ai-doc-assistant": major
"@moluoxixi/i18n-tool": major
---

全仓破坏性迁移到 Vercel AI SDK：共享包改为多 Provider 模型工厂，AI 文档助手采用 UI Message Stream 与远程 embedding，i18n 工具采用 `generateText` 和显式 Provider 配置，并删除全部旧 transport、配置别名与兼容 API。
