# ConfigForm 工作台移动端与国际化实施计划

## 实施顺序

1. [ ] 为 Workbench 增加类型化 en-US / zh-CN locale 目录、locale 规范化、合并与偏好存储 helper，并补纯函数单测。
2. [ ] 将 App.vue 所有产品文案、title、aria-label、状态与错误提示接入 Workbench translator；加入可访问的语言下拉菜单和 `html[lang]` 同步。
3. [ ] 给 PageManager、PreviewRuntimeBoundary、ProjectFileTree 与 WorkspaceCodeEditor 注入同一 locale；补齐 FlowWorkspace 全部 `flow.*` 目录文案并保证调用方 override 优先级。
4. [ ] 将 effective locale 同时传给 Designer 与所有 Workbench 子视图；按当前 adapter 合并 Element/Ant material locale，并按 template id 本地化模板选择器。
5. [ ] 给 Profile shared Designer document 写入已验证的 tablet/mobile responsive；保持模板协议版本 1，不增加旧项目自动迁移或破坏 Reset 保护。
6. [ ] 补 locale、Workbench 子组件、shell、template/reset/config/source round-trip 回归测试。
7. [ ] 运行 Workbench test/typecheck/build、相关 Designer/Runtime 定向测试和两套真实导出工程验证。
8. [ ] 启动本地站点，浏览器核验 1440px、900px、390px；覆盖 en-US/zh-CN、Light/Dark、Designer/Preview、语言/Export 菜单及 Page/Flow/Export 弹窗。
9. [ ] 执行 Trellis quality check，核对无残留硬编码产品文案、无 responsive 语义漂移，再提交与归档任务。

## 预计修改范围

- `packages/ConfigForm/workbench/src/locale.ts`：Workbench locale 单一目录和组合逻辑。
- `packages/ConfigForm/workbench/src/App.vue`：locale wiring、语言菜单、全部 shell 文案。
- `packages/ConfigForm/workbench/src/components/PageManager.vue`：locale 注入与动态可访问文案。
- `packages/ConfigForm/workbench/src/components/FlowWorkspace.vue`：统一目录 key 与 fallback 使用。
- `packages/ConfigForm/workbench/src/components/PreviewRuntimeBoundary.vue`：运行时错误状态本地化。
- `packages/ConfigForm/workbench/src/components/ProjectFileTree.vue`：文件树可访问名称本地化。
- `packages/ConfigForm/workbench/src/components/WorkspaceCodeEditor.vue`：Workbench-owned viewer/status 文案本地化。
- `packages/ConfigForm/workbench/src/styles.css`：语言菜单和窄屏约束。
- `packages/ConfigForm/workbench/src/project/templates/create-template.ts`：Profile responsive，保持 template 协议版本 1。
- 对应 Workbench unit/component/integration 测试；必要时增加 Playground 浏览器断言。

## 明确不修改

- `packages/ConfigForm/runtime/src/renderer/responsive.ts` 及其无配置兼容语义。
- Config Model schema、历史已有项目内容和自动 migration。
- 用户字段/页面/项目内容及生成源码的自然语言。
- 国际化工具、AI Provider 或任何 API key 处理代码。

## 验证命令

```bash
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/playground typecheck
pnpm --filter @config-form/playground test:e2e -- --grep "workbench|responsive|locale"
```

若 Playground 当前没有 Workbench 路由对应的稳定 grep，用 Workbench component test 加浏览器人工核验代替，不伪造一个与真实入口无关的测试页面。

## 实施前基线（2026-08-30）

- `pnpm --filter @config-form/workbench test`：21 个测试文件、119 个测试全部通过。
- `pnpm --filter @config-form/workbench typecheck`：通过。
- `pnpm --filter @config-form/workbench build`：通过；现有产物 `index` 约 1.99 MB、异步 `WorkspaceCodeEditor` 约 2.90 MB，Vite 发出大 chunk 警告。
- 本任务不得扩大现有主 chunk 或把 Monaco 从异步边界拉回首屏。现有 bundle 拆分属于后续独立性能任务，不在 locale/responsive 实施中顺手重构。

## 风险与回滚点

- App.vue 文案量大：每批替换后运行 key parity 与 hardcoded-copy audit，避免漏翻或 aria-label 漂移。
- locale 合并错误可能覆盖 material locale：先固定优先级单测，再接 App。
- 顶栏空间有限：语言入口必须保持 icon-only trigger，390px 浏览器验证不过则回滚样式，不隐藏核心操作。
- 模板 responsive 与生成 model 必须同步，同时断言协议版本仍为 1、跨版本 Reset 拒绝逻辑未被放宽；template unit 与真实导出工程共同作为提交门。
