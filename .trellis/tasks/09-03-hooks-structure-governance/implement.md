# Hooks 包结构治理实施计划

1. [x] 锁定根 runtime/type exports、Vite entry、产物名、source files 与 components consumer。
2. [x] 补根 exact runtime surface、分页归一化边界与 RequestTable ref/watch characterization并提交。
3. [x] 将六个 hook 迁入 feature `state/`，将 RequestTable 纯归一化迁入私有 `utils/`，更新纯 barrels与测试 import并提交。
4. [x] 删除 manifest 6 条 debt，补中文 README 与 package source files，运行 architecture/package门禁并提交。
5. [x] 扫描 P0/P1/P2、barrel 逻辑、composable/state 证据、deep import、公共 API 与 value/type cycle。
6. [x] 运行 package test/typecheck/coverage/build、components consumer tests/typecheck/build、architecture/path/workflow、packed Node/browser smoke、全仓 lint 与 `git diff --check`。
7. [x] 独立只读 review；修复后重跑门禁，更新 spec/evidence，提交并归档，不 push。

## 回滚点

- Characterization、feature move 与发布收口分开提交。
- Feature move 保持函数体逐段等价，只有纯归一化函数允许原样迁移。
- 根 export、query key/watch/mutation行为或 components consumer 任一漂移均视为回归。
