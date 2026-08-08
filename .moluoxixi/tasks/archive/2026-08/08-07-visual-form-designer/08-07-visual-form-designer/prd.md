# 配置化表单可视化设计器

## Goal

为仓库现有的配置化表单能力规划一套可视化设计界面，使表单搭建者能够通过直接操作完成表单结构、字段属性和布局配置，并让设计结果继续由现有运行时可靠渲染。

首个 Element Plus MVP 已完成并合并到主分支；当前阶段继续实现和验证设计画布的真实组件呈现与选中交互。

## Background

- 用户希望参考主流低代码产品的可视化拖拽体验，但尚未指定要复刻某个产品。
- 现有公开轻量契约是 `ConfigFormNode[]`：字段节点绑定模型，容器节点通过 slots 形成递归树；运行时已负责布局、显隐、校验、提交和组件双向绑定（`packages/ConfigForm/headless/src/types/props.ts:172`, `packages/ConfigForm/headless/src/types/props.ts:182`, `packages/ConfigForm/runtime/src/renderer/types.ts:44`）。
- Element Plus、Ant Design Vue 和 shadcn-vue 均复用同一 renderer，差异主要位于组件引用和 value/trigger binding 适配层（`packages/ConfigForm/element/src/index.vue:39`, `packages/ConfigForm/antd/src/index.vue:45`, `packages/ConfigForm/shadcn/src/index.vue:39`）。
- 现有协议不是可直接持久化的设计器文档：节点没有稳定 ID，`component` 可为 Vue 对象，条件、校验、转换、slots 和 readonly renderer 可包含函数或 Zod 对象（`packages/ConfigForm/headless/src/types/props.ts:5`, `packages/ConfigForm/headless/src/types/props.ts:153`, `packages/ConfigForm/headless/src/types/props.ts:200`）。
- 现有 runtime registry 只解析组件，没有标题、分类、图标、默认配置、属性 setter 或迁移信息等设计态物料元数据（`packages/ConfigForm/runtime/src/runtime/types.ts:13`, `packages/ConfigForm/runtime/src/runtime/types.ts:47`）。
- 仓库已有 `sortablejs` 与同级排序实践，可作为 MVP 拖拽基础；没有现成的表单设计器或全局状态库（`packages/components/src/ConfigTable/src/components/ColumnSettings.vue:108`）。
- 该能力至少涉及设计态交互、配置协议、物料描述、运行时渲染、校验与配置持久化，属于复杂任务。
- 产品首版定位为可嵌入的开发期设计器组件，不是自带后端治理的在线低代码平台。
- MVP 确认支持有限容器树与基础声明式条件；不支持任意脚本和完整表达式语言。
- 设计器核心保持 UI 库无关；MVP 只交付一套完整的 Element Plus 物料适配器。
- MVP 包含常用校验规则的可视化配置；设计器保存声明式规则并在运行时编译为 Zod，而不是序列化 `ZodType` 实例。
- 常用校验规则与 Zod 的桥接单独发布为 `@moluoxixi/zod3-to-rule`（建议目录 `packages/zod3-to-rule`），不依赖 Vue 或设计器 UI，方便后续独立复用。
- 采用贴近现有 `ConfigFormNode[]` 的 `DesignerDocument` 作为唯一设计态协议，并通过薄 compiler 生成运行时配置；不引入与现有表单语义割裂的通用低代码 DSL。
- MVP 聚焦设计器文档的可视化创建、持久化 round-trip、编译和真实运行时预览；暂无必须打开既有手写表单的产品需求。
- 设计画布必须直接呈现字段 label 和真实物料组件，不能通过隐藏文字模拟占位；表单级 label 布局支持左右和上下两种模式。
- 节点选中态使用不参与布局的外扩覆盖层：虚线边框距离组件内容 5px，未选中时不存在覆盖层且不产生任何占位。
- 节点操作栏位于选中虚线右上方外侧，底边紧贴虚线；覆盖层和操作栏不能阻断嵌套节点选择或拖拽。

## Requirements

- 先从第一性原理定义设计器要解决的用户任务，再选择界面形态和拖拽技术。
- 设计器文档应是可版本化、可校验、可 JSON round-trip 的唯一设计态事实来源；通过一个共享编译边界投影为现有 renderer 配置，渲染层不得自行重定义协议。
- `DesignerDocument` 中的 `field`、`label`、`props`、`span` 和递归子节点等属性应尽量与 `ConfigFormNode` 同名同义；仅对不可序列化值和设计态元数据增加明确表示。
- 每个字段与容器节点必须具有独立、稳定的设计态 ID；字段 `field` 仍作为业务模型 key，不承担画布节点 identity。
- 持久化协议只能保存组件物料 key 和声明式数据；Vue 组件、函数、VNode 与 Zod 实例等运行时值必须经 registry/compiler 解析，不得直接写入 JSON。
- 声明式校验至少覆盖字符串、数值、布尔、日期、枚举，以及必填、长度、范围、整数、正则、邮箱、URL、自定义错误文案和基础跨字段比较。
- 任意 `refine`/`superRefine`、异步业务校验、preprocess/transform 等高级能力不保存函数源码；文档只保存 registry key 与可序列化参数，由宿主提供实际实现。
- `@moluoxixi/zod3-to-rule` 以 JSON-safe rules 为稳定协议：`rules -> Zod` 是确定性主路径；`Zod -> rules` 只对支持的 Zod 3 子集做最佳努力导出，无法表达的节点返回结构化诊断，不承诺任意 Zod schema 无损 round-trip。
- 方案应说明设计器、配置协议、组件物料和运行时渲染之间的边界。
- 物料定义至少应包含稳定 type、版本、分类、默认节点工厂、运行时组件映射、绑定约定和属性 setter 描述；业务控件能通过注册扩展而无需修改设计器核心。
- Element Plus MVP 应覆盖常用文本、数值、选择、布尔、日期时间等字段物料及有限容器；Ant Design Vue 与 shadcn-vue 通过同一 registry contract 后续接入，不成为首版验收项。
- 设计态编辑必须产生不可变历史记录，支持选择、添加、移动、复制、删除、撤销与重做，并阻止循环嵌套、重复字段 key 和无效落点。
- 预览必须直接使用现有 `ConfigFormRenderer` 路径，并证明同一设计器文档的编辑预览、导出再导入、运行时预览结果一致。
- 设计器负责编辑、入口校验、运行时预览和版本化 JSON 的导入导出；保存、权限、审计和发布由宿主应用负责。
- MVP 至少覆盖字段节点、有限容器节点、基础布局、基础属性与 `visible`/`hidden`/`required`/`disabled`/`readonly` 条件。
- `DesignerFormSettings` 提供可序列化的 `labelPosition: 'left' | 'top'`，默认值为 `left`，并由 document parser、setter、compiler 和 runtime renderer 贯通。
- 设计态组件保持真实渲染但不可交互，节点选择由零布局开销的外层 shell 接管；容器不得使用整块遮罩阻断其后代节点。
- 方案应包含可渐进交付的 MVP 范围，并明确后续高级能力。
- 方案应评估配置兼容、声明式联动、撤销重做、拖拽排序、嵌套布局、属性编辑、预览、入口校验和性能基线等关键问题。

## Acceptance Criteria

- [ ] 现有表单配置模型、渲染路径、扩展机制和相关约束均有仓库证据支撑。
- [ ] 形成用户角色、核心工作流、MVP 范围与明确的非目标。
- [ ] 设计文档定义 Designer Document -> validator/normalizer -> runtime compiler -> ConfigFormRenderer 的单向数据流及每个边界的 owner。
- [ ] compiler 确定性解析物料 key、条件规则、校验规则与宿主 registry 引用，剔除设计态元数据，并返回运行时节点或结构化诊断。
- [ ] 任意合法设计器文档可 JSON round-trip，并在导入时拒绝或报告未知物料、重复 ID、重复 field、循环/非法嵌套和不支持的协议版本。
- [ ] 第三方物料可通过 registry 注册 palette、默认节点、setter 与运行时映射，不要求在核心画布中增加组件特判。
- [ ] 声明式校验配置可编译为 Zod 并由现有 runtime 执行；未知规则、非法参数或缺失的自定义 validator registry key 在导入/编译边界给出结构化诊断。
- [ ] `@moluoxixi/zod3-to-rule` 可脱离设计器导出/解析 JSON-safe rules、编译为当前 Zod 3 peer 版本，并对受支持的 Zod 子集提供带诊断的反向导出。
- [ ] MVP 支持字段/容器添加、同级与跨容器移动、选中编辑、复制删除、撤销重做、JSON 导入导出和真实运行时预览。
- [ ] 字段 label 在画布和运行时预览中均可见，切换 `left`/`top` 后分别形成左右/上下布局，导出再导入保持该配置。
- [ ] 未选中节点不增加边框、padding 或其他布局尺寸；选中节点只通过 `inset: -5px` 的虚线覆盖层表示状态。
- [ ] 选中节点的操作栏位于虚线右上外侧并紧贴边线，真实组件仍可见，嵌套选择与拖拽不受覆盖层影响。
- [ ] `design.md` 描述架构边界、核心数据流、关键契约、兼容策略和主要取舍。
- [ ] `implement.md` 给出可独立验证的实施阶段、验证方式和回滚点。
- [ ] 所有仍待用户决定的问题只涉及产品意图、范围或风险偏好，而非仓库可回答的事实。

## Out of Scope (provisional)

- 页面级 CRUD、数据源编排、权限、流程引擎和应用发布平台。
- 内置服务端存储、草稿/发布版本管理和多人协作；这些能力可由宿主基于设计器的受控文档与变更事件实现。
- 在 JSON 中持久化或执行任意 JavaScript/字符串脚本。
- 首版生成 Vue SFC、HTML 或源码工程。
- 首版提供 Formily/amis 等完整表达式语言或页面级低代码 DSL。
- 首版完整适配 Ant Design Vue 与 shadcn-vue；核心不得因此写入 Element Plus 特有分支。
- 通用 `ConfigFormNode[] -> DesignerDocument` 反向导入及任意运行时对象逆向还原；后续可提供只处理静态可识别配置的独立桥接工具。
- 任意 Zod 3 schema、custom refine/superRefine、transform 或异步 validator 的无损 `Zod -> rules` 转换。
