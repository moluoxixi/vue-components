# ConfigForm Workbench 组件替换审计

## 审计结论

Workbench chrome 统一以 Element Plus 为成熟组件基线，Ant Design Vue 只保留在 Ant Runtime、物料 specimen 和对应 Designer adapter 中。迁移没有建立 `BaseButton`、`BaseTabs`、`BaseDialog` 等二次通用组件层；业务状态仍由既有 Workbench context、Project Session 和 Designer controller 持有。

## 直接采用成熟组件

| 区域 | 原手写能力 | 当前组件 | 文件 |
| --- | --- | --- | --- |
| Topbar | 命令按钮、Tooltip、下拉菜单 | `ElButton`、`ElTooltip`、`ElDropdown` | `src/app/WorkbenchTopbar.vue` |
| 左侧导航 | Tabs、搜索、滚动、空状态、行操作菜单 | `ElTabs`、`ElInput`、`ElScrollbar`、`ElEmpty`、`ElDropdown` | `src/studio/StudioLeftPanel.vue` |
| Preview 外壳 | 侧栏、modal、焦点与 ESC 生命周期 | `ElDrawer` | `src/studio/PreviewDrawer.vue` |
| Export | Dialog、Tabs、Alert、命令按钮 | `ElDialog`、`ElTabs`、`ElAlert`、`ElButton` | `src/features/export/ExportDialog.vue` |
| Flow 外壳 | Dialog、焦点闭环、关闭按钮 | `ElDialog`、`ElButton` | `src/features/flow/FlowDialog.vue` |
| Page Manager | Dialog、Project 选择、搜索、行内编辑、命令按钮、删除确认 | `ElDialog`、`ElSelect`、`ElInput`、`ElButton`、`ElAlert` | `src/features/pages/PageManagerDialog.vue`、`src/components/PageManager.vue` |
| Persistence | Dialog、Input、Button、Empty | `ElDialog`、`ElInput`、`ElButton`、`ElEmpty` | `src/features/persistence/PersistenceDialog.vue` |
| Template | Dialog、模板命令按钮 | `ElDialog`、`ElButton` | `src/features/templates/TemplateDialog.vue` |
| 通知与恢复提示 | 状态、语义色、图标、操作按钮 | `ElAlert`、`ElButton` | `src/app/WorkbenchShell.vue` |

这些组件直接使用 Element Plus 的焦点、键盘、disabled、弹层和可访问性状态机。Workbench 只保留领域文案、事件接线和稳定测试标识。

## 薄领域接线

| 组件 | 允许承载的领域语义 | 不拥有的状态 |
| --- | --- | --- |
| `WorkbenchTopbar` | Project/Page 命令、History、主题、语言、Preview/Export 入口 | Project Model、History reducer、Dropdown/Tooltip 状态机 |
| `StudioLeftPanel` | Registry 物料、Layers selection/arrange、Pages/History projection | 第二份 PageGraph、Tabs/Scrollbar 状态机 |
| `PreviewDrawer` | Preview Session、viewport、RuntimeHost 提交和结果投影 | Runtime form model、Drawer/modal 状态机 |
| 各辅助 Dialog | Export/Page/Flow/Persistence/Template 命令及 i18n | 自定义 focus trap、ESC、modal click 状态机 |

所有父文档弹层统一 Teleport 到 `#workbench-overlays`。`ElDropdown`、`ElTooltip`、`ElSelect` 保持默认 Teleport，并显式设置 `append-to="#workbench-overlays"`；禁止用 `teleported="false"` 把 popper 留在会裁剪内容的 Topbar 或面板滚动容器中。该 root 镜像 Workbench Light/Dark token 与 z-index 行为，但不会进入 Runtime iframe。Preview Drawer 固定从 48px Topbar 下方开始，并关闭会让父文档和 iframe 坐标不同步的入场位移动画。

## 保留领域自研

| 区域 | 保留内容 | 领域理由 |
| --- | --- | --- |
| Canvas | camera、Fit/Zoom/Pan、selection overlay、resize、drop target、candidate、drag visual | 必须与 Runtime 几何、pointer capture、ProjectDraftSnapshot 和 1px overlay 合同一致 |
| Designer 节点工具 | 拖拽手柄、节点移动/复制/删除、断点切换 | 按钮直接参与 selection/keyboard-drag/overlay mode，不是可复用通用 Button |
| Palette | Registry 分组、真实 specimen、拖放/键盘放置 | 物料预览是真实 adapter Runtime，不能由通用 List/Tree 重建 |
| Inspector schema renderer | setter dispatch、conditions、validation、reaction、options | 控件由 Registry setter schema 和 Provider adapter 决定；Element/Ant adapter 各自使用其 Provider 控件，核心 Designer 不绑定单一 UI 库 |
| Layers/Page 行为 | 稳定 node/page identity、层级移动、删除确认 | 行操作提交 ProjectCommand，不能引入 Tree 自带排序或第二份 selection |
| Flow Workspace | Vue Flow 画布、节点/边、trigger/action/error policy 编辑 | 属于 Flow execution plan 领域编辑器；`ElDialog` 只负责外壳 |
| Preview 内部工具 | viewport、提交、结果、复制/清除 | 直接驱动 Preview Session 与 RuntimeHost，不形成通用 Toolbar 抽象 |
| RuntimeHost | Design/Preview iframe、协议、geometry/pointer bridge、Teleport target | 必须隔离 Provider CSS、Vue Component 和运行状态 realm |
| Source/Config | Monaco model、文件树投影、只读 ExportSnapshot | 编辑器模型和固定导出 revision 属于导出领域能力 |
| Mobile dock | Components/Layers/Canvas/Inspector/Pages 导航 | 负责窄屏 Workbench/Designer workspace ownership，不复制桌面 Tabs 业务状态 |

## 按需导入与隔离检查

- `vite.config.ts` 使用 `unplugin-vue-components` 和 `ElementPlusResolver({ importStyle: 'css' })`，模板组件由 resolver 按需生成导入。
- `src/components.d.ts` 只声明实际使用的 Element Plus 组件。
- `scripts/verify-element-plus-bundle.mjs` 禁止 `app.use(ElementPlus)`、`import ElementPlus from 'element-plus'` 和 `element-plus/dist/index.css`，并检查声明与 CSS 构建产物。
- Element 与 Ant Runtime 仍在各自 iframe 内加载 adapter 和 Provider CSS；Workbench Element Plus chrome 不进入 iframe，Runtime popper 也不 Teleport 到父文档。
- 父文档说明 Tooltip 通过专用 `workbench-passive-tooltip` popper class 保持 pointer-transparent；不能按 Element Plus 内部通用 `.el-tooltip` 类禁用指针，因为 Dropdown popper 也会携带该类。Dropdown、Select 和 Runtime Provider popper 继续保留交互。

## 后续变更规则

新增通用 Button、Tabs、Dropdown、Tooltip、Form、Dialog、Drawer、Tree、Alert、Switch、Input 或 InputNumber 前，先使用 Element Plus 已有能力。只有当控件直接拥有 Canvas、Registry、ProjectCommand、Flow、RuntimeHost 或 Monaco 领域合同，且成熟组件会引入第二套状态时，才保留领域实现，并在本审计中补充理由。
