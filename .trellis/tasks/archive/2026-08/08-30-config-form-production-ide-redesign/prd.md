# ConfigForm 生产级 Low-Code IDE 重设计

## 目标与用户价值

把当前低代码工作台重构为可投入真实项目使用的 Design-first Low-Code IDE。用户只需要在 Design 中建页、拖拽、嵌套、配置属性和编排事件；系统以 Config Model 作为唯一数据源，实时生成 Runtime Preview，并在需要时导出可维护的 Config 源码或完全不依赖 ConfigForm 的真实 Vue 工程。

本任务完成前不能以“第一阶段”“演示版”或局部样式优化作为交付。所有范围内工作流必须达到本文质量门。

## 已确认事实

- 当前 Application v2 已包含 pages、route、home page、单页 `LowCodePageModel` 与 IndexedDB revision repository。
- 当前 Model Operation、RuntimeSurface、候选模型、真实 DOM drag clone、pointer/keyboard drag、受控 Vue Flow、Flow interpreter、Export snapshot 与 VS Code 风格文件树可以演进。
- 当前主要结构问题是 Workbench 与 Designer 重复持有 Preview、History 和响应式 UI 状态；Preview 打开后会压缩 Designer，最终把三栏退化为互斥抽屉或 tab。
- 当前 Config 导出已经使用 `defineFields<PageFormValues>()` 和 `defineField(...)`。
- 当前 Source 导出虽然不依赖 ConfigForm 包，但把真实 Element Plus / Ant Design Vue 组件降级为原生 HTML，并包含 `page.model.json`，不满足真实项目源码要求。
- 现状证据和成熟库评估见 `research/current-state-audit.md`。

## 产品心智模型

```text
Component Registry
        ↓
Workspace Application -> Current Page Config Model
        ↓                       ↓
    Model Operation         Read-only Projections
        ↓                   ↙       ↓        ↘
      Design          Runtime Preview   Config   Source
```

- Config Model 是唯一可持久化真源。
- Design 是唯一编辑入口。
- Preview、Config 与 Source 都是特定 revision 的只读投影。
- UI selection、hover、drag session、panel open state、zoom 和 runtime form values 不进入 Config Model。

## 范围内需求

### R1. Design-first IDE 信息架构

- 桌面宽屏使用稳定三栏：左侧 Components / Layers / Pages，中间 Design Canvas，右侧 Inspector。
- Canvas 是视觉中心。打开 Preview 不得改变 Designer 的内部断点或把左/右栏降级为互斥视图。
- Preview 从右侧以 overlay drawer 展开，不参与三栏宽度计算；支持收起和扩展为工作区级预览。
- 顶栏保留应用/页面上下文、Save、Undo/Redo 状态、Preview、Flow、Export、语言和主题；页面切换只发生在左侧 Pages，顶栏不提供重复选择器。
- Export 是一个不换行的下拉菜单，项目为“导出源码”和“导出配置”；点击后打开只读预览弹窗。
- Flow 与 Page Manager 使用独立弹窗/辅助工作区，不占用主 Canvas。

### R2. Components、Layers、Pages 与 Inspector

- Components 按 Registry category 分组，支持搜索；每个物料用同一 Registry 的受控真实 Runtime specimen 展示，不用伪造 input/card。
- 物料 specimen 禁止交互副作用，但视觉仍来自真实注册组件；不能挂载的物料必须通过显式 `designPolicy` 处理并显示诊断。
- Layers 使用与 Canvas 相同的节点树，支持选择、多选、排序、缩进、移出、复制和删除；操作全部派发 Model Operation。
- Pages 支持切换、新建和进入 Page Manager；切换入口不得重复出现在顶栏。
- Inspector 根据 Registry schema 动态生成，属性分组明确；默认 304px 右栏使用稳定纵向属性行，label 单行省略并提供完整可访问名称，control 在下一行占满可用宽度。复杂数组、对象、slot、event 和 binding 同样使用全宽 editor 行。
- 左右栏在宽屏可独立折叠；折叠状态是 UI preference，不影响 Model 或 Runtime viewport。

### R3. 唯一 Config Model 与 Operation 历史

- Config Model 节点至少包含 `id`、`component`、`props`、`events`、`bindings`、`slots`、`children`，并只允许 Registry 注册组件。
- Workbench 的 Workspace Session 是唯一 history owner；Design Surface 不维护第二份业务 history 或 Preview model。
- 拖拽、排序、嵌套、Resize、多选批处理、复制、删除、Inspector、Flow 和 Page 变更都通过可序列化 operation/transaction 修改 Model。
- Undo/Redo 记录 operation transaction，批量操作一次撤销；UI selection、drag position 和 Flow node 拖动中间帧不进入 history。
- 同一 session 保持单调 `modelRevision`；Preview、Config 与 Source snapshot 必须标记并验证 revision。

### R4. 真实 Runtime Canvas 与拖拽一致性

- Design Canvas 与 Preview 复用 `RuntimeSurface`、注册组件、props 合并、slots、bindings、reaction 与 responsive resolver。
- 拖拽进入 Canvas 后，先把 candidate operation 应用到临时 projected model，再由同一 RuntimeSurface 渲染；candidate 节点只增加半透明 editor style。
- 鼠标跟随虚影来自已经渲染的 candidate/源节点真实 DOM 的无交互 clone，不重复挂载业务组件，不伪造尺寸。
- selection box、resize handle、drop line、empty-container target 与 toolbar 位于独立 overlay；不得插入会参与 Runtime layout 的占位 DOM。
- 容器末尾通过 drop line/target geometry 接收投放，不显示持久空白格。
- 多层 layout 嵌套优先选择最深合法 slot，并支持 sticky target；所有 registered layout/component 都必须通过 root、末尾和至少三级合法嵌套测试。
- Date、Time 与所有声明 full-width 的控件在 Design、candidate 和 Preview 中占满相同容器宽度。
- Resize 遵循 Registry layout capability；表单网格默认修改 span，不把临时像素尺寸写进 Model。

### R5. Component Registry 单一契约

- Registry 统一管理 component id、display name、category、icon、kind、props schema、events、bindings、slots/children rules、defaults、layout/resize capability、design policy、runtime binding 和 source adapter。
- Design、Components、Inspector、Runtime、Preview、Config formatter 与 Source Generator 消费同一 registration，不再各自猜测组件语义。
- Registry 在创建时做完整性和冲突校验；缺失 runtime/source/slot contract 的组件不能静默进入可导出页面。
- Element Plus 与 Ant Design Vue 的所有注册物料都必须通过同一 registry contract suite。

### R6. 实时 Preview

- Preview 是真实可交互 Runtime，使用当前页面相同 model revision，但拥有独立 runtime form values 和 flow execution state。
- Design operation 提交后，Preview 在下一帧或受控短 debounce 内更新；不得保存第二份可编辑 schema。
- Preview 支持 desktop/tablet/mobile viewport、reset runtime values、submit 和 expand/collapse。
- Flow/reaction 异步结果必须经过 revision gate；旧 revision、abort、timeout 或已关闭 Preview 的结果不得覆盖新页面。
- Preview 编译失败时显示可定位诊断并保留最后一个明确标记为 stale 的有效画面；不能把旧画面伪装为 Live。

### R7. 页面内 Flow 编排

- Flow 是页面内事件编排，不是 BPMN、审批流或任意 JavaScript 执行器。
- 触发范围为 `page.mount`、`form.submit`、`field.change`；节点范围为 trigger、condition、reaction、action、success、failure、end。
- Flow IR、validation、execution plan 与 interpreter 归 Core；Vue Flow 只做受控图形投影，`applyDefault=false`。
- Flow 变更派发细粒度 Model Operation；拖动节点时只在 drag stop 提交位置 transaction。
- Action 只引用受控 Registry key，Model/Config/Source 不保存函数、`eval`、URL 脚本或运行时对象。
- 默认并发 `latest`，并支持 queue/ignore、AbortSignal、timeout 和错误分支；Preview 与 Source 导出执行语义一致。

### R8. Config 只读查看与导出

- Config 弹窗默认显示 TypeScript 源码：`defineFields<PageFormValues>()`、`defineField(...)`、`defineFlow(...)`。
- 弹窗同时提供 JSON 与 Tree 只读视图，用于检查当前 Config Model；它们不能编辑或反向覆盖 Model。
- Copy/Download 使用打开弹窗时捕获的 revision snapshot；Model 变化后明确提示 snapshot stale，并要求刷新，而不是混用 revision。
- Config 下载默认产出 `.ts` 源码；JSON 可作为独立下载选项。

### R9. 真实 Source 工程查看与导出

- Source 弹窗左侧是真正的 VS Code 风格层级文件树，右侧是 Monaco 只读源码；支持文件夹展开、文件选择、键盘导航、Copy、单文件 Download 和 Project ZIP。
- 工程至少包含 `package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`src/main.ts`、`src/App.vue`、router、pages、styles 和纯源码 flow helper。
- Source 工程完全不依赖 `@moluoxixi/config-form*`、Designer Model、`defineFields` 或 Runtime Renderer；不包含 `page.model.json`。
- Generator 必须通过 Registry source adapter 输出当前 adapter 的真实 Element Plus / Ant Design Vue component、imports、v-model、props、events、slots 与 layout，不得统一降级为原生 HTML。
- Source 工程能独立 install、typecheck、test/build；同一 fixture 在 Preview 与导出工程中的组件结构、关键 props、布局和 Flow 结果一致。
- 不支持把任意已有真实项目导入并反向转换为 Config Model。

### R10. 主题、国际化与响应式

- IDE 支持 Light/Dark，但 IDE theme 只影响 chrome、panels、toolbar、Inspector 与 overlay；Design Canvas 的整个 Runtime viewport 和 Preview 不随 IDE theme 改色。
- Runtime 自身需要暗色时由页面/Preview 的独立 runtime theme 设置控制，不能继承 IDE theme。
- Workbench 与 Designer 共用一套 locale contract，内置 `en-US` / `zh-CN`；所有 visible text、tooltip、title、aria-label、empty/error state 和菜单项进入类型化 catalog。
- 用户输入的应用名、页面名、route、field label、option 和生成源码标识符不翻译。
- 国际化工具仅用于构建期生成/校验资源；浏览器不保存 API key、不调用翻译服务。
- `>=1280px` 保持稳定三栏；`768-1279px` 使用不压缩 Canvas 的 overlay side panels；`<768px` 使用 Canvas-first 分段导航/全屏 sheet。Preview、Flow、Pages、Export 在移动端为全屏工作区。
- 1440px、900px、390px 下不得出现顶栏/menu 换行、不可达操作、横向溢出或文本遮挡。

### R11. 性能、可访问性与错误恢复

- Monaco、Vue Flow、Source Generator 与非当前 adapter 必须按需加载，不进入初始 editor shell chunk。
- 200 节点页面拖拽时 animation frame p95 不高于 16.7ms；单次普通 Model Operation p95 不高于 8ms；Preview revision 提交到可见 DOM 更新 p95 不高于 100ms（本地基准 fixture）。
- Dialog 实现 focus trap、Escape、return focus；tree/tab/menu/toolbar 遵循 ARIA 键盘模型；所有 pointer 核心操作有键盘路径。
- 普通文本对比度至少 4.5:1，控件/焦点/边界至少 3:1；`prefers-reduced-motion` 下禁用非必要动画。
- IndexedDB 不可用时明确显示 volatile mode；commit conflict、migration error、export/build error 和 invalid model 都有可恢复诊断，不能静默失败。

## 验收标准

- [x] AC1：1440px + Preview 打开时仍保持 Components/Layers/Pages + Canvas + Inspector 的 Design-first 结构；Preview 作为右侧 overlay，不触发 Designer 退化为互斥 tab。
- [x] AC2：900px 与 390px 使用 overlay/full-screen panels，Canvas 操作可达，顶栏、Export menu 和 dialog 无换行、遮挡或横向溢出。
- [x] AC3：同一 Registry + Model + viewport 在 Design、candidate、drop 后 Runtime 和 Preview 中生成相同组件树；全物料尺寸/props contract suite 通过，三级嵌套和末尾投放稳定。
- [x] AC4：Components panel 的物料视觉来自真实 Runtime specimen；候选节点半透明、鼠标虚影跟随，二者不产生第二次业务副作用。
- [x] AC5：多选、Resize、排序、嵌套、复制、删除、Inspector、Flow 与 Page 操作只修改 Config Model，并可按 transaction Undo/Redo；刷新后保存结果一致。
- [x] AC6：Preview 对每次 operation 实时更新；旧 revision 的 reaction/flow/export 异步结果无法覆盖新状态，stale/error 状态有明确标识。
- [x] AC7：Flow 在弹窗中完成创建、连接、配置、删除和执行；Core 与 Preview/Source 对 resolve/reject/abort/timeout/latest/queue/ignore 产生相同轨迹。
- [x] AC8：Config 默认显示并下载 `defineFields / defineField / defineFlow` TypeScript，JSON/Tree 只读；任何视图都不能反向编辑 Model。
- [x] AC9：Source 弹窗提供真实层级文件树与 Monaco；Element/Ant 两套导出工程均无 ConfigForm 依赖或 `page.model.json`，能独立 typecheck/build，并使用真实 adapter 组件。
- [x] AC10：Light/Dark 切换不改变 Design Runtime viewport 与 Preview 计算样式；IDE 操作按钮在两种主题均满足对比度。
- [x] AC11：切换 `en-US / zh-CN` 后 Workbench、Designer、Pages、Flow、Preview、Export 同步更新，无硬编码中英文混杂；390px 菜单不换行。
- [x] AC12：Page 新建、切换、排序、复制、路由、首页、删除、保存、刷新和旧 Project->Application 迁移回归通过。
- [x] AC13：性能预算、键盘路径、focus/ARIA、reduced-motion、error recovery、视觉回归、全包 typecheck/test/build 与导出工程集成验证全部通过。

## 非目标

- 不支持导入任意真实项目或从 Vue/Babel AST 反向生成 Config Model。
- 不支持任意 HTML DOM、未注册组件、用户函数、`eval`、远程脚本或任意运行时 npm 安装。
- 不做多人协作、云端发布、权限、服务端 Flow、BPMN、审批流或跨页面事务。
- 不把 Vue Flow、Monaco、DOM、drag overlay 或 UI component local state作为持久化真源。
- 不修改纯 ConfigForm Headless/Runtime 的既有业务语义；Designer editor metadata 必须保持在 Designer/Workbench 边界。

## 已解决决策

- Preview 使用右侧 overlay drawer，而不是第四栏挤压 Design；展开时可覆盖工作区。
- 保留当前自有 pointer/keyboard drag controller、candidate resolver 与 RuntimeSurface；不因“成熟库”替换正确的数据流。
- 保留自有 Flow interpreter + controlled Vue Flow；不引入 XState 作为第二语义核心。
- Source Generator 必须真实输出 adapter 组件，不能只满足“无 ConfigForm import”。
- 本任务保持单一生产交付，不拆成对用户可见的“试验阶段”；实施内部按可回滚切片推进，所有 AC 完成后才归档。
