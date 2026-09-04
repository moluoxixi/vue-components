# Packages 全仓结构治理收尾

## 目标

完成 `packages/` 全仓结构治理的最后一轮可验证收口，使发布合同、目录所有权、P2 服务边界和全仓门禁与已建立的包根 `index.ts + src/` 合同一致。

## 背景

- 当前 33 个受治理包已通过包根入口架构检查，不存在重复的 `src/index.ts` 总入口或已登记架构债务。
- 完成审计仍发现四类独立缺口：发布包元数据、架构 collector 覆盖、ConfigForm Workbench 两个 P2 服务边界、AI 文档组件发现服务边界。
- 本任务作为父任务，只维护来源需求、子任务映射和最终集成验收，不直接承载生产代码实现。

## 子任务

1. `09-05-published-package-contracts`：发布包源码、README、`sideEffects` 与自动门禁收口。
2. `09-05-architecture-collector-residual-rules`：补齐跨 feature 深导入、共享组件 owner 和无状态 composable 规则。
3. `09-05-config-form-large-service-boundaries`：拆分 Workbench 导出源码与 Monaco language features 的独立职责。
4. `09-05-ai-doc-discovery-boundary`：拆分 AI 文档组件发现服务的工作区解析、AST 遍历和策略编排。

## 需求

- 每个子任务必须独立规划、验证、提交和归档，不在一个提交中混合不同责任边界。
- 保持公共 API、数据协议、样式和用户可观察行为不变；任何必须改变公共合同的发现应回到规划阶段。
- 用户现有的 `.github/workflows/release.yml` 与 `scripts/__tests__/release-workflows.test.mjs` 修改不属于本任务，不得覆盖或混入提交。
- 结构规则必须进入自动门禁，不能只依赖人工审计或文档约定。
- 不以行数为唯一拆分依据；数据表、规范模型和已清晰承担单一职责的组件不做机械拆分。

## 验收标准

- [ ] 四个子任务均完成验证、独立提交并归档。
- [ ] 所有发布包的源码条件、发布文件、README 和 `sideEffects` 合同可由自动测试验证。
- [ ] 架构 collector 自动覆盖剩余的目录与所有权合同，且现有生产代码无未知诊断。
- [ ] 三个 P2 服务文件按真实职责拆分，原公共入口和运行时行为保持稳定。
- [ ] 全仓 lint、typecheck、unit、build、package architecture 与 packed consumer 验证通过。
- [ ] ConfigForm Workbench、Designer、package smoke 和 E2E 门禁保持通过。
- [ ] `git diff --check` 通过，工作树仅保留用户原有的无关修改。

## 范围外

- 不处理第三方或生成源码。
- 不为降低行数拆分纯数据目录、规范 schema 或根应用装配层。
- 不发布、不 push，也不修改 release 流程的既有用户改动。

## 阻塞问题

无。
