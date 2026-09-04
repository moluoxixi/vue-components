# Vite Config 结构治理实施计划

1. [ ] 补根/聚合/15 个 addon subpath exact export 与 concrete registry characterization。
2. [ ] 迁移 `src/addons/*.ts` 到 services，调整 tsup entries、TypeScript/Vitest alias 并保持 dist subpaths。
3. [ ] 迁移 `src/types.ts` 和 app/lib/base config factories/merge 到责任目录，保持根 API。
4. [ ] 将 base addon runtime 拆为 types、adapter、defaults、utils 与 services，更新 feature imports 和包内测试。
5. [ ] 删除 manifest 35 条 debt，更新 README/DESIGN 和 Vite Config spec，扫描 deep import/cycle/P0/P1/P2。
6. [ ] 每批运行 package test/typecheck/build；最终运行 coverage/browser/real fixtures、architecture/path/packed/lint 和 `git diff --check`。
7. [ ] 独立只读复核后提交、归档并记录 journal，不 push。
