# ConfigForm 真实预览与表单测试台

## 目标与用户价值

让所有 Preview 入口都进入真正可交互、与 Design 状态隔离的页面运行态，并把 Preview 提升为可以填写、校验、提交和检查 JSON 结果的表单测试台。

## 已确认事实

- 当前 `PreviewDrawer` 使用独立 iframe `PreviewRuntimeHostFrame`，已有 desktop/tablet/mobile、expand、close、submit 和 runtime state 协议。
- 2026-08-31 浏览器复核中，预览的 Name 输入框成功写入 `Preview test`，且没有出现设计器节点浮动工具栏；当前提交未复现“输入无效”的历史问题。
- 提交按钮会发出 values，但 UI 没有展示提交 JSON、校验摘要或重置结果。
- 现有展开预览仍属于 Workbench 内 overlay；本任务选择工作区级独立预览弹窗复用 RuntimeHost，避免浏览器弹窗拦截和跨窗口状态协议。新标签页可后续扩展。

## 需求

- 顶部 Preview、展开 Preview 和移动端 Preview 必须消费同一 `PreviewSession`，禁止回落到 Design iframe 或复用 selection/editor bridge。
- Preview 中 input/select/date/time/switch/validation/Flow 均可真实交互；点击运行态组件不得修改 Design selection 或打开节点工具栏。
- 提供工作区级独立预览弹窗，保留 viewport、关闭/退出文字命令、焦点约束、Escape 和返回焦点。
- 提交成功后展示格式化 JSON、touched/validation 摘要，并支持复制、清空和再次提交；校验失败时不伪装为成功。
- Preview state 不进入 `ProjectDocument`，切页/切项目/切 adapter 时按现有 `PreviewSession` identity 清理或迁移兼容状态。
- 加入可执行回归矩阵，覆盖所有 Registry field material 以及 Element Plus、Ant Design Vue 两个 adapter。

## 验收标准

- [ ] 所有 Preview 入口中输入值后，运行态 DOM、`PreviewSession.values` 与提交 JSON 一致，Design selection 和 revision 不变。
- [ ] 点击 Preview 输入框不会出现节点浮动工具栏；Design iframe 中同一输入仍只执行设计选择，不能直接编辑表单值。
- [ ] 独立预览弹窗在 1440/900/390 下可进入、退出和提交，关闭后焦点返回触发按钮。
- [ ] 提交 JSON 支持复制/清空；必填等校验失败时展示字段级错误且不输出成功状态。
- [ ] Preview 更新、stale、compile error、关闭后异步 Flow 和快速切页均通过 revision gate。
- [ ] Registry 动态生成的两套 provider 交互 E2E、PreviewSession 单测、RuntimeHost protocol 测试、typecheck 和 build 通过。

## 范围外

- 不建设在线部署、外部分享 URL、任意 npm 沙箱或真实 Vue 工程反向导入。
- 不把预览值写回字段默认值或 Config Model。
- 本轮不实现新标签页跨窗口同步；独立体验以 Workbench 弹窗为准。
