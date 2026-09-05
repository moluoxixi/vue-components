# Workbench 样式所有权拆分

## 目标

拆分 templates.css 与 features.css 的跨 feature 样式职责并保持视觉语义。

## 需求

- 删除混合 Template catalog、JSON import、Export、Persistence、Flow、Pages、App notice 与 Runtime preview 的两个大型全局样式文件。
- 组件/feature 专属规则移动到对应 owner 的 `style/index.css`；真正跨 feature 的 surface/theme 规则保留在命名明确的共享样式文件。
- `styles/index.css` 继续作为 Main 与 Runtime Host 的唯一聚合入口，`responsive.css` 保持最后加载。
- 不改 CSS declaration、selector specificity、主题 token、断点和用户可观察布局；必要的 mixed selector 规则按 owner 拆分。
- 删除已确认没有生产 DOM owner 的 `.mobile-surface-tabs`、`.empty-workbench`、`.template-dialog`、`.template-list*`、`.persistence-empty` 遗留规则。
- 不改 Vue 组件结构、异步加载边界或 adapter 样式加载方式。

## 验收标准

- [x] `templates.css` 与 `features.css` 不再存在，所有保留规则有明确 owner 或共享边界。
- [x] Template workspace、catalog、JSON import、四类 dialog 和通知位于对应 owner；跨 iframe 的死 container rules 已删除。
- [x] Theme contract 与 architecture tests 通过，CSS 聚合入口和 responsive 最终层稳定。
- [x] Workbench build 通过 Element Plus/Monaco verifier，样式 chunk 无重复全量导入。
- [x] Workbench 全量 unit 与视觉 E2E 基线通过，桌面/平板/手机无可观察变化。
- [x] 根 lint、package architecture 与 `git diff --check` 通过。

## 范围外

- 不重设计 Workbench 视觉或调整颜色、间距、边框。
- 不把全局聚合改成异步组件首次挂载时才加载。
- 不修改 release workflow 的用户改动。
