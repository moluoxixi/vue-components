# AI Provider 结构治理实施计划

1. [x] 锁定 `.`, `./shared`, `./server` 符号集合、Vite entries、产物名与全仓 consumer。
2. [x] 补 root/shared 等价、server-only 负向导出与 compatible/embedding validation characterization，运行定向测试并提交。
3. [x] 将 shared types/constants/validation/error 归入责任目录，使 `src/shared/index.ts` 成为纯 barrel；运行 entry/error tests并提交。
4. [x] 将 server target、SDK adapter、runtime status、error cause、redaction 归入 types/adapters/services/utils，清理旧根文件；运行 factory/error/redaction tests并提交。
5. [x] 删除 manifest 中 4 条已消失 debt，新增中文 README，核对 exports/build/declaration/source files并提交。
6. [ ] 扫描 P0/P1/P2、barrel 逻辑、deep import、server/shared 泄漏与 value/type cycle。
7. [ ] 运行 package test/typecheck/coverage/build、AI-doc/i18n consumer builds、architecture、packed Node/browser smoke、全仓 lint 和 `git diff --check`。
8. [ ] 独立只读 review；修复后重跑门禁，更新 spec/evidence，提交并归档，不 push。

## 回滚点

- Characterization、shared 与 server 分开提交；旧私有路径不保留 forwarding shim。
- shared 入口若出现 SDK/Node/server-only 依赖立即回滚对应结构批次。
- package exports、entry symbol set、validation error 或 SDK model metadata 任一漂移均视为回归。
