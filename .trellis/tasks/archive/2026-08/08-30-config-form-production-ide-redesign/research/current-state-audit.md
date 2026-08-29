# ConfigForm Low-Code IDE 现状审计

## 审计结论

当前实现已经具备可保留的 Model Operation、RuntimeSurface、候选模型、受控 Flow 与多页面仓储能力，但产品外壳和投影边界失控。主要矛盾已经不是“缺一个样式”，而是 Workbench、Designer、Preview、Flow 与 Export 同时保存相互重叠的 UI/派生状态，导致 Design-first 心智模型在真实宽度下崩溃。

本轮重设计不回退已经正确的底层能力，也不继续在 `App.vue` 和全局样式中增加响应式分支。目标是保留可信内核，替换产品结构和不完整的 Source 投影。

## 运行态证据

审计页面：`http://127.0.0.1:4313/designer.html`。

### 宽屏 Preview 会破坏三栏编辑器

- 在浏览器 CSS viewport 约 `1600 x 1000` 时，Preview 打开后：
  - `.provider-surface` 宽约 `927px`；
  - `.preview-pane` 宽约 `672px`；
  - Designer 因自身容器宽度不足，只能把 Materials / Properties 变成互斥抽屉。
- 浏览器恢复到约 `1121 x 822` 后，Designer 进一步退化为 `Palette / Canvas / Properties` 三个互斥 tab；当 Palette 可见时 Canvas 完全不在 DOM 可访问工作流中。
- 这意味着 Preview 不是辅助投影，而是在抢占 Design 的核心空间。仅调整断点无法解决双层响应式互相触发的问题。

### Pages、Flow、Export 的能力可以保留

- Pages 已统一位于左侧 Pages tab，并有独立 Page Manager 弹窗；支持名称、路由、首页、排序、复制和删除。
- Flow 已是独立弹窗，Vue Flow 以受控模式呈现；当前页面可配置 trigger、condition、reaction、action、并发与错误策略。
- Source 导出弹窗已有分层 ARIA Tree、Monaco 只读区、ZIP / Copy / Download，以及 revision snapshot。
- Config 导出已有 `defineFields<PageFormValues>()`、`defineField(...)` 与 `defineFlow(...)` 源码投影。

这些能力的问题主要是宿主耦合和投影语义，而不是入口形式。

### 主题边界只完成了一半

- 暗色下 `.mx-config-form-designer__canvas` 当前计算背景是 `rgb(15, 16, 18)`，而 `.canvas-sheet` 保持白色。
- Preview 的 canvas/stage 保持浅色 Runtime 视觉。
- 用户要求暗色 IDE 不改变画布区域，因此新设计中整个 Runtime viewport（不只是 sheet）必须与 IDE theme 解耦；暗色只影响 chrome、Inspector 和 editor overlay。

### 国际化仍有混用

- `packages/ConfigForm/designer/src/locale.ts:14-68` 已提供统一的 `DesignerLocaleOptions`、物料翻译与插值契约。
- Workbench 已有 locale 接入基础，但 `packages/ConfigForm/workbench/src/App.vue:1108,1112` 仍硬编码“导出源码 / 导出配置”，默认英文界面会混入中文。
- 国际化工具只能用于构建期资源生成/校验，浏览器运行时不得读取 API key 或调用翻译服务。

## 代码边界证据

### Workbench 根组件职责过载

- `packages/ConfigForm/workbench/src/App.vue`：1599 行。
- `packages/ConfigForm/workbench/src/styles.css`：1589 行。
- `App.vue:142-195` 同时持有 repository、application、current page、history、Preview runtime、Flow coordinator、Export snapshot、主题、多个弹窗和焦点恢复状态。
- `App.vue:214-219` 从 `Config Model` 计算 `DesignerDocument`；`App.vue:330-379` 又维护 compile/last valid preview/history control。
- `App.vue:274-305` 同时承担 Source revision、文件选择、语言判断、Config Source/JSON 投影。

这些状态应分别属于 Workspace Session、Projection Services 与 Dialog/View state，不能继续由一个 SFC 协调。

### Designer 内部还有第二套产品状态

- `packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:71-102` 自己保存 breakpoint、workspace width、Palette/Properties 开关、medium/narrow view 和 standalone Preview。
- Workbench 已经拥有 Preview、Pages、Flow、History；Designer 再保存同类状态造成双重布局和双重历史心智模型。
- `ConfigFormDesigner.vue:540-574` 的 standalone Preview/reaction projection 不应出现在 Workbench 使用的受控 Design Surface 中。

### Config Model 与 Runtime 基础可保留

- `packages/ConfigForm/workbench/src/App.vue:214-219` 的 `configHistory.present` 已是当前页面的模型真源，DesignerDocument 是计算投影而非持久化真源。
- `packages/ConfigForm/designer/src/model/operations.ts:518` 的 `applyModelOperation` 已覆盖插入、移动、更新、删除、复制、页面与 flow 更新。
- `packages/ConfigForm/designer/src/components/DesignerCanvas.vue:120-132` 已通过临时 command 构造 `projectedDocument`。
- `DesignerCanvas.vue:859` 使用 `RuntimeSurface` 渲染候选后的真实组件树；`DesignerCanvas.vue:879-931` 将 selection/drop/drag overlay 放在独立 editor layer。
- `packages/ConfigForm/designer/src/components/designer-drag.ts:43-77` 已把 pointer/keyboard session、position、offset、target 和 announcements 分离。
- `packages/ConfigForm/designer/src/components/designer-drag-overlay.ts:61` 已从候选真实 DOM 创建无交互视觉 clone，避免第二次挂载有副作用的组件。

因此不应替换 Model candidate / RuntimeSurface / overlay 架构。需要做的是收窄职责、修复注册默认 props 等语义差异，并建立全物料尺寸一致性测试。

### Registry 已有雏形，但 Source 能力不足

- `createLowCodeComponentRegistry` 已汇总 component、displayName、category、icon、props、events、bindings、layout、slots、defaults、designPolicy、runtime 与 `sourceComponent`。
- 但 `sourceComponent` 只有组件名，无法表达包依赖、import、v-model、props/event 映射、slot 或容器源码策略。
- `packages/ConfigForm/workbench/src/project/export/source.ts:592-627` 当前把所有字段降级为原生 `input/textarea/select`，容器降级为 `section/div`。
- `source.ts:882` 还把 `page.model.json` 放进“纯源码工程”。虽然测试保证没有 ConfigForm 包依赖，但导出的视觉/组件语义不可能与 Element Plus / Ant Design Vue Runtime 一致。

Source 必须由 Registry 的 source adapter 生成真实目标组件代码；`page.model.json` 只能属于 Config 导出，不能进入纯 Source 工程。

### Flow 语义核心无需更换

- `packages/ConfigForm/core/src/flow/interpreter.ts:24` 已有确定性 `ConfigFormFlowInterpreter`。
- `packages/ConfigForm/workbench/src/components/FlowWorkspace.vue:70-96` 将 Flow IR 投影为 Vue Flow nodes/edges。
- 组件测试断言 `VueFlow.applyDefault === false`，业务 Model 不由图形库直接改写。
- Workbench 已有 revision gate、AbortController 和 `latest / queue / ignore` 协调测试。

继续引入 XState 会增加第二套运行语义，当前没有收益。Vue Flow 只负责图形投影，Flow IR、validation、operation 与 interpreter 继续归项目所有。

### 仓储与迁移基础可保留

- `WorkspaceApplication` schema v2 已包含 `pages[]`、`homePageId` 与单页 `LowCodePageModel`。
- `WorkspaceApplicationOperation` 已包含 add/duplicate/move/remove/rename/home/route/update model。
- IndexedDB repository 使用 `baseRevision` 做乐观并发提交，并能把旧 Project 迁移为单页 Application。
- 迁移失败会记录错误并保留旧 key；目标 application 成功写入后才删除 legacy key。

UI 重设计不需要修改持久化 schema。新 Workspace Session 应继续使用同一 repository，并把所有 Design/Page/Flow 变更收敛为 operation history。

## 成熟库复核

### 保留/采用

- Vue Flow：只做 controlled graph projection；与当前实现和测试一致。
- Monaco：只在 Export 弹窗打开时异步加载；用于 Source/Config 只读查看。
- WAI-ARIA Tree View Pattern：继续约束 Pages/Layers/Source 文件树的 focus、selection、展开与键盘导航。
- dnd-kit / Pragmatic Drag and Drop 的可复用思想：独立 Drag Overlay、sticky nested target、candidate before commit、monitor lifecycle。

### 不直接引入为业务核心

- GrapesJS、Craft.js、Plasmic、Builder：它们证明“Model 真源 + 真实组件树 + overlay + registry”的方向，但接管其 Model 会破坏 ConfigForm schema 与 Vue adapter 契约。
- XState：不作为持久化协议或解释器；当前 deterministic interpreter 已覆盖所需语义。
- BPMN/Rete/LogicFlow/X6：页面内事件编排不需要 BPMN 或通用 dataflow 的复杂度。
- Pragmatic Drag and Drop / dnd-kit：当前 pointer + keyboard controller 已符合候选模型架构。只有在新契约测试证明 sensor 生命周期无法达到指标时，才替换 sensor adapter；不会替换 target resolver 或 Model Operation。

参考：

- GrapesJS Components / Canvas / Pages：<https://grapesjs.com/docs/modules/Components.html>、<https://grapesjs.com/docs/modules/Pages.html>
- Craft.js User Components / Save Load：<https://github.com/prevwong/craft.js/tree/main/site/docs>
- Plasmic host frame：<https://github.com/plasmicapp/plasmic/blob/master/platform/wab/src/wab/client/frame-ctx/README.md>
- Pragmatic Drag and Drop core：<https://github.com/atlassian/pragmatic-drag-and-drop/tree/main/packages/documentation/constellation/05-core-package>
- dnd-kit Drag Overlay：<https://dndkit.com/legacy/api-documentation/draggable/drag-overlay/>
- Vue Flow controlled flow：<https://vueflow.dev/guide/controlled-flow.html>
- WAI-ARIA Tree View：<https://www.w3.org/WAI/ARIA/apg/patterns/treeview/>

## 重设计保留、重构与删除清单

### 保留并加固

- `LowCodePageModel`、现有 schema 与 Application v2 repository。
- Model Operation 与 revision snapshot。
- RuntimeSurface、真实 candidate projection、独立 overlay、pointer + keyboard drag。
- controlled Vue Flow、Flow IR、interpreter、revision gate。
- Monaco、ProjectFileTree、ZIP/source snapshot 的能力。
- `defineFields / defineField / defineFlow` Config 源码投影。

### 重构

- Workbench 根组件拆为 Workspace Session、Projection Services、IDE Shell 与独立 feature dialogs。
- Designer 改为完全受控的 Design Surface；Standalone compatibility 通过薄 facade 保留。
- Registry 增加完整 source adapter 与 Inspector schema contract。
- Source Generator 改为真实 adapter 组件工程生成。
- Preview 改为不压缩 Design 的右侧 overlay drawer，可全屏展开。
- Pages/Layers/Components/Inspector 统一为稳定 panel，而非被 Preview 间接触发的内部 tabs。
- Flow 修改改为细粒度 Model Operation，拖动位置在 drag stop 时提交一次。
- 所有 Workbench 文案进入统一 locale catalog。

### 删除

- Workbench 中 `Source / Config / Design` 可编辑 provider 心智模型。
- Workbench 使用的 Designer 内部 Preview、Import/Export 与内部 history。
- Preview 展开后重排并压缩 Designer 的双栏布局。
- Canvas/slot 中持久的“最后一个空白格”；末尾投放由 overlay drop line 表达。
- Source 工程中的 `page.model.json` 和通用原生控件降级生成。
- `App.vue` 内手工构造的 Config Tree、文件状态、弹窗焦点与业务 session 大状态簇。
