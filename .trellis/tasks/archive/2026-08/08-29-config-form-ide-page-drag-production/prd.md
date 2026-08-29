# 低代码 IDE 页面与拖拽体验生产化

## 目标

把 Design-first ConfigForm Workbench 的拖拽反馈、页面模型与管理、源码导出浏览体验提升到可投入生产的水平。最终用户在一个应用内管理多个页面，只通过左侧 Pages 切换页面；拖拽期间看到与落点一致的真实组件虚影；Source 导出通过真正的层级文件树浏览完整工程。

## 已确认事实

- Config Model 是设计、预览和导出的唯一页面内容真源。
- 当前 `WorkspaceProject` 是单页虚拟工程，`packages/ConfigForm/workbench/src/project/types.ts:29` 没有页面集合；Workbench 中有 39 个调用点跨越 revision、schema、repository、draft、template、upgrade 和 export。
- 顶部页面 `<select>` 与左侧 Pages 调用相同切换能力，分别位于 `packages/ConfigForm/workbench/src/App.vue:982` 和 `packages/ConfigForm/workbench/src/App.vue:1199`。
- 画布已通过临时 Model Operation 生成 `projectedDocument` 并交给真实 `RuntimeSurface` 渲染，相关入口在 `packages/ConfigForm/designer/src/components/DesignerCanvas.vue:105`；当前 drag session 未保存最新指针坐标，见 `packages/ConfigForm/designer/src/components/designer-drag.ts:38`。
- Source 已生成完整虚拟工程，但 `packages/ConfigForm/workbench/src/App.vue:1398` 仍按完整路径平铺文件按钮，不具备文件夹层级、展开状态或完整键盘交互。

## 关键决策

- 采用 `WorkspaceApplication -> pages[] -> page metadata + LowCodePageModel` 的真正多页面模型，编辑器一次只编辑一个 Page。
- 旧 v1 `WorkspaceProject` 逐个、确定性地迁移为只含一个默认页面的 v2 Application；不自动合并多个旧 Project。
- 顶部 Page 下拉框移除，页面切换统一由左侧 Pages 完成；页面管理使用独立界面。
- Drag Overlay 与画布落点候选消费同一个 candidate/Registry。Overlay 复用真实候选的渲染结果和实测尺寸，不维护伪造物料 DOM。
- Source 文件树与 ZIP 下载消费同一次不可变导出快照。
- Flow 扩展不纳入本任务，待产品定位重新确认后单独规划。

## 交付范围

### R1 Designer 真实拖拽反馈

- 指针拖拽物料或已有节点时，显示跟随鼠标的半透明真实组件虚影。
- 画布目标位置继续显示临时 Config Model 投影形成的真实 Runtime candidate，准确表达最终位置、宽度、高度和嵌套关系。
- 虚影不能参与命中测试、触发组件交互或修改持久化 Config Model；取消、提交、只读切换、页面切换和卸载必须统一清理。
- 键盘拖拽保留无障碍公告和落点候选，不强制显示指针虚影。

### R2 多页面 Application 与统一导航

- 持久化层升级为一个 Application 包含至少一个 Page；每个 Page 拥有稳定 `id`、名称、路由、排序位置和 `LowCodePageModel`，Application 拥有唯一首页引用。
- 旧 v1 Project 必须无损升级为单页 Application，迁移可重复执行且失败时不覆盖原记录。
- 顶部不再提供页面切换控件，只显示不可交互的当前应用/页面上下文。
- 左侧 Pages 是设计工作区唯一快速切换入口，切换时保留未保存变更保护。
- Config Model 的 Undo/Redo 仍限定当前页面；页面集合操作使用独立的 Application Operation 边界。

### R3 独立 Page Manager

- 页面管理界面支持搜索、新建、重命名、复制、删除、排序、路由配置和首页设置。
- 路由在 Application 内唯一且规范化；首页始终指向存在的页面。
- 删除需要确认，且不能删除最后一个页面；复制页面生成全新的 Page/Node 标识，避免跨页身份冲突。
- 左侧 Pages 提供明确的“管理页面”入口，但不承载完整管理表单。

### R4 VS Code 风格 Source 文件树

- Source 导出预览按 `ProjectPath` 构造真实文件夹/文件层级，文件夹可折叠，目录优先且同层稳定排序。
- 使用文件类型图标、层级缩进、当前文件高亮、焦点样式和 `tree/treeitem/group` 语义。
- 支持上下键、左右键、Home、End、Enter 和可见节点 roving tabindex；文件选择与目录展开状态相互独立。
- 导出弹窗打开时创建一次不可变快照；Monaco 浏览、文件树和 ZIP 下载不得混用不同 revision。
- 多页面 Application 的 Source 导出包含全部页面、路由入口和 `package.json`，且生成工程不依赖 ConfigForm Runtime。
- Config 的 defineField Source、JSON、Tree 仍为只读查看/下载，不恢复编辑模式。

### R5 架构纯净与集成质量

- 保持 `Core <- Runtime <- Designer <- Workbench` 的单向依赖，Core/Runtime 不得反向依赖 Designer、Workbench、Vue Flow 或页面管理代码。
- Component Registry 与 Config Model 契约保持单一来源，Designer、Preview、Generator 不新增平行组件描述。
- 桌面、窄屏、亮色、暗色均可完成页面切换、拖拽、页面管理和导出浏览；Runtime 画布在暗色主题下保持原始组件视觉。

## 子任务

- `08-29-config-form-workbench-multipage`：Application 模型、v1 迁移、Pages 导航、Page Manager 与多页面导出输入。
- `08-29-config-form-source-file-tree`：不可变导出快照与层级 Source 文件树。
- `08-29-config-form-designer-drag-overlay`：真实 candidate 驱动的指针 Overlay 与拖拽生命周期。

实施顺序为多页面 Application、Source 文件树、拖拽 Overlay，最后由父任务执行全量集成验证。Overlay 与页面模型代码无直接依赖，但必须纳入最终页面切换清理测试。

## 范围外

- 不新增或重构 Flow Action、流程节点或 Vue Flow 编排界面。
- 不支持导入任意外部 Vue 项目。
- 不把 Source 或 Config 恢复为编辑 Provider。
- 不在本轮实现跨应用页面共享、多人协作、发布托管或服务端版本管理。

## 验收标准

- [x] AC1 物料和已有节点拖拽时均有跟随指针的半透明真实组件虚影，合法落点中的真实 candidate 与提交后节点在组件、Props、Slots、宽高和嵌套布局上保持一致。
- [x] AC2 拖拽取消、提交、页面切换、只读切换和组件卸载后不残留 candidate、Overlay、动画帧、监听器或 Model 修改。
- [x] AC3 v1 Project 能确定性迁移为单页 v2 Application；现有数据可打开、编辑、保存、重开，迁移失败不破坏旧数据。
- [x] AC4 顶部不存在 Page 切换控件；左侧 Pages 可切换全部页面，未保存保护与当前页面 Undo/Redo 正常。
- [x] AC5 Page Manager 覆盖搜索、新建、重命名、复制、删除、排序、路由和首页设置，并拒绝重复路由、无首页和删除最后页面。
- [x] AC6 Source 弹窗以可折叠层级树展示同一快照中的完整多页面工程；键盘操作、焦点、选择、Monaco 内容与 ZIP 一致。
- [x] AC7 Source 工程包含 `package.json`、路由和所有页面，不导入 ConfigForm 包；Config 导出仍为只读 defineField 源码/JSON/Tree。
- [x] AC8 Core、Runtime 依赖检查无反向依赖；Designer、Workbench 的单测、类型检查、Lint、生产构建全部通过。
- [x] AC9 完成桌面、窄屏、亮色、暗色浏览器验证，并对拖拽、多页面迁移、Page Manager 和文件树执行反证式边界检查。
