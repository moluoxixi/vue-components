# 修复文档审查缺陷与测试盲区

## 目标

修复文档审查中已复现的用户侧缺陷和 CI 测试盲区，使开发、构建、预览、双语内容以及主题独立消费链路都能被自动化验证。

## 背景

- 文档和主题单元测试、类型检查及默认 GitHub 构建通过，但主题响应式 E2E 仅有 4/13 通过。
- `docs/vitepress` 的 `preview` 绕过主题 CLI，缺少已解析默认分支并稳定失败。
- HeadlessTable 中英文文档将插槽返回的动态组件写成静态 `<Cell>`，浏览器报无法解析组件。
- 主题 consumer fixture 的作者内容不在配置的 `content/` 目录，`/content.html` 不存在并回落首页，使公共 API E2E 失真。
- 主题 E2E 未进入根命令和 GitHub CI。
- 英文 Utilities 路由复用了中文 README，且英文工具映射不完整。
- 仓库入口在非 GitHub provider 下仍固定展示 GitHub 图标。

## 需求

1. 所有受支持的文档生命周期入口都必须通过主题 CLI 获取相同的 prepare 和仓库上下文。
2. HeadlessTable 中英文 Demo 必须无 Vue 运行时组件解析警告并正常渲染。
3. 主题独立 consumer fixture 必须遵循最新 `.generated/content` 投影契约，E2E 必须命中真实测试页而非 404 回退页。
4. 根 E2E 和 GitHub browser CI 必须运行主题 E2E，并保留失败诊断产物。
5. 英文 Utilities 不得静默展示中文正文；只有存在明确英文来源的工具才生成英文详情路由和侧栏项。
6. GitHub、GitLab、Gitee、云效和 Local 的仓库入口必须展示与 provider 一致且可访问的图标或标识。
7. 更新已经因内容结构调整而过期的目录断言和截图基线，但不得通过放宽断言掩盖运行时错误。
8. 文档工程与主题包按职责组织源码：feature 根目录仅保留 barrel/入口，Node 生命周期、Markdown 插件、项目配置、仓库配置和工具分别进入可定位的职责目录；每个实际存在的职责目录提供 `index.ts`，不得保留仅转发旧路径的兼容文件。

## 验收标准

- [x] `pnpm -C docs/vitepress preview` 能启动已构建文档，不再报告缺少默认分支。
- [x] HeadlessTable 中英文页面无 `Failed to resolve component: Cell`。
- [x] 主题 consumer E2E 访问 `/content.html` 时确认真实页面路径、Demo、Playground 和 ApiDocs 均可用。
- [x] 根 `test:e2e` 和 CI browser job 包含主题 E2E。
- [x] 英文 Utilities 页面不存在中文正文回退，英文侧栏不出现无英文来源的详情项。
- [x] 各 repository provider 的导航标识与当前 provider 一致。
- [x] 主题与文档的类型检查、单测、构建和 E2E 全部通过。
- [x] `.generated` 和 Playwright 运行产物保持未跟踪，现有 ConfigForm 改动保持原样。
- [x] `docs/vitepress/.vitepress` 与主题包 Node/Markdown 源码可按目录直接定位职责，内部导入通过当前 feature barrel，npm 公开入口和运行行为保持不变。

## 范围外

- 不重写浏览器端 SFC 编译器，也不在本轮完成 `vue3-sfc-loader` 的架构替换。
- 不修改仓库 provider 的 API 数据契约、同步策略或失败语义。
- 不为缺少英文来源的中文 README 自动机器翻译。

## 验收证据

- Docs：11 个测试文件、52 项测试通过；typecheck 与 Local provider 生产 build 通过，生成 26 个组件路由、8 个工具路由和 13 个 API 契约。
- Theme：31 个测试文件、227 项测试及 consumer build 通过；完整 Playwright 17/17 通过，四张 Windows 明暗基线已逐张复核并再次严格通过。
- Preview：`pnpm -C docs/vitepress preview --port 5322` 完成 prepare 后启动；`/components/copy-text.html` HTTP 200，浏览器渲染 `CopyText` 且无 console/page error。
- AI Doc：公共入口发现器修复后 28 个测试文件、223 项测试通过；`ElementConfigForm` 与 `AntdConfigForm` 均从各自根入口生成命名契约。
- Root/CI wiring：release/path 检查 35 + 8 项通过；根 `test:e2e` 和 browser CI 均包含 Theme functional E2E 与失败产物上传。
- `.generated`、`.playwright` 和 VitePress cache 由 `.gitignore` 管理且未跟踪；两个既有 ConfigForm 用户改动未纳入本任务提交。
- 最终独立只读复核无 findings。
