# 按事件入口锁定流程编排

## 目标

让流程编辑从具体事件进入，并在整个编辑期间只编排当前事件，降低用户理解成本并避免切换到其它事件造成误配置。

## 需求

- 组件事件只能从选中节点的事件面板进入，入口携带稳定的 `{ nodeId, event }`。
- 表单属性面板增加“表单加载”和“表单提交”两个事件入口，分别映射 `page.mount`、`form.submit`。
- 移除 Topbar 不带事件上下文的全局流程入口。
- 一个 trigger 只能对应一个流程；新增、编辑和项目校验均拒绝重复 trigger。
- FlowWorkspace 只接收当前 trigger 对应的流程，不展示全局 trigger 选择器，不允许修改 trigger。
- 无流程事件打开本地 draft，首次有效编辑才提交 `flow.add`；直接关闭不产生项目变更。
- 已有流程显示编排状态和节点数；删除流程在锁定编辑器标题栏通过 Element Plus 确认操作完成。
- 当前合同移除 `field.change`；旧数据在 Model/Compiler 边界失败，不迁移、不删除、不执行。
- 组件绑定事件以“值变化”等业务文案展示，底层事件名作为辅助标识。
- 非法旧 trigger、重复 trigger 和不可编辑流程在属性面板诊断区明确显示。

## 验收标准

- [x] 组件事件、表单加载、表单提交都能从各自属性面板进入锁定流程编辑器。
- [x] FlowWorkspace 不存在可切换 trigger 的 Select/Choice；所有保存 command 的 trigger 与入口一致。
- [x] 一事件一流程约束在 Model schema、Compiler/Flow authoring 和 UI 三层生效。
- [x] 空 draft 关闭不产生 `flow.add`，首次添加节点或修改设置产生一次当前 trigger 的 `flow.add`。
- [x] 删除流程后返回原事件面板，状态恢复为未编排。
- [x] `field.change` 在当前 schema、编译、运行时和导出路径中被拒绝或移除，不保留历史兼容分支。
- [x] Workbench、Designer、Core、Model、Compiler 相关 unit/typecheck/build/E2E 通过。

## 范围外

- 不新增跨页面流程或新的 Flow 节点类型。
- 不改变 Flow 执行器的 concurrency、errorPolicy、projection 和 RuntimeHost 协议语义。
- 不自动修复、合并或删除历史项目数据。
