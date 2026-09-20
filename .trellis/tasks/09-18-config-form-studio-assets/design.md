# Studio 项目资产与独立设计面技术设计

## 1. 现状与最小行为差距

Surface、Project transfer、IndexedDB Repository、自动保存和单 Surface Designer 已经落地。当前缺口集中在 Studio 作者入口：项目生命周期命令不完整，左侧 Surface 仍以单列表展示，Dialog/Drawer 的 presentation 缺少明确作者界面，引用阻止诊断没有在资产操作中完整呈现。

本任务只补齐资产与设计面闭环，不实现 Dataset 内容编辑、物料扩充、Prototype Interaction 作者 UI 或 Experience reducer。

## 2. 所有权与数据流

```text
Studio UI
  -> Workbench controller commands
  -> Project editor session / Model command history
  -> autosave coordinator
  -> ProjectRepository

Project import
  -> Project transfer v1 Reader
  -> complete metadata + embedded bytes validation
  -> one atomic Repository create
```

- Model 继续拥有 Surface add/remove/move/rename/route/home/presentation 与引用完整性。
- Workbench 组合根拥有项目 create/open/rename/duplicate/import/export/delete，以及焦点、通知和当前项目切换。
- Repository 继续拥有持久化原子性和 embedded bytes；UI 不绕过 Repository 直接写 IndexedDB。
- Designer 只接收当前 SurfaceGraph。Page、Dialog、Drawer 的外壳由 Workbench 根据 Surface kind/presentation 组合，不把外壳伪装为内容节点。

## 3. UI 结构

- 项目管理入口展示本地项目，提供打开、重命名、复制、导入、导出和删除。
- 资产导航固定分组为 Pages、Dialogs、Drawers、Datasets、Resources；本任务使前三组可用，后两组保留稳定入口并由数据集任务补齐编辑器。
- Surface 列表支持搜索、计数、选中和上下文操作。直接点击资产重置调用路径。
- Dialog/Drawer 使用结构化 presentation 编辑器；尺寸仍使用 `ResponsiveLength`，关闭策略使用既有判别合同。

## 4. 命令与失败语义

- Surface 修改必须作为一个 Project command 进入同一 history，可撤销且由自动保存发布。
- 删除被引用 Surface 时沿用 Model 的 `PROJECT_SURFACE_REFERENCED` 诊断，UI 显示引用来源，不做级联删除。
- 项目重命名通过项目级 Model operation 进入 history；稳定 project id 不变。
- 项目复制读取完整 Project transfer（包括 embedded bytes），分配新项目与内部身份后再原子创建，不能只复制 metadata。
- 删除当前项目前确认；Repository 删除成功后刷新列表并打开下一项目。失败时保留当前会话和可见错误。
- 导入必须先完成 transfer Reader、Registry 和 embedded content 校验，再创建 Repository 实体；失败不发布部分实体或孤儿 bytes。

## 5. 兼容与边界

- 不新增旧版本 Reader、迁移器或兼容别名。
- 不将 Surface 注册为 Material。
- 不恢复事件编辑器、事件转发、HTTP、任意函数或动作链。
- 不新增另一套持久化状态；ProjectDocument 和 Repository 仍是唯一事实源。

## 6. 验证

- Model/Workbench 单测覆盖项目重命名、Surface presentation、引用阻止、Undo/Redo 和 Repository 生命周期。
- Workbench 组件测试覆盖资产分组、搜索、上下文操作、焦点恢复和窄屏可达性。
- Playwright 覆盖项目列表 -> 项目 -> Page/Dialog/Drawer 设计面、刷新恢复、引用阻止、390/900/1440 布局与 axe。
- 运行 Workbench typecheck/build、ConfigForm 包门禁、架构门禁和 frozen lockfile 校验。
