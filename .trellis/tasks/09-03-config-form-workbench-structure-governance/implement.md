# ConfigForm Workbench 结构治理实施计划

1. [x] 锁定 Workbench package/build entries、Project/RuntimeHost/Flow/template 协议、Source export 文件集合和 controller return contract。
2. [ ] 补 `DesignRuntimeHostFrame` geometry/revision、App shell 接线和 Monaco model/disposal characterization。
3. [ ] 迁移 3 个 single-parent debt 组件与 4 个单 feature UI；移动测试并清理全局 component barrel。
4. [x] 将 `WorkbenchProjectError` 实现移出 barrel，清零 4 条 manifest debt并提交 ownership 批次。
5. [ ] 拆 Source generator 的 canonical/Flow/validation/Vue/project-files 生成责任；运行 export/parity/templates 并提交。
6. [ ] 拆 Workbench controller 的 binding/creation/page/persistence/recovery/lifecycle，保持单一 state owner并提交。
7. [ ] 拆 FlowWorkspace command/persistence 与 VueFlow projection；清理 Flow/Preview 错位 owner和 type-only barrel 环并提交。
8. [ ] 拆 WorkspaceCodeEditor worker/language/declarations/model lifecycle并提交。
9. [ ] 拆 IndexedDB repository serialization/retention/CRUD 边界并提交。
10. [ ] 拆 RuntimeHost sync/geometry/design bridge/protocol dispatch；运行 protocol/host/frame 和 E2E 并提交。
11. [ ] 扫描 P0/P1/P2、logic barrel、owner、deep import、value/type cycle；确认 CSS/locale 大文件仍为单一职责。
12. [ ] 运行 Workbench 440+ unit、typecheck、build、templates 2/2、E2E 72/72、ConfigForm package smoke、全仓 lint/typecheck/architecture/path/workflow 和 `git diff --check`。
13. [ ] 独立只读 review；修复后重跑门禁，更新 README/spec，归档任务，不 push。

## 回滚点

- Source export、controller、Monaco、RuntimeHost 均单独提交，禁止在未通过局部门禁时进入下一高风险边界。
- 私有旧路径不回退为 forwarding shim；失败时恢复整个 ownership 批次。
- 任何生成项目字节、RuntimeHost message 或 persistence schema 漂移都视为行为回归，不用 caller 兼容补丁掩盖。
