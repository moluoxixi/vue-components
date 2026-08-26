# 技术设计

## 设计目标

在不改变公开 API 和现有交互语义的前提下，关闭 PopoverTableSelect 的异步监听生命周期缺口，并让 ConfigTable 的单元格 mode/action 与事件参数解析拥有单一实现来源。

## 变更边界

### PopoverTableSelectBase

在现有 composable 内维护一个非响应式生命周期门闩，表示当前实例是否允许安装 DOM 监听：

1. `onMounted` 和 `onActivated` 在安装监听前开启门闩。
2. `onDeactivated` 和 `onUnmounted` 先关闭门闩，再执行统一清理。
3. 可见性 watcher 仍延迟到 next tick 安装外部点击监听，但回调执行时重新检查门闩和当前 `visible`。
4. `cleanupEventListeners` 无条件先清理 document listener，再按 `virtualListenersInstalled` 清理 virtual element listener，消除两个监听状态之间的不正确耦合。
5. `virtualRef` 变化时始终清理旧监听，仅在生命周期门闩开启时安装到新节点，避免 KeepAlive 停用期间重新安装。

不引入通用 composable：当前延迟安装协议只在一个模块使用，新增跨文件抽象会大于收益。

### ConfigTable renderer

保留 `createSlotParams` 与 `createRendererCellScope` 两个函数，因为它们的列集合公开语义不同。仅抽取共同的内部 cell mode state helper，负责：

- `rawValue`、`rowId`、`columnId` 和有效 mode；
- 惰性 `requireRowId`；
- `setRowMode`、`clearRowMode`、`setCellMode`、`clearCellMode`；
- scope 中保持原值的 `value`。

两个 scope creator 分别组装自己的 `columnIndex`、`sourceColumnIndex`、`allColumns`、`columns` 和 `visibleColumns`，避免无意扩大或改变协议。

新增一个内部虚拟单元格参数解析 helper，统一完成 raw row、配置列、source/visible index 和 `createCellParams` 调用。现有 click/dblclick handler 继续分别调用类型明确的 `emit('cellClick', ...)` 与 `emit('cellDblClick', ...)`，不使用联合事件名绕过 overloaded emit 类型。

## 注释策略

- 在虚拟表头与单元格渲染前对 `slotsVersion` 的读取处，用一条注释说明它用于建立动态 slot 变更的响应式依赖。
- 生命周期门闩、调度 helper 通过命名表达用途；只在延迟回调处保留必要的时序说明。
- 不为字段赋值或简单 wrapper 添加叙述性注释。

## 兼容性

- 不改变公开 exports、props、emits、slot scope 类型或 HeadlessTable renderer 类型。
- 不改变错误文本、惰性抛错时机、formatter 运行时机或 raw/formatted value 语义。
- 不新增依赖，不迁移目录。

## 测试设计

### PopoverTableSelect

- 初始可见后立即卸载，再等待 next tick，断言没有遗留 document mousedown listener。
- 可见后在延迟安装前关闭，断言旧回调不会重新安装监听。
- KeepAlive 停用使待执行注册失效；重新激活且仍可见时只恢复一次监听。
- 保持既有外部点击、空 popover ref、键盘与重新激活测试通过。

### ConfigTable

- 对 slot scope 与 renderer scope 断言共同的 raw value、mode、row id 和四个 actions 行为一致，同时锁定各自不同的列集合语义。
- 无稳定 row id 时，读取 scope 不抛错；调用四个 action 时保持原错误文本。
- click 与 dblclick payload 除事件类型外保持相同的 row、column、索引、rawValue、formatter 后 value 和 mode。

## 风险与回滚

- 风险集中在 KeepAlive 生命周期顺序、Vue next tick 测试稳定性和 scope spread 后的字段覆盖顺序。
- 测试通过 listener add/remove 计数与实际事件行为双重验证，避免只验证 mock 调用。
- 若 ConfigTable 类型推断因 helper spread 变宽，给内部 helper 增加精确返回类型，不放宽公开类型或使用 `any` 规避。
- 两个模块互不依赖，可按文件分别回滚。
