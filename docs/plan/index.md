# 实现计划总览

> 项目级实现计划入口。前后端按域拆分，各自维护子索引，互不并发写本文件（由本环节串行单独维护）。

## 子索引

| 域 | 索引 | 说明 |
|---|---|---|
| 后端 | [docs/plan/backend/index.md](backend/index.md) | extractor/generator/indexer/retriever/BFF/ai-provider/cli |
| 前端 | [docs/plan/frontend/index.md](frontend/index.md) | 调试台 UI：问答区/预览区/Props控件/SSE消费/沙箱宿主 |

## 门禁链路状态

PRD（定稿）→ 架构（ACCEPTED，5 ADR + 2 spike 验证）→ API/组件契约（就绪）→ 测试设计（定稿，28 用例）→ **实现计划（方案级 PLAN，前后端各一份）**。

实现计划经评审确认后，进入代码生成环节（按 task 驱动，前后端分别由 coding 子代理执行）。
