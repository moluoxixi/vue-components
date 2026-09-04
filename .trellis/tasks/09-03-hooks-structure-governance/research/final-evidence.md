# Hooks 包结构治理验收证据

## 结构结果

- 本任务 6 条 architecture debt 全部消失，tracked debt 从 114 降至 108；无 unknown/stale diagnostic。
- 六个 hook 实现均进入各自 feature 的 `state/`，feature/state barrels 均为纯导出；旧实现路径不存在。
- `normalizePositiveInteger` 原样迁至 `useRequestTable/utils`，只有 state 实现消费，未进入根公共 API。
- 最大生产实现 109 行，无 P0/P1/P2；无 unresolved/deep imports 或 emitted-value cycle。

## 行为与公共边界

- 根 runtime surface 精确保持六个 hook 与 `normalizeQueryKey`、`invalidateQueryKeys`。
- RequestTable 外部 Ref、getter projection、deep params watch 与 fallback/clamp/truncate 语义已锁定。
- Form/Batch 使用 deferred invalidation 证明完成后才触发 `onSuccess`，Batch 在此后才清空 selection。
- Package 仍仅暴露根 entry；tarball 包含 `dist`、`index.ts`、`src`，不新增 subpath。
- README 示例按真实 `submit({ mode,id,values })` 与 `operate({ keys,payload })` 契约编写。

## 验证结果

- Hooks unit：7 files / 35 tests。
- Coverage：98% statements、93.44% branches、93.87% functions、98% lines；私有 pagination utils 100%。
- Hooks typecheck/build 通过；dry-run pack 67 files且 source closure 完整。
- Components consumer：15 files / 108 tests，typecheck/build通过。
- Architecture：11/11，33 packages / 108 tracked debt；path contracts：8/8；workflow validation通过。
- 全仓 lint 与 `git diff --check` 通过。
- Packed Node smoke：29 packages / 58 public JavaScript entries。
- Packed browser smoke：23 browser JavaScript entries、3 stylesheets、8 batches 与发布包浏览器应用通过。

## 独立复核

- 结构审查确认六个移动函数体等价、纯 helper 唯一消费、响应式责任与依赖方向正确。
- 公共审查发现 README mutation 示例错误、缺 invalidation 顺序和 deep watch characterization；均已修复并重跑门禁。
