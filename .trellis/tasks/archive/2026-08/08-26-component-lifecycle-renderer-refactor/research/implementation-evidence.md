# 实现证据

## PopoverTableSelect 生命周期

- `packages/components/src/PopoverTableSelect/src/composables/use-popover-table-select-base.ts:276-287` 在可见时通过 `nextTick(setupOutsideClickListener)` 延迟安装 `document.mousedown`。
- `setupOutsideClickListener`（`:225-231`）只检查监听是否已经安装，不检查组件是否仍处于激活状态或弹层是否仍可见。
- `cleanupEventListeners`（`:203-212`）在 virtual listener 未安装时提前返回，因此不能保证独立清理 document listener。
- `onDeactivated` 与 `onUnmounted`（`:298-299`）无法取消已经排队的 next tick 回调。
- 现有测试 helper：`createVirtualInput`（`PopoverTableSelect.test.ts:216`）、`createElPopoverStub`（`:222`）；现有外部点击测试位于 `:746-769`。

最小时序修复为：显式记录组件激活状态；延迟回调执行时同时检查激活状态与当前可见性；生命周期结束时先关闭门闩，再无条件清理 document listener。

## ConfigTable renderer 重复边界

- `createSlotParams`（`use-config-table-renderer.ts:136-174`）与 `createRendererCellScope`（`:266-301`）重复构造 `rawValue`、`rowId`、`columnId`、`mode`、惰性 row id 校验和四个 mode action。
- 两种 scope 的列集合语义不同，不能整体合并：slot scope 使用原始 `props.columns` 并暴露 `visibleColumns`；renderer scope 使用 `orderedColumns` 与 `visibleColumns` 作为 `allColumns`、`columns`。
- 错误文本必须保持为 `[ConfigTable] getRowId or a stable rowKey is required for row/cell mode APIs`，且只在调用 mode action 时惰性抛出。
- 两种 scope 的 `value` 与 `rawValue` 都保持原值；formatter 后的值只属于事件/formatter 参数。
- `handleVirtualCellClick`（`:200-218`）与 `handleVirtualCellDblClick`（`:220-238`）只有 emit 名不同，可共享参数解析 helper，但保留两个公开 handler 和两个 emit 名。
- 现有覆盖包括 slot/renderer、row id、mode、formatter、列投影以及 click/dblclick payload；需要补充 mode actions 错误契约和重构后的共同字段一致性。

## 规范现状

- `.trellis/spec/components/frontend/` 仍是待填充模板，当前没有额外项目专属约束。
- `.trellis/spec/guides/code-reuse-thinking-guide.md` 要求只在重复逻辑具有真实一致性风险时抽取；本任务只抽两处逐字重复的状态/action 构造和事件参数解析，不合并语义不同的完整 scope。
