# 架构 Collector 残余规则补齐执行计划

- [ ] 阅读现有 module graph、component ownership 和 manifest reconciliation 实现。
- [ ] 为三类规则先添加失败 fixtures 与稳定诊断断言。
- [ ] 实现跨 feature 深导入分析并跑局部测试。
- [ ] 实现包级共享组件 owner 分析并跑局部测试。
- [ ] 实现 composable 职责分析，复核 `useBem` 候选并跑局部测试。
- [ ] 运行 33 包全量架构检查，处理 unknown/stale 结果。
- [ ] 运行 lint、typecheck、unit、`git diff --check`，更新 spec 后独立提交归档。

验证以 `pnpm test:package-architecture` 和 `node --test scripts/__tests__/package-architecture.test.mjs` 为核心，并补跑受生产代码移动影响的所属包测试。
