# Workspace 包依赖循环门禁执行计划

- [x] 抽取通用稳定 SCC 私有服务并保持 module-cycle 测试通过。
- [x] 实现 workspace package graph 与 `package.circular-dependency` collector。
- [x] 接入 service barrel 和总 architecture diagnostics。
- [x] 添加 dependency/peer/optional、两/三节点、自环、external/dev、重复边与稳定结果测试。
- [x] 运行 live architecture audit，确认当前 package/module cycle 均为零。
- [x] 更新 spec，运行根 lint、package architecture、`git diff --check` 后提交归档。

## 验证记录

- package architecture：19 个测试通过，覆盖 package/module 两级 SCC、稳定 identity 与 aggregate collector。
- live architecture：33 个包，0 package cycle、0 module cycle、0 debt/unknown/stale。
- 独立源码跨包图审计：51 条 workspace source 边，无 SCC/self edge。
- 根 lint 与 `git diff --check`：通过。
