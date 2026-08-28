# 优化低代码 IDE 暗色主题

## 目标

在不改变低代码 IDE 信息架构与业务行为的前提下，重做暗色主题的视觉层级和交互状态，使工作台保持 Figma / VS Code / Linear 风格的专业、高密度观感，并确保所有操作按钮、文字和表单控件清晰可辨。

## 背景与已确认事实

- Workbench 通过根节点 `data-theme` 切换主题，但当前暗色 token 只覆盖部分界面（`packages/ConfigForm/workbench/src/App.vue:805`、`packages/ConfigForm/workbench/src/styles.css:32`）。
- Designer 仍存在浅色硬编码：素材项背景、属性标签、画布工具浮层和危险按钮 hover 不会随暗色 token 改变（`packages/ConfigForm/designer/src/styles.scss:122`、`:261`、`:327`、`:400`、`:819`）。
- Inspector 使用 Element Plus 或 Ant Design Vue 的真实控件，但 Workbench 尚未提供作用域内的暗色主题桥接，导致标签、输入框、步进器、开关和分段控件对比度不一致。
- 当前浏览器实测中，素材按钮出现浅底浅字，Inspector 标签和工具栏图标接近背景色，画布表单标签也难以辨认。
- Canvas 与 Preview 承担真实 Runtime 展示职责，IDE 主题不应无条件篡改用户页面的输出主题。

## 需求

### R1 统一语义化主题 token

- Workbench 与 Designer 的编辑器外壳统一使用语义化颜色 token，至少覆盖页面背景、面板、浮层、边框、主文字、次文字、悬停、选中、焦点、危险操作和禁用状态。
- 清理本次范围内绕过 token 的浅色或暗色硬编码，保证暗色与亮色主题都能正确响应。
- 暗色主题采用中性炭黑/灰作为结构色，蓝色用于选择与焦点，红色只用于危险操作，避免整页呈现单一蓝灰色。

### R2 编辑器操作清晰可辨

- 顶栏、Designer 命令栏、侧栏切换、Canvas 工具、节点操作和导出弹窗中的按钮必须覆盖 normal、hover、active/pressed、focus-visible、disabled 状态。
- 图标按钮使用稳定尺寸和清晰边界；disabled 状态可以弱化，但仍应能辨认图标和控件轮廓。
- 危险操作必须与普通操作区分，暗色主题下不得出现突兀的浅粉色块。

### R3 左侧素材栏与右侧 Inspector

- 素材项在暗色主题下使用暗色表面和高对比文字/图标，不再出现浅底浅字。
- Components、Layers、Pages 的默认、悬停、选中和键盘焦点状态一致。
- Inspector 的标题、标签、分组、输入框、数字步进器、开关、分段控件和响应式配置项均清晰可读。
- Element Plus 与 Ant Design Vue 两种 Provider 均需达到一致的视觉层级；主题覆盖必须限制在编辑器作用域，不污染页面 Preview 或导出的项目。

### R4 Canvas 与 Preview 保真

- 暗色 IDE 中应明确区分工作区背景与 Runtime 画布；Runtime 画布保持项目真实主题和默认控件表现，不因 IDE 暗色主题被整体改成暗色。
- Designer 的选择框、拖拽提示、操作浮层和连线工具随 IDE 主题变化，并在 Runtime 画布上保持清楚。
- Preview 与导出产物不得因本次编辑器主题优化改变业务样式。

### R5 响应式与主题切换

- 1440px、900px 和 390px CSS 宽度下无横向溢出、遮挡或按钮文字/图标裁切。
- Dark / Light 切换后所有编辑器表面和状态立即同步；亮色主题现有可读性不得退化。
- Source / Config 只读弹窗继续与当前主题同步，Monaco 暗色/亮色模式保持正确。

## 验收标准

- [x] AC1：暗色主题下，顶部命令、Designer 工具栏、侧栏与 Inspector 的普通文字/图标对相邻背景具有清晰对比；普通文本目标不低于 4.5:1，关键控件边界与状态目标不低于 3:1。
- [x] AC2：所有操作按钮的 normal、hover、pressed、focus-visible、disabled 状态均可辨识，危险操作具有独立且克制的红色语义。
- [x] AC3：Components 素材项不再出现浅底浅字；Layers、Pages 与侧栏标签在暗色主题下的悬停、选中、焦点状态一致。
- [x] AC4：Element Plus 与 Ant Design Vue 的 Inspector 控件在暗色主题下均清晰可用，且作用域外的 Preview 与导出项目样式不受影响。
- [x] AC5：Runtime 画布与 IDE 暗色外壳有明确边界，字段标签、输入框、选择控件和节点操作均可读；拖拽 overlay 不再回退为错误的整套浅色编辑器 token。
- [x] AC6：切换 Light / Dark 后顶栏、三栏工作区、导出弹窗与 Monaco 主题同步，亮色主题无明显回归。
- [x] AC7：在 1440px、900px、390px 三种 CSS 宽度完成浏览器截图与交互验收，无横向溢出、遮挡、裁切或不可见按钮。
- [x] AC8：Workbench/Designer 相关测试、typecheck、build 与 `git diff --check` 通过；新增自动化至少覆盖主题切换的 DOM/可访问名称契约或等价的稳定主题契约。

## 范围外

- 不改变 Config Model、Component Registry、Model Operation、Preview 编译或导出数据流。
- 不新增用户自定义主题编辑器或主题持久化协议。
- 不改变用户页面及导出项目的默认 Runtime 主题。
- 不处理流程引擎、Source/Config 编辑能力或新的 Designer 功能。

## 关键决策

- 本任务是轻量视觉缺陷修复，采用 PRD-only，不新增 `design.md` 和 `implement.md`。
- 主题覆盖以语义 token 和编辑器作用域为边界，不使用全局 `.el-*` / `.ant-*` 规则污染 Preview。
- 视觉验收同时依赖自动化契约和真实浏览器截图；仅通过单元测试不能证明暗色层级与可读性。
