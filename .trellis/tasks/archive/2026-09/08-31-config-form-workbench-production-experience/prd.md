# ConfigForm Workbench 生产体验收口

## 目标与用户价值

把当前已经完成核心架构重构的 ConfigForm Workbench，进一步收口为可长期高频使用的生产级 Design-first Low-Code IDE。用户应能可靠预览和测试表单、直观完成排序与批量编辑、快速理解 Inspector，并在不让设计器承担模板等外围职责的前提下管理模板和导入 Config Model JSON。

## 已确认事实

- 当前 Preview Drawer 已通过独立 `PreviewRuntimeHostFrame` 运行。2026-08-31 浏览器复核中，预览输入框可以填写并触发 submit；用户报告的“预览仍进入设计选中且无法输入”在当前提交未复现，必须转为入口一致性和回归测试要求，不能重复建设 Runtime。
- 当前节点工具栏的六点手柄已接入 pointer/keyboard drag，Model 也已有多选、批量复制/删除和移动 transaction；产品缺口主要是可发现性、完整快捷键、批量属性操作、历史面板和覆盖复杂场景的 E2E。
- 顶部及设计器工具按钮已有 `aria-label` 和原生 `title`，但没有统一的可见 tooltip，也没有把快捷键写入提示。
- 左侧物料当前同时渲染“图标 + 名称”和真实 Runtime specimen。最新产品要求改成高信息密度的“图标 + 名称”列表；真实组件仍只用于 Canvas、拖拽 candidate/ghost 和 Preview。
- `TemplateDialog` 仍由 `WorkbenchShell` 直接装配，内置 `profile` 只是模板 fixture，不应继续承担模板管理心智模型。
- 当前 Export 支持 Config/Source 只读查看与下载，但新建流程缺少受校验的 Config Model JSON 导入入口。
- `r0` 保存状态、autosave、跨标签页、恢复草稿和持久化版本历史由现有子任务 `08-31-config-form-editing-durability-recovery` 负责，本任务不重复实现。

## 子任务地图

1. `config-form-preview-runtime-testbench`：真实交互预览、独立预览工作区、提交 JSON 与回归矩阵。
2. `config-form-designer-editing-productivity`：拖拽排序、多选批处理、快捷键、可撤销删除和操作历史。
3. `config-form-workbench-ui-accessibility`：统一 tooltip、物料列表、空画布、缩放位置、主题对比度。
4. `config-form-inspector-adaptive-ux`：基于 Registry 能力动态组织 Inspector，并解释栅格占比。
5. `config-form-template-management`：将模板管理从 Designer/Workbench 主编辑壳拆为独立功能。
6. `config-form-json-import-lifecycle`：在新建流程支持严格校验的 Config Model JSON 导入。
7. `config-form-editing-durability-recovery`：autosave、恢复、正式版本与跨标签页协调。
8. `config-form-workbench-component-ui-redesign`：完成 Workbench 组件化界面重构与全尺寸视觉收口。

## 跨任务验收标准

- [x] Preview、Design、Inspector 和批量操作继续只读写同一 `ProjectDocument/PageGraph`，不引入第二份可编辑 schema。
- [x] Pointer、keyboard、toolbar 和 Layers 对同一操作生成等价 Model Command；批量操作一次撤销。
- [x] 模板、JSON 导入、持久性版本和操作历史的职责边界明确，不把 UI 状态、模板目录或恢复草稿写入 `ProjectDocument`。
- [x] Element Plus 与 Ant Design Vue 均通过对应交互矩阵；新增 Registry 物料后测试矩阵自动覆盖。
- [x] 1440/900/390、Light/Dark、zh-CN/en-US 下无文本截断、控件遮挡、不可达操作或焦点丢失。
- [x] 子任务分别通过定向单测、typecheck、Playwright 和可访问性检查后，父任务再做整体验收。

## 范围外

- 不支持导入任意 Vue 工程或把 Source 反向转换为 Config Model。
- 不在 Designer 中建设模板市场、用户 Profile、云同步或多人协作。
- 不回退已完成的 RuntimeHost、Config Model 单一真源、只读 Source/Config 和 Project Command 架构。
- 不把本父任务直接作为实现目标；实现和归档以子任务为单位推进。
