# @moluoxixi/ai-doc-assistant

组件库的契约提取、知识库检索和 AI 问答工具。默认使用 `content` 检索；可选的 `vector` 模式使用 Vercel AI SDK 调用远程 embedding Provider。

## 安装

```bash
pnpm add -D @moluoxixi/ai-doc-assistant vite vue
```

## 公共入口

| 入口                                       | 用途                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| `@moluoxixi/ai-doc-assistant`              | 契约抽取、索引、服务端上下文和查询编排                  |
| `@moluoxixi/ai-doc-assistant/plugin`       | `aiDocAssistant` Vite 开发服务器插件                    |
| `@moluoxixi/ai-doc-assistant/protocol`     | browser-safe 请求、响应、错误码和 UI Message 数据块类型 |
| `@moluoxixi/ai-doc-assistant/api-contract` | 把抽取结果投影为文档 API 表格的类型与规范化函数         |

Vite 配置可以直接使用独立插件入口：

```ts
import { aiDocAssistant } from '@moluoxixi/ai-doc-assistant/plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    aiDocAssistant({
      componentEntries: ['packages/components/index.ts'],
    }),
  ],
})
```

## 运行

```bash
pnpm exec ai-doc-assistant serve --root . --entries packages/components/index.ts
```

`--entries` 接受逗号分隔的公共入口；没有稳定入口时可改用逗号分隔的 `--globs`。`serve` 还支持 `--host` 与 `--port`，面板默认地址为 `http://127.0.0.1:5173/__ai-doc/`。也可以运行 `ai-doc-assistant build-index` 只构建和校验知识库。

## Chat 配置

Chat Provider 必须显式配置，不提供默认 Provider、模型或 relay：

```dotenv
AI_DOC_CHAT_PROVIDER=openai
AI_DOC_CHAT_API_KEY=your-key
AI_DOC_CHAT_MODEL=gpt-4o-mini
```

支持 `openai`、`anthropic`、`google` 和 `openai-compatible`。使用 `openai-compatible` 时还必须设置 `AI_DOC_CHAT_BASE_URL`。

## Vector 与远程数据边界

默认的 `content` 模式不调用 embedding Provider。启用 `vector` 后，构建索引会把提取出的组件契约正文发送给所选远程 embedding Provider，查询也会发送给同一 Provider。该过程需要网络访问，可能产生调用费用，并受供应商的数据处理与保留政策约束；请确认代码和文档内容允许发送到该供应商。

```dotenv
AI_DOC_RETRIEVAL_MODE=vector
AI_DOC_EMBEDDING_PROVIDER=google
AI_DOC_EMBEDDING_API_KEY=your-key
AI_DOC_EMBEDDING_MODEL=gemini-embedding-001
```

Embedding 支持 `openai`、`google` 和 `openai-compatible`。使用 `openai-compatible` 时还必须设置 `AI_DOC_EMBEDDING_BASE_URL`。Provider、模型、兼容端点或组件契约发生变化后，现有索引会进入 `stale`，必须全量重建。

Vector 索引默认保存到 `<root>/.ai-doc-index`；可通过 `AI_DOC_INDEX_DIR` 指定其他目录。

面板运行状态会显示当前检索模式和远程 embedding Provider，并持续提示组件契约上传与潜在费用。API key 只在服务端内存中使用，不会进入浏览器请求、响应或公开状态。

## Qdrant

`vector` 模式默认使用 Orama。切换到 Qdrant 时必须显式提供连接信息：

```dotenv
AI_DOC_VECTOR_STORE=qdrant
AI_DOC_QDRANT_URL=http://127.0.0.1:6333
AI_DOC_QDRANT_COLLECTION=ai-doc-components
AI_DOC_QDRANT_API_KEY=
```

Qdrant collection 会保存 embedding 身份与组件源哈希。远端 collection 被其他实例以不同 Provider、模型、端点或组件内容重建后，本地索引不会恢复为 ready，需重新构建。

## 开发验证

```bash
pnpm --filter @moluoxixi/ai-doc-assistant test
pnpm --filter @moluoxixi/ai-doc-assistant typecheck
pnpm --filter @moluoxixi/ai-doc-assistant build
```
