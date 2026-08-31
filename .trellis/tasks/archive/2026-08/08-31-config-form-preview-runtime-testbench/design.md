# ConfigForm 真实预览与表单测试台设计

## 1. 目标与边界

Preview 继续使用 Workbench 已有的独立 RuntimeHost iframe；本任务补齐
提交测试闭环和独立弹窗呈现，不创建第二个表单模型、不复制 Design Runtime、
不把运行时值写入 `ProjectDocument`。

## 2. 状态流

```text
RuntimeHost iframe
  -> submitResult / runtimeState
  -> PreviewSession
  -> PreviewDrawer 结果面板
  -> Flow dispatch（仅成功 submit）
```

- `PreviewSession` 继续拥有 values、touched、validation、Flow trace，并新增
  `lastSubmission`。提交结果绑定 `revisionKey`，页面/项目/adapter 或编译版本
  变化时清空或标记过期，旧结果不能冒充当前结果。
- 成功提交仍触发一次 `form.submit` Flow；校验失败只更新 validation/touched，
  不触发成功 Flow，也不显示成功状态。
- RuntimeHost 只发送 JSON-safe 数据；Vue renderer、函数、DOM 和事件参数不
  跨 iframe 边界。

## 3. RuntimeHost 合同

RuntimeHost 协议升级到下一个版本，避免父子页面误解旧消息。新增：

```ts
type RuntimeSubmitStatus = 'success' | 'invalid'

interface RuntimeHostSubmitResultPayload {
  status: RuntimeSubmitStatus
  values: Record<string, unknown>
  touched: string[]
  validation: Record<string, string[]>
}
```

`RuntimeHostApp` 收到 `submit` 后等待 `renderer.submit()`，无论返回成功或
校验失败都发送一次 `submitResult`，并携带同一序列、revision、project/page
身份。成功时保留现有 `submit` 语义事件供 Flow 使用；失败时不得发送成功
事件。`PreviewRuntimeHostFrame` 严格校验并转发该 payload，丢弃 stale、重放、
错误 origin 或错误 host 的消息。

## 4. PreviewSession 合同

```ts
interface PreviewSubmission {
  status: 'success' | 'invalid'
  values: Record<string, unknown>
  touched: string[]
  validation: Record<string, string[]>
  revisionKey: string
  submittedAt: number
}
```

- 新增 `submission` 只读引用、`handleSubmitResult` 和 `clearSubmission`。
- `handleSubmit` 只处理成功 Flow 事件；`handleSubmitResult` 先校验当前
  Runtime identity，再写入 values/touched/validation 和结果快照。
- `accept()` 在 scope 变化、compile error 或 revision 变化时清除结果；同一
  revision 的重复 runtime state 不产生重复状态变更。
- `clearSubmission()` 只清空测试结果，不重置用户填写的 Runtime values。

## 5. UI 设计

- `PreviewDrawer` 保留一个 `PreviewRuntimeHostFrame`，普通状态呈现为右侧
  pane，`expanded` 状态切换为工作区级 modal presentation；不得通过两个
  `v-if` 分支复制 iframe。
- 展开状态使用 `role="dialog"`、`aria-modal="true"`、焦点循环、Escape 和
  关闭后焦点恢复；显示“退出预览”文字命令，图标按钮继续有 tooltip。
- Preview 结果面板展示成功/校验失败、格式化 JSON、touched 字段和字段级
  validation；提供复制、清空和再次提交。复制失败通过现有 Workbench 通知
  边界反馈，不吞掉异常。
- 结果面板不参与 Runtime 布局、Design selection、Project revision 或导出。
- Light/Dark、中文/英文和 1440/900/390 使用同一结构，窄屏时结果区可滚动，
  按钮和状态文案不得换行或遮挡。

## 6. 兼容与回滚

- 父子 RuntimeHost 同时由当前构建产出，协议版本同步升级；旧 iframe 消息
  直接拒绝并展示 Preview unavailable，不猜测 payload。
- 编译失败保留已有 last valid Runtime，但提交按钮禁用，旧提交结果标记
  stale；刷新失败不清空上一份完整结果，直到新的有效提交到达。
- 任何异常只影响 PreviewSession 和 UI，不修改 Design、History、Persistence
  或 Export snapshot。

## 7. 测试策略

- Protocol：submitResult schema、身份/序列/revision 校验和 invalid/success。
- PreviewSession：成功/失败提交、Flow 单次触发、结果清空、scope/revision
  隔离、stale 消息忽略。
- Component：结果 JSON 复制/清空、modal 焦点循环、Escape、返回焦点。
- Browser：Element Plus 与 Ant Design Vue 的 input/select/date/time/switch、
  required 校验、submit JSON、Design 隔离、展开/关闭和 1440/900/390。
