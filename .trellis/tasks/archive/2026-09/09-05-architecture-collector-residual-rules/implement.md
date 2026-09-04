# 架构 Collector 残余规则补齐执行计划

- [x] 阅读现有 module graph、component ownership 和 manifest reconciliation 实现。
- [x] 为三类规则先添加失败 fixtures 与稳定诊断断言。
- [x] 实现跨 feature 深导入分析并跑局部测试。
- [x] 实现包级共享组件 owner 分析并跑局部测试。
- [x] 实现 composable 职责分析，复核并迁移无状态候选。
- [x] 运行 33 包全量架构检查，处理 unknown/stale 结果。
- [x] 运行 lint、typecheck、unit、build、consumer smoke 与 `git diff --check`，更新 spec。
- [x] 独立提交并归档子任务。

验证以 `pnpm test:package-architecture` 和 `pnpm exec vitest run scripts/__tests__/package-architecture.test.mjs` 为核心，并补跑受生产代码移动影响的所属包测试。

## 验证结果

- package architecture：15 个 fixture 测试通过；33 个包为 0 tracked debt、0 unknown、0 stale exception。
- ConfigForm Runtime：23 个测试文件、210 个测试通过；typecheck/build 通过。
- ConfigForm Designer：19 个测试文件、84 个测试通过；最终路径移动的 6 个交互测试、typecheck/build 通过。
- AI 文档助手：28 个测试文件、223 个测试通过；typecheck/build 通过；VectorStrategy 只存在于独立动态 chunk，不进入默认 `dist/index.js`。
- ConfigForm public package boundaries：14/14 构建任务与 installed consumer smoke 通过。
- Workbench：51 个测试文件、462 个测试通过；typecheck/build 与 bundle verifier 通过。
- 根 `pnpm lint` 与 `git diff --check`：通过。
