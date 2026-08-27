# 配置化表单设计器功能与界面优化

## 目标

在不破坏现有设计器文档、运行时渲染和双 UI 框架适配能力的前提下，把 ConfigForm Designer 优化为稳定、紧凑、可访问的专业工作台。

用户应能在桌面、中等宽度、窄屏和窄父容器中高效完成素材添加、节点选择、属性编辑、预览、导入和导出，避免多重滚动、焦点丢失、隐藏操作和预览行为不一致带来的编辑成本。

## 背景与证据

- 前序任务 `08-08-config-form-designer-advanced` 已完成并归档；现有能力包括拖拽编辑、撤销/重做、导入/导出、运行预览、三档表单响应式预览、条件、校验、reaction、选项源，以及 Element Plus / Ant Design Vue 双适配器。
- 工作区当前采用素材 / 画布 / 属性三栏，在 viewport `<=1100px` 时将属性面板下置，在 `<=720px` 时纵向堆叠，导致中窄宽度出现多个滚动上下文：`packages/ConfigForm/designer/src/styles.scss:1155`、`packages/ConfigForm/designer/src/styles.scss:1179`。
- 工作区响应式由 `window.innerWidth` 驱动，嵌入宽页面中的窄父容器时不会按实际可用宽度切换：`packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:63`。
- 导入、导出和预览弹窗已有 dialog 语义，但缺少 Escape、焦点约束和关闭后焦点恢复：`packages/ConfigForm/designer/src/components/ConfigFormDesigner.vue:399`。
- 属性页签已有 `tablist` / `tab`，但缺少 tabpanel 关联、roving tabindex 和方向键模型：`packages/ConfigForm/designer/src/components/DesignerPropertyPanel.vue:246`。
- 节点操作条位于节点焦点壳之前，顺向 Tab 无法自然进入操作按钮：`packages/ConfigForm/designer/src/components/DesignerNodeList.vue:254`。
- 画布预览会用空函数覆盖材料的 `blurTrigger` listener：`packages/ConfigForm/designer/src/components/DesignerNodePreview.vue:137`。
- 自定义 validator 的 registry、setter 和 compiler 已完整，但 Playground 未注册 validator，Custom 规则入口始终禁用：`packages/ConfigForm/playground/src/designer/DesignerExample.vue:42`。
- 未知 material 在画布中只显示空虚线框，不显示 material key：`packages/ConfigForm/designer/src/components/DesignerNodePreview.vue:172`。
- 现有 Playwright 覆盖真实拖拽、双适配器、响应式和导入/导出，但没有稳定视觉基线、完整键盘路径、非法导入 UI、复制/下载成功路径或跨浏览器覆盖。

## 需求

### R1. 契约与兼容性

- 保持现有 `DesignerDocument`、compiler、history、diagnostics、registry、公共 props、emits 和 expose 契约。
- 保持 Element Plus 与 Ant Design Vue 的材料、属性控件、预览和导出行为对等。
- 所有文档写入继续经过现有 controller 与 history，不允许响应式或 UI 重构绕过文档校验。
- 工作区结构应为下一阶段在线网站工作台保留扩展空间，但本轮不显示尚不可用的 Config、Source、模板库或 Page Preview 占位入口。

### R2. 画布优先的自适应工作区

- 工作区模式依据 Designer 根容器宽度计算，不依赖浏览器 viewport。
- 宽度大于 1100px 时保持素材、画布、属性三栏常驻，画布占据主要空间。
- 宽度 721px 至 1100px 时保持画布常驻，素材和属性作为互斥侧滑面板按需打开。
- 宽度不大于 720px 时使用素材、画布、属性三个可访问分段视图，同一时刻只展示一个主视图。
- 窄屏添加材料后回到画布；选中节点后进入对应属性；切换视图不销毁面板实例，不丢失选择、草稿或滚动上下文。
- 工作区不出现非预期横向溢出，不让 page、workspace 与两个侧栏同时形成相互争抢的滚动链。

### R3. 专业工作台视觉

- 保留现有品牌与两套真实 UI 组件的原生识别度，不进行整体换肤。
- 使用中性工作区、清晰分隔、有限强调色、统一紧凑控件和明确的 hover / focus / selected / disabled / error 状态建立层级。
- 工具栏、节点操作和面板命令使用现有 Lucide 图标与 tooltip / accessible name；不增加营销式标题、装饰卡片或不可操作的功能说明。
- 交互目标在桌面与触控宽度下保持稳定尺寸，动态状态不得造成工具栏、面板或画布跳动。

### R4. 键盘与弹窗交互

- 导入、导出、预览弹窗支持初始聚焦、Tab / Shift+Tab 焦点循环、Escape 关闭以及条件式焦点恢复。
- 中宽侧滑面板支持 Escape、明确关闭按钮和打开触发器焦点恢复。
- 属性页签与窄屏工作区页签具备完整 tab / tabpanel 关联，支持 Left / Right / Home / End 和 roving tabindex。
- 顶部工具栏支持方向键在 enabled commands 间移动，disabled command 不进入 roving 顺序。
- 节点现有 Up / Down / Left / Right / Delete 结构编辑语义保持不变；选中节点顺向 Tab 可进入其操作条，命令完成后焦点落在仍有效的选中节点。

### R5. 现有功能缺口

- 画布不再吞掉材料或注册项已有的 blur listener；本轮不在画布内复制 Runtime 的 touched、validation 或 error state。
- Playground 向两套 adapter registry 注入同一个可执行 custom validator，使 Custom 规则可配置、导出并在 Runtime Preview 中验证。
- 未知 material 在画布中显示本地化占位与原始 material key，同时保留 registry diagnostics；未知容器不猜测或渲染未知 slots。
- 非法 JSON、无效文档、复制成功和下载成功具备明确且可自动验证的 UI 行为。

### R6. 回归与浏览器范围

- Chromium 运行完整 Designer 端到端流程。
- Firefox 与 WebKit 运行布局、弹窗焦点、键盘、拖拽和双 adapter 的定向冒烟测试，不要求复制 Chromium 的全部场景。
- Chromium 为桌面、中宽窄容器和 390px 窄屏建立稳定视觉基线；截图聚焦 Designer 外壳和交互状态，避免把第三方组件细微版本差异扩大为全量快照。
- 设计器核心、两套 adapter 和 Playground 的单元测试、类型检查与构建均通过。

## 验收标准

- [ ] AC1：现有文档在优化前后可稳定导入、导出和编译，历史、diagnostics 与双 adapter 行为无回归。
- [ ] AC2：在宽 viewport 的窄父容器中，Designer 能按自身宽度切换 desktop / medium / narrow 模式；ResizeObserver 生命周期完整且卸载后断开。
- [ ] AC3：桌面保持三栏；中宽仅一个侧滑面板；窄屏仅一个主视图，添加和选择后的自动导航符合 R2，状态与滚动位置保留。
- [ ] AC4：弹窗、侧滑面板、属性页签、工作区页签、顶部工具栏和节点操作可以按 R4 通过键盘完成，ARIA 关系可由自动化断言验证。
- [ ] AC5：blur listener 不再被覆盖；两套 adapter 均可配置并运行 Playground custom validator；未知 material 显示本地化 key 占位。
- [ ] AC6：桌面、中宽和窄屏无横向溢出、重叠、裁切或不可达命令，视觉基线通过人工与 Playwright 截图复核。
- [ ] AC7：非法导入不修改当前文档；成功复制与下载产生正确 JSON、文件名和内容。
- [ ] AC8：Chromium 完整 E2E、Firefox/WebKit 冒烟、相关包测试、类型检查与构建全部通过。

## 约束与决策

- 采用画布优先模型，不延续中窄宽度的纵向堆叠。
- 采用克制的专业工作台视觉，不重塑品牌或适配器主题。
- 工作区响应与表单预览 breakpoint 是两套不同状态；前者由容器宽度决定，后者继续表示 Desktop / Tablet / Mobile 表单效果。
- 本轮不新增公共工作区控制 props；响应式导航首先作为 Designer 内部行为实现。
- Chromium 全量加 Firefox/WebKit 冒烟是本轮兼容性承诺。

## 不在本轮范围内

- Config / 拖拽设计器 / Source / Page Preview 在线网站工作台。
- 模板库、项目保存、协作、权限、部署、代码生成和虚拟项目文件系统。
- 导入任意现有项目、任意 npm 依赖、任意 Vite plugin 或 WebContainer。
- 新的 DesignerDocument 版本、Runtime/Headless 架构重构或新的公开包边界。
- 在画布内复制 Runtime touched、校验执行和错误展示状态。

## 下一阶段方向

下一阶段产品是基于受控 Vue 3 + Vite 模板的在线网站工作台。同一虚拟项目提供 Config、拖拽设计器、Source 三种编辑形态并共同驱动实时 Page Preview；Source 是完整可下载、可在标准 Node 环境类型检查和 Vite build 的真实项目，但不支持导入现有项目。

相关研究：

- `research/online-website-workbench.md`
- `research/code-roundtrip-feasibility.md`
- `research/project-source-and-page-preview.md`（被后续需求澄清替代的早期方案）
