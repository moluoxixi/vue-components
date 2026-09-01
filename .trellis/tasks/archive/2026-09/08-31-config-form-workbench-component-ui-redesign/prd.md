# ConfigForm Workbench 组件化视觉重构

## 目标与用户价值

把 ConfigForm Workbench 从大量手写通用控件和零散样式，重构为稳定、清晰、可维护的专业低代码 IDE 视觉系统。高频搭建表单的前端开发者应能依靠熟悉的控件行为完成导航、配置、导出和辅助操作，同时保留 Canvas、拖拽、RuntimeHost 等真正属于低代码编辑器的领域能力。

## 已确认事实

- Workbench 当前自行实现了 Topbar、Tabs、Dropdown、Dialog、Toast、Tree、Form setter 等大量通用交互；Canvas camera、selection overlay、drag candidate、RuntimeHost 和 Monaco 则是不能由通用 UI 库替代的领域组件。
- Workbench 已依赖 `element-plus` 与 `ant-design-vue`；Element/Ant Runtime 在独立 iframe 中按项目 Registry 运行，编辑器外壳没有必要随 Runtime Provider 维护两套 UI。
- 仓库共享 Vite 能力已有 `ElementPlusResolver`，但 Workbench 独立 `vite.config.ts` 当前只启用 Vue 插件，尚未接入按需组件与样式解析。
- 用户明确要求遵循 `frontend-design` 方法，减少抽象自造组件，通用控件优先使用 Element Plus 等成熟实现，并严格按需导入。

## 需求

### R1. 先建立组件替换清单

- 审计 Workbench/Designer 中每个手写通用控件，标记为“直接采用成熟组件”“用薄领域适配层封装成熟组件”或“保留领域自研”。
- 禁止以统一抽象为目的再造 Button、Tabs、Dropdown、Tooltip、Form、Dialog、Drawer、Tree、Alert、Switch、Input、InputNumber 等通用组件。
- 薄适配层只允许承载 Workbench 领域语义、i18n、Command/Session 接线和稳定测试标识，不复制 UI 库已有的状态机与键盘交互。

### R2. Workbench 外壳统一采用 Element Plus

- Workbench chrome 以 Element Plus 为默认成熟组件基线；Ant Design Vue 继续只服务 Ant Runtime、物料 specimen 与 Preview，不为编辑器外壳复制第二套实现。
- 优先迁移 Topbar 命令、Tooltip、Dropdown、左侧 Tabs/搜索/Tree、Inspector Form setter、Dialog/Drawer、通知反馈、空状态和滚动容器。
- Canvas、选择框、拖拽手柄与候选层、camera、RuntimeHost、Monaco、Flow 画布等领域组件保持现有所有权，不为“组件化”而替换。

### R3. 严格按需导入

- Workbench Vite 使用 `unplugin-vue-components` 的 `ElementPlusResolver`（以及确有需要时的 composable resolver）生成组件导入和类型声明。
- 禁止 `app.use(ElementPlus)`、禁止全量导入 Element Plus JS 或 `element-plus/dist/index.css`。
- 构建产物必须证明只包含实际使用的组件与样式；新增组件同时更新 bundle/声明验证。

### R4. 采用面向编辑器的视觉系统

- 视觉中心始终是单页真实 Runtime Canvas；左右栏与顶栏安静、紧凑、服务于扫描和连续操作。
- Light/Dark 使用有层级的中性色、明确的文字对比和单一交互强调色；Dark 不改变 Canvas 内 Runtime 的 Provider 样式。
- 图标按钮必须有成熟 Tooltip、可见焦点、禁用态和快捷键信息；不使用无语义装饰、卡片套卡片或营销式大标题。
- 所有文案从用户操作命名，统一命令、Toast、Dialog 和 History 中的动作词。

### R5. 响应式与可访问性

- 1440/900/390 三档保持可达操作、无文字截断、无横向溢出、无 Inspector 控件遮挡。
- zh-CN/en-US 与 Light/Dark 均需截图审查；键盘、焦点恢复、ESC、菜单方向键和屏幕阅读器语义由成熟组件或现有领域合同保证。
- 尊重 `prefers-reduced-motion`，只保留能解释状态变化的微动效。

### R6. 不改变核心状态流

- UI 迁移不得新增第二份 Model、History、Selection 或表单状态；所有编辑继续走 `ProjectCommand -> ProjectEditorSession -> ProjectDomainEngine`。
- Design/Preview/Export 仍消费同一 Config Model 投影，Source/Config 继续只读。
- Element 与 Ant 两套 Runtime 的行为、几何和 Preview 交互不得因 Workbench 外壳迁移而变化。

## 验收标准

- [ ] 形成完整组件替换清单，所有保留自研项都有明确领域理由，不存在新的通用 UI 抽象层。
- [ ] Topbar、左侧导航、Inspector 通用 setter、辅助弹窗与通知优先落到 Element Plus 成熟组件；交互名称和样式统一。
- [ ] Workbench 构建使用 Element Plus resolver 按需导入，无 `app.use(ElementPlus)` 和全量样式导入，类型声明、构建与 bundle 审计通过。
- [ ] Canvas/selection/drag/camera/RuntimeHost/Monaco 的领域合同和 Config Model 单一真源保持不变。
- [ ] Element Plus 与 Ant Design Vue 的全物料、Design inert、Preview interactive、拖拽、快捷键、History、Export E2E 全部通过。
- [ ] 1440/900/390、Light/Dark、zh-CN/en-US 截图无截断、溢出、遮挡或不可辨识按钮；axe 无新增 WCAG 2 A/AA 问题。
- [ ] 根 lint、受影响包 typecheck/test/build、Workbench Playwright 和 `git diff --check` 通过。

## 范围外

- 不重写 Config Model、Compiler、RuntimeHost、Flow Engine、Export 生成或 Provider Registry。
- 不把 Workbench chrome 做成随 Runtime Provider 切换的两套 Element/Ant UI。
- 不追求把每一段 DOM 都替换成第三方组件；低代码领域交互必须保留明确的自研边界。
- 不在本任务引入模板市场、源码编辑、任意 Vue 工程导入或新的状态管理框架。
