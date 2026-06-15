# ADR-0007 vector 可选增强

## 状态

accepted（2026-06-15）

## 背景

默认 content 检索适合结构化组件契约，但在用户问题高度口语化、同义词多、跨组件语义聚合明显时，关键词 topK 可能召回不足。向量检索仍有价值，但不应成为默认依赖和默认 token/构建成本。

## 决策

保留 `vector` 作为显式可选增强：

- 通过 `AI_DOC_RETRIEVAL_MODE=vector` 或插件/ServerContext 选项启用。
- 使用本地 embedding 模型生成文档向量和查询向量，默认不依赖远端 embedding key。
- 向量存储经 `VectorStore` 抽象接入，当前保留 Orama 内存后端，并预留 Qdrant 等外部后端。
- vector 模式的重依赖通过动态 import 按需加载，默认 content bundle 不触碰。

## 影响

- 大知识库或语义召回不足时可以切 vector，而不改动上层 BFF / UI / query-handler 契约。
- 本地模型首次加载和索引构建可能较慢，必须显式暴露构建状态和失败原因。
- 向量维度、embedding 数量与文档数量必须严格一致；不允许用空向量、截断或默认值伪装成功。

## 约束

- vector 不是默认路径，不得让 content 模式隐式下载模型或构建向量索引。
- 外部向量后端连接配置属于系统边界，缺少 URL / collection 等必需字段时必须抛错。
- 检索无可信命中时仍返回 empty，由上层执行无依据兜底。
