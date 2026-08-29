# 实施计划

- [x] 定义 immutable ExportSnapshot 及创建、stale 判定、刷新和 selection fallback。
- [x] 实现 `buildProjectFileTree`、稳定排序、文件类型图标映射和 visible-node 导航纯函数。
- [x] 实现 `ProjectFileTree` 的层级 DOM、ARIA、roving tabindex 与完整键盘交互。
- [x] 将 Source 导出弹窗接入文件树和 snapshot；Monaco/ZIP 改为只读同一对象。
- [x] 增加二进制文件占位、stale 提示和显式刷新。
- [x] 优化桌面与 320px 窄屏布局，修复单行/溢出和亮暗主题对比度。
- [x] 运行 Workbench 单测、类型检查、Lint、构建与浏览器键盘验证。

## 回滚点

- Tree builder 和 snapshot 先以独立模块落地；旧平铺 UI 保留到组件测试通过。
- 新文件树接入失败可回滚 UI，snapshot 契约和一致性测试继续保留。
