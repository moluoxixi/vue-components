# 模板管理仓库证据与设计研究

## 研究结论

模板管理应先于 JSON 导入实施。它建立 App 级创建工作区、显式创建目标、Provider/catalog service、identity remap 和 Runtime 预览边界；JSON 导入随后只需增加一种受校验的创建来源，而不重复导航、筛选、确认和原子创建 UI。

## CodeGraph 证据

- `packages/ConfigForm/workbench/src/app/WorkbenchShell.vue:25,472-500`：Designer 壳直接导入 `TemplateDialog`，并同时渲染首屏模板列表和 Dialog。
- `packages/ConfigForm/workbench/src/app/workbench-ui-store.ts:57,145-154`：模板 UI 只有 `templatePickerOpen`，`openPageTemplatePicker` 通过关闭 Page Manager 再打开 Dialog。
- `packages/ConfigForm/workbench/src/app/workbench-controller.ts:443-496`：项目创建直接读取内置 Map、用 `Date.now()` 生成 id；页面创建已经通过一个 `page.add` transaction。
- `packages/ConfigForm/workbench/src/app/workbench-controller.ts:795-799`：`selectTemplate` 根据 `currentProject` 隐式选择 project/page，缺少显式用户意图。
- `packages/ConfigForm/workbench/src/project/templates/types.ts:14-22`：manifest 不含 category、requirements、preview 或 provider 信息，且把工厂函数放在 entry 上。
- `packages/ConfigForm/workbench/src/project/templates/create-template.ts:28-156`：两套 profile graph 使用固定 node/field id，Registry 只校验模板 id 格式和重复。
- `packages/ConfigForm/workbench/src/project/page-actions.ts:55-62`：`duplicateProjectPage` 仅 structuredClone 并替换 page identity，不重映射内部 identity。
- `packages/ConfigForm/workbench/src/runtime-host/PreviewRuntimeHostFrame.vue:20-211`：预览 iframe 接收 data-only compilation/state/projection，可直接复用。
- `packages/ConfigForm/model/src/schema.ts:353-359`：`createProjectSnapshot` 能从内存 ProjectDocument 创建严格快照。
- `packages/ConfigForm/compiler/src/compile.ts:152-240`：`compileCanonicalPage` 可对候选 snapshot + Registry snapshot 做页面级 fail-closed 编译。
- `packages/ConfigForm/workbench/src/components/PageManager.vue:25-30` 与 `features/pages/PageManagerDialog.vue:17-22`：当前只发出 `createPage`，适合增加语义 `createProject` 事件而不加入模板状态。
- `packages/ConfigForm/workbench/src/app/__tests__/architecture-boundary.test.ts:101-166`：现有架构测试已经禁止 controller/shell 直接编译 Runtime，新的 preview compiler 应归 feature service。

## 测试缺口

- CodeGraph 报告 `TemplateDialog`、`openTemplatePicker` 没有直接覆盖。
- `src/project/__tests__/templates.test.ts` 只验证两套 profile、基础 schema 和非法/重复 id；未覆盖深拷贝、identity、Registry compatibility、Provider failure 或 preview。
- `e2e/helpers.ts` 依赖 `dialog[name="New page"]`，E2E 入口与独立工作区目标冲突。
- 现有视觉矩阵在创建项目后截图，没有创建工作区自身的 1440/900/390、主题和双语证据。

## 成熟库与复用判断

- UI 继续使用已安装的 Element Plus 控件与 Lucide 图标；不自行实现输入、筛选、loading、focus ring 或图标 SVG。
- 编译与预览复用 ConfigForm Model schema、Compiler 和 RuntimeHost；不手写第二套 schema parser 或 Runtime renderer。
- 不新增 Vue Router。Workbench 当前是可嵌入单页应用，`designer | create` App 级视图枚举能满足独立工作区和返回语义；新增 URL 路由会引入宿主 base/history 合同，但没有当前产品价值。
- identity remap 没有可复用的完整现有实现；`duplicateProjectPage` 只深拷贝。应在 project 层建立一个可供模板和后续 JSON import 共用的严格纯函数。

## 视觉研究

现有 1440px Workbench 是高密度三栏 IDE，使用清晰 1px 边界、4px 控件圆角、蓝色交互强调和真实 Runtime 画布。创建工作区应延续这一语言，而不是做营销式模板图库：

- 连续目录列表承担扫描与比较；右侧由真实 RuntimeHost 主导。
- selected rail 同时表达选中和 Registry compatibility，是唯一强视觉签名。
- 使用现有 Light/Dark token，避免新的一色主题、渐变、装饰 orb 或嵌套 card。
- 390px 将目录与详情变为两个明确 pane，避免把双栏缩成不可读卡片。

## 需要在实现阶段验证的技术点

- Registry requirement 的 exact version/fingerprint 是否应由 built-in manifest 固化，或由 release-coupled local provider 只声明 component key 后使用当前 lock；实现应选择能让 compiler 与可解释诊断一致的最窄合同。
- Flow action opaque config 不具备通用字段引用 schema；identity remap 必须只处理正式 typed config，并对无法证明安全的声明 fail closed。
- 首次启动无项目时，创建工作区没有返回目标；Escape/Back 不应制造空白 Designer。
