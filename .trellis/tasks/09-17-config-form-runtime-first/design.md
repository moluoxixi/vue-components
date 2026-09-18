# ConfigForm Runtime-first 技术设计

## 设计原则

本次重构解决的不是“属性面板太拥挤”，而是产品边界与底层实现不一致。实现必须同时满足以下原则：

1. Runtime 是可独立集成的主产品；Designer 和 Workbench 都不能成为运行前置。
2. 默认 Designer 只编辑当前节点、同步、确定性、可序列化的配置。
3. 复杂事件是宿主代码，不是 Schema 数据；代码态 config 直接持有函数。
4. 主产品不存在事件编辑、事件转发或事件编排的残留层。
5. 为未来扩展保留清晰包依赖方向，不预建 dormant Event/Automation 包或抽象壳。

## 产品与包边界

```text
宿主 Vue/TypeScript 代码
  ├─ Runtime / Headless / Core        主产品：渲染、状态、校验、同步规则、数据
  ├─ fields[].props.onX               复杂组件事件函数，直接执行
  ├─ Form emits / expose              表单级宿主 API
  ├─ Designer + Provider Adapter      可选轻量 Schema 编辑器
  └─ Workbench                        内部 Playground / Preview / 静态 Source 集成验证

Model -> Compiler -> Canonical IR -> Vue Backend -> Runtime
  ^                                                  ^
  |                                                  |
Designer                                      宿主代码态 config

禁止：Runtime/Core/Headless -> Designer/Workbench
禁止：Designer -> Workbench/Event/Automation 实现
禁止：ProjectDocument/Canonical IR -> 函数、事件总线或 Flow plan
```

`packages/ConfigForm/PRODUCT.md` 负责长期产品定位，`packages/ConfigForm/README.md` 负责当前架构事实。任务文档记录本次硬切，不替代长期入口。

## 代码态事件合同

组件事件只使用普通 Vue props listener：

```ts
const fields = [
  defineField({
    id: 'save',
    component: 'ElButton',
    props: {
      onClick: () => saveDraft(),
    },
  }),
]
```

该函数存在于宿主运行内存，Renderer 将它直接传给组件。不存在字符串事件名映射、`eventNames`、中央 emit、参数 snapshot、iframe 转发、action registry 或 Flow dispatch。

字段值绑定需要组合内部 trigger 和外部 listener。内部实现保持固定顺序：

```text
Renderer design mode guard
  -> Runtime 写值 / blur 校验
  -> 宿主 props.onX
```

非 design mode 按后两步执行；design mode 在第一步直接阻断宿主 listener。现有 `runtime-flow-events.ts` 不能整段删除，其中与字段监听器顺序有关的纯 Renderer 逻辑迁到中性内部模块，例如 `component-listeners.ts`。该模块不收集事件名、不 emit 公共事件、不克隆参数，也不把宿主异常包装成 Flow diagnostic；异常遵循正常 Vue 错误处理。

`ConfigFormRuntimeEventContext`、`interceptEvent` 和 editor bridge 中对应的 payload 路径一起删除。Designer 的选择、几何和拖拽继续使用各自明确的接口；组件交互是否执行仅由 Renderer 内部 mode guard 决定，不向 Designer 传事件名或参数。

保留的表单级合同为：

- `change`、`fieldChange`、`metaChange`、`errorsChange`、`error`、`submit`。
- `variablesChange`、`dataSourceStateChange`，作为 Data runtime 状态通知。
- `getValues`、`setValues`、`validate`、`resetFields`、`submit` 等 expose。
- Headless controller 的内部 lifecycle，用于表单控制器和 Data 生命周期；它不是可视化事件作者模型。

## 可序列化边界

Model、Designer、JSON import/export、IndexedDB、Canonical IR 和 Preview transport 均保持数据合同，只接受可序列化值。它们不保存、不克隆、不比较、不传输函数。

因此存在两条明确路径：

- Designer 路径：产生结构、布局、静态 props、基础校验和其他允许的可序列化配置。
- 工程师路径：在 Vue/TypeScript 中导入或创建配置，再把 `props.onX` 函数组合进去并交给 Runtime。

Workbench Source 只输出静态结构配置，不生成 handler stub、字符串 action ref 或“待绑定事件”元数据。宿主事件函数不要求回写 Designer，也不承诺在 Workbench Preview 中复现。

## 事件编排整域删除

| 领域 | 删除 | 保留 |
| --- | --- | --- |
| Core | `src/flow/**`、`src/flow-authoring/**`、Flow action/HTTP/trace/transaction 合同与 exports | reaction、expression、value-reference、data-source 等独立能力 |
| Headless | `ConfigFormNodeBase.eventNames` 及对应根导出/类型合同 | controller、fields、bindings、form emits/expose 所需类型 |
| Model | `RegisteredEventAction`、`PageNode.events`、`ProjectPage.flows`、`node.events`/`flow.*` operations、schemas、inverse、reference validation | graph、props、validation、bindings、conditions/reactions、runtime data config |
| Registry | `ComponentEventContract`、`ComponentContract.events` | props、bindings、slots、parent constraints、defaults |
| Compiler | Flow 编译/校验/plan、synthetic flow、`flowEvents`、Canonical `events/flows` | 结构、规则、数据和同步状态的 Canonical 编译 |
| Vue backend | `flowEvents -> eventNames`、`plan.flows`、Flow cache identity | 组件 binding、字段规则、布局、数据 plan |
| Runtime | `eventNames`、`runtimeEvent`、`flowActions`、scheduler、builtin actions、scoped Flow transaction、Flow result/error/trace | 直接 props listener、表单 emits/expose、Headless controller、Data runtime |
| Designer | events/Flow props、emits、sections、material metadata、commands、stale repair、`interceptEvent` payload bridge | properties、validation、设计态选择/几何/拖拽、只读状态投影 |
| Workbench | `features/flow/**`、`src/flow/**` engine/registry/targets、Flow UI/store/locale、Preview Flow RPC、Source Flow generator | Preview、Source 静态配置、项目/模板/数据集成设施 |

删除使用 current-contract-only 方式完成。禁止旧名字转发、新旧 shape 双读、deprecated export、迁移器、隐藏 feature flag 和未来占位 package。

## Runtime 职责拆分

当前 `use-renderer-events.ts` 混合了 Flow 调度、reaction projection、Data Source 生命周期和表单 lifecycle。目标拆分如下：

- 删除 Flow plan 同步、dispatch、并发/取消、builtin action、transaction、trace/result/diagnostic 发布。
- Data 的 `prepare/start/refresh/reset/cancelScope/stop` 迁到 Data runtime composable，由通用表单 lifecycle 驱动。
- 程序化 reactions 继续由 Headless/controller 计算；外部 `reactionProjection` 若仍被隔离 Preview 消费，则以 reaction 责任保留，不挂在 Flow 模块。
- 字段监听器组合迁到纯内部 component listener helper。
- 删除 Designer event context/`interceptEvent`；design mode 通过 Renderer 内部 guard 阻止宿主 listener，选择与拖拽走既有专属接口。

删除后 Runtime public API 不得出现 `ConfigFormFlow*`、`runtimeEvent/componentEvent`、`flowResult/flowError/flowTrace` 或 `flowActions`。

## Designer Lite 边界

Inspector 固定为两个 section：

- `properties`：字段身份、标签、组件静态 props、默认值、静态 options、节点 span 与表单布局等局部配置。
- `validation`：当前字段的同步基础规则和 `validateOn`。

基础校验可创建 required、length/minLength/maxLength、email/url/uuid/regex、min/max/integer/finite/multipleOf、dateMin/dateMax，以及 base/optional/nullable。`compare` 与 `custom` 继续存在于 Runtime/Model 合同，但默认 Designer 不创建或修改。若规则集合包含高级规则，编辑器把未知部分视为 opaque：可只读提示，或在修改基础规则时无损合并，不能丢弃。

Designer Registry 在唯一校验点对白名单路径做验证。官方和第三方默认 setter 只能写入局部属性根，包括 `props`、`field`、`label`、`defaultValue`、`validation`、`validateOn` 和 `span`；具体嵌套路径继续受现有类型/Schema 校验。

以下根路径不得由默认 material setter 写入：`events`、`bindings`、`conditions`、`reactions`、`optionSource`、`valueScope`、`extensions`。`custom` 只表示自定义局部属性控件，不是任意 ProjectDocument 写入口。

Designer 继续读取程序化 Schema 中的 conditions/reactions，并通过纯投影生成设计态可见/禁用状态；这不产生作者 UI。`ComponentContract.bindings` 与组件运行 binding 保留。首阶段不新增 `enableFlows`、`enableEvents` 等开关，也不新增空的通用扩展框架。

## Data 与复用解耦

- `ConfigFormFlowHttpRequestInput/Output` 迁到 Data Source 领域并使用 Data 命名；所有消费者直接依赖 Data 类型，不保留旧 Flow 类型别名。
- `FlowValueEditor` 移入 Data feature，改为 `DataValueEditor` 或等价职责名；DataWorkspace 改用新入口，旧 `features/flow` barrel 删除。
- `flowReferenceFields` 等被 Data 复用的中性能力改为 Data/value-reference 命名；只服务 Flow authoring 的 source catalog 删除。
- `use-renderer-events` 中的数据生命周期迁到 Data composable，确保删除 Flow 不影响 data source、option source、variables 和 scope cancellation。
- `use-renderer-data` 删除 `ConfigFormFlowActionContext`、`cloneConfigFormFlowData`、`createRendererFlowValueContext` 和 `loadFromAction`；clone、value context 与 scope context 迁到 Data/value-reference API。
- `flow-value-context.ts` 拆分并使用所属领域名称，不再以 `ConfigFormFlowEvent` 为输入；Data load 只接受 Data load options/context，不构造 `component.event` 或 `dataSource.load` 伪触发器。
- `source-flow.ts` 中的 `createStandaloneDataSourceRequestSource` 先迁到 Workbench 中性的 Source Data 模块，并由生成页面直接创建 `dataSourceHost`；随后才删除 Flow source/action binding 文件。

## Workbench、Preview 与 Source

Workbench 继续是内部 composition root。Preview 验证静态 Schema、布局、校验、同步规则、数据源和 Runtime 集成；Source 验证可生成并运行的静态配置。两者都不是事件编排产品。

必须删除：

- `FlowDialog`、`FlowWorkspace`、节点/动作/条件/参数编辑器及其 store、样式、locale、测试和 E2E。
- PageFlowEngine、action registry、event targets、builtin action descriptors 和 Flow controller projection。
- Runtime Host 的 `runtimeEvent`、`flowTrace`、`flowError`、`flowResult`、action RPC 消息与 schema。
- Source 的 `flows.ts`、flow plan bundling、`createSourceFlowActions`、`:flow-actions`、Flow callbacks，以及 source-portability 中 events/flowEvents 专属规则；保留并改写静态 props、bindings 与递归 portability 校验。
- 无消费者的 `@vue-flow/core` manifest、workspace catalog 与 lockfile 记录。

Preview iframe 仍可保留与数据源或普通运行状态有关的协议，但必须使用所属领域名称，不能借 Flow RPC 继续承载事件函数。

## 版本硬切

| 合同 | 当前 | 目标 | 原因 |
| --- | ---: | ---: | --- |
| `PAGE_GRAPH_VERSION` | 2 | 3 | 删除 `PageNode.events` |
| `PROJECT_DOCUMENT_VERSION` | 4 | 5 | 删除 `ProjectPage.flows` 并包含新版 PageGraph |
| `REGISTRY_CONTRACT_SNAPSHOT_VERSION` | 1 | 2 | 删除 `ComponentContract.events` |
| `CANONICAL_PROJECT_IR_VERSION` | 3 | 4 | 删除 Canonical node events/flowEvents 和 page flows |
| `CONFIG_FORM_COMPILER_VERSION` | 4.0.0 | 5.0.0 | 编译输入与输出语义破坏性变化 |
| `PAGE_TRANSFER_VERSION` | 1 | 2 | 页面传输 shape 删除事件与 Flow |
| `PROJECT_ENTITY_CODEC_VERSION` | 2 | 3 | IndexedDB entity payload shape 改变 |
| `CONFIG_FORM_EXPORT_GENERATOR_VERSION` | 3.0.0 | 4.0.0 | 生成产物删除 Flow bundle/action binding |
| `RUNTIME_HOST_PROTOCOL_VERSION` | 5 | 6 | Preview 协议删除事件转发与 Flow 消息 |

`PROJECT_MANIFEST_VERSION` 只描述实体索引，索引 shape 未变时不机械提升。`PROJECT_TEMPLATE_VERSION` 也不机械提升，模板 seed 内的新版 PageGraph/ProjectDocument version 负责拒绝旧合同。`CONFIG_FORM_FLOW_VERSION` 随 Flow 领域删除，不升级。组件 fingerprint、registry lock、compiler cache identity、fixture 和示例随新合同整体刷新。

所有入口只接受目标版本；旧、未来、缺失或混合 shape 返回稳定诊断或明确重置提示，不迁移、不猜测、不静默删除字段后继续。

## ConfigForm 包族原子发布

仓库 `.changeset/config.json` 没有 fixed/linked group，`scripts/auto-changesets.mjs` 只会为改动包生成 patch。本次删除公开 API，不能依赖自动脚本兜底。

直接发生破坏性 API 变化的 pre-1.0 包使用手写 minor Changeset：

- `@moluoxixi/config-form-core`、`@moluoxixi/config-form-model`、`@moluoxixi/config-form-compiler`。
- `@moluoxixi/config-form-headless`、`@moluoxixi/config-form`、`@moluoxixi/config-form-vue-backend`。
- `@moluoxixi/config-form-designer`、`@moluoxixi/config-form-designer-element-plus`、`@moluoxixi/config-form-designer-antd-vue`。

依赖新 Runtime/Headless/Designer/Model 合同的公开消费包也必须在同一 Changeset 中发布并把 peer range 指向新 minor：

- `@moluoxixi/config-form-element`、`@moluoxixi/config-form-antd-vue`。
- `@moluoxixi/config-form-devtools-vite-plugin`。
- `@moluoxixi/config-form-plugin-element-plus`、`@moluoxixi/config-form-plugin-antd-vue`。

这些 peer 合同的硬切同样不能用旧/新联合 range 伪装兼容。实际生成后的目标版本由 Changesets 计算，实施时用 `changeset status`、peer range 检查和发布测试验证整个 ConfigForm 包族可原子安装。

## 扩展准入合同

未来 Rules、Data、Automation 或其他能力只有同时满足以下条件才进入设计：

1. 有可复现的真实用户任务，且宿主代码解决方式存在明确、重复的成本。
2. 能定义独立职责，不与 properties/validation 或现有 Runtime API 重复。
3. 有显式输入输出、错误、取消、生命周期和权限边界。
4. 使用独立 package 和稳定公开合同，核心包不反向依赖。
5. 默认未安装时零运行成本、零 UI 占位、零持久化噪声。
6. 有直接 API、Preview 和 Source 的适用性判断及独立测试。
7. 不增加第二事实源、兼容双读或任意脚本执行。

未满足这些条件时，能力留在宿主 Vue/TypeScript 代码中。

## 文档与规范

- 新建 `packages/ConfigForm/PRODUCT.md`，更新 ConfigForm/root README、`ROADMAP.md` 和关键包 README。
- Runtime README 明确代码态 `props.onX`；Designer README 定位为轻量 Schema 编辑器；Workbench README 标注 internal 且不含事件系统。
- 新增 `.trellis/spec/config-form/frontend/product-boundaries.md`，并从相关 package spec index 链接。
- 删除 `flow-runtime-consistency.md`，用 product-boundaries 与 Runtime state boundaries 承接仍有效的非 Flow 合同；同步更新 spec index 和任务 `implement.jsonl`/`check.jsonl`，避免后续上下文引用已删除文件。
- 为缺少 Trellis package scope 的 Model、Compiler、Vue backend 补 package 登记与 spec index，使后续变更能加载正确合同。

## 回滚策略

这是跨版本原子硬切，不提供运行时 feature flag。实施按“产品/测试合同 -> Data 解耦 -> Model/Registry -> Compiler/backend -> Runtime -> Designer/Workbench（含静态 Source）-> 全量验证”推进；每个阶段以定向测试为保存点。

若某阶段不能完成，只修复或撤销本任务产生的该阶段改动，不能用兼容分支同时接受两套合同，也不能发布中间状态。任何回滚都不得覆盖用户已有改动。
