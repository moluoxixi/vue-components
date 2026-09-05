# Workbench Shell 样式所有权拆分执行计划

- [x] 锁定 shell/responsive selector owner、遗留规则与层叠顺序。
- [x] 拆分 foundation/theme/root shell。
- [x] 迁出 CommandHint、Appearance、Topbar、PreviewDrawer、App、Template owner 规则。
- [x] 迁出 component-specific responsive rules，更新同步 CSS manifest 与 owner contracts。
- [x] 运行 Theme/architecture、相关组件 unit、Workbench 全量 unit/typecheck/build/E2E。
- [x] 运行根 lint、package architecture、`git diff --check`，更新 spec 后提交归档。

## 验证结果

- Workbench unit：52 个测试文件、476 项测试通过。
- Workbench E2E：79 项测试通过，覆盖 16 组 Workbench/Template 视觉合同、主题、响应式、焦点与 axe。
- Workbench typecheck/build、根 lint、19 项 package architecture 测试和零 debt 审计通过。
- `git diff --check` 通过；独立只读复核未发现 owner、导入顺序或响应式层叠回归。
