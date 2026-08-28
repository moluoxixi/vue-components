# 在线项目内核与模板导出

## 目标

为在线工作台建立版本化虚拟项目、受控 Vue 3 + Vite 模板、revision 事务、本地持久化与完整源码导出。

## 范围

- 新建 private app `packages/ConfigForm/workbench`，项目内核位于 `src/project/`，不改变现有 ConfigForm Playground 的集成验证职责。
- 定义 `WorkspaceProject`、manifest、虚拟文件、路径安全、revision 与原子提交协议。
- 内置模板注册、模板版本与迁移入口；首版至少包含一个 Element Plus 与一个 Ant Design Vue 模板。
- 项目创建、重置、克隆快照，以及 memory / IndexedDB repository。
- 扩展现有 IndexedDB 包的单 key 原子 `updateItem`，保证跨连接 compare-and-swap 不丢更新。
- 生成完整 `package.json`、Vite config、类型配置、入口、页面、样式、表单 artifact 与声明式 form module，并使用精确依赖版本。
- 使用 `fflate` 生成 ZIP，并提供浏览器下载。
- 仓库内标准 Node/Vite 构建验证 fixture，验证模板导出而非 workspace symlink。

## 验收标准

- [ ] 相同模板和输入生成确定性的文件树与 revision。
- [ ] 非法路径、重复文件和过期 base revision 被明确拒绝。
- [ ] Memory 与 IndexedDB repository 通过相同 contract suite；draft 与 committed snapshot 隔离。
- [ ] 导出 ZIP 文件完整，解压后通过类型检查与 Vite build。
- [ ] 模板 registry 可扩展但首版不允许任意外部模板执行代码。
- [ ] IndexedDB 不可用时上层能识别 volatile repository，不会误报持久化成功。

## 依赖与非目标

- 这是首个实施子任务，无前置代码依赖。
- 不包含三模式编辑器、浏览器运行、账号、服务端存储或部署。
