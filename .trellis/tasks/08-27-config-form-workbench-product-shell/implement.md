# 在线工作台产品界面实施计划

1. [x] 增加 Monaco direct dependency 与 `WorkspaceCodeEditor`，支持页面/配置 model、语言、resize、保存快捷键和清理。
2. [x] 重构 App 为 Topbar + Source / Config / Designer 三 provider + 右侧可折叠 Preview。
3. [x] 将公开 `defineFields / defineField` Config、DesignerDocument 与当前页面 project artifact 建立同步，`src/form.config.ts` 直接作为 Source 运行模块。
4. [x] 接入 Element/AntD Designer registry、Renderer Preview 与 Source SFC Sandbox Preview。
5. [x] 实现项目选择保护、模板创建、Save、Export、dirty/revision/storage/stale 状态。
6. [x] 完成桌面与窄屏 Edit / Preview 布局、对话框键盘边界和 Browser 验证。
7. [x] 运行 Workbench unit/type/build、模板真实性与 scoped lint。

## 本轮延期

- Source 任意 Vue 文件驱动完整 Page 的浏览器编译由 `live-preview` 子任务完成。
- AST 三方合并和超出 Designer 子集的 capability 由 `three-mode` 子任务完成。

## 验证结果

- [x] Workbench unit：34 passed。
- [x] Workbench typecheck、scoped ESLint、production build。
- [x] 两套导出模板 tarball install、typecheck、Vite build。
- [x] Browser：Source SFC 实时驱动右侧 Page、Config / Designer 驱动 Renderer Preview、无效 draft、项目切换保护、Preview 展开/收起、390px Edit / Preview 切换。
- [x] 两套模板的 `src/form.config.ts` 均通过真实 tarball 安装、`vue-tsc` 与 Vite build。
- [ ] 本轮浏览器复核受 localhost URL 安全策略阻断；此前界面验证结果保留，需人工刷新检查新的 Config 源码和补全菜单。
