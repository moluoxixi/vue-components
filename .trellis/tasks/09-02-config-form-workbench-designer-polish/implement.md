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

## 6.2 表单尺寸设置

- [ ] 将 Gap setter 改为 0–64 数字控件，并在 Designer 边界完成 number 与规范 px 字符串互转。
- [ ] 在 FormSettings 严格 schema 中验证 gap px 格式与 labelWidth 0–480 整数。
- [ ] 将 labelWidth 接入 Vue backend 与 ConfigFormRenderer 左标签 grid。
- [ ] 为 Workbench 新建模板写入 120px 默认标签宽度，并同步编辑器声明与 Config/Source 导出。
- [ ] 覆盖 Tablet/Mobile Columns/Field span 的 min/max/整数提交与窄 Inspector 几何。
- [ ] 抽取 `DesignerBreakpointLayoutSettings`，让三个断点复用 Columns/Field span/Label width 的 DOM、setter 与样式。
- [ ] 为 responsive override 增加 labelWidth，并同步 Runtime CSS variable、container query 与 standalone Source export。
- [ ] 运行 model、runtime、vue-backend、designer、workbench 的相关单测、typecheck、build 和 E2E。

## 6.3 简化字段物料注册

- [ ] 在 Designer Registry 增加字段物料声明类型与 `defineDesignerFieldMaterial()`，自动生成 props/defaultValue setters 和 JSON-safe 独立节点默认值。
- [ ] 将 Element Plus 与 Ant Design Vue registry factory 收敛为 `{ materials, layers, optionResolver }` 对象参数，并迁移 Workbench 调用点。
- [ ] 使用两套 Provider 的 Input 内置物料验证高层工厂，同时保留布局和复合物料的底层 factory。
- [ ] 更新 ConfigForm 架构 README、material registry spec 与独立包 consumer smoke。
- [ ] 运行 Designer、两套 Designer adapter、Workbench 的 test/typecheck/build，以及 `pnpm test:config-form-packages`、lint 和 `git diff --check`。

## 6.4 物料注册结构收敛

- [ ] 将 Core `createDesignerRegistry` 改为 `{ materials, layers, rendererNamespace }` 对象参数，并迁移所有直接调用。
- [ ] 将字段物料 factory 的字段名、默认值和 setter 转换拆到私有 `registry/utils`。
- [ ] 将两套 Adapter 的 `materials/shared.ts` 拆为职责目录下的 `index.ts`，`shared/index.ts` 仅聚合，并保持 glob 只扫描叶子物料。
- [ ] 迁移可严格等价的普通字段物料到 `defineDesignerFieldMaterial()`，增加 setter 顺序和完整节点默认值矩阵。
- [ ] 检查 option composable 只保留响应式/注入职责；纯函数继续归属 utils，不新增无状态 hook。

## 7. 评审与回滚

- [ ] 独立确认 diff 未触及 Project Model、History、Command、RuntimeHost schema 或 Runtime styles。
- [ ] 独立确认四个 900 入口与五项 390 dock 没有重复命令或焦点陷阱。
- [ ] geometry、Runtime 隔离或核心交互任一失败时，不启动模板页子任务。
