# 修复组件监听生命周期并收敛表格渲染逻辑

## 目标

消除 `PopoverTableSelectBase` 外部点击监听在组件卸载或停用后延迟注册的风险，并在不改变 `ConfigTable` 公共行为的前提下收敛单元格 scope 与虚拟单元格事件的重复实现，降低后续维护成本。

## 背景

- `packages/components/src/PopoverTableSelect/src/composables/use-popover-table-select-base.ts:281` 使用 `nextTick(setupOutsideClickListener)` 延迟注册 `document.mousedown`；`onUnmounted` 与 `onDeactivated` 只能同步清理已经安装的监听，无法阻止待执行回调在生命周期结束后重新安装监听。
- `packages/components/src/ConfigTable/src/composables/use-config-table-renderer.ts:136` 与 `:266` 重复构造 row/cell mode 操作；`:200` 与 `:220` 的点击、双击处理仅事件名不同。
- 两个模块均已有组件级测试，可在保持既有外部行为的情况下补充针对性回归覆盖。

## 需求

### R1 外部点击监听生命周期

- 组件卸载或停用后，不得再安装或保留该实例的 `document.mousedown` 监听。
- 可见性切换、组件重新激活以及 `virtualRef` 变化时，监听最多安装一次，并能被确定性移除。
- 保持当前外部点击关闭弹层、键盘操作和重新激活行为不变。

### R2 ConfigTable 重复逻辑收敛

- 单元格 mode、row id 校验及 mode actions 由单一内部构造逻辑生成。
- 虚拟单元格单击和双击共享参数解析与事件分发逻辑。
- 保持 slot scope、renderer scope、事件名称、事件 payload 和错误文本不变。

### R3 必要注释

- 对 `ConfigTable` 的 slot 版本强制依赖补充简短注释，说明该读取用于让虚拟渲染函数追踪动态 slot 变化。
- 对外部点击监听的延迟注册仅在代码无法通过命名表达其时序原因时补充“为什么”注释；不增加叙述性注释。

### R4 验证与兼容性

- 不新增公开导出，不修改 props、emits、slot scope 或 renderer 协议。
- 新增监听生命周期竞态的回归测试，并保持现有 PopoverTableSelect 与 ConfigTable 测试通过。
- 受影响包 lint、typecheck 和测试通过。

## 范围外

- ConfigFormRenderer、AI 文档助手、富文本编辑器及其他审查建议。
- AI 文档助手已有独立 UI 优化工作，本任务不得读取或修改其代码与测试。
- ConfigTable 公共类型或渲染器插件协议重设计。
- 全仓库注释清理、目录迁移或覆盖率脚本调整。

## 验收标准

- [x] 弹层显示后立即卸载或停用组件，待 Vue next tick 完成后仍不存在该实例遗留的 `document.mousedown` 监听。
- [x] 正常显示时外部点击仍关闭弹层；隐藏、卸载和停用均能清理监听；重新激活后功能可恢复且不重复注册。
- [x] ConfigTable 单击与双击事件 payload 与重构前一致，slot renderer 和 registry renderer 的 mode actions 行为一致。
- [x] 动态 slot 更新仍能触发虚拟表头和单元格重新渲染，强制依赖的原因有明确注释。
- [x] `pnpm --filter @moluoxixi/components test` 与 `pnpm --filter @moluoxixi/components typecheck` 通过。
- [x] `pnpm lint` 通过，或仅报告与本任务无关且已明确记录的既有问题。

## 技术约束

- 优先复用 Vue 生命周期与现有项目模式，不引入新运行时依赖。
- 重构保持在 `packages/components` 内部，不扩大包边界。
- 现有未提交任务目录不属于本任务，不得修改或提交。
