# 事件引擎与流程运行时重新评估

## 问题拆解

我们需要的是页面内事件编排：表单提交、字段变化、页面挂载、条件判断、字段/组件副作用、可取消异步动作和错误反馈。它不是 BPMN 审批流，也不是任意 JavaScript 执行器。

## 候选比较

| 方案 | 优点 | 风险/限制 | 结论 |
| --- | --- | --- | --- |
| 直接把 XState machine 作为 Config | actor、invoke、取消、错误处理成熟 | machine config 可包含函数；持久化与源码投影不稳定；DAG 页面事件被迫映射成 statechart | 不采用为持久化协议 |
| Vue Flow + XState adapter | 画布、异步 actor 能力较强，社区资料多 | 需要自有 IR 与编译层；adapter 复杂度可控 | 可作为可选执行 adapter |
| BPMN.js + bpmn-engine | 标准化、规则校验、命令栈和 XML 序列化成熟 | BPMN 语义过重，前端表单事件需要大量扩展；XML 与 defineFlow 投影不自然 | 不采用首版 |
| Rete.js engine | 原生 dataflow/control-flow，节点端口模型清晰 | 与 Vue Runtime、ConfigForm Model、导出协议整合成本高 | 不作为首版核心 |
| 自有 deterministic graph interpreter | 与 ConfigForm reaction、JSON-safe IR、导出和测试完全一致；无需把函数塞入 machine | 需要自己实现调度、取消、超时、并发策略 | 作为语义核心，XState 可做执行适配层 |

## 重新设计的分层

```text
Flow IR (JSON-only, versioned)
          ↓ validate / compile
   Flow Execution Plan (pure data)
          ↓
  Deterministic Flow Interpreter
       ↙               ↘
 Preview runtime     Host Action Registry

Optional XState adapter wraps each run/async invoke but never owns persistence.
```

- Core 负责 IR、图分析、条件/effect 复用、execution plan、事件队列和诊断。
- Runtime 负责 `AbortController`、timeout、concurrency policy（`latest`/`queue`/`ignore`）和 action registry 调用。
- XState 若引入，只负责 actor 生命周期和异步 invoke 的实现细节；`FlowExecutionPlan` 可以在无 XState 的测试环境运行。
- 任何宿主函数只能在 registry 中按 key 注入；Model、Config、Source 中只出现 key、schema 和 JSON mapping。

## 首版语义边界

- 触发：`page.mount`、`form.submit`、`field.change`。
- 节点：`trigger`、`condition`、`reaction`、`action`、`success`、`failure`、`end`。
- 图：有向无环；每个执行分支有明确的 next/true/false/error 语义。
- 反应：直接调用 core reaction evaluator；不复制条件运算符或 effect 类型。
- 异步：action 可返回 Promise，受 timeout、AbortSignal 和错误策略约束；不支持在 IR 中写 URL + 任意脚本并动态执行。
- 并发：同一 flow 默认 `latest`，新触发取消旧 run；可按 flow 声明 `queue` 或 `ignore`，但仍不允许隐式并行写同一字段。

## 为什么不让 XState 成为真源

XState 文档明确展示了 `fromPromise`、`assign`、actor subscribe 等运行能力，但这些能力依赖宿主函数和运行时对象。若直接保存 machine：

- `setup()` 注入的 action/guard/actor 无法在 Config 中稳定表达；
- XState 版本升级可能改变序列化细节；
- 页面事件图的节点位置、分支标签和 ConfigForm reaction 需要额外映射；
- Source 导出无法保证与 Config/Preview 语义一致。

因此必须把 XState 降级为 adapter，而不是让它决定页面模型。

## 验证要求

- 同一 `FlowExecutionPlan` 在无浏览器的 core 测试和 Preview runtime 中得到相同事件轨迹。
- action 的 resolve/reject/abort/timeout 都产生可断言的诊断和终态。
- 新 revision 触发时，旧 run 的所有异步结果、reaction 投影和 UI 状态都被丢弃。
- source generator 只依赖 plan 的纯数据和 registry key，不读取 XState machine 实例。
