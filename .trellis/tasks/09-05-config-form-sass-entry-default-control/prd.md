# ConfigForm Sass 入口与默认值控件收口

## 目标

移除无意义样式 TypeScript 入口，并统一注册默认值控件的属性字段结构。

## 需求

- ConfigForm 发布包的组件样式只保留 `style/index.scss` 手动/按需入口，不再增加仅导入 Sass 的 `style/index.ts`。
- 删除零导出、零调用的 `styles/index.ts` 占位文件；实际执行样式加载的 TypeScript 模块归入其服务 owner。
- Designer 发布组件不隐式绑定组件 Sass；Workbench 与 Playground 私有组件直接导入明确的 SCSS 文件。
- 保持现有公开 Sass 子路径、聚合样式内容、主题变量和构建产物语义稳定。
- 已注册的 `defaultValue` 属性控件使用与 text/number 等注册控件相同的表单字段外壳。
- Element Plus 默认值继续使用 `ElInput`、`ElInputNumber`、`ElSwitch`、`ElSelect`、`ElDatePicker`、`ElTimePicker`，并将字段 `id` 与 ARIA 属性传递给真实控件。
- 未注册 adapter 时继续使用 Designer 核心 fallback；choice custom setter 行为不变。

## 验收标准

- [x] `packages/` 下不存在 `style/index.ts` 或无意义 `styles/index.ts`。
- [x] Designer 的 `sideEffects` 与公开 Sass exports 保持正确，Workbench/Playground 样式正常加载。
- [x] 注册默认值字段使用统一的 `is-simple is-control-default-value` 外壳，`label[for]` 指向真实 Element Plus 输入节点。
- [x] 默认值与普通 Element Plus 属性输入保持相同静态/聚焦尺寸、圆角和单层 focus frame。
- [x] Designer、Element Plus Designer、Workbench、Playground 的相关 unit、typecheck、build、E2E 通过。
- [x] 根 lint、package architecture 与 `git diff --check` 通过。

## 范围外

- 不改变公开组件 API、主题配色或 Runtime 画布样式。
- 不把 Ant Design Vue 核心 fallback 强行改为 Element Plus。
- 不修改用户已有的 release workflow 改动。
