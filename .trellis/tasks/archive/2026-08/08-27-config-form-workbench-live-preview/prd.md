# 浏览器实时页面运行与诊断

## 目标

复用仓库现有 Vue REPL 基础，把成功的虚拟项目 revision 编译并运行成实时 Page Preview，同时可靠处理并发、错误和 stale 状态。

## 范围

- WorkspaceProject 到 REPL 多文件 store/import map 的投影。
- build id / revision 竞态控制、旧结果丢弃与运行资源清理。
- compile、runtime、console 和 ConfigForm diagnostics。
- 最后成功 artifact、stale 标记、刷新和预览 viewport。
- 首版允许依赖白名单与浏览器可执行能力边界。

## 验收标准

- [ ] 成功 revision 在 Preview 中渲染，快速连续提交只发布最新结果。
- [ ] 编译或运行失败保留最后成功页面并显示当前 revision 诊断。
- [ ] Preview 支持桌面、平板、移动尺寸且无空白画布。
- [ ] 运行时资源和监听器在切换项目或卸载时释放。

## 依赖与非目标

- 依赖项目内核；与三模式任务通过 project revision 协议集成。
- 不提供在线 Node、任意 npm、任意 Vite plugin 或部署。
