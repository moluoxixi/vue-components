# 流程引擎与可视化编排库调研

> 状态：已延期。用户要求先修复 Designer 布局并重新设计三 provider 单一数据源；本材料不进入当前实现批次。

## 结论

社区没有一个库可以同时稳定承担 ConfigForm 的持久化协议、浏览器执行、Vue 画布和 TypeScript 双向转换。推荐采用分层组合：

- 项目自有、版本化的 `ConfigFormFlow` IR 作为唯一持久化协议。
- 复用现有 `ConfigFormReactionCondition` 与 reaction effects，保持字段条件和同步副作用只有一套语义。
- Vue Flow 负责 Vue 3 流程画布，不持久化其内部运行对象，只保存节点位置等展示信息。
- XState v5 作为异步、取消、错误路径和状态编排的执行适配层；IR 中只保存白名单 implementation reference，不保存函数。
- `src/form.config.ts` 使用公开 `defineFlow()` / `defineFields()` API 表达 IR，并通过受控 AST codec 解析和生成真实 TypeScript。

## 候选比较

| 方案 | 适合职责 | 关键限制 | 结论 |
| --- | --- | --- | --- |
| XState v5 | actor、异步调用、取消、并行状态、错误路径 | action、guard、actor 的实现仍由 `setup()` / `provide()` 注入；machine config 允许函数 | 作为执行适配层，不作为稳定 IR |
| Rete.js 2 + rete-engine | Vue 节点编辑、dataflow/control-flow 执行 | 框架图模型和节点实例不是业务协议；导入导出需自行定义 | 备选一体化实现，首选方案不直接持久化 Rete JSON |
| Vue Flow | 原生 Vue 3 画布、自定义节点/端口、保存和恢复图形状态 | 不提供流程执行语义和持久化后端 | 首选画布层 |
| LogicFlow / AntV X6 | 高自由度图编辑、端口和自定义节点 | 只解决画布且核心更重，执行与源码投影仍需自建 | 本阶段不选 |
| JSON Logic | JSON 条件和值表达式 | 没有顺序、赋值、动作和异步语义 | 不引入；现有 reaction condition AST 已覆盖核心需求 |
| json-rules-engine | 事实条件匹配并产出事件 | 不是通用流程图或表达式计算引擎 | 可作未来规则触发参考，本阶段不选 |

## 代码库事实

- Core 已有 JSON-only 的 condition AST 和 `setValue`、`clearValue`、`setState`、`setProps`、`validate` effects：`packages/ConfigForm/core/src/types.ts:1`、`packages/ConfigForm/core/src/reaction.ts:25`。
- Designer 已把 `conditions`、`reactions` 和 JSON validation 保存在 `DesignerDocument`：`packages/ConfigForm/designer/src/document/types.ts:7`。
- 仍依赖函数的主要入口是 Headless 条件、异步 validator/transform、render/event escape hatches 和 plugin hooks：`packages/ConfigForm/headless/src/types/props.ts:8`、`:45`、`:104`、`:181`。
- 当前 Config codec 已用 Babel 解析受控 TypeScript 子集，并确定性生成 `defineFields` 源码：`packages/ConfigForm/workbench/src/workbench/config-codec.ts:180`、`:350`。
- Source 当前只编辑 `src/App.vue`，不会反投影 Config/Designer；有效 Config/Designer 则统一通过 `synchronizeDocument` 更新 artifact、Config 和 Preview：`packages/ConfigForm/workbench/src/App.vue:254`、`:373`。
- Repository 已有 `WorkspaceProjectDraft { baseRevision, files }` 与 CAS commit，但工作台尚未接入 draft persistence 或结构化冲突：`packages/ConfigForm/workbench/src/project/types.ts:53`、`packages/ConfigForm/workbench/src/project/repository.ts:3`。

## 源码往返边界

- MVP 继续用 `@babel/parser` 识别唯一、受控的 exports；不执行源码，不反编译任意函数。
- 新建受控模块时使用确定性 formatter；若要保留用户额外 imports、comments 和 exports，使用 Recast 只替换唯一 managed initializer。
- Babel generator 的 `experimental_preserveFormat` 不能作为源码保真承诺；TypeScript printer 和 ts-morph 同样会重新打印源码。
- 同一 managed export 在 Source 与 Designer 两侧同时变化时返回显式冲突，不做语义猜测。

## 权威资料

- XState actors、TypeScript 与 persistence：<https://stately.ai/docs/actors>、<https://stately.ai/docs/typescript>、<https://stately.ai/docs/persistence>
- XState runtime：<https://github.com/statelyai/xstate>
- Rete.js engine 与 Vue renderer：<https://retejs.org/docs/concepts/engine>、<https://retejs.org/docs/guides/renderers/vue>
- Vue Flow custom nodes 与 save/restore：<https://vueflow.dev/guide/node.html>、<https://vueflow.dev/examples/save.html>
- Recast 保守打印：<https://github.com/benjamn/recast#usage>
- Babel generator 格式保留限制：<https://babel.dev/docs/babel-generator>

## 风险

- 若首版同时覆盖字段联动、页面生命周期、任意异步请求、导航和跨组件动作，节点协议、权限模型与错误恢复会一起膨胀，难以验证三形态无损往返。
- XState 实现注册表仍是受信任源码函数边界；流程只是把函数从 Config 数据中移出，并不能消除所有宿主代码。
- 画布坐标属于展示投影，不应参与流程语义 hash 或 revision 冲突判断。
