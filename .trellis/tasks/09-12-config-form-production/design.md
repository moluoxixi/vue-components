# ConfigForm 生产能力技术设计

## 输入与授权

以已批准目标合同和 `prd.md` 的 AC1-11 为范围依据。用户已回复确认并批准自主执行；本设计是已批准行为的技术落实，不增加任意脚本、服务端或其他组件库。现有 `09-12-config-form-event-architecture` 工作区改动保留并复验。

## 可保留的边界

- Model 的 ProjectDocument / ProjectSnapshot 是唯一业务结构来源；ProjectCommand / Operation / History 是唯一编辑事务链。
- Core 现有 Flow execution plan、解释器、latest/queue/ignore、Abort、超时及补丁提交作为唯一流程执行基础。
- Runtime 使用同步 model read/write，Headless 管理字段、校验、触达与脏状态。Designer 只编辑结构，真实控件由 RuntimeHost 渲染。
- Source 继续导出真实 Core 模块，不能复制另一份流程、表达式、数据源或作用域算法。

## 事件作者模型与编辑事务

- 用户操作有序步骤和嵌套条件，不直接操作节点 ID、出口、坐标或 JSON。
- 有序步骤树是编辑器草稿及转换接口，降低为已存在的确定性 DAG/ExecutionPlan。持久化不同时保存两套可修改流程；若必须修改持久化合同，版本硬切，不引入旧格式迁移器。
- 支持动作、条件 then/else、状态/赋值、结束/成功/失败/阻断；结构化插入、移动、复制和删除保持分支语义与引用。
- 一次编辑会话固定原始 Flow identity/hash；所有编辑只更新草稿。保存验证后提交一次 ProjectCommand，取消不提交。现有配置被并发修改时报告冲突，不静默覆盖。
- 动作合同描述名称、分类、参数控件、必填、输出、宿主能力和可导出绑定；可信 execute 留在宿主注册器，不进入 JSON。
- 字段、变量、事件参数和已执行上游输出使用可枚举引用。下游/互斥分支输出不可选择；校验错误带 flow/step/parameter 路径。

## 共享引用与数据合同

- 字段引用按稳定 nodeId 和 current/parent/root 作用域定位，变量/数据源按稳定 id 定位。名称是展示信息；表达式通过现有安全 parser/AST 分析引用，不做猜测式文本替换。
- 模型边界检查缺失引用、输出可达性、条件/动作结构、危险 key 及深度/数量预算。复制、重命名和删除共用引用分析与 remap。
- ProjectPage 持有显式 runtime 配置，包括 variables 和 dataSources；不藏进任意 props/settings。Canonical page/runtime plan 保留这些语义。
- 数据源是有版本/身份的请求声明，动态 URL、headers、query、body 和结果映射复用安全值引用。字段 options 与流程加载动作使用同一 source id。
- Core 数据源运行器管理按 source/scope 的请求身份、Abort、timeout、加载/空/错误/结果；依赖变化触发级联，晚到结果不覆盖新结果。只能使用显式宿主请求能力，设计态不会自动调用。

## 表单与生命周期所有权

- 表单生命周期与控制器在同一个运行实例内协调，顺序为 initialize、mount、值变化/组件事件；提交经 beforeSubmit、校验、validation success/failure、submit Flow，再通知业务宿主。
- 阻断、失败或过期状态不得继续业务提交；重复提交有确定的串行/忽略策略，所有重入受有界链路保护。
- 重置原子恢复声明的初始 values/variables/meta/errors，再触发 reset；卸载运行受限清理事件并取消其余任务。
- 真实 RuntimeHost 应拥有这份运行实例；父工作台仅适配显式副作用能力、调试和状态镜像，不另拥有一份表单事务。
- 追踪包含时间、耗时、步骤输入输出及错误；有界保存，敏感宿主数据不自动跨出实例。

## 嵌套与明细

- layout 节点扩展显式 object/array 数据作用域语义，不能把它伪装成普通布局 props。数组模板子树持久化一次。
- 字段实例身份为 nodeId 加稳定 rowId 链；索引仅是当前值路径，排序不改变行身份，删除取消该行验证/流程/请求。
- 对象、重复列表及明细表格共用同一作用域算法。提供新增/复制/删除/排序/min/max；两层嵌套同样工作。
- 外部回填通过声明 itemKey 协调身份；未声明且整体替换数组时重新建立瞬态行身份。瞬态 rowId 不污染业务提交值。
- 校验、touched、dirty、readonly、联动、事件和输出都按实例作用域解析；对外提交/回填仍是自然嵌套对象与数组。

## 编译、导出与扩展

- 编译产物必须完整带字段、作用域、变量、数据源、Flow plans 和 required bindings。Vue backend、直接业务集成、Preview 与独立 Source 同时消费，不从不同 revision 手工配对。
- Source 页面只适配 Vue 组件和宿主能力，共享核心逻辑以实际模块导出；不丢弃 optionSource，不猜测缺省值。
- 自定义 action/validator/source binding 缺失在导出前定位并失败，不生成静默缺功能的工程。
- 导入只接受当前 schema；必要时同时更新版本、fixtures、示例和精确拒绝旧版本的测试，不自动清空任何持久化数据。

## 验证与风险控制

已有基线：Workbench 590 测试与两个导出模板构建通过；Compiler 目录清单漏 runtime-source、Designer 七条类型诊断待修复。它们不能被算作最终通过。

按共享模块先冻结合同，再并行 UI/Runtime/引用完整性/导出；禁止两个代理同时修改同一路径。每个子任务做单元与类型检查，跨边界合并后再做行为 parity。完整双组件库三场景、指定视口、无障碍与完整命令输出是最终验收依据。缺少平台截图时必须实际审视并建立基线，不跳过用例或放宽标准。

## 本轮冻结的模块接口

### value-reference

`ConfigFormValueReference` 判别字段为 `kind`：literal(value)、field(nodeId, scope?: current/parent/root)、variable(variableId)、event(path: string[])、output(stepId, path?: string[])、expression(source)。配置中的引用使用唯一键对象 `{ $ref: reference }`；普通 JSON 对象和数组递归解析，literal 分支不再次解释业务对象。表达式继续使用现有安全 parser/evaluator；稳定字段/变量/输出符号为 `$fields["nodeId"]`、`$variables["variableId"]`、`$outputs["stepId"]`，通过 AST 收集和重映射，不做文本替换。

公开 `resolveConfigFormValueInput(input, context)`、`collectConfigFormValueReferences(input)`、`remapConfigFormValueReferences(input, maps)`。context 提供 fields、variables、outputs、event 和可选 `resolveField(nodeId, scope)`，后者返回 `{ found, value? }`，缺失引用和无效表达式产生带 code/path 的错误。保持 JSON 深度 32、访问预算 10000，拒绝危险键、循环和未知引用配置。

### data-source

公开 `ConfigFormVariableDefinition { id, name, initialValue }`；`ConfigFormDataSourceDefinition { id, name, request: { url, method?, headers?, query?, body?, responseType? }, mapping?, dependencies?, auto?, timeoutMs?, cacheTtlMs? }`。动态 request 和 mapping 复用 value-reference，mapping 的 event 是已返回的 response 对象。ProjectPage.runtime 使用 `{ variables, dataSources }`。

`createConfigFormDataSourceRuntime({ sources, host: { request? }, readContext?, onState?, maxEntries? })` 提供 load、getState、invalidate、reset、dispose。load 接受 `{ scopeKey?, context?, force?, signal? }`；每个 source/scope 采用 latest 隔离，取消与超时不会发布过期结果。request 端口是 `(input: ConfigFormFlowHttpRequestInput, signal: AbortSignal) => Promise<ConfigFormFlowHttpRequestOutput>`；模块不得读取全局 fetch。state 包含 idle/loading/success/empty/error、data/error、请求身份及时间，缓存和实例数量有上限。没有隐式设计态请求；auto 由已挂载运行时协调器启动。

### value-scope

公开 `ConfigFormValueScopeDefinition { nodeId, field, parentId?, kind: object/array, itemKey?, minItems?, maxItems? }`、`ConfigFormScopedFieldDefinition { nodeId, field, scopeId?, defaultValue? }`、`ConfigFormScopePath = readonly { scopeId, rowId }[]`。字段名是对象内一个键，不把点号拆成路径；节点/作用域声明负责真实嵌套。

`createConfigFormValueScopeStore({ scopes, fields, values?, createRowId? })` 提供 getValues、replaceValues、getValue/setValue(nodeId, scope)、resolvePath(nodeId, scope)、listRows(scopeId, parentScope)、appendRow、insertRow、duplicateRow、removeRow、moveRow。对象作用域无行标识；数组实例按稳定 rowId 链寻址。排序保留身份，复制为全部后代分配新身份，删除返回失效身份供生命周期协调器取消任务；itemKey 回填按键复用，未声明且整体替换时重建行身份。初值和快照深克隆，危险键/非法层次/越界/min-max 违约返回明确错误。

这三个模块先以纯 Core 单元测试固定边界，Model/Compiler/Headless/UI 接入仍是父验收的必要部分，不能以模块存在代替端到端完成。

## GPT-6 修复阶段的补充合同

- Vue 后端产物统一为 `{ compilationKey, pageId, renderer }`。`renderer.plan` 是完整运行数据；消费者不再读取旧 `artifact.plan.renderer`，生成声明和 fixtures 必须与真实 producer 一致。
- Headless 新增 `updateValueSchema(schema?)`：相同拓扑内容为 no-op；兼容作用域保留 rowId，新增字段补声明初值，失效字段清理状态；重置仍以原始基线加新拓扑默认值为准，不以当前编辑值重新建立基线。候选 schema 验证失败须保持旧状态。
- Flow 原子写回接口定为 `applyValuePatch`，支持根键 set/remove 与稳定实例地址补丁；整批预检、单次 model/change 发布，非法地址或冲突不得部分提交。该接口仍在实施，逐字段 setter 的阶段实现不符合最终事务验收。
- 共享 Renderer 接入显式 `dataSourceHost.request`；运行器提供变量快照、数据源 load/state 与实例 option state。变量初值通过安全 ValueInput 求值，命名源与动态选项复用 Core manager，设计态与导入态禁止自动请求；行取消使用稳定作用域身份。
- Preview 仅镜像自然值与字段实例目录，目录包含 nodeId、scope、instanceKey、valuePath；同身份 live 镜像不得回声替换数组。重新挂载后允许瞬态 rowId 变化，但状态只能按已验证的路径和兼容节点合同映射。提交 requestId 必须贯穿请求、成功通知和最终结果，不能仅用页面 revision 区分不同提交。
- 对象组、数组子表单、明细表仍为 `layout + valueScope`。`props.arrayDisplay` 仅表示 list/table 呈现，不改变数据模型；不使用 slot 子节点数量约束代替行数量约束。设计态需要单模板投影，不在 render 中修改业务行。
- Model 的 current/parent/root 以直接数据作用域为准，包括 object；数组 rowId 链只是实例身份。Runtime 的数组链退层不能代替对象/数组完整作用域解析，这项跨层对齐仍待实施和真实编译回归。
- 动作只接受同步安全数据或原生 Promise。标准 JavaScript 无法同步探知 Promise 内部 settled 状态，动作能力从运行器观测到完成起撤销；不承诺此前已排队微任务的不可实现隔离。同步返回和异步接受点均立即复制输出，不保留宿主可变对象。
- 新 Config 导出使用完整 Canonical 页面与 plan，不再猜测空字符串/零值或扁平收集字段；固定生成工厂复用公开 Vue backend，配置数据本身不含函数或可执行脚本。

阶段报告必须区分已实跑、代理报告、并行改动中的中间失败和最终集成门禁；任一 AC 未通过时不归档父任务、不发布或推送。
