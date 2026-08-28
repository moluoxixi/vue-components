# Designer 拖拽落点与全物料回归测试技术设计

## 交付边界

本子任务只修改 Designer 的拖拽落点、嵌套容器投放、末尾追加和字段宽度表现，并补齐 Element Plus / Ant Design Vue 的物料回归测试。Config Model、Registry 的持久化协议和导出/流程引擎边界保持不变。

## 当前数据流

```text
Palette Sortable (clone)
  -> DesignerNodeList Sortable (onAdd/onEnd)
  -> DesignerDropTarget(parentId, slot, index)
  -> useDesignerController.addMaterial / move
  -> Model reducer validation + operation
  -> DesignerDocument projection / Runtime Preview
```

`index === siblings.length` 已被 Model reducer 接受；因此 UI 必须修复目标列表和末尾落点计算，不能放宽 reducer 校验来掩盖 DOM 错误。

## 拖拽目标设计

1. 为每个 `DesignerNodeList` 建立稳定的列表级 drop metadata：`parentId`、`slot`、允许的 node kind/material，以及可命中的 trailing drop zone。
2. trailing drop zone 不参与 `draggable`，但参与 Sortable 的插入计算；从 DOM 子项计算 `newIndex` 时只统计真实 `[data-designer-draggable]` 节点，忽略空槽提示和设计态 chrome。
3. `onAdd` / `onEnd` 统一经过纯函数 target resolver，把列表身份、节点前后关系和末尾 sentinel 转换成 `DesignerDropTarget`。无效 target 只显示诊断，不触发 Model operation。
4. 对嵌套容器使用 Registry 的 slot accepts/materials 做投放前反馈和投放后校验。Collapse/Tabs 只允许对应 item/pane；Section/Card/Grid/Flex 允许 Registry 声明的 field/container。
5. Palette clone 的 drag session、Sortable fallback、取消和非法落点都必须清理 ghost/fallback DOM、selection 和 `is-dragging` 状态；Model reducer 仍是最终权威校验。
6. 保留点击新增和键盘新增作为不依赖 Pointer/Sortable 的可访问性路径，并让它们复用同一个 target resolver。

## 字段宽度设计

- DesignerNodePreview 的 field control、adapter 设计态 wrapper 以及 date/time 具体控件统一使用 `width: 100%; min-width: 0` 的语义约束。
- Element Plus 的 date/time editor 与 Ant Design Vue 的 picker/range picker 只通过适配器 class 或 Designer scope 约束，不污染外部 Runtime 页面。
- 宽度不得依赖固定像素；在 label left/top、root grid span、嵌套 layout、inline、desktop/tablet/mobile 下均以父 control 的可用宽度为基准。
- Canvas 和 Preview 继续共用 Runtime component；测试同时测量 Designer control 与 Preview control 的几何宽度。

## 全物料测试矩阵

- 测试 fixture 从 `createElementPlusDesignerRegistry().listMaterials()` 和 `createAntdVueDesignerRegistry().listMaterials()` 动态读取 material key。
- 为每个 material 推导默认创建节点、合法父/slot 集合和受限 slot 的非法候选；不在测试中复制 Registry 的 accepts/materials 规则。
- 单元层测试 target resolver、append index、slot filter、cancel cleanup 和 adapter width class。
- 浏览器层按 adapter 分组执行：field add/drag/root/合法嵌套/undo-redo；layout add/合法子节点/末尾追加/嵌套；受限容器非法投放；date/time 几何宽度。
- 测试失败消息必须包含 adapter、material key、source/target parent、slot 和期望 index，便于定位新增物料漏接线。

## 兼容性与回滚

- 不改变 `DesignerDropTarget`、`DesignerCommand` 和 Registry 对外类型；新增 resolver/sentinel 为内部实现或向后兼容扩展。
- 不持久化 Sortable 实例、DOM 坐标、ghost 节点或拖动 session。
- 若某适配器组件无法在设计态提供稳定宽度，优先增加适配器局部 class 和测试，不修改 Runtime 公共布局协议。
- 回滚点分为：拖拽 resolver/DOM、宽度样式、测试矩阵三组，可独立回退。
