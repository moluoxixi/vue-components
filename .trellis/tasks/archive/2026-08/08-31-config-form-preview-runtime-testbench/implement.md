# ConfigForm 真实预览与表单测试台实施计划

## 1. 实施顺序

### 1.1 RuntimeHost 提交结果协议

- 扩展 `protocol.ts` 的版本、消息类型、payload guard 和协议单测。
- 修改 `RuntimeHostApp.vue`：等待 renderer submit，统一发送 success/invalid
  结果，保证一次点击只产生一次 Flow submit。
- 修改 `PreviewRuntimeHostFrame.vue` 转发结果并保留 identity/sequence gate。

### 1.2 PreviewSession 结果状态

- 为 `preview-session.ts` 增加 `PreviewSubmission`、computed/ref 暴露和清理 API。
- 对成功/失败结果统一更新 values、touched、validation；只允许成功结果
  dispatch `form.submit`。
- 在 projection scope/revision/compile error 变化时清理或标记结果 stale。
- 补 PreviewSession 单测，覆盖 stale host、重复消息、快速切页和失败校验。

### 1.3 Preview 测试台 UI

- 扩展 `PreviewDrawer.vue` 为 pane/modal 两种呈现，复用一个 RuntimeHost iframe。
- 接入 `useWorkbenchDialogFocus`，补退出预览文字按钮、Escape、焦点恢复和
  `aria-live` 状态。
- 新增结果面板组件或局部模块，展示 JSON、touched、validation，并实现复制、
  清空、再次提交与失败通知。
- 增加 locale 文案和 Light/Dark、窄屏样式，不修改 Runtime iframe 样式。

### 1.4 Workbench wiring 与回归

- 在 `WorkbenchShell.vue` 透传 PreviewSession submission/clear/copy 状态，
  保证顶部 Preview、展开 Preview、移动端 Preview 仍是同一 session。
- 更新架构边界测试，禁止回退到 Design iframe 或第二份 values store。
- 扩展 Element Plus/Ant Design Vue Playwright 矩阵，验证真实控件交互、校验、
  Flow、提交 JSON、弹窗退出和 Design selection/revision 不变。

## 2. 验证命令

```powershell
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench test:e2e
pnpm --filter @moluoxixi/config-form-model typecheck
pnpm lint
git diff --check
```

## 3. 高风险检查点

- `protocol.ts` 与 `RuntimeHostApp.vue` 必须同时升级，不能让旧消息通过 guard。
- submit invalid 不得触发 `form.submit` Flow，也不得显示“提交成功”。
- Preview modal 不能重新挂载 iframe 或创建第二个 PreviewSession；关闭/展开只
  改变 UI presentation。
- 结果快照必须包含 revision identity；任何 stale 结果只能保留为历史提示，
  不能被当作当前提交值。
- 复制使用真实文本 JSON；不得复制 binary、运行时函数或 Config Model。

## 4. 完成门禁

- [ ] 最新规划摘要已获用户明确批准后才运行 `task.py start`。
- [ ] 先通过 Protocol/PreviewSession 定向单测，再进行 UI 与浏览器回归。
- [ ] 两套 provider 和 1440/900/390、Light/Dark、zh-CN/en-US 均完成验收。
- [ ] 更新相关 state-management spec 后提交并归档本子任务。
