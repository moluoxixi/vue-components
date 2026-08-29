# 仓库证据与方案约束

## 页面模型

- `packages/ConfigForm/workbench/src/project/types.ts:29` 的 `WorkspaceProject` 只包含一份 `manifest` 和一组虚拟文件，没有 `pages` 或路由集合。
- `packages/ConfigForm/workbench/src/App.vue:125-128` 使用 `projects`、`currentProject` 和单份 `configHistory`；页面切换实际是打开另一个 Repository Project。
- `packages/ConfigForm/workbench/src/App.vue:982-992` 的顶部 `<select>` 与 `packages/ConfigForm/workbench/src/App.vue:1199-1212` 的左侧 Pages 调用同一 Project 切换能力。
- `WorkspaceProject` 在 Workbench 中有 39 个调用点，覆盖 revision、schema、memory/IndexedDB repository、draft、template、upgrade、source export、integration tests。真正多页面化必须升级完整持久化边界，不能只在 `App.vue` 组合多个现有项目。
- 安全迁移方式是把每个 v1 Project 升级为一个只含单页的 v2 Application；不能自动把多个旧 Project 合并，因为仓库没有可靠的应用归属关系。

## 拖拽反馈

- `packages/ConfigForm/designer/src/components/DesignerCanvas.vue:105-116` 已经通过临时 command 生成 `projectedDocument`，再投影为真实 Runtime renderer。
- `packages/ConfigForm/designer/src/components/DesignerCanvas.vue:144-198` 的 editor bridge 已能注册候选真实 DOM，并通过 `ResizeObserver` 跟踪尺寸。
- `packages/ConfigForm/designer/src/components/designer-drag.ts:38-44` 的 session 只保存 `origin`，没有保存最新 pointer position；新增鼠标虚影前必须把当前坐标纳入 transient session。
- 鼠标虚影应消费同一个 `candidateNode` 和实测候选矩形；持久化 Model、Runtime API 和 Component Registry 不需要新增第二套节点协议。
- 当前 ConfigForm 工作区没有使用 Pragmatic Drag and Drop 或 dnd-kit。为单一 Overlay 引入完整拖拽库收益有限，优先扩展现有受控 pointer controller；若后续出现跨窗口、原生文件拖拽等需求再重新评估。

## Source 文件树

- `packages/ConfigForm/workbench/src/App.vue:257-259` 只把导出文件路径排序为扁平数组。
- `packages/ConfigForm/workbench/src/App.vue:1398-1411` 虽声明 ARIA Tree，却为每个完整路径直接渲染一个 `treeitem`，没有文件夹节点、层级、展开状态或 roving tabindex。
- 仓库没有满足层级文件树、键盘 Tree 导航和文件图标要求的可复用组件。
- 文件树必须从一次导出 snapshot 的 `Record<ProjectPath, WorkspaceFile>` 纯构造，不能反向读取 Monaco，也不能在打开弹窗后混用不同 revision 的文件集合。

## 推荐决策

推荐将 v2 持久化层级改为 `WorkspaceApplication -> pages[] -> LowCodePageModel`，编辑器仍一次只加载一个页面。旧 v1 Project 逐个迁移为单页 Application。这样页面管理、路由、组件事件导航和多页面 Source 导出才共享同一个应用边界。

若继续把每个 Project 当页面，只能实现列表管理和单页 ZIP；页面路由、首页、跨页导航、共享依赖和整站 Source 导出都会继续缺少真源。
