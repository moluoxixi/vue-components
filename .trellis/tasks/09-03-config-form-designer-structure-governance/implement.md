# ConfigForm Designer 结构治理实施计划

1. [x] 锁定 DesignerCanvas public API、overlay modes、session/geometry contracts 和 Workbench consumer 调用。
2. [x] 先补 Camera、Runtime registration/geometry、selection/menu、resize/lifecycle 的行为回归。
3. [x] 提取 Canvas Camera 与 Runtime bridge composables，验证计算、监听器和 node registration 清理。
4. [x] 提取 drop targets、selection、node drag、resize、menu composables，保持单向依赖和一个 Design session。
5. [x] 提取 Runtime、Overlay、NodeToolbar 私有组件，将 Canvas facade 收敛为组装层；drag visual 状态归入 overlay composable。
6. [x] 提取 DesignSurface workspace/commands、PropertyPanel entries/tabs 与 Palette drag composables，保持 public facade。
7. [x] 重构 Antd/Element material bindings/defaults/setters/source 责任目录，删除旧逻辑目录并清理 7 条 debt。
8. [x] 将 material-only 组件移动到 `materials/components/`，readonly-only 组件移动到 `readonly/components/`，删除错误共享 barrel。
9. [x] 扫描 Designer 三包生产文件行数、循环依赖、深导入、logic barrel 和组件所有权；最大生产文件为 487 行。
10. [x] 运行 Designer 三包 test/typecheck/build、`pnpm test:config-form-packages`、Workbench unit/templates/build/E2E。
11. [x] 运行 `pnpm test:package-architecture`、`pnpm test:path-contracts`、`pnpm lint`、`pnpm lint:workflows`、`pnpm typecheck` 和 `git diff --check`。
12. [x] 独立只读 review；修复后重跑门禁并创建一个 Designer 结构治理提交，不 push。

## 回滚点

- 每个 composable/视觉组件提取完成后先跑对应定向测试，不把多个未验证状态迁移叠在一起。
- Adapter material 目录迁移与 Canvas/Surface 拆分分开验证；任一失败只回滚该职责边界。
