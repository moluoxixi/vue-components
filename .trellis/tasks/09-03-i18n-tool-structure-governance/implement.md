# I18n Tool 结构治理实施计划

1. [x] 锁定 exports/bin/build、CLI、HTTP/wire、安全写入、UI workflow 与 dynamic config 边界。
2. [x] 补 CLI help/success/invalid/config-error stdout/stderr/exit characterization并提交。
3. [x] 归位 App、五个单父组件及 App 私有 api/state，更新测试/import，运行 UI unit/build/E2E并提交。
4. [x] 迁移 config schemas/services/types 与 Core constants/services/utils/types/adapters，保持 public symbols/Jiti/protocol边界并提交。
5. [x] 迁移 server runtime/resources/filesystem/http/errors，保持 scan/translate/preview/apply/atomic rollback行为并提交。
6. [ ] 删除 manifest 24 条 debt，更新 README 入口说明，扫描 P0/P1/P2/barrel/deep import/cycle/browser leak。
7. [ ] 运行 package test/typecheck/coverage/build/E2E、architecture/path/workflow、packed Node/browser、全仓 lint和 `git diff --check`。
8. [ ] 独立只读 review；修复后重跑门禁，更新 spec/evidence，提交并归档，不 push。

## 回滚点

- UI、config/core、server 分开提交；旧私有路径不保留 forwarding shim。
- `I18N_DIAGNOSTIC_CODES` 在 constants 和 browser protocol 之间保持单一 value owner。
- exports/bin/CLI/API/wire/path/write/rollback/UI 任一漂移均视为回归。
