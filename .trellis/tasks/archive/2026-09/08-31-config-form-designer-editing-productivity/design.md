# 设计器高效编辑与操作历史技术设计

## 1. 边界

本任务只增强 Workbench/Designer 的编辑器体验。`ProjectDocument`、
`ProjectEditorSession` 和 `ProjectDomainEngine` 仍是唯一业务状态与历史来源；
选择、焦点、快捷键防抖、toast、时间线展开状态都属于瞬态 UI 状态，不写入文档。

DesignSurface 继续通过 `DesignerCommandControl.execute()` 提交
`ProjectCommand`，批量复制、删除、移动和属性调整必须在一次 command 中完成，
从而由现有 Engine 产生一个 history entry 和一组 changeSet。

## 2. 操作历史只读投影

Workbench 在 `ProjectEditorSessionSnapshot` 中增加只读的历史摘要投影，或由
session 提供等价的 `history` getter；投影内容只包含：

- 稳定的 entry id、label、timestamp、editVersion；
- 当前 cursor 与 `past`/`future` 的可跳转位置；
- history limit 和是否存在 redo 分支。

禁止把完整 document、inverse operation 或可变 history 对象暴露给 UI。历史跳转
通过 session 的 `undo()` / `redo()` 重复执行 Engine 操作，不能用时间线快照替换
ProjectDocument。若需要跳到旧位置，按当前 cursor 与目标位置计算最短方向并逐步
调用 undo/redo；任一步失败即停止并显示诊断。

## 3. 快捷键与编辑边界

在 DesignSurface 根节点注册一个可卸载的 keydown 处理器，覆盖：

- `Ctrl/Cmd+Z` 撤销；`Ctrl/Cmd+Shift+Z` 与 `Ctrl/Cmd+Y` 重做；
- `Delete`/`Backspace` 删除顶层有效选择；
- `Ctrl/Cmd+D` 复制顶层有效选择。

处理器只在 DesignSurface 拥有焦点或事件来自其编辑器 overlay 时生效，并在
`INPUT`、`TEXTAREA`、`SELECT`、`contenteditable`、Monaco、Preview iframe、
setter 控件和只读状态下退出。快捷键与 toolbar、Layers、Canvas 共享同一个
controller action；不直接操作 DOM 或创建第二次 command。

## 4. 删除撤销反馈

Workbench UI store 增加 transient notice：`message`、语义 tone、可选 undo
callback 的结构化状态。Designer 在删除 command 成功后发出包含 command identity
的通知，通知操作调用同一 `historyControl.undo()`，且 callback 只能执行一次。
连续删除会替换当前通知但不会合并 history；键盘 Undo 和通知 Undo 走相同 Engine
路径。通知使用 `role=status`/`aria-live=polite`，自动消失不影响历史。

## 5. 交互与数据流

```text
Canvas/Layers/Shortcut/Toolbar
        -> DesignerController action
        -> ProjectCommand
        -> ProjectEditorSession / DomainEngine
        -> ProjectSnapshot + history cursor
        -> Workbench projection + HistoryPanel
```

Canvas 与 Layers 的 selection 仍使用 controller 的顶层有效集合；父子同时选中时
批量操作只处理祖先节点，既有 `topLevelSelectedIds()` 规则继续作为唯一判定。
Range selection 的文档顺序保持稳定，跨容器排序仍复用现有 target resolver 与
`node.move` operation。

## 6. 可访问性与失败策略

- 所有图标按钮保留可见 tooltip、`aria-label` 和 disabled 状态；快捷键反馈写入
  live region。
- 历史面板只展示可跳转条目；达到 limit 的旧条目明确标记不可用。
- 发生 readonly、诊断或跨页面变化时不改变 selection/history；通知展示失败原因。
- 快捷键不抢占文本编辑、代码查看、Preview 运行态和浏览器原生输入行为。

## 7. 兼容与性能

不引入 Sortable 或新的状态管理库。历史摘要按当前 session snapshot 计算并限制
渲染数量，时间线 UI 不参与编译、持久化、导出或 Preview revision。所有批量动作
仍是单个 command，避免按节点循环产生多个 revision。
