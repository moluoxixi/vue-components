# 技术设计

## 边界

`RichTextEditor/index.vue` 保留为编排壳，只负责 props/emits/slots、布局和子组件组合。TipTap 配置放到 `services`，编辑器生命周期和状态放到 `composables`，工具栏和链接面板放到组件目录。

## 数据流

外部 `modelValue` 进入 controller，controller 创建 TipTap 实例并在外部值变化时静默 `setContent`。用户编辑由 TipTap `onUpdate` 转换为 HTML，再发出 `update:modelValue` 和 `change`。`disabled`/`readonly` 通过 controller 同步 `setEditable`。选区和 transaction 更新由 controller 维护版本 ref，供工具栏状态计算使用。

## 扩展点

默认扩展由工厂集中组装，`extensions` prop 只允许在编辑器创建时追加扩展，避免运行时重建 schema。扩展数组追加顺序由组件保证，业务扩展不需要修改组件壳。

## 工具栏契约

工具栏组件接收 `Editor`、禁用状态和 controller 提供的 `ToolbarState`。每个按钮的执行由 `RichTextToolbarCommand` 描述，统一提供 `isActive`、`canExecute` 和 `execute`，避免模板散落 TipTap chain。保留现有 toolbar slot，slot scope 继续兼容现有字段。

## 兼容性

不改变包根导出、样式导出、HTML 空文档输出、事件参数和 `RichTextEditorExpose`。公开 `editor` 仍保留为兼容 escape hatch，但内部新增代码不依赖消费者直接操作它。
