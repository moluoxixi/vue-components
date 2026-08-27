# 共享 AI Provider 包与文档助手迁移设计

## 模块边界

```text
@moluoxixi/ai-provider/shared
  ChatMessage, ProviderStatus, public errors

@moluoxixi/ai-provider/server
  ProviderConfig, config loader, streamChat, embed, redactor
             ↑
@moluoxixi/ai-doc-assistant compatibility facade
```

- `loadProviderConfig` 接受显式 `{ envKeys, defaults }`，共享包不认识 `AI_DOC_*`。
- server transport 允许注入 `fetch` 以便稳定测试；公开响应和错误不得包含上游正文原样内容。
- error 使用可穷尽 code、HTTP status/retryable/cause 元数据；只在 server 内保存 cause。
- `AbortSignal` 从调用方贯穿 fetch 与 reader，abort 保持原生 `AbortError` 语义。

## AI 文档助手迁移

- 原 `ai-provider.ts` 变为带 `AI_DOC_*` mapping/defaults 的 facade。
- 原 `ai-client.ts` 可变为共享 transport re-export 或薄 adapter。
- 根 `index.ts` 保留全部旧符号名；内部 `QueryDeps` 继续按依赖注入消费。
- router 将共享稳定错误映射为现有 wire error，不改变 query/health 协议。

## 验证策略

- 将通用配置与 transport 测试迁到共享包，同时保留 AI 文档助手兼容性回归。
- 增加 consumer/type smoke，证明旧导出与新子路径均可用。
- 增加 secret sentinel 扫描、Authorization/model/URL 断言和上游正文脱敏测试。
