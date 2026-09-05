# 按事件入口锁定流程编排设计

## 入口与上下文

- Designer 节点事件面板继续发出 `{ nodeId, eventName }`，Workbench 将其转换为 `{ kind: 'component.event', nodeId, event }`。
- Designer 表单分支新增表单事件行，发出 `ConfigFormFlowTrigger`；Workbench 直接打开 `page.mount` 或 `form.submit`。
- Topbar 和移动菜单移除无上下文 `openFlow` 事件，FlowDialog 只能由事件入口打开。

## FlowWorkspace 合同

`FlowDialog`/`FlowWorkspace` 接收必选 `initialTrigger` 作为锁定上下文，并接收当前 page 的 flows 以派生当前 trigger 的单条流程：

```ts
interface FlowWorkspaceProps {
  currentFlow?: ConfigFormFlow
  initialTrigger: ConfigFormFlowTrigger
  pageId: string
  readonly?: boolean
}
```

编辑器不再生成全量 trigger choices、不显示 trigger kind/event target Select，也不允许 patch trigger。新增流程只使用 `initialTrigger`；Flow command 的 `flow.settings`、`flow.node`、`flow.edges` 都校验 trigger identity。

空状态由本地 draft 表示。新增节点或第一次设置变更时把 draft 转换成一个 `flow.add` command；已存在流程的后续变更使用 `flow.settings`/`flow.node`/`flow.edges`。关闭空 draft 只清理本地状态。

## 一事件一流程约束

- `triggerKey()` 统一生成 `page.mount`、`form.submit`、`component.event` 的稳定 key。
- Model schema 在同一 `ProjectPage.flows` 内拒绝重复 key，并拒绝 `field.change`，错误包含 pageId、trigger 和全部 flowId。
- Compiler 对进入编译的 flow 再执行同一约束，防止绕过 Model schema 的调用方继续运行。
- UI 事件行根据当前页 flows 显示“未编排”或“已编排 · N 个节点”；错误项显示诊断并禁用编辑。

## 删除与返回

FlowDialog 标题栏使用 Element Plus 确认气泡包裹“删除流程”按钮。删除提交 `flow.remove`，关闭编辑器后恢复 Designer 原事件 tab 和稳定焦点。

## 兼容边界

这是当前合同的硬切：`field.change` 从 Core trigger union、Model schema、Compiler、Workbench preview/source dispatch 和文档中移除。旧项目不迁移，边界解析/校验直接失败；重复 component event flow 同样失败，不自动选择或合并。

## 不变量

- Runtime component event listener 仍只安装 Canonical IR 引用的 `{ nodeId, event }`，一次组件 emit 只产生一次 Flow dispatch。
- Flow 运行时不增加新的全局 trigger revision；page-scoped engine 与现有 concurrency 语义保持不变。
- 表单 `page.mount` 只在 mounted Runtime session dispatch 一次，`form.submit` 仍从真实 Renderer submit 事件进入。

## Pages 发布

- `scripts/build-pages.mjs` 使用 `CONFIG_FORM_WORKBENCH_BASE` 以
  `/vue-components/config-form-playground/` 为 base 构建 Workbench。
- `dist/pages/config-form-playground/` 完整复制 Workbench 的 `dist`，不混入旧
  `@config-form/playground` 产物。
- `designer.html` 直接复制同次构建的 `index.html`，因此指定远程 URL 与目录入口
  使用同一 Workbench JS/CSS；`runtime-host.html` 和 assets 由同一目录提供。
- Pages 产物校验拒绝缺少上述入口、错误 base path 或非 Workbench 标题的构建。
