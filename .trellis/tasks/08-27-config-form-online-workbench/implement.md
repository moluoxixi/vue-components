# 配置化在线网站工作台总实施计划

## 任务路线

1. [ ] 完成并启动 `08-27-config-form-workbench-project-core`：private app 骨架、项目协议、IndexedDB CAS、内置模板、ZIP 和真实构建验证。
2. [ ] 完成 `08-27-config-form-workbench-three-mode`：Config / Designer / Source codec、draft、revision、capability 和 conflict。
3. [ ] 完成 `08-27-config-form-workbench-live-preview`：REPL projector、runtime facade、build revision、diagnostics 和 stale preview。
4. [ ] 完成 `08-27-config-form-workbench-product-shell`：模板入口、三模式、文件树、Monaco、Preview、状态、导出和响应式网站。
5. [ ] 完成其子任务 `08-27-config-form-designer-ux`，将 Designer 作为工作台模式时的容器响应、键盘与视觉体验收敛。
6. [ ] 完成 `08-28-config-form-designer-dnd-regression`，验证布局容器投放、末尾追加、date/time 宽度和全物料矩阵。
7. [ ] 父级集成验收：模板创建 -> 三模式编辑 -> Preview -> 本地恢复 -> ZIP -> 标准 build。
8. [ ] 更新 ConfigForm 架构 README、Pages/CI/根脚本，并完成 Chromium 全量与 Firefox/WebKit 冒烟。

## 父级验证门

- 每个子任务自己的 unit/type/build/check 全部通过。
- `@config-form/workbench` build、typecheck、unit 和 E2E 通过。
- 导出模板在隔离临时目录完成 frozen install、TypeScript 与 Vite build。
- ZIP 解压内容与模板生成器输出一致。
- IndexedDB 与 memory repository contract suite 一致，过期 revision 不产生写入。
- Chromium 覆盖完整工作流；Firefox/WebKit 覆盖创建、模式切换、编辑、Preview 和恢复。
- `packages/ConfigForm/README.md`、根 scripts、Pages 和 CI 与新 private app 一致。

## 父级风险门

- 不启动父任务做直接实现；始终启动拥有下一交付物的子任务。
- 不把 REPL store、Monaco model 或 AST 当作项目真源。
- 不把 `workspace:*` / `catalog:*` 写入导出项目。
- 不以 silent fallback 掩盖 IndexedDB 不可用或 revision conflict。
- 不为了“真实项目”引入任意依赖执行、在线 Node 或项目导入。
