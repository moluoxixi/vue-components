# 事件产品技术设计

## 冻结的第一阶段接口

Core `flow` 保留现有 `ConfigFormFlow { nodes, edges }` 与 ExecutionPlan；编辑器只通过 `flow-authoring` 的有序步骤接口读写，不把节点坐标和连线作为业务操作。

生命周期种类统一为 `form.initialize | page.mount | page.unmount | form.valuesChange | form.beforeSubmit | form.validationSuccess | form.validationFailure | form.reset | form.submit | component.event`。唯一常量数组供 Core/Model/编译器/UI 使用；具体组件值变化仍由 `component.event` 承载，不另造 field.change 兼容入口。

节点增加可选 `policy: { when?, stopWhen?, onError?: 'continue' | 'failure', timeoutMs? }`，条件复用现有安全 reaction condition。执行条件 false 跳过动作并走 next；错误 continue 记录诊断后继续，failure 走 error 出口或失败；stopWhen 在动作完成后判断并返回 blocked。新增 `blocked` 终止结果，提交已完成的运行内补丁但阻止后续流程和业务提交。

新增动作描述类型，数据安全且独立于 execute：ref/title/category/parameters/outputs/capabilities，参数控件为 text/number/boolean/enum/value/field/variable/dataSource/object/array。注册动作可带 descriptor，注册器可列出描述，旧 get 单一执行端不被重复执行。内置动作元数据与参数校验属于 Core；工作台不再维护第二份预设。

Trace 增加 timestamp、durationMs、input/output/value patch 的有界快照。错误保留原始稳定 diagnostic code/path；队列和重入有界，取消/失效结果不能发布。timeout 默认 10000ms，0 明确表示不设置动作超时；各 schema 一致。

## 作者树

`ConfigFormFlowStep` 包含 action、condition(when/then/else)、reaction、terminate；每项稳定 id、可选 title。action/reaction使用与Flow node相同input/config/policy合同。`createConfigFormFlowFromSteps(metadata, steps)` 生成稳定图及完整分支汇合；`readConfigFormFlowSteps(flow)` 返回结构化草稿或可定位的不可表达诊断，不猜测丢失分支。`cloneConfigFormFlowSteps` 重建步骤identity并重映射内部output引用；字段/外部变量引用保持身份。暴露上游必达输出分析与移动/删除后验证。

Conversion 必须明确终止分支：分支结束的后续节点不可达时不生成虚假边；两支正常汇合时后续执行一次。限制深度、节点数及危险key；稳定生成不依赖随机数或全局计数器。

## 编辑器

`FlowEditorSession` 保存base hash和draft，有变动时显示保存状态；所有输入和树操作只改draft。Save 校验后一次 command 并等待结果；Cancel/关闭不提交。动作控件、来源选择、嵌套条件和终止策略直接对应这些类型。采用现有Element Plus、lucide、主题token及对话框焦点设施，不另造通用组件框架。中文/英文词条一致。

## 后续接入

Model/Compiler 校验扩大事件枚举、policy/blocked与动作结构，并共享引用检查。Runtime生命周期与Headless同实例；Workbench Host通过显式能力端口运行，父侧不再重复dispatch。Source携带同一Core模块并校验required bindings。变量、数据源、scope扩展以父任务冻结合同为准，不在本模块保留工作台私有副本。

## 测试

作者树图往返/嵌套汇合/终止/复制/上游输出；内核策略、异常码、并发取消、队列限制、timeout=0及默认timeout；UI保存取消冲突及输入错误；实际Runtime/Preview/Source lifecycle parity。子任务不能仅因Core测试通过就标整体完成。
