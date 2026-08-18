# 配置化表单可视化设计器

## Goal

为仓库现有的配置化表单能力提供一个可嵌入的开发期可视化设计器。表单搭建者通过拖拽、选择和属性编辑完成字段结构与布局，设计器生成可版本化 JSON，并由现有运行时确定性渲染。

本任务阶段完成需求、技术设计和执行计划；不在规划阶段实现业务代码。

## Confirmed Context And Constraints

- 当前公开轻量契约是递归的 `ConfigFormNode[]`：字段节点绑定 `field`，容器节点通过 `slots` 组织子树；运行时负责布局、显隐、校验、提交和组件双向绑定（`packages/ConfigForm/headless/src/types/props.ts:172`, `packages/ConfigForm/headless/src/types/props.ts:182`, `packages/ConfigForm/runtime/src/renderer/types.ts:44`）。
- Element Plus、Ant Design Vue 和 shadcn-vue 复用同一 renderer，差异主要在组件引用和 value/trigger binding 适配（`packages/ConfigForm/element/src/index.vue:39`, `packages/ConfigForm/antd/src/index.vue:45`, `packages/ConfigForm/shadcn/src/index.vue:39`）。
- 运行时配置不能直接作为设计器文档：节点没有稳定设计 ID，`component` 可为 Vue 对象，条件、validator、transform、slots 和 readonly renderer 可为函数或 Zod 对象（`packages/ConfigForm/headless/src/types/props.ts:5`, `packages/ConfigForm/headless/src/types/props.ts:153`, `packages/ConfigForm/headless/src/types/props.ts:200`）。
- 当前 runtime registry 只解析组件，没有设计态标题、分类、图标、默认配置、setter 或迁移元数据（`packages/ConfigForm/runtime/src/runtime/types.ts:13`, `packages/ConfigForm/runtime/src/runtime/types.ts:47`）。
- 仓库已有 SortableJS 生产依赖和同级排序实践，但没有现成表单设计器或全局状态库（`packages/components/src/ConfigTable/src/components/ColumnSettings.vue:108`）。
- 当前 Zod peer/catalog 是 Zod 3（`packages/ConfigForm/runtime/package.json:60-78`, `pnpm-workspace.yaml:35-64`）；本任务不升级 Zod 主版本。
- 首版定位为开发期可嵌入组件。宿主负责保存、权限、审计和发布；设计器负责受控文档编辑、入口校验、编译、预览、导入和导出。

## Requirements

### R1. Authoring Document

- 设计器使用贴近 `ConfigFormNode[]` 语义的 `DesignerDocument`，而不是另起一套页面级低代码 DSL。
- 文档必须包含版本号；字段和容器节点均有独立稳定 ID；字段 `field` 只承担业务模型 key。
- 文档只保存 JSON-safe 物料 key、props、布局、声明式条件、默认值和规则；Vue 组件、函数、VNode、Zod 实例和任意脚本不得进入 JSON。
- 文档必须支持 JSON round-trip；导入时报告未知版本、未知物料、重复 ID、重复 field、循环/非法嵌套和无效规则。

### R2. Rules Package

- 常用校验规则与 Zod 的桥接独立发布为 `@moluoxixi/zod3-to-rule`，建议目录为 `packages/zod3-to-rule`；包不依赖 Vue 或设计器 UI。
- JSON-safe rules 是稳定协议；`rulesToZod()` 是确定性主路径。
- `zodToRules()` 只对受支持的 Zod 3 子集做最佳努力导出，并对 `refine`、`superRefine`、transform、preprocess、异步 validator、闭包等无法还原的能力返回结构化诊断。
- 规则至少覆盖 string、number、boolean、date、enum、required、长度、范围、integer、regex、email、URL、自定义文案和基础跨字段比较。

### R3. Material Registry

- 物料定义至少包含稳定 key/version、kind、title、category、默认节点工厂、运行时组件/绑定映射、合法 slots 和属性 setter 描述。
- 业务物料可以通过 registry 注册 palette、默认节点、setter 和 runtime mapping，不修改画布核心。
- 核心 UI 与物料适配器解耦；MVP 只交付 Element Plus 完整适配。

### R4. MVP Materials

- 字段：文本、textarea、数字、select、radio、checkbox、switch、date、time。
- 容器：section/card、tabs/tab-pane、collapse/collapse-item。
- autocomplete、cascader、tree-select、upload、富文本和远程 options 延后。

### R5. Editing Workflow

- 工作台包含 palette、canvas、property panel 和 preview/import/export toolbar。
- 支持添加、选择、同级排序、跨容器移动、复制、删除、撤销和重做。
- 支持有限容器树、grid/span 布局和 `visible`、`hidden`、`required`、`disabled`、`readonly` 基础声明式条件；不支持任意脚本或完整表达式语言。
- 属性编辑采用混合提交：离散控件立即提交；文本在 blur/Enter 提交、Escape 取消；条件和校验编辑器使用 Apply/Cancel；一次完整编辑只产生一条历史记录。
- pointer drag 与键盘移动使用同一 command/reducer；SortableJS 只负责瞬时 DOM 拖拽反馈，文档 reducer 是最终事实源。

### R6. Runtime Bridge

- compiler 单向将 `DesignerDocument`、material registry、condition AST 和 rules 转换为 `ConfigFormRendererNode[]`。
- 预览直接使用现有 `ConfigFormRenderer`；设计器不维护第二套运行时渲染语义。
- registry key、规则、条件或绑定解析失败时返回结构化 diagnostics，不得静默降级或部分渲染错误文档。
- 现有手写 `ConfigFormNode[]` 保持可用；通用反向导入不属于 MVP。

### R7. State And Ownership

- 文档采用受控 `v-model:document`；设计器不修改宿主传入对象。
- 所有文档变更通过一个纯 command reducer；selection、hover、拖拽临时态不进入 document history。
- MVP 使用有界完整快照历史；只有成功的语义命令进入 history。

### R8. Verification

- 规则包、文档 parser/compiler、registry、reducer/history 和组件交互均有 Vitest 覆盖。
- ConfigForm playground 增加 Playwright 流程，验证 palette -> drop -> nested move -> edit -> preview -> export/import -> equivalent preview。
- 现有 ConfigForm runtime/adapters、递归容器、联动和 200-field E2E 不得回归。

## Acceptance Criteria

- [x] `prd.md`、`design.md`、`implement.md` 已完成人审级规划，且不含未解决的仓库事实问题。
- [x] `@moluoxixi/zod3-to-rule` 可独立解析 JSON-safe rules、编译为当前 Zod 3 peer，并对受支持的 Zod 子集提供带诊断的反向导出。
- [x] DesignerDocument -> parser/normalizer -> compiler -> ConfigFormRenderer 的数据流和 owner 在 `design.md` 中明确。
- [x] 合法文档可 JSON round-trip；非法版本、物料、ID、field、嵌套和规则均产生结构化 diagnostics。
- [x] MVP Element Plus 物料覆盖 R4 列表，并通过 registry 提供默认节点、绑定和 setter。
- [x] MVP 支持 R5 的编辑命令、键盘替代路径、混合属性提交、撤销/重做与真实 runtime preview。
- [x] 规则、reducer、compiler、registry、组件交互和 playground E2E 均有对应验证命令和回滚点。

## Out Of Scope

- 页面级 CRUD、数据源编排、权限、流程引擎、应用发布平台和多人协作。
- 内置服务端存储、草稿/发布版本管理和审计。
- JSON 中任意 JavaScript、字符串脚本、render function、任意 Zod schema 的无损反向转换。
- 首版生成 Vue SFC、HTML 或源码工程。
- 首版完整适配 Ant Design Vue 与 shadcn-vue。
