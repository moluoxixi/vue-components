# Workbench 样式所有权拆分执行计划

- [x] 锁定 `templates.css`、`features.css` 的 selector-owner 映射和全局加载顺序。
- [x] 拆分 Template workspace、catalog、JSON import owner 样式。
- [x] 拆分 Export/Persistence/Flow/Pages/App owner 样式并保留共享 surface 层。
- [x] 更新 `styles/index.css` 与 theme contract，删除无 owner 规则、死跨 iframe 规则和旧聚合文件。
- [x] 运行 Workbench style/architecture unit、全量 unit、typecheck、build 与视觉 E2E。
- [x] 运行根 lint、package architecture、`git diff --check`，更新 spec 后提交归档。

## 验证记录

- PostCSS AST 等价核验：Template 223 条记录全部保留；Feature 规则仅删除已确认 orphan 与 5 条跨 iframe 死 selector；93 条响应式 selector/declaration/at-rule 记录完整迁移。
- Workbench style/architecture：180 个测试通过；全量 unit：52 个文件、476 个测试通过。
- Workbench typecheck：通过。
- Workbench build：通过 Element Plus 与 Monaco bundle verifier。
- 视觉 E2E：16 个 Workbench/Template 桌面、平板、手机基线通过；删除死跨 iframe 规则后再次全部通过。
- package architecture：18 个测试通过，33 个包、0 debt、0 cycle diagnostic。
- 根 lint 与 `git diff --check`：通过。
