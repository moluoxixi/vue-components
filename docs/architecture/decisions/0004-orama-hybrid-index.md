# ADR-0004 知识库索引存储与检索选型（Orama 混合检索）

## 状态

accepted（2026-06-13，开发者确认「用标准向量库」）

## 背景

PRD 要求知识库「向量检索为主 + FTS 全文检索多路混合」，索引存于包内本地文件（构建产物 + `.cache/`，无外部 DB），embedding 走 `text-embedding-3-small`。需选定向量存储与检索实现。开发者明确要求**使用标准（成熟）向量库**，不自研。

## 决策

**采用 [`@orama/orama`](https://www.npmjs.com/package/@orama/orama)（v3.x）作为知识库引擎，配 `@orama/plugin-data-persistence` 做包内本地文件持久化。**

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

- 新增依赖 `@orama/orama` + `@orama/plugin-data-persistence`。
- `indexer` 负责建库 + 调 embedding 写入向量 + persist 到本地文件；`retriever` 负责 load + hybrid search。
- embedding 维度需与 `text-embedding-3-small`（1536 维）在建库 schema 中对齐。
- 检索目标 < 500ms：Orama 内存检索满足，瓶颈在 embedding 网络调用（查询期对用户问题算 embedding），需做查询向量缓存。

## 后续约束

- 索引 schema 固定 embedding 维度；更换 embedding 模型需重建索引并升版本。
- persist 产物纳入 `files` 白名单随包分发（见 ADR-0005 / overview 部署节）。
