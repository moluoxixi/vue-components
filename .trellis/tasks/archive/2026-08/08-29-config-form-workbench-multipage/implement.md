# 实施计划

- [x] 定义 v2 Application/Page 类型、strict schema、route/id/home 不变量与 clone/summary/revision 工具。
- [x] 实现 v1 parser 与幂等 migration，增加合法、损坏、重复迁移 fixture。
- [x] 升级 Memory/IndexedDB repository、draft、template、upgrade 和项目入口测试。
- [x] 实现 Application operations 与节点/引用 ID 重映射测试。
- [x] 重构 Workbench 状态为 current Application/current Page，隔离逐页 history、selection 和 preview revision。
- [x] 移除顶部 select，改造左侧 Pages，新增 Page Manager 及完整交互测试。
- [x] 升级 Source/Config 导出输入为多页面 Application，验证生成工程类型检查和构建。
- [x] 执行 Workbench lint、typecheck、unit/integration tests、build 和浏览器流程验证。

## 回滚点

- migration/repository 是独立提交边界；未通过 round-trip 不接入 UI。
- Workbench 状态重构完成后再接 Page Manager，避免管理 UI 与持久化同时调试。
- 多页面导出未构建成功前保留旧生成器作为测试 oracle，不作为写入真源。
