# 流程引擎选型与边界

## 结论

没有一个成熟库能同时承担 ConfigForm 的持久化协议、Vue 画布、浏览器执行和 TypeScript 双向投影。首版采用分层组合：

- 自有、版本化 `ConfigFormFlow` IR 作为唯一持久化/Config/Source/Runtime 协议。
- Vue Flow 负责 Vue 3 节点画布与展示位置。
- XState v5 负责 actor、异步 invoke、取消、超时和错误路径；machine 实例只在运行时创建。
- 现有 `ConfigFormReactionCondition` 与 effects 直接复用，不引入第二套 JSON Logic。
- 动作通过受控 Flow Action Registry 引用，IR 不保存函数、源码或动态表达式。

## 候选限制

| 库 | 适合职责 | 不承担的职责 |
| --- | --- | --- |
| Vue Flow | Vue 画布、自定义节点/端口、保存展示位置 | 流程语义、执行、业务持久化协议 |
| XState v5 | 状态/actor、异步、取消、错误恢复 | 稳定 JSON IR；实现仍需宿主注入 |
| Rete.js | 可视化 dataflow 与引擎 | 与现有 Config Model、Registry 的整合成本较高 |
| LogicFlow / X6 | 高自由度图编辑 | 不提供执行语义，核心较重 |

## 参考

- XState actors、TypeScript、persistence：<https://stately.ai/docs/actors>、<https://stately.ai/docs/typescript>、<https://stately.ai/docs/persistence>
- Vue Flow custom nodes/save：<https://vueflow.dev/guide/node.html>、<https://vueflow.dev/examples/save.html>
- 现有实现证据：`.trellis/spec/config-form-designer/frontend/state-management.md`、`packages/ConfigForm/core/src/reaction.ts`、`packages/ConfigForm/designer/src/model/types.ts`。

## 已知风险

- 扩大到循环、定时器、任意脚本、跨页和服务端事务会同时膨胀 IR、权限和测试面，首版明确排除。
- XState 的函数能力不能直接暴露到配置；Registry 是受信任宿主边界，仍需对 action 输入和导出依赖做诊断。
