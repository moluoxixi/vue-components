# Packages 全仓结构治理收尾执行计划

## 执行清单

- [x] 完成并归档 `published-package-contracts`。
- [x] 完成并归档 `architecture-collector-residual-rules`。
- [x] 完成并归档 `config-form-large-service-boundaries`。
- [x] 完成并归档 `ai-doc-discovery-boundary`。
- [x] 完成并归档 `config-form-sass-entry-default-control`。
- [x] 完成并归档 `package-cycle-architecture-gate`。
- [x] 完成并归档 `workbench-style-ownership`。
- [x] 完成并归档 `workspace-package-cycle-gate`。
- [x] 完成并归档 `workbench-shell-style-ownership`。
- [x] 完成并归档 `element-default-value-style-parity`。
- [x] 完成并归档 `headless-slot-attrs-inference`。
- [x] 运行全仓集成门禁并核对无新增架构债务。
- [x] 更新必要的 `.trellis/spec/` 合同并归档父任务。

## 最终验证

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:package-architecture
pnpm test:config-form-workbench
pnpm test:config-form-workbench-templates
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm test:pack
pnpm test:pack:browser
git diff --check
```

若根脚本名称或平台矩阵与当前仓库不一致，以各子任务已经验证的等价命令和根 `package.json` 现有脚本为准，不临时新增重复门禁。

## 复核点

- 用户原有 release workflow 修改保持最终状态；本次收口未再新增 release 行为改动。
- `packages/` 下不存在未被子任务解释的新大文件或所有权诊断。
- package exports、README、spec 和实际实现保持一致。

## 验证结果

- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。
- `pnpm test:package-architecture`：19 项测试通过，33 包、0 tracked debt。
- `pnpm test:config-form-workbench`：476 项测试通过；模板集成 2 项通过。
- Workbench build 与 E2E：79 项浏览器测试通过，含主题视觉、axe、响应式、焦点和 Monaco。
- `pnpm test:pack`：29 个包、58 个 public JavaScript entries 通过；`pnpm test:pack:browser`：23 个 JS entries、3 个 stylesheet entries 和 8 批浏览器应用通过。
- `git diff --check` 通过。release workflow 的用户既有 token 删除修改保持在最终工作树中，本次收口未再新增 release 行为改动。
