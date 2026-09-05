# Workbench Shell 样式所有权拆分

## 目标

拆分 shell.css 中 theme、Appearance、Topbar 与 Preview owner 样式。

## 需求

- 将 document foundation、Workbench theme token/palette、根 shell 分为命名清晰的全局层。
- WorkbenchCommandHint、Appearance Panel/Popover/Drawer、WorkbenchTopbar、PreviewDrawer 专属规则移动到各组件 `style/index.css`。
- App layout/mobile dock 归 `app/style/index.css`，Template mobile action 归 TemplateCreationWorkspace owner。
- 对应 component-specific media/coarse/reduced-motion 规则一并迁出全局 `responsive.css`；该文件只保留跨 shell/breakpoint 协调。
- 删除无生产 DOM owner 的 `.editor-file-meta*`、`.pane-error` 和不可命中的 `.appearance-swatch i`。
- `styles/index.css` 继续同步聚合全部层，theme 在所有 token consumer 前，responsive 保持最后。
- 不改 selector declaration、主题值、断点、组件 DOM 或异步加载边界。

## 验收标准

- [x] `shell.css` 不再混合 theme、Appearance、Topbar、PreviewDrawer 和 App layout owner。
- [x] 每个组件 owner 文件只包含自身 selector family，theme/foundation/shell 全局边界清晰。
- [x] component-specific 响应式规则不残留在共享 `responsive.css`。
- [x] Theme/architecture unit、Workbench 全量 unit、typecheck、build 与视觉/E2E 通过。
- [x] 根 lint、package architecture 与 `git diff --check` 通过。
- [x] 无 owner selector 被删除且所有保留规则有自动/浏览器回归证据。

## 范围外

- 不调整配色、间距、边框或交互设计。
- 不把关键 CSS 改为随异步组件首次挂载加载。
- 不重构 Studio/Designer 样式或 release workflow 用户改动。
