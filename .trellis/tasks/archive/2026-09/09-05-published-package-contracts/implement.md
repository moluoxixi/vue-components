# 发布包源码与 README 合同收口执行计划

## 实施步骤

- [x] 复核六个目标包的 `source`、`files`、构建入口和 tarball 形态。
- [x] 复核所有发布包的库、CLI、UI mount、自动注册和样式副作用入口。
- [x] 更新六个 package manifest 的 `files`。
- [x] 为五个发布包编写默认中文 README，并校验所有示例来自公开入口。
- [x] 为 `ai-doc-assistant`、`hooks`、`i18n-tool` 与 `vitepress-theme-element-plus` 补充准确的 `sideEffects` 声明。
- [x] 在 package architecture collector 中增加三项发布合同诊断。
- [x] 添加正反 fixture 测试并运行目标测试。
- [x] 运行 packed consumer 和目标包完整门禁。
- [x] 更新 spec 并完成提交前验收。
- [x] 独立提交并归档子任务。

## 验证命令

```powershell
pnpm test:package-architecture
pnpm test:pack
pnpm --filter @moluoxixi/ai-doc-assistant test
pnpm --filter @moluoxixi/ai-doc-assistant typecheck
pnpm --filter @moluoxixi/ai-doc-assistant build
pnpm --filter @moluoxixi/hooks test
pnpm --filter @moluoxixi/hooks typecheck
pnpm --filter @moluoxixi/hooks build
git diff --check
```

其余六个 manifest 和五个 README 所属包按实际包名补跑 lint、typecheck、test、build；`pnpm test:pack` 作为 tarball 合同的最终依据。

## 风险文件与回滚点

- `packages/*/package.json` 与 `packages/ConfigForm/*/package.json`：只做精确字段修改，避免格式和 lockfile 噪声。
- `scripts/package-architecture/`：新规则必须保持 CLI 只读，不能引入自动基线重写。
- `.github/workflows/release.yml`、`scripts/__tests__/release-workflows.test.mjs`：保留用户现有修改，不纳入提交。

## 验证结果

- `pnpm test:package-architecture`：12 个 fixture 测试通过，33 个包为 0 tracked debt。
- 14 个受影响包测试：全部通过，共 765 个测试；对应 typecheck 全部通过。
- `pnpm lint`：通过。
- 根发布构建：29/29 个任务通过；三项副作用修正后的目标包重建通过。
- `pnpm test:pack` / `verify-published-packages.mjs`：29 个 packed packages、58 个公开 JavaScript 入口通过。
- `publint packages/i18n-tool --strict` 与 dry-run pack：通过。
- `git diff --check`：通过；用户 release workflow 修改未纳入本任务。
