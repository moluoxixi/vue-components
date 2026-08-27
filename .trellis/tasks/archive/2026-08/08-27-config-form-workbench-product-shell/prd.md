# 在线工作台产品界面与集成

## 目标

把项目、Config、Designer、Source、Page Preview、模板、诊断和导出组合为可直接使用的在线网站工作台。

## 范围

- 内置模板选择与项目创建入口；有项目时首屏直接进入编辑工作区，不显示项目列表首页。
- 中央编辑区以 `Source / Config / Designer` 三个 provider tabs 切换。
- Source provider 使用 Monaco 编辑当前单页源码 `src/App.vue`，不展示项目文件树。
- Config provider 使用同一代码编辑器编辑 `src/form.config.ts` TypeScript 配置；合法静态配置实时投影到 Designer 与 Preview，无效草稿保留诊断。
- Designer provider 直接嵌入完整 `ConfigFormDesigner`，编辑同一个受控文档。
- Page Preview 固定在右侧并可展开/收起，展示当前最后有效文档及 revision/stale 状态。
- 项目重置、导出和持久化反馈。
- 桌面、中宽和窄屏工作区、键盘焦点、无障碍与视觉回归。
- 集成 `08-27-config-form-designer-ux` 的 Designer 专项优化。

## 验收标准

- [ ] 用户无需阅读功能说明即可从模板创建项目并完成编辑、预览和导出。
- [ ] 有项目时页面呈现三 provider 编辑区和右侧可折叠 Preview，而不是模板/项目列表首页。
- [ ] 三模式与 Preview 的 revision、draft、stale、error 和 saving 状态清晰可辨。
- [ ] 桌面和 390px 窄屏不存在不可达命令、重叠或非预期横向溢出。
- [ ] Chromium 主流程及 Firefox/WebKit 冒烟通过。

## 依赖与非目标

- 依赖项目内核、三模式同步与实时 Preview 子任务。
- 不实现营销 landing page、账号协作、项目导入或云端部署。
