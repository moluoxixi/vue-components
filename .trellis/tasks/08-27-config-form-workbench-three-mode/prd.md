# Design-first 低代码 IDE 重构

## 目标

将当前 Source / Config / Designer 并列编辑的工作台重构为现代化 Design-first Low-Code IDE。用户只在 Design 中编辑页面，所有设计操作写入唯一的 Config Model；Runtime、Preview、Config View 和 Generated Vue Source 都是该 Model 的确定性投影。

最终心智模型：

```text
Design 编辑 -> Config Model 保存 -> Runtime 运行 -> Preview 展示
                                  -> Config 只读查看/导出
                                  -> Source 只读查看/导出
```

## 已确认事实

- 现有 `DesignerDocument` 已是严格序列化树，包含节点 id、material、props、条件、联动、具名 slots 与字段/容器信息，但没有通用 events、bindings 和显式 component 字段。
- 现有 Designer 已支持拖入、排序、嵌套、复制、删除、单选、Undo/Redo 和基于 `span` 的属性式布局调整。
- 现有控制器只有 `selectedId`，没有多选、批量操作或画布 Resize handle。
- 现有 Material Registry 已包含 key、title、category、icon、runtime component、setters、slot 约束和 `createNode`，但默认值隐含在工厂中，缺少统一 props/events/bindings schema。
- 现有 Workbench 同时维护 project files、`designerDocument`、`configDraft` 和两套 Preview 路径，与本任务的单一 Model 目标冲突。
- 现有 `formatDesignerConfig`、模板 App 壳、`compileDesignerDocument` 和 `ConfigFormRenderer` 可分别作为生成器和 Runtime 的迁移基础；`parseDesignerConfig` 仅保留在 legacy migration/import 边界。

## 需求

### R1. 唯一 Config Model

- 新的版本化 Config Model 是页面内容唯一数据源，至少表达：`id`、`component`、`props`、`events`、`bindings`、`slots`、`children`。
- `children` 表达默认子节点序列，`slots` 只表达具名插槽，二者不得保存同一节点的重复副本。
- Model 仅允许 Component Registry 注册的业务组件和 Layout Components，不允许任意 HTML DOM。
- Design 的拖入、移动、排序、嵌套、Resize、属性编辑、事件/绑定编辑、复制、删除和批量操作必须通过 Model Operation 修改 Model。
- Source、Config、Preview 与 Runtime 不得反向成为新的长期真源。

### R2. Model Operation 与历史

- 定义可序列化、可测试的 Operation：insert、move、updateProps、updateEvents、updateBindings、resize、duplicate、remove 和 batch。
- Undo/Redo 以 Operation 及其逆操作为基础，不再以 UI watch 或多份文档同步实现。
- 多选属于 UI selection state，不写入 Config Model；批量删除、复制、移动和属性更新通过 batch operation 完成。
- 所有 operation 在写入前校验 Registry、slot accepts、层级循环、id 唯一和布局约束；失败不得产生半次提交。

### R3. Component Registry

- Registry 统一拥有 component key、runtime component、displayName、icon、category、props schema、events schema、bindings schema、slots/children 约束和 default values。
- Design Palette、Layers、Inspector、Runtime Renderer、Preview 和 Source Generator 必须读取同一份 Registry。
- Inspector 根据 Registry schema 动态生成 ConfigForm，不为单个组件写专用属性表单。
- 现有 Element Plus / Ant Design Vue materials 迁移到该契约，保留 adapter 差异但不复制模型语义。

### R4. 三栏 Design 工作区

Desktop 使用稳定三栏：

```text
┌────────────┬──────────────────────┬──────────────┐
│ Components │                      │  Inspector   │
│ Layers     │    Design Canvas     │  ConfigForm  │
│ Pages      │                      │              │
└────────────┴──────────────────────┴──────────────┘
```

- Canvas 是默认和视觉中心，展示真实 Runtime 组件，不用静态占位图替代最终控件。
- 左侧提供 Components、Layers、Pages 三个可键盘访问的视图；Layers 反映 Model 树并支持选中、排序和嵌套；Pages 首版管理工作区已有页面。
- 右侧 Inspector 始终跟随当前单选或多选集合，根据 Registry schema 生成 ConfigForm；无选中时显示页面级属性。
- 顶部命令栏提供撤销/重做、复制/删除、设备尺寸、Preview、导出下拉菜单和 Dark Mode 等明确命令。
- 支持左右栏隐藏，并保持 Canvas 尺寸与焦点稳定。

### R5. Canvas 核心交互

- 保留拖拽新增、排序、跨容器移动、嵌套、键盘移动、复制、删除和 Undo/Redo。
- 新增 Shift/Ctrl/Cmd 多选、选区反馈和 batch operation。
- 新增画布 Resize handle；Resize 写入 Registry 允许的布局属性，至少覆盖现有 24 栅格 `span`，不得直接写不可持久化的 DOM 像素。
- 选择框、投放目标、拖拽预览和 Resize 反馈必须清晰；交互期间不得遮挡关键控件或改变工作区轨道尺寸。

### R6. Runtime 与实时 Preview

- Canvas 与 Preview 使用同一个 Registry 和 Runtime Renderer；Canvas 只额外叠加设计态 selection/drop/resize chrome。
- Model operation 成功后 Preview 实时更新；运行时表单值属于 Preview 实例状态，不回写页面结构 Model。
- Preview 支持 desktop/tablet/mobile viewport，并明确显示 compile/runtime diagnostics。
- Preview 由顶部命令打开右侧实时分屏，可调整宽度或全屏；关闭后 Canvas 恢复完整中心区域。
- Preview 失败时保留最后有效画面；旧异步结果不得覆盖更新的 Model revision。

### R7. 只读 Source / Config

- Source 和 Config 不再是可编辑 provider，也不参与 Model 反向解析。
- 顶部只保留一个“导出”下拉按钮，菜单提供“导出源码”和“导出配置”，不把 Source/Config 作为常驻工作区视图。
- 选择导出项后先打开大尺寸只读预览弹窗；Source 使用 Monaco 展示 Generated Vue Source，并支持复制、下载和项目导出。
- Config 弹窗提供 JSON / Tree View，二者读取同一 Config Model；支持复制和下载。
- 生成器输出必须确定、可测试并能通过 TypeScript/Vite 构建；导出文件只由当前 Model revision 生成。
- 旧项目的 Config/Designer artifact 解析仅用于一次性 migration，不进入常规编辑状态流。

### R8. 视觉、主题与响应式

- 视觉参考 Figma、Framer、VS Code、Linear：克制、高信息密度、清晰层级、稳定尺寸，避免营销式卡片和大面积装饰。
- 支持 Light/Dark Mode，主题由语义 token 驱动；所有 Canvas chrome、面板、代码、Config tree 和 Runtime 状态满足可读对比度。
- Desktop 保持三栏；中宽允许互斥侧栏；移动端将左侧、Canvas 与 Inspector 组织成可达的 tabs/drawers，Preview 和导出预览使用全屏视图，不产生横向溢出。
- 图标命令使用 Lucide、提供 tooltip/accessible name；tabs 使用 roving tabindex；隐藏面板使用 `hidden + inert` 并正确迁移焦点。

## 验收标准

- [x] AC1：运行态只有一个可变 Config Model；删除 App 级 Source/Config 可编辑 draft 与双向同步路径。
- [x] AC2：Design 的新增、排序、嵌套、Resize、多选、复制、删除和 Undo/Redo 都产生可断言的 Model Operation。
- [x] AC3：Palette、Layers、Inspector、Runtime 和 Generator 使用同一 Registry，未注册 component 无法进入 Model 或 Runtime。
- [x] AC4：Desktop 三栏布局稳定；Canvas 展示真实控件；左右栏收起不改变核心工作流或丢失焦点。
- [x] AC5：Inspector 按 Registry schema 生成 ConfigForm，单选、多选和页面级属性都有明确状态。
- [x] AC6：Preview 右侧分屏随 Model revision 更新，可调整宽度或全屏，desktop/tablet/mobile 可切换，错误保留最后有效画面。
- [x] AC7：单一导出下拉菜单可打开 Source Monaco 或 Config JSON/Tree 只读预览弹窗；内容来自同一 Model revision，可复制/下载/导出。
- [x] AC8：Light/Dark Mode、1440px、900px 和 390px 浏览器场景无重叠、不可达操作或横向溢出。
- [x] AC9：现有模板能迁移到 Config Model，生成项目继续通过 TypeScript、Vite build 与模板真实性验证。

## 非目标

- 本轮不支持导入任意现有 Vue/TypeScript 项目。
- 本轮不允许任意 HTML DOM、自定义源码组件或用户手写函数进入 Config Model。
- 流程引擎与可视化函数编排继续延期；events/bindings 首版只实现 Registry 白名单能力。
- 不在本轮实现多人实时协作、云端发布或插件市场。
