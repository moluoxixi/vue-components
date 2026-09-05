# Element 默认值控件样式一致性

## 目标

修复 Element Plus Designer 属性面板中默认值输入控件与普通输入控件的 class 和视觉样式不一致，并确认样式按 Sass 入口按需暴露。

## 需求

- 默认值的 text、number、boolean、select、multiselect、date、time 均继续使用 Element Plus 组件。
- 保留调用方自定义 class，移除仅用于 Designer 路由的 `is-default-value` 标记，并避免重复基础 class。
- `multiselect` 继续复用 `is-select` 视觉 class，不改变现有控件值、事件或禁用行为。
- 组件样式入口保持 `style/index.scss`，不得新增 TypeScript 副作用包装。

## 验收标准

- [x] 默认值文本输入与普通属性 `ElInput` 的根 class、尺寸、背景、边框、圆角、padding 和字体一致。
- [x] 所有默认值 kind 的 Element Plus 组件与类型 class 由单测覆盖。
- [x] Vue 字符串、数组和对象 class 可归一化，调用方 class 不丢失且基础 class 不重复。
- [x] adapter unit、typecheck、build、Workbench unit/E2E、根 lint 与架构门禁通过。

## 范围外

- 不修改 Element Plus 主题色、属性面板布局或其他 adapter 控件交互。
