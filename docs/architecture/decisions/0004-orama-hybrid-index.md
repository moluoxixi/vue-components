# ADR-0004 知识库索引存储与检索选型（Orama 混合检索）

## 状态

superseded（2026-06-15，由 ADR-0006 默认 content 检索与 ADR-0007 vector 可选增强取代）

## 背景

2026-06-13 的 PRD 曾要求知识库「向量检索为主 + FTS 全文检索多路混合」，索引存于包内本地文件（构建产物 + `.cache/`，无外部 DB），embedding 走 `text-embedding-3-small`。需选定向量存储与检索实现。开发者当时明确要求**使用标准（成熟）向量库**，不自研。

2026-06-15 重新评估后，开发者确认默认场景不必先引入向量工具库：组件契约是高度结构化语料，几千到上万个组件也可以先用结构化关键词 topK、字段注释和来源约束解决大多数问题。向量检索降级为显式可选增强。

## 决策

历史决策：采用 [`@orama/orama`](https://www.npmjs.com/package/@orama/orama)（v3.x）作为向量优先知识库引擎，配 `@orama/plugin-data-persistence` 做包内本地文件持久化。

当前有效决策：

- 默认检索策略见 ADR-0006：结构化关键词 topK，无 embedding、无向量库、无持久化向量索引。
- vector 可选增强见 ADR-0007：保留 Orama 作为本地内存向量后端之一，另可切 Qdrant 等外部向量库。

理由：

- Orama 单库**原生支持全文（BM25）+ 向量 + 混合（hybrid）检索**，一个成熟库直接满足「向量为主 + FTS 混合」，无需手搓多路召回融合（遵循「不重复造轮子」红线）。
- 纯 JS、零原生编译依赖，浏览器 / Node / edge 都能跑，与「包内本地文件、随包分发」目标契合（对比 `hnswlib-node` 需原生编译，跨平台分发成本高）。
- `plugin-data-persistence` 支持把索引序列化到本地文件并加载，匹配索引状态机 `未构建→构建中→就绪→过期`。
- 体积小、活跃维护。

## 替代方案

- `hnswlib-node`：向量检索强，但需原生编译、无内置 FTS，跨平台随包分发困难，且要自己拼 FTS 融合，否决。
- `vectra`：file-backed + BM25 混合可行，但生态与混合检索成熟度不及 Orama，列为后备。
- 纯内存 + 自写 cosine + 自写 FTS：违背「用标准向量库」要求，否决。

## 影响

- `@orama/orama` 与持久化插件不再是默认 content 链路的核心依赖，只在 vector 增强/兼容索引模块中使用。
- 默认 `build-index` 只需抽取公共契约并建立关键词检索态，不调用远端 embedding。
- vector 模式改用本地 embedding，维度跟随本地模型；不再绑定 `text-embedding-3-small` 1536 维。

## 后续约束

- 历史向量优先内容只作为背景，不再约束默认实现。
- 若启用 vector，按 ADR-0007 的本地 embedding / 可插拔存储约束执行。
