# 后端实现任务书索引

> 后端实现计划（方案级，供评审「后端打算怎么做」）。前置门禁：PRD 定稿 + 测试设计定稿 + out-api 契约就绪 + 架构 ACCEPTED。

## 任务总览

```mermaid
mindmap
  root((后端任务))
    组件AI文档与调试助手
      extractor契约提取
      generator示例生成
      indexer索引+持久化
      retriever混合检索
      server-BFF流式
      ai-provider持密钥
      cli构建工具
```

## task 导航

| 需求模块 | 任务书 | 核心范围 | 状态 |
|---|---|---|---|
| 组件AI文档与调试助手 | [组件AI文档与调试助手](组件AI文档与调试助手.md) | extractor/generator/indexer/retriever/BFF/ai-provider/cli | 实现方案(PLAN) |

## 说明

- 本索引仅维护后端任务书；前端实现计划见 `docs/plan/frontend/index.md`。
- 两个子 skill 不并发写共享 `docs/plan/index.md`，避免相互覆盖。
