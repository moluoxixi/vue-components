# Packages 全仓结构治理收尾执行计划

## 执行清单

- [ ] 完成并归档 `published-package-contracts`。
- [ ] 完成并归档 `architecture-collector-residual-rules`。
- [ ] 完成并归档 `config-form-large-service-boundaries`。
- [ ] 完成并归档 `ai-doc-discovery-boundary`。
- [ ] 运行全仓集成门禁并核对无新增架构债务。
- [ ] 更新必要的 `.trellis/spec/` 合同并归档父任务。

## 最终验证

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:package-architecture
pnpm test:pack
pnpm --filter @moluoxixi/config-form-workbench test:e2e
git diff --check
```

若根脚本名称或平台矩阵与当前仓库不一致，以各子任务已经验证的等价命令和根 `package.json` 现有脚本为准，不临时新增重复门禁。

## 复核点

- 用户原有 release workflow 修改未进入本任务提交。
- `packages/` 下不存在未被子任务解释的新大文件或所有权诊断。
- package exports、README、spec 和实际实现保持一致。
