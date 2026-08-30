# ConfigForm IDE 当前工作台审计

## 审计范围

- 运行页面：`packages/ConfigForm/workbench`
- 视口：1440 桌面、900 紧凑桌面、390 移动端
- 主题：Light / Dark
- 结构：Topbar、Components / Layers / Pages、Canvas、Inspector、Preview、Flow、Export
- 日期：2026-08-30

浏览器当前为 90% 缩放，因此自动化审计使用等效视口换算，并以页面内 `innerWidth`、DOM 几何和可访问树作为判定依据。

## 架构边界

现有核心状态流不需要因本轮视觉重设计而推翻：

- `workbench-controller.ts:125-130` 从当前页面的 Config Model 计算 Design Document。
- `workbench-controller.ts:346-379` 将 Design 命令适配为 Model Operation，再交给 Workspace Session。
- `workbench-controller.ts:309-317` 从同一快照编译 Preview 投影。
- `WorkbenchShell.vue:177-380` 只负责组合 Topbar、DesignSurface、Preview 与辅助 Dialog，没有建立第二份页面数据。
- `DesignSurface.vue:268-281` 让 candidate 和落地操作共用拖拽控制器；`DesignSurface.vue:385-419` 的新增、移动、Resize 和 setter 都走命令/操作入口。

因此当前问题主要位于 editor chrome、面板编排、视觉 token 和响应式呈现，不是 Config Model、Runtime 或 Operation 的缺陷。

## 真实界面发现

### 1. Components 信息重复且密度过低

- `DesignerPalette.vue:182-219` 同时渲染图标、名称、`Field/Layout` 类型文字和真实 Runtime specimen。
- `styles.scss:285-341` 把单个物料设为至少 92px，其中摘要 34px、specimen 54px。
- 1440 下 232px 左栏首屏只能稳定看到约 7 个字段物料，分类扫描成本高。
- `Field/Layout` 对用户没有新增信息，且与分类标题重复；真实 specimen 才是应保留的核心识别信号。

结论：保留 Registry 驱动的真实 specimen，但删除重复类型标签并压缩为约 64-72px 的紧凑物料行。布局物料应使用同一密度规则，不另做厚重卡片。

### 2. Canvas 是真实 Runtime，但工作区层级仍像“表单 Demo”

- `styles.scss:429-448` 用 900/720/390px sheet 表示 desktop/tablet/mobile，这一模型合理。
- `styles.scss:429-441` 的 `min-height: 100%` 让内容很少的页面仍形成满屏白色 sheet；当前模板只有三个字段时，首屏大部分为空白。
- `styles.scss:513-548` 已保证 candidate、visual source 和 drag overlay 由 Runtime 节点导出，不应回退为伪造控件。
- `styles.scss:570-650` 已把 drop、selection、node actions 和 resize 放在 editor overlay，方向正确。

结论：保留 Runtime/overlay 机制，只重做 Canvas chrome、留白尺度、浮动工具、选择反馈和 sheet 周边环境；不能用 CSS 卡片或手写 placeholder 替代 Runtime。

### 3. Inspector 具备 Schema 能力，但缺少生产工具的信息分组

- 当前 304px Inspector 中，表单属性逐项垂直堆叠，Form、Layout、Responsive 没有明确的分组层级。
- `styles.scss:650-690` 已存在属性标题和 tabs 基础；Workbench 的主题桥接位于 `styles/studio.css:186-342`。
- Dark 下 Element Plus / Ant Design Vue setter 已做独立 token 适配，证明主题边界可以保留。

结论：Inspector 改为可折叠 section + 紧凑 property row；短字段采用单行 label/control，复杂 setter 独占整行。label 不换行，溢出用省略和 tooltip，不能缩窄真实控件到不可操作。

### 4. 紧凑桌面和移动端已有机制，但视觉入口不够明确

- `styles.scss:1243-1270` 已支持 medium 模式左右 drawer；无需重新实现 Model 或拖拽。
- `responsive.css:1-18` 在 900px 仅压缩 Topbar，DesignSurface 的面板入口仍混在二级 toolbar。
- `WorkbenchShell.vue:104-138` 与 `WorkbenchShell.vue:306-328` 已定义移动端 Components / Layers / Canvas / Inspector / Pages 五工作区。
- `responsive.css:69-125` 已定义底部 Dock；最新 4315 服务的 DOM 与可访问树能看到五个 tab。
- 4313 端口曾展示旧构建而 4315 展示当前源码，后续开发与验收必须绑定一个确定的 Vite 入口，避免旧进程造成错误视觉判断。

结论：900px 使用持续可见的 activity rail，左右 drawer 从 rail 明确打开；390px 保留五工作区底部 Dock，但重做其可见性、选中态和 Canvas 可用高度，并用截图像素验证，不只检查 DOM。

### 5. Dark/Light 的 Runtime 边界正确，IDE 层次仍需重做

- `styles/studio.css:186-223` 明确把 Dark IDE 的 Canvas sheet 和 Runtime surface 固定为白色。
- 实测 Light/Dark 均保持 Canvas sheet 为 `rgb(255, 255, 255)`；这一合同必须保留。
- 当前 Dark 的 canvas chrome 接近纯黑，顶栏、工作区和面板层级差异太弱；Light 的 panel/canvas 也主要依靠边线区分。

结论：重做中性色阶、边框、hover、focus、disabled 和 overlay elevation，但禁止把 IDE theme 注入真实 Runtime。

### 6. Pages、Flow、Export 的产品位置已经正确

- `StudioLeftPanel.vue:215-239` 让 Pages 成为左侧唯一页面切换入口，并只暴露“管理页面”。
- `FlowDialog.vue:41-69` 已是独立 modal，`WorkbenchShell.vue:366-375` 只传递 flows 和 Model Operation。
- `ExportDialog.vue:60-104` 已把 Source 设为真实工程文件树 + Monaco，把 Config 设为只读 TypeScript/JSON/Tree 投影。
- `WorkbenchTopbar.vue:210-233` 的 Export 是下拉入口，Source/Config 不参与 Design 编辑模式。

结论：本轮只统一这些辅助工作区的视觉系统和响应式，不改变其产品定位或数据合同。

## 设计输入

### Wide（>= 1180px）

- 稳定三栏：左 240-248px、中心弹性 Canvas、右 304-320px。
- 左栏用 Components/Layers/Pages tabs；右栏使用 Inspector section。
- Preview 从右侧 overlay 展开，不能重新计算 Design Surface 内部宽度。

### Compact（701-1179px）

- 保持 Canvas 全程可见。
- 左侧使用 40-44px activity rail；Components/Layers/Pages 以非模态 drawer 打开。
- Inspector 从右侧非模态 drawer 打开；Preview 继续为 overlay。
- drawer 关闭后焦点回到稳定触发器，且不会改变当前选择。

### Mobile（<= 700px）

- 单工作区切换：Components、Layers、Canvas、Inspector、Pages。
- Canvas 默认采用 mobile sheet breakpoint；辅助 Dialog 使用全屏 workspace。
- Topbar 只保留页面上下文、Export、Preview 和 More；其他命令进入 More。

## 不应引入的回退

- 不得用静态 HTML 物料、placeholder 或截图替代 Registry Runtime。
- 不得为 Source / Config 建立可写 Provider。
- 不得把 Flow 变成第四个主编辑模式。
- 不得让 Workbench theme 改写 Canvas sheet、Preview 或导出页面的 Runtime computed style。
- 不得用 DOM clone 作为 Config Model 的持久状态。

