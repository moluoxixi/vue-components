# ConfigForm IDE 视觉与交互再设计

## 目标与用户价值

在已完成生产质量门的 Design-first Low-Code IDE 基础上，重新定义视觉系统、信息层级与核心操作体验，使页面设计、组件发现、层级管理、属性配置、预览和辅助工作区形成一套更克制、连续、可高频使用的专业工具体验。

本轮采用新架构 hard cut：`ProjectDocument / PageGraph / ProjectCommand / PageCompilation` 是唯一产品合同。旧 `WorkspaceApplication`、`LowCodePageModel`、`DesignerDocument` 及其 parser、migration、compatibility adapter、公开导出和测试 fixture 必须从产品仓库中完全移除，不保留运行时 fallback、双写或旧数据自动读取。

本任务不是继续给旧页面叠加局部样式。最终界面应当让 Canvas 成为明确视觉中心，同时保证复杂表单、多级布局、暗色模式和紧凑桌面仍然清晰、稳定、可操作。

## 已确认事实

- `ProjectDocument` 是项目级唯一持久化业务事实；`ProjectSnapshot` 只是绑定本地编辑时序和内容身份的不可变 envelope。Repository 可按 Manifest/Page/Resource 分实体原子存储。页面 Flow 属于对应 `ProjectPage`，作为视觉 `PageGraph` 的同级数据随 Page 实体原子保存。每个页面的视觉结构由规范化 `PageGraph` 表示，Design 是唯一编辑入口。
- Design Surface、拖拽 candidate、Components specimen 与 Preview 已复用真实 Runtime 和 Component Registry。
- Config / Source 只读查看和下载；Pages、Flow、Export 使用独立工作区或弹窗。
- 当前实现已覆盖 Light/Dark、中文/英文、1440/900/390 响应式、键盘拖拽与无障碍质量门。
- 历史讨论已确认：物料与画布节点不得伪造控件；开发者式 node title、field code 等视觉噪声应隐藏，但保留可访问名称。
- 父容器选择、drop 和 resize overlay 不得阻挡嵌套子节点操作。
- 上一任务的产品代码、规范、验收证据和全部历史任务已归档，本任务从新的规划边界开始。
- 1440/900/390 运行页审计确认：当前主要问题位于 editor chrome、面板编排、视觉 token 和响应式呈现，不是 Config Model、Runtime 或 Operation 缺陷；证据见 `research/current-workbench-audit.md`。
- 成熟编辑器调研确认：Craft.js、GrapesJS、dnd-kit、Moveable、Ali LowCode 均有可借鉴模式，但直接接入会引入 React/HTML/像素坐标等第二套模型；本轮不应替换现有 Vue Registry Runtime，详见 `research/designer-patterns-and-library-fit.md`。

## 架构重新评估

本轮按“不考虑重构成本、以长期生产质量为目标”重新审计后，结论分为两层：

- 产品数据流合理，应保留：`ProjectDocument -> ProjectPage { PageGraph, flows } -> CompileCoordinator -> PageProgram -> RuntimePlan -> Design/Preview`。Readonly Export 固定同一 ProjectSnapshot 后按需组装 `ProjectProgram`，Registry、语义事务、持久化快照和只读导出快照的职责方向正确。
- 当前代码边界不够合理，不应继续在现有边界上堆功能。`DesignerDocument` 与 `LowCodePageModel` 存在近重复节点协议；受控 `DesignSurface` 仍实例化本地 Designer history，而 Workbench 同时维护 `WorkspaceSession` history；Design 与 Preview 通过不同编译模式可能选择不同组件；`workbench-controller.ts` 同时编排会话、投影、预览流程、页面、主题、语言、导出和弹窗状态。

因此，本任务的架构目标调整为：独立于 Designer 的 `ProjectDocument` 成为唯一规范业务内容，过期页面和应用模型从产品包、公开 API、持久化入口与测试 fixture 中完全删除；页面内部只保留 `root: SlotItem[] + nodesById + slots: Record<SlotName, SlotItem[]>` 一套关系，不再同时持有 `children` 与 `slots`；用户意图先由 Domain Command Engine 解析为规范 Operation，再由 Transaction Engine 原子提交；CompileCoordinator 只对活动页面和受影响子树增量生成 `PageProgram`，全项目 `ProjectProgram` 仅在导出等全局场景按需组装；Design 与 Preview 使用同一个 `PageProgram` 降级出的同一语义 `RuntimePlan`，但由彼此隔离的 RuntimeHost 创建独立运行实例；viewport、字体、运行主题与 locale 属于 Runtime Presentation，不进入页面结构模型；Workbench 拆为 Project Store、Design Session、Preview Session、Flow Engine、Export Service 和 UI Store。

## 范围内需求

### R1. 视觉系统与信息层级

- 重新设计 Workbench chrome、顶栏、左右侧栏、Canvas 环境、Inspector、菜单、弹窗和状态反馈。
- 风格保持 Figma / Framer / VS Code / Linear 的专业、高密度和弱装饰特征，不做营销页式大卡片或单色主题堆叠。
- Canvas sheet 与真实 Runtime 继续保持主题隔离；IDE Dark 不修改用户页面组件视觉。
- 图标按钮、命令按钮、菜单、表单控件和面板标题建立一致的尺寸、状态、focus 和 tooltip 规则。

### R2. Canvas 与拖拽交互

- Canvas 是第一视觉焦点；选中、多选、拖拽、排序、嵌套、Resize、复制、删除和 Undo/Redo 的反馈必须连续且不遮挡真实组件。
- 物料、candidate、拖拽虚影与落地节点继续使用真实 Runtime，不回退为手写占位结构。
- 选择框、drop indicator、resize handle 和 node actions 使用 editor overlay；嵌套父节点不得抢占子节点命中。
- 移除开发者式标题、field code 和持续占位空格等非产品化视觉噪声。

### R3. Components、Layers、Pages 与 Inspector

- Components 优先帮助用户识别真实控件和类别，不把每个物料做成厚重卡片。
- Components 保留 Registry 驱动的真实 Runtime specimen，删除重复的 `Field/Layout` 类型文案，并把物料压缩为可高频扫描的紧凑行。
- Layers 重点支持扫描层级、定位当前节点和安全执行结构操作。
- Pages 是页面切换的唯一入口，并提供明确的管理入口。
- Inspector 保持 Schema 驱动；304px 默认宽度下 label、control、复杂 setter、event 和 binding 均可读且不横向换行挤压。
- Inspector 采用可折叠 section；短属性使用单行 label/control，复杂 setter 独占整行，label 溢出以 tooltip 补全而不是换行挤压控件。

### R4. Preview 与辅助工作区

- Preview 继续为不改变 Design 几何的 overlay，并按真实 Runtime stage 宽度响应。
- Flow、Page Manager、Config 和 Source 继续作为辅助工作区，不与 Design 争夺主编辑模式。
- Source 维持 VS Code 风格真实文件树 + Monaco；Config 维持只读 TypeScript / JSON / Tree 投影。

### R5. 响应式、主题和可访问性

- 1440px 使用稳定三栏；900px 保持 Canvas 与非模态侧栏/Preview 的连续操作；390px 提供明确的移动端工作区切换。
- 900px 使用持续可见的 activity rail 打开 Components/Layers/Pages 和 Inspector 非模态 drawer；390px 使用 Components/Layers/Canvas/Inspector/Pages 五工作区 Dock。
- Light/Dark、zh-CN/en-US 具有同等完成度，不允许操作按钮、菜单标签和 Inspector 控件在暗色模式失去对比度。
- 所有核心工作流支持键盘，dialog/menu/tree/tab 遵守既有无障碍合同。

## 暂定验收标准

- [ ] 1440/900/390 三个视口下，页面设计、选中节点、配置属性、打开 Preview 和导出均可完成，且无遮挡、横向溢出或文本截断。
- [ ] 1440 下左/中/右三栏稳定；900 下 Canvas 始终可见且左右 drawer 可由稳定 activity rail 打开；390 下五工作区 Dock 可见、可点击并保持焦点与选中状态。
- [ ] Components 首屏扫描密度明显提高，同时每个平台注册物料仍由真实 Runtime specimen 渲染；不得出现静态 HTML 仿制控件。
- [ ] Element Plus 与 Ant Design Vue 的全部注册物料继续使用真实 Runtime specimen、candidate 和 Preview。
- [ ] 三级布局嵌套下，选择、drop、resize 和 node actions 不互相抢占命中。
- [ ] Preview 打开、关闭和扩展不改变 Design Surface 的内部 breakpoint 或几何。
- [ ] Canvas 与 Preview 使用同一不可拆分 `PageCompilation`，其中绑定 ProjectSnapshot identity、页面 content hash、实际使用的 Registry contracts、compiler identity 和 `CanonicalPageProgram`；两者再使用同一 Vue Runtime Backend 生成的 `RuntimePlan`。Source Export 从同一固定 ProjectSnapshot 按需组装 `ProjectCompilation`。相同 Runtime Presentation 下组件、props、slot placement 与可见几何一致，不同 viewport 下只发生真实响应式差异；运行值、校验、异步任务和 Flow trace 彼此隔离。
- [ ] Repository 的分实体存储不会暴露混合 revision；跨页事务、CAS 冲突、保存期间继续编辑、配额/部分写入失败均有行为测试。
- [ ] pointer move 只增量编译受影响子树；2000 节点页面的 candidate 更新不触发整页重新编译或重新挂载。
- [ ] IDE Light/Dark 不改变 Canvas sheet、Preview 和导出页面的 Runtime computed style。
- [ ] Design 与 Preview 通过独立 RuntimeHost 隔离 IDE CSS、第三方组件库全局样式、Teleport 容器和副作用生命周期；editor overlay 只通过稳定 geometry/event bridge 读取运行节点，不进入 Runtime DOM。
- [ ] Source/Config、Flow 和 Page Manager 保持辅助 dialog/workspace；Source/Config 仍只读且不出现在 Design 主模式导航中；Source 只由固定快照的 CanonicalProjectIR 生成，Config/JSON/Tree 只由同一快照的 ProjectDocument 无损投影。
- [ ] 中英文可见文案、aria-label、tooltip 和菜单保持完整且不换行溢出。
- [ ] Playwright 覆盖真实视觉几何、hit testing、键盘主路径和 axe WCAG 2 A/AA，全部通过。
- [ ] 所有受影响包 test/typecheck/build、lint、发布包边界和导出工程验证通过。

## 暂定范围外

- 任意 HTML DOM、自定义项目导入、自由源码回写 Design。
- 与视觉或交互目标无关的组件库新增物料。

## 架构重构范围

- 允许重构 Core/Designer/Workbench/Runtime 的包边界和公共接口；Repository 只接受当前 schema，历史开发数据若需保留必须在仓库外一次性处理。
- 建立项目级 `ProjectDocument` 与规范化 `PageGraph`，删除持久化模型中的 `children + slots` 双结构和生成文件副本。
- 统一 `Command -> OperationBatch -> AppliedTransaction`、RenderPlan 和设计命令的类型合同，删除正常编辑路径上的 `LowCodePageModel`/`DesignerDocument` 双重投影状态。
- 将流程运行时与生成 Source 的流程执行实现收敛到同一可验证的执行计划/运行时合同。

## 暂定范围外（保持不变）

## 阻塞决策

- 无待决阻塞项。按上述架构推进：保留 Registry 能力和真实 Runtime 渲染，严格拒绝非当前 schema，推翻 Designer 对领域模型的所有权、`children + slots` 双结构、受控设计器本地历史、持久化生成文件以及 Workbench 巨型 Controller。
