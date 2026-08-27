# 国际化工作台与端到端集成实施计划

- [x] 建立包内 UI Vite 配置、入口、Element Plus/Lucide 基础样式与共享 token。
- [x] 实现 typed API client、应用状态 reducer 和 config bootstrap。
- [x] 实现紧凑 topbar、资源扫描与语言覆盖视图。
- [x] 实现翻译筛选、批量选择、进度、取消、部分失败和 retry。
- [x] 实现候选编辑、即时校验、逐项/批量接受拒绝。
- [x] 实现结构化 operation、文本 diff、overwrite/stale 状态和 apply dialog。
- [x] 补齐 loading/empty/error/cancelled、键盘、live region、tooltip 和焦点行为。
- [x] 完成 desktop/tablet/mobile 响应式布局与局部滚动。
- [x] 建立真实 CLI + temp fixture + stub AI Playwright harness。
- [x] 覆盖成功/create/overwrite/conflict/invalid output/cancel/mobile/keyboard E2E。
- [x] 运行 UI test/typecheck/build/e2e，并回归本地服务集成测试。

## 回滚点

- UI 仅消费公开 protocol；后端 contract 不稳定时停在 typed mock 层，不在组件中临时绕过 schema。
- apply UI 在 preview/conflict E2E 通过前保持不可用。
