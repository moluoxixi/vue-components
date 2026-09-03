# ConfigForm Runtime 与领域结构治理实施计划

1. [x] 锁定六个 package root exports、Runtime props/emits/slots/expose、Model transaction result、Compiler public API 与 Playground glob/fixture 路径。
2. [x] 补 Model draft/final validation、change merge/inverse 与 Compiler cache/diagnostic characterization tests。
3. [ ] 补 Runtime renderer mode/editor/Flow lifecycle、Headless async validation 与 Runtime validation queue/dispose 回归。
4. [x] 迁移 Provider wrapper、Runtime error 与 Playground 子示例，清理 5 条 architecture debt；修正 single-parent collector 优先级并清除 2 条假债务。
5. [x] 在新 owner 内拆 Playground layout/container/linked/stress 场景；运行 adapter/playground/devtools 验证并提交。
6. [x] 拆 Model transaction engine 的 apply/operations/graph/validation/changes 责任目录；运行 model test/typecheck/build、performance 与 Workbench candidate consumer 回归并提交。
7. [x] 拆 Compiler canonical/page/diagnostics/registry/coordinator 责任目录；运行 compiler test/typecheck/build、performance 与 Workbench import/export/design consumer 回归并提交。
8. [ ] 拆 Runtime renderer controller/guard/editor/Flow/render pipeline；运行 runtime test/typecheck/build、Designer/Workbench unit 与 E2E 并提交。
9. [ ] 拆 Headless controller 与 Runtime `useFormValidation` 的 lifecycle/queue/policy/submit 职责；运行 headless/runtime test/typecheck/build 与 adapter consumer 回归并提交。
10. [ ] 扫描目标包 P0/P1/P2 热点、logic barrel、组件 owner、深导入和循环依赖；确认 package exports/README/spec 一致。
11. [ ] 运行 `pnpm test:config-form-packages`、Playground/Workbench E2E、`pnpm lint`、`pnpm typecheck`、architecture/path/workflow tests 与 `git diff --check`。
12. [ ] 独立只读 review；修复后重跑门禁，更新 spec，归档任务，不 push。

## 回滚点

- 五个工作提交相互独立；不得在一个未通过验证的状态下继续下一个高风险状态机。
- Model 与 Compiler 公共符号保留根导出但不保留旧私有文件 shim。
- Runtime renderer 任一 lifecycle 回归失败时回滚该 composable/service extraction，不在 Workbench caller 增加补丁。
