# ConfigForm 工作台移动端与国际化一致性

## 目标

让内置 Profile 工程在 Designer 与 Preview 的平板、手机视口中呈现可用的单列布局，并让独立 Workbench 的所有产品文案在 `en-US` / `zh-CN` 间完整、即时、一致地切换。用户看到的 Designer、Preview、Pages、Flow、Export 和辅助视图必须使用同一 locale，不能再出现中英文混杂。

## 背景与事实

- `packages/ConfigForm/workbench/src/project/templates/create-template.ts:86` 的 Profile 表单声明为 24 列，Name / Role 各占 12 列，但没有 `form.responsive`；模板描述却声称包含 responsive fields。
- `packages/ConfigForm/runtime/src/renderer/responsive.ts:26` 只应用显式 responsive override；既有规范要求“未配置 responsive 时各断点保持桌面数值语义”，因此 Runtime 不能增加隐式移动端兜底。
- `packages/ConfigForm/playground/src/designer/sample-document.ts:14` 已有经过浏览器验证的模板值：tablet `{ columns: 12, fieldSpan: 12 }`、mobile `{ columns: 1, fieldSpan: 1 }`。
- `packages/ConfigForm/designer/src/locale.ts:14` 已提供 `DesignerLocaleOptions` 与 `createDesignerLocale`；FlowWorkspace 已消费该契约，但 App、PageManager、Export、Preview 和辅助导航仍有大量硬编码英文，Export 菜单还包含固定中文。
- 独立 Workbench 当前由 `main.ts` 直接挂载 `<App />`，没有用户可操作的语言入口。仅保留一个可选 prop 不足以证明独立产品支持国际化。

## 需求

### R1. 内置模板响应式真值

- Element Plus 与 Ant Design Vue Profile 模板共用的 Designer document 必须写入 tablet `{ columns: 12, fieldSpan: 12 }` 与 mobile `{ columns: 1, fieldSpan: 1 }`。
- Workbench 的 Designer breakpoint 与右侧 Preview viewport 继续只投影 Config Model；不得为 Preview 维护第二份布局规则。
- Runtime 的 `resolveConfigFormLayout` 兼容语义保持不变：没有 responsive 的用户页面在所有断点继续使用其原始数值配置。
- responsive 是现有 schema 内的可选内容，本次保持模板协议版本 1。新建或显式 Reset 的工程获得当前模板布局；已有工程不自动迁移、不覆盖用户已编辑的 form 配置。

### R2. Workbench locale 单一边界

- 增加类型化的 Workbench 文案目录，完整覆盖 App、PageManager、FlowWorkspace、PreviewRuntimeBoundary、ProjectFileTree、WorkspaceCodeEditor、模板选择器、导出弹窗、空状态、已知错误状态、title 和 aria-label。
- 内置 `en-US` 与 `zh-CN`；英文是未知 locale 和缺失 key 的确定性回退。
- Workbench locale 与当前 adapter 的 Designer material locale 合并后，同时传给 ConfigFormDesigner、PageManager 与 FlowWorkspace。调用方自定义 `messages`、`materials`、`translate` 保持最高优先级。
- 禁止新增第三套翻译函数或在组件内复制 message map；插值继续复用 `createDesignerLocale` 的 `{param}` 契约。

### R3. 独立站点语言交互

- 顶栏提供紧凑的语言下拉按钮，使用熟悉的语言图标、明确 tooltip 和菜单语义；不挤压 Save、Export、Flow、Preview 等核心操作。
- 初次打开跟随浏览器语言（中文族映射 `zh-CN`，其余回退 `en-US`），之后记忆用户选择；切换立即更新可见文案、title、aria-label 和 `document.documentElement.lang`。
- 390px 窄屏下语言菜单、Export 菜单和顶栏操作不得换行、越界或遮挡。

### R4. 国际化工具边界

- Workbench 文案作为普通、可静态分析的资源目录维护，可由现有 `@moluoxixi/i18n-tool` 的构建期工作流生成或校验。
- 浏览器运行时不依赖翻译服务，不读取、不存储 API key，不发起 AI 翻译请求。

### R5. 验证

- 单元测试覆盖 locale 选择、目录完整性、插值、调用方覆盖优先级和模板版本/响应式 model。
- 组件测试覆盖 PageManager、FlowWorkspace 与关键 Workbench shell 在两种 locale 下的可见文本及可访问名称。
- 浏览器验证 1440px、900px、390px 的 Designer/Preview 响应式一致性，以及 Light/Dark 下两种 locale 的菜单、弹窗和顶栏布局。
- Workbench test、typecheck、build 和 Profile 真实导出工程的 typecheck/build 必须通过。

## 验收标准

- [ ] AC1：新建 Element Plus / Ant Design Vue Profile 后，desktop 的 Name / Role 保持双列，tablet 和 mobile 的 Designer 与 Preview 均为单列；两侧使用同一 Config Model responsive 值。
- [ ] AC2：没有 responsive 的既有用户 model 经过 parse、保存和 Runtime 渲染后语义不变；任务不包含静默迁移。
- [ ] AC3：切换 `en-US` / `zh-CN` 后，Workbench、Designer、Pages、Flow、Preview 与 Export 同步更新，不出现固定中文混入英文或固定英文混入中文。
- [ ] AC4：用户选择会被记忆，重新加载后恢复；未知或损坏偏好安全回退，`html[lang]` 与当前语言一致。
- [ ] AC5：调用方注入的 `translate` / `messages` / `materials` 继续覆盖内置目录，Flow 的参数插值和 Designer material 本地化正常。
- [ ] AC6：390px 下语言/导出菜单和顶栏操作不换行、不越界、可键盘操作；1440px / 900px / 390px 的 Light/Dark 截图无新增重叠或横向溢出。
- [ ] AC7：范围内测试、类型检查、构建和两套 Profile 真实导出工程验证全部通过。

## 非目标

- 不改变 Config Model、Runtime responsive resolver 或任意已有用户页面的数据。
- 不翻译用户输入的项目名、页面名、路由、字段 label、选项和生成源码内容。
- 不在本任务重构 Designer adapter 内部 setter 文案，也不增加第三种语言。
- 不替换 Monaco 自带的 NLS bundle，也不翻译源码标识符、API 名称和代码补全文档；Workbench 自有的编辑器 region/status 文案仍需本地化。
- 不把 `@moluoxixi/i18n-tool` 或任何 AI Provider 作为 Workbench 浏览器运行时依赖。
