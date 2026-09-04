# Vite Config 结构治理实施计划

1. [x] 补根/聚合/15 个 addon subpath exact export 与 concrete registry characterization。
2. [x] 迁移 `src/addons/*.ts` 到 services，调整 tsup entries、TypeScript/Vitest alias 并保持 dist subpaths。
3. [x] 迁移 `src/types.ts` 和 app/lib/base config factories/merge 到责任目录，保持根 API。
4. [x] 将 base addon runtime 拆为 types、adapter、defaults、utils 与 services，更新 feature imports 和包内测试。
5. [x] 删除 manifest 35 条 debt，更新 README/DESIGN 和 Vite Config spec，扫描 deep import/cycle/P0/P1/P2。
6. [x] 每批运行 package test/typecheck/build；最终运行 coverage/browser/real fixtures、architecture/path/packed/lint 和 `git diff --check`。
7. [x] 独立只读复核后提交、归档并记录 journal，不 push。

## 验证证据

- `pnpm --filter @moluoxixi/vite-config test`：9 files / 79 tests 通过；新增 15 个 leaf subpath exact export 与 concrete registry metadata 断言。
- `pnpm --filter @moluoxixi/vite-config test:coverage`：statements 96.01%、branches 91%、functions 92%、lines 97.04%。
- package typecheck/build 通过；保持 `dist/index`、`dist/addons/index` 与 15 个 leaf JS/d.ts 输出。
- Browser fixture：Chromium desktop/mobile、Firefox desktop、WebKit desktop/mobile 共 5/5 通过。
- Package architecture：11/11，tracked debt 从 83 降至 48，Vite Config 35 条目标 debt 清零。
- Path contracts：8/8 与 components playground typecheck 通过；全仓 lint、`git diff --check` 通过。
- Packed verifier：全部发布 export 通过，23 个 browser JS entries、3 个 stylesheet entries 和 packed applications 通过 8 个浏览器批次。
- 第一轮三份最终审计未发现 runtime/public 阻断，发现的测试 deep import、结构测试空集合与 design 归属偏差均已修复并重跑门禁。
- 审计修复后重新独立核验：伪公开 deep import 为零，mock 命中生产 adapter barrel，15 个 feature 枚举非空，barrel/type-only 与 manifest 均符合目标，无阻断项。
