# 全仓包根入口治理实施计划

1. [x] 锁定 20 个包的旧根/src 导出表、build/source metadata、tsconfig include、alias 与直接测试引用。
2. [x] 迁移 `ajax-package`、`excel`、`indexed-db`、`utils` 的纯 barrel：新增根入口、删除 `src/index.ts`、更新 build/source/include/test/alias。
3. [x] 将 `eslint-config` 与 `postcss-selector-prefix` 的入口实现下沉到 `src/services/`，建立声明式根入口并更新测试与构建配置。
4. [x] 迁移 `vite-config` 根入口，保留 `./addons`、`./addons/*` 多入口并更新 TypeScript/Vitest alias。
5. [x] 迁移 `components` 根入口和 auto-loader API 测试，不改变组件 subpath 与样式入口。
6. [x] 按依赖顺序迁移 ConfigForm 领域/runtime 和 adapter/plugin/designer/devtools 根入口，更新四处旧入口测试及 architecture assertions。
7. [x] 每组删除 manifest 中精确匹配的 `package-root-entry-governance` debt，并运行对应 package test/typecheck/build。
8. [x] 搜索 `src/index` 遗留引用，核对 README、DESIGN、tsconfig、Vitest/Vite/tsup 和 package exports。
9. [x] 运行 `pnpm test:package-architecture`、`pnpm test:config-form-packages`、`pnpm test:pack`、`pnpm test:path-contracts`。
10. [x] 运行 `pnpm lint`、`pnpm lint:workflows`、`pnpm typecheck` 和 `git diff --check`。
11. [x] 独立只读 review，修复后重跑门禁并创建一个入口治理提交，不 push。

## 回滚点

- 每个包组完成 package build/test 与 architecture reconciliation 后才进入下一组。
- 失败时恢复该组的入口、metadata、alias 和 debt；不对已通过组创建 forwarding shim。
