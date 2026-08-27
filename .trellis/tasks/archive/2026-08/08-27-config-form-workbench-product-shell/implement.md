# 在线工作台产品界面实施计划

1. [x] 增加 Monaco direct dependency 与 `WorkspaceCodeEditor`，支持页面/配置 model、语言、resize、保存快捷键和清理。
2. [x] 重构 App 为 Topbar + Source / Config / Designer 三 provider + 右侧可折叠 Preview。
3. [x] 将公开 `defineFields / defineField` Config、DesignerDocument 与当前页面 project artifact 建立同步，`src/form.config.ts` 直接作为 Source 运行模块。
4. [x] 接入 Element/AntD Designer registry、Renderer Preview 与 Source SFC Sandbox Preview。
5. [x] 实现项目选择保护、模板创建、Save、Export、dirty/revision/storage/stale 状态。
6. [x] 完成桌面与窄屏 Edit / Preview 布局、对话框键盘边界和 Browser 验证。
7. [x] 运行 Workbench unit/type/build、模板真实性与 scoped lint。

## 本轮交互与预览补强

- [x] Workbench provider tabs 与移动端 Edit / Preview tabs 使用标准 `aria-selected`、roving `tabindex`、Arrow/Home/End 键盘导航。
- [x] Designer 按容器宽度切换 desktop / medium / narrow；窄屏使用 Palette / Canvas / Properties tabs，并在拖放后回到 Canvas。
- [x] Designer Import / Export / Preview 对话框支持初始焦点、Tab focus trap、Escape 关闭和关闭后焦点恢复。
- [x] Source 预览使用成功实例与候选实例分离模型；编译失败时保留最后有效页面并提供状态提示，避免错误草稿替换可用预览。
- [x] 项目快速切换、组件卸载期间异步初始化、Save / Create 重入均有竞态保护；Config / Designer 同步后保留已有预览输入值。
- [x] Designer 桌面与中宽模式支持独立隐藏/恢复 Materials 与 Properties 面板，收起后画布自动扩展；窄屏继续使用单面板 tabs。
- [x] Palette 字段物料拖拽时展示真实运行时控件的半透明跟手浮层；容器物料使用轻量摘要，Sortable 使用 180ms 动画，投放区与 ghost 使用高对比 2px 虚线。

## 本轮延期

- Source 任意 Vue 文件驱动完整 Page 的浏览器编译由 `live-preview` 子任务完成。
- AST 三方合并和超出 Designer 子集的 capability 由 `three-mode` 子任务完成。

## 验证结果

- [x] Workbench unit：56 passed（含 Monaco worker 路由、import 上下文隔离、SFC TypeScript mirror 与声明回归）。
- [x] Workbench typecheck、scoped ESLint、production build。
- [x] 两套导出模板 tarball install、typecheck、Vite build。
- [x] Browser：Source SFC 实时驱动右侧 Page、Config / Designer 驱动 Renderer Preview、无效 draft、项目切换保护、Preview 展开/收起、390px Edit / Preview 切换。
- [x] 两套模板的 `src/form.config.ts` 均通过真实 tarball 安装、`vue-tsc` 与 Vite build。
- [x] Browser：Source / Config 的真实 TypeScript completion 与 Hover；Vue、Element、headless、项目依赖和 `./form.config` 模块路径/命名 import 隔离；Vue 高亮、折叠与 worker 无运行错误。
- [x] Browser：390px / 820px 响应式检查无页面级横向溢出；Designer 对话框焦点循环、Escape 与焦点恢复；Source TypeScript 编译错误显示 `Last valid` 并保留上一份页面。
- [x] Designer unit：92 passed；Browser 实际拖入 Input 时捕获真实半透明控件、清晰投放边界，节点落入成功且测试节点已撤销，未产生新的浏览器 warning/error。

## 已知边界

- Source iframe 内部运行时异常仍由 `@vue/repl` 自身处理；当前已覆盖 SFC 解析与文件编译错误的 last-valid 保护，未将 REPL runtime error 通道重新建模到父级状态。
- 根 ESLint 对 Designer 的显式 `.vue/.scss` 路径没有匹配规则，但全仓 `pnpm exec eslint .` 通过；调整全局 lint 配置不属于本轮功能范围。
