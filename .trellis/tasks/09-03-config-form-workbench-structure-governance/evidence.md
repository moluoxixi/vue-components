# ConfigForm Workbench 结构治理验证证据

## 最终结果

- Workbench unit：`51` 个测试文件、`458` 个用例全部通过。
- Workbench typecheck：通过。
- Workbench build：通过；Element Plus 按需样式校验与 Monaco 初始静态模块图校验通过。
- Source templates：Element Plus、Ant Design Vue 两套生成项目均完成 install、typecheck、build，`2/2` 通过。
- Workbench Playwright：`72/72` 通过，包含主题、可访问性、Design/Preview RuntimeHost、Flow、模板、JSON import 与 readonly Monaco workspace。
- ConfigForm public package smoke：12 个发布包构建通过，`PASS ConfigForm public package boundaries`。
- 全仓 lint：通过。
- 全仓 typecheck：36 个 workspace package 通过。
- Package architecture：测试 `11/11`，live 对账 `PASS package architecture (33 packages, 145 tracked debt)`。
- Path contracts：`8/8`，Components Playground typecheck 通过。
- Workflow：3 个 workflow 通过 actionlint `1.7.12`。
- `git diff --check`：通过。

## 执行命令

```powershell
pnpm --dir packages/ConfigForm/workbench test
pnpm --dir packages/ConfigForm/workbench typecheck
pnpm --dir packages/ConfigForm/workbench build
pnpm --dir packages/ConfigForm/workbench verify:templates
pnpm --dir packages/ConfigForm/workbench test:e2e
pnpm test:config-form-packages
pnpm lint
pnpm typecheck
pnpm test:package-architecture
pnpm test:path-contracts
pnpm lint:workflows
git diff --check
```

## 审计结论

- 最终热点扫描没有 TS/Vue P0/P1/P2 混合职责文件；较大的 CSS 与 locale message 文件仍是任务明确保留的单一职责规则/数据表。
- 旧私有组件路径、`preview` Flow owner、错误 logic barrel 和跨 feature app reverse import 均已移除。
- README 不需要机械更新：Workbench 仍是私有应用，用户用法、package exports、ProjectDocument/Flow/RuntimeHost/persistence 协议均未变化。
- 可执行的新知识已写入 `.trellis/spec/config-form-workbench/frontend/quality-guidelines.md`：Monaco worker 首装、静态模块图、disposer owner，以及 superseded persistence callback 的 session identity 检查。

## 运行说明

首次尝试将多个 Turbo/Vite 门禁并行运行时，Windows 出现 `dist` 清理竞争并使 5 秒测试受到 CPU 争用。所有受影响命令随后保持原阈值串行重跑并通过；未通过延长 timeout 或忽略错误绕过门禁。
