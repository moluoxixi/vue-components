# 收敛 ConfigForm 产品边界与轻量设计器

## 目标

将 ConfigForm 定型为面向 Vue/TypeScript 工程师的生产级表单 Runtime。Runtime 是主产品，Designer 是可选的轻量 Schema 编辑器，Workbench 是内部 Playground、预览和集成验证设施。复杂业务事件只在代码态 config 中以 `props.onX` 函数维护；主产品不再包含事件编辑、事件转发或事件编排能力。

## 用户价值

- 工程师可以用 Schema 复用表单结构、布局、静态配置和基础校验，同时继续用普通 Vue/TypeScript 函数表达复杂逻辑。
- Runtime 不要求业务逻辑进入字符串事件名、动作注册表、DAG、表达式或跨层 RPC，调试、测试和类型检查都回到宿主工程。
- 默认 Designer 的学习成本与错误面显著缩小，属性检查器不再混合局部属性、状态规则、数据请求和副作用编排。
- 包边界和架构门禁阻止事件编排重新侵入主路径；未来只有真实需求成立时，才新建完全独立的 Automation 产品。

## 已确认事实

- 代码态 Runtime 节点的 `props` 是运行时对象，现有 Renderer 会把 `onClick`、`onChange` 等函数监听器传给真实组件；复杂事件不需要中央转发协议。
- 当前 Model 同时持久化 `PageNode.events` 与 `ProjectPage.flows`；Core Flow 还包含 trigger、condition、action、DAG、并发、超时、事务、结果和 trace，属于完整事件编排系统，不是 Preview 或源码导出的内部辅助数据。
- 当前 `runtimeEvent` 只为 Flow 的 `component.event` 服务，事件名来自 `eventNames/flowEvents`，随后继续 dispatch Flow；它不是普通表单事件，也没有脱离 Flow 的保留价值。
- `ComponentContract.events` 和 Designer material `events` 的生产消费者都服务于 Flow 校验或事件编辑器；字段值绑定依赖的是独立的 `bindings.trigger/blurTrigger/getValueFromEvent`。
- 默认检查器当前公开 `properties`、`validation`、`events`、`bindings`、`conditions`、`reactions` 六类入口，跨越了局部配置、状态策略和副作用编排三种责任。
- Data Source 当前复用了 Flow HTTP 类型，DataWorkspace 当前复用了 `FlowValueEditor`；删除 Flow 前必须把这些真实的 Data 能力迁回 Data 领域。
- 项目处于预发布阶段，现行规范要求 current-contract-only 硬切：旧合同必须拒绝，不能增加迁移器、兼容别名、deprecated wrapper 或双读分支。

## 需求

- R1：新增可长期维护的产品定位文档，明确目标用户、核心价值、能力分层、非目标、Workbench 身份和扩展准入规则；仓库入口与关键包 README 必须能发现该文档。
- R2：Runtime、Headless 与 Core 不得依赖 Designer、Workbench 或未来可选逻辑产品；Designer 不得拥有业务副作用、请求调度或通用流程执行。未来能力只能通过新的独立 package 和明确公共合同接入。
- R3：默认 Designer Inspector 只保留 `properties` 与 `validation`。结构、展示、布局、默认值、静态 options、基础校验和 `validateOn` 属于默认作者体验。
- R4：默认 Designer 不提供 events、底层 bindings、conditions、reactions、动态 option source 或任何 Flow/Automation 作者入口，也不以 feature flag、隐藏 tab、自定义 setter 或内部路由绕过边界。Setter 路径必须由单一白名单校验。
- R5：基础校验只创建当前字段、同步、确定性的规则。`compare` 和 `custom` validator 仍可由宿主代码使用；Designer 遇到已有高级规则时必须只读提示或无损保留，普通属性编辑不得丢失它们。
- R6：完整删除事件编排领域，包括 Core `flow/**` 与 `flow-authoring/**`、Model 的 `PageNode.events`/`ProjectPage.flows` 及其 operations/schema/reference logic、Compiler Flow plan、Vue backend Flow 投影、Runtime scheduler/actions/transaction/diagnostic/trace，以及 Workbench 的编辑、执行、Preview RPC 和 Source 生成适配。
- R7：完整删除事件转发协议，不新增替代物。删除 `runtimeEvent`、`ConfigFormRuntimeEventPayload`、`ConfigFormRuntimeEventContext`、`interceptEvent`、`eventNames`、`flowEvents`、`componentEvent` 式中央总线设想，以及 Workbench iframe 中对应消息。代码态组件事件只通过节点 `props.onX` 直接绑定并执行；design mode 只做内部模式判断，不构造或转发事件 payload。
- R8：删除 `ComponentEventContract`、`ComponentContract.events`、Designer material `events` 及其校验、投影和文案。保留组件值绑定合同 `bindings` 及其 `trigger`、`blurTrigger`、`getValueFromEvent`。
- R9：保留与 Flow 无关的表单级宿主 API：`change`、`fieldChange`、`metaChange`、`errorsChange`、`error`、`submit`、`variablesChange`、`dataSourceStateChange`，以及 `get/set/validate/reset/submit` 等 expose。字段组件事件仍须维持“内部写值/校验先执行，再调用代码态 `props.onX`”的行为。
- R10：Designer 的 ProjectDocument、JSON 导入导出和持久化继续只接受可序列化数据，不存储、不克隆、不往返函数。Workbench 的源码导出只生成结构配置，不生成事件 handler stub 或 action binding；工程师在宿主代码中组合 handler。
- R11：conditions/reactions 的默认作者 UI 删除，但现有程序化同步规则 Runtime、只读设计态投影、数据源 Runtime、动态 options resolver 和 value scope 暂时保留。删除 Flow 时必须把 Data HTTP 合同、Data 值编辑器、数据生命周期、clone/value/scope context 和 Source Data request generator 移入各自领域；删除 `loadFromAction` 及 `component.event/dataSource.load` 伪事件，不能保留 Flow 命名、类型或转发 barrel。
- R12：提升受影响的持久化、Registry、传输、Canonical IR、Compiler、Runtime Host 和源码生成合同版本；所有 writer、reader、fixture、示例和测试在同一变更中切换，旧、未来、缺失和混合合同均稳定拒绝。删除公开 API 的 ConfigForm 包必须使用手写 breaking Changeset 原子发布，并同步所有内部 peer range，不能依赖自动 patch Changeset。
- R13：移除事件编辑器、Flow Lab、`@vue-flow/core` 及全部 Flow 专属 locale、测试和 E2E；不能留下隐藏入口、公共 re-export、兼容 wrapper、空占位 package 或“未来可能使用”的死代码。
- R14：旧的 09-12 低代码/事件编排扩张任务保留历史证据，但记录被本任务取代的产品方向；不得把未完成的可视化编排验收伪称为已交付。
- R15：Runtime、Headless、双组件库适配、基础表单、嵌套对象/数组、readonly、校验、提交、程序化同步规则、数据源和 Workbench 现有静态源码导出不得因收敛退化。

## 验收标准

- [ ] AC1：`PRODUCT.md`、ConfigForm README、根 README、路线图和关键包 README 一致表达“Runtime-first、Designer optional、Workbench internal、complex logic in host code”。
- [ ] AC2：依赖与架构测试证明 Runtime/Headless/Core 不依赖 Designer/Workbench，Designer 不依赖 Workbench 或事件编排实现。
- [ ] AC3：默认 Inspector 精确只显示 `properties` 与 `validation`；公共 DesignSurface/PropertyPanel API 不再暴露事件或 Flow props/emits，官方及第三方默认 setter 不能写高级路径。
- [ ] AC4：基础校验、静态 options、默认值、布局和属性编辑正常；已有 compare/custom、conditions/reactions 等程序化高级配置在普通编辑后不被静默删除。
- [ ] AC5：`packages/ConfigForm` 生产代码不再定义、导出或消费 `PageNode.events`、`RegisteredEventAction`、`ProjectPage.flows`、`ConfigFormFlow*`、`flowEvents`、`eventNames`、`flowActions`、`flowResult`、`flowError`、`flowTrace` 或 `runtimeEvent`。
- [ ] AC6：组件合同和 Designer material 不再声明 `events`；值绑定 trigger 仍正常工作。
- [ ] AC7：代码态 config 中的 `props.onClick/onChange` 可直接执行且恰好执行一次；字段绑定与校验先于外部 listener。Designer design mode 不调用宿主 listener，也不构造、转发组件事件 payload。
- [ ] AC8：表单级 `change/fieldChange/metaChange/errorsChange/error/submit/variablesChange/dataSourceStateChange` 和 expose API 继续通过回归；不存在新增的 `componentEvent/forwardEvents/onRuntimeEvent` 等替代协议。
- [ ] AC9：当前版本文档、页面图、Registry 快照、传输记录、持久化实体、Canonical IR、Runtime Host 消息和生成产物可读；旧、未来、缺失或混合 shape 均 fail closed，无迁移器或兼容读取。
- [ ] AC10：Workbench Preview 与 Source 继续服务结构、校验、数据和渲染验证，但不存在 Flow UI、运行引擎、trace、action RPC、handler 生成或事件转发 RPC；`@vue-flow/core` 从 manifest、catalog 和 lockfile 移除。
- [ ] AC11：Data Source、`use-renderer-data` 和 value/scope context 不再导入 Flow 类型，不构造 `component.event/dataSource.load` 伪事件，也不暴露 `loadFromAction`；DataWorkspace 不再导入 `FlowValueEditor`，Source Data request generator 不再位于或依赖 Flow/action 文件。迁出的类型、组件和生成器使用 Data/value-reference 领域名称，旧 Flow export 不保留。
- [ ] AC12：ConfigForm 相关包的定向单测、类型检查、构建、模板验证、包架构测试和关键 E2E 通过。
- [ ] AC13：手写 Changeset 对直接删除公开 API 的 pre-1.0 包执行 minor bump，对依赖这些新合同的 adapter/plugin/devtools 同步发布并更新 peer range；Changeset status、release checks 和发布测试通过。
- [ ] AC14：`.trellis/spec/` 记录可执行的产品边界、依赖方向、代码态事件合同、版本策略和必需测试，未来新增 Automation 必须重新立项。

## 范围外

- 不新建 Rules Editor、Event Editor、Automation 包、占位 package、商业 SaaS 或通用插件框架。
- 不增加任意 JavaScript 字符串执行、远程插件、鉴权、云存储、多人协作、发布平台或模板市场。
- 不在 Designer 文档、JSON、IndexedDB、Preview RPC 或源码生成器中序列化函数。
- 不新增 `runtimeEvent` 的改名版本、事件名订阅表、全局 EventBus、handler registry 或 adapter。
- 不在本阶段新增表单 lifecycle 公共 API；现有表单 emits、expose 和代码态 `props.onX` 已构成 MVP 宿主出口。
- 不在本阶段删除 conditions/reactions、data source、optionSource、valueScope 或组件 bindings 的运行合同；它们是否进一步收敛需基于真实需求另行设计。
- 不提供旧事件或 Flow 数据到新合同的自动迁移器；仓库内 fixture 直接改写为无事件编排的当前合同。
- 不将 Workbench 整理成公开产品，也不继续扩张其多页平台、模板市场或协作能力。

## 风险与延期项

- Flow 已跨越 Model、Compiler、Runtime、Preview、Source 和持久化，必须按原子硬切实施；中间状态不可发布。
- `use-renderer-events` 同时承载 Data Source 生命周期，不能整文件粗删；需要把 prepare/start/refresh/reset/cancelScope 等数据职责迁回 Data 模块。
- `runtime-flow-events` 同时维护字段内部监听器与外部 `props.onX` 的执行顺序；删除转发/诊断/Designer event context 时必须保留这一纯 Renderer 行为，并以直接 mode guard 取代事件 bridge。
- `source-flow.ts` 当前混有独立的 Data Source request 生成器；必须先迁到 Source Data 模块并保持生成项目的数据源 parity，才能删除 Flow Source 文件。
- 自动 changeset 脚本只生成 patch，且仓库未配置 fixed/linked package group；若不手写 breaking Changeset 并更新 peer range，会把不兼容合同错误发布为 patch。
- 代码态函数只存在于宿主运行配置，不进入 Designer JSON。Preview 无法复现宿主未注入的业务函数是明确边界，不通过新增序列化或 RPC 解决。
- Event Editor、Rules、Data、Automation 与 DevTools 的独立产品化延期到真实使用证据出现后；未来 Automation 若重建，应使用全新包和合同，本阶段不保留遗留外壳。
