# 事件体系重构设计

## 架构判断

当前存在 Renderer 监听、iframe 消息、PreviewFlowCoordinator、PageFlowEngine 和独立 Source 执行器五个连续边界。组件参数在 iframe 出口被丢弃，Source 维护了另一套约 500 行执行器，页面引擎失效只阻止提交而不能独立取消悬挂任务。此次重写这些边界的事件合同与调度所有权。

## 参考依据

- form-create v3.3.0，commit `b34d0e0d37c84559183fad9737d242d3b664bf15`：`packages/core/src/handler/inject.js` 以 `fn($inject, ...args)` 注入事件上下文，`input.js` 先同步字段值再通知 change。
- form-create-designer v3.5.0，commit `02485bc95ab8c86e9b9613101709d22d480dc598`：物料声明事件目录，EventConfig 编辑可序列化处理器，导出剥离编辑态数据。
- 官方源码：https://github.com/xaboy/form-create/tree/v3.3.0 与 https://github.com/xaboy/form-create-designer/tree/v3.5.0。

## 方案

1. Core 提供统一事件上下文、严格的输入解析和页面事件运行时，拥有按流程调度、生命周期取消、补丁提交与 projection。Workbench 仅适配 Vue 状态和 UI 回调。
2. 事件上下文保留 trigger、参数、字段身份和触发时快照。组件值写入先于用户监听和事件流程；设计模式继续拦截全部业务副作用。
3. iframe 仅传递显式、可序列化的参数快照。DOM Event 转为受控事件数据，函数、DOM 节点及组件实例不能跨 realm；协议版本同步更新。
4. 动作支持字段、事件参数、前序输出和表达式引用。解析失败必须形成诊断；不能静默变为 undefined。引用值防御性复制，异步 action 不能修改宿主值源。
5. 公共 ConfigFormRenderer 使用同一事件内核，支持流程、动作注册与运行结果；不再依赖工作台才可执行事件。
6. Source 导出携带 Core 中 flow/expression/reaction/json 的实际 TypeScript 源文件，生成薄适配器。导出工程无 ConfigForm 包依赖；执行器和表达式求值不再手工复制。
7. 保留已有 DAG 分支能力及 Project Command 历史，重写事件动作编辑为结构化输入，保留高级 JSON 与可靠草稿校验。事件来源仍从选中组件进入，以保持目标明确。
8. 收紧图边界：每个合法出口只能有一条边，终止节点不能出边，错误出口与普通出口分别校验；非法配置在执行前诊断。

## 修改边界

- Core flow/expression/json：运行合同、调度、参数快照、图校验和可导出源码。
- Runtime Renderer/Headless 接口：监听顺序、事件订阅、公共表单执行集成。
- Workbench flow/session/runtime-host：统一内核适配、跨 iframe 事件传递和失效清理。
- Workbench Source export：生成共享内核源码和薄页面适配。
- Designer/Workbench 事件编辑：动作参数控件、草稿、错误反馈及必要元数据。
- 测试、当前 README/spec：验证和记录新合同。

本次不增加任意 JavaScript 字符串执行、业务后端、跨页面工作流或兼容迁移；不改写无关存储与拖拽机制。用户已明确授权架构破坏性修改，无旧协议兼容层。

## 关键风险与验证

源码导出的主要风险是相对导入闭包和浏览器打包；以真实生成工程的类型检查、构建和执行矩阵验证。异步风险用不响应 AbortSignal 的 action、排队取消、页面销毁、同时编辑其他字段验证。事件传输覆盖多参数、DOM Event、循环对象、非法 key 和跨 realm 对象。
