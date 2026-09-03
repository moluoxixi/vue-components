# ConfigForm Workbench 设计器视觉精修实施计划

## 1. 开发前

- [ ] 主题子任务完成且 semantic token/DOM 属性冻结后，启动本子任务并加载 `trellis-before-dev`。
- [ ] 记录 1440/900/390 的四区尺寸、Canvas/iframe/selection rect、命令可见性与两 Provider computed-style 基线。
- [ ] 核对 Designer property-control registry 已覆盖 text/textarea/number/boolean/select，避免重复造控件。

## 2. 排版与表面

- [ ] 在 Workbench 样式中统一 12–13 像素正文/控件层级，将 9 像素导航和 meta 提升到可扫读尺寸。
- [ ] 固定工具栏、面板标题、icon button 和 badge 的稳定尺寸，所有字距设为 0。
- [ ] 使用主题 semantic token 重整 workspace/panel/control/line/selection/focus/status 层级，清理局部硬编码品牌色。
- [ ] 保持页面 section 无嵌套卡片、无装饰渐变或无业务含义的大片留白。

## 3. Canvas Framing

- [ ] 仅在父文档 Canvas host 外围增加中性 well、可见边界与克制阴影。
- [ ] 不修改 DesignRuntimeHostFrame payload、iframe CSS、viewport、transform 或测量服务。
- [ ] 对 desktop/tablet/mobile breakpoint 分别比对 Canvas、iframe、selection 和 drop geometry，误差不超过 1 像素。

## 4. 响应式命令

- [ ] 在 641–900 像素为保存、导出、组件、属性增加 Lucide 图标 + 本地化短文字。
- [ ] 保留其余命令的现有 overflow/Tooltip/快捷键/disabled reason，并验证关闭后焦点返回 trigger。
- [ ] 640 像素及以下保持紧凑顶栏与五项带文字底栏，不增加重复入口。
- [ ] 粗指针环境把关键操作命中区提升到至少 44×44，验证不遮挡 Canvas。

## 5. 属性控件

- [ ] 审计 Inspector 中 enum/boolean/number 的 setter 定义与 adapter control 映射。
- [ ] 少量 enum 保持 segmented；较多/长标签 enum 使用现有 adapter Select；boolean/number 使用 adapter Switch/InputNumber。
- [ ] 只有测试证明 adapter 映射缺口时才修改 designer adapter；Designer 核心不得 import Element Plus 或 Ant Design Vue。
- [ ] 保留 inherited value、hint、commit、Enter/Escape、readonly 与 validation 行为。

## 6. 验证

- [ ] 更新/增加 WorkbenchTopbar、PropertyPanel 和响应式组件测试。
- [ ] 增加 900/390 命令文字、可达性、无横滚与触控尺寸 E2E。
- [ ] 重跑 selection、drag、resize、camera、drop candidate、Preview、属性 commit 与 command 快捷键回归。
- [ ] 执行 geometry 1px 门禁和两 Provider Runtime computed-style 隔离检查。
- [ ] 在主题任务的视觉矩阵内人工检查 1440/900/390、zh/en，不新增冗余快照。
- [ ] 运行：
  - `pnpm --filter @moluoxixi/config-form-designer test`
  - `pnpm --filter @moluoxixi/config-form-designer typecheck`
  - `pnpm --filter @config-form/workbench test`
  - `pnpm --filter @config-form/workbench typecheck`
  - `pnpm --filter @config-form/workbench build`
  - `pnpm --filter @config-form/workbench test:e2e`
  - `pnpm lint`
  - `git diff --check`

## 6.1 组件级 Sass

- [ ] 将 Designer 单体 `styles.scss` 拆为共享 foundation、公开组件样式和组合入口。
- [ ] 为每个公开视觉组件增加 Element 风格的 `style/index.scss`，并在 package exports 暴露按需路径。
- [ ] 保留 `./styles` 完整入口，增加 Sass 编译测试和无关选择器缺席断言。
- [ ] 删除 Designer 标签级 input/textarea/select focus 覆写，为自有原生控件保留明确的类级键盘焦点。
- [ ] 将 Workbench 左侧物料面板样式迁到组件 Sass，保留全局主题和 Designer/Provider bridge。
- [ ] 在真实浏览器以 Tab 聚焦物料搜索，断言 `.el-input__inner` 无 outline 且 Element wrapper 为唯一焦点框。

## 7. 评审与回滚

- [ ] 独立确认 diff 未触及 Project Model、History、Command、RuntimeHost schema 或 Runtime styles。
- [ ] 独立确认四个 900 入口与五项 390 dock 没有重复命令或焦点陷阱。
- [ ] geometry、Runtime 隔离或核心交互任一失败时，不启动模板页子任务。
