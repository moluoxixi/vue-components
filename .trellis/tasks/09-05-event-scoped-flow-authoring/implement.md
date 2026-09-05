# 按事件入口锁定流程编排执行计划

- [x] 扩展 Designer 表单属性面板事件区与事件状态投影，新增表单事件 emit。
- [x] 移除 WorkbenchTopbar/移动菜单全局流程入口，收紧 `openFlowWorkspace` 为带 trigger 上下文的调用。
- [x] 重构 FlowDialog/FlowWorkspace props 与 composable，锁定 trigger、单流程过滤、本地 draft 和删除确认。
- [x] 在 Core、Model、Compiler 中移除 `field.change` 并增加重复 trigger 校验。
- [x] 删除 Workbench preview/source 的 `field.change` dispatch 与相关协议分支，更新测试和文档。
- [x] 增加事件入口、锁定上下文、空 draft、删除、重复 trigger、旧 trigger 拒绝的 unit/E2E 回归。
- [x] 运行 Designer/Core/Model/Compiler/Workbench unit、typecheck、build、E2E 与 package smoke。
- [x] 更新相关 spec，独立提交并归档任务。
- [x] 将 Pages 的 ConfigForm 远程目录硬切到最新 Workbench，并验证完整 Pages artifact。

## 验证命令

```powershell
pnpm --filter @moluoxixi/config-form-core test
pnpm --filter @moluoxixi/config-form-core typecheck
pnpm --filter @moluoxixi/config-form-model test
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm --filter @moluoxixi/config-form-compiler test
pnpm --filter @moluoxixi/config-form-designer test
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm test:config-form-packages
pnpm test:package-architecture
git diff --check
```
