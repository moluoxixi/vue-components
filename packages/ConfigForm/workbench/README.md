# @config-form/workbench

Workbench 是仓库内部的 ConfigForm Studio UI 设计应用与集成验证入口，不应被业务应用
作为运行时依赖导入。首页“创建表单”从模板直接进入设计并自动创建项目；“新建项目”用于
先组织多页面工程。代码态表单开发直接使用 [Runtime adapters](../README.md)，不经过此工作台。
项目配置持续保存设计决定，设计、体验预览与源码交付共享同一模型。
源码生成和只读查看由独立 `@moluoxixi/config-form-source` 包提供。

## 当前实现

- 设计、体验、交付分别聚焦作者操作、实际运行和源码交接。`Ctrl/Cmd+K` 打开命令中心；
  底部问题面板汇总编译、设计、运行和导出诊断并定位字段/资产。
- 物料支持最近使用/收藏，大纲可筛选和折叠；三断点对照直接运行同一编译结果，布局复制
  以一个命令修改目标断点。体验检查器显示实例值、触碰与错误状态，并可重置会话。
- Dataset 支持表格分页/筛选、CSV/JSON 导入、可视映射和查询预览。未保存的单元格及映射
  草稿在当前会话内按数据集保留，切换或关闭面板不会丢失，刷新页面会丢弃未提交草稿。
- 平面 JSON Schema 先展示字段/校验映射与不支持项，再一次性插入，可整体撤销。
  内置目录提供两套 adapter 的审批和问卷页面。验收场景见 [验证文档](../docs/verification.md)。

- 组合公开的 Model、Compiler、Vue backend、Runtime、Designer 与 provider adapter。
- 应用壳是真正的路由应用，层级为**项目 › 页面 › 表单设计器**：`/projects`（项目管理）、
  `/projects/new|import`（新建项目）、`/projects/:projectId/pages`（页面管理）、
  `/projects/:projectId/pages/new`（新建页面）、`/projects/:projectId/pages/:pageId/design`
  （该页面的表单设计器）各自独立成路由。设计器属于页面而非项目，`pageId` 承载三类
  Surface（page/dialog/drawer）的 id，页面管理同时列这三类。
- **页面管理属于一个明确选择的项目**。全局入口只有项目管理，因此不渲染侧边菜单；
  用户从项目卡片进入该项目的页面管理，顶部以项目名称为主标题，使用“返回项目”切换工程。
  页面管理只接收当前项目，搜索、新建、导入、编辑与导出页面都限定在该项目中；不自动选择
  最近项目。带项目 id 的链接可刷新或直接打开，无项目上下文的路径返回项目列表。
  **项目管理创建项目，页面管理只创建页面**：新项目为空，新建页面是项目内可撤销命令。
- 哈希历史让刷新、分享链接和浏览器前进后退都能还原同一项目与同一页面；路由模块位于
  `src/app/router`，URL 与工作区状态由 `useWorkbenchRouteSync` 双向同步，懒加载 features
  仍只接收命令与事件、不直接依赖路由。
- `ProjectDocument v8`、`SurfaceGraph v3`、RuleSet v2、Canonical IR v7、Compiler
  8.0.0、持久化、Experience Runtime Host、缓存和 Source generator 都以 Surface 为
  身份；Designer Inspector 提供 `properties`、`validation` 与 `interactions`。
- Studio 首屏管理本地项目，项目内资产树管理 Page/Dialog/Drawer/Dataset/Resource；
  Dataset 支持 JSON/表格编辑和导入导出，Resource 支持 URL/embedded 内容，主题与所有
  作者变更进入同一历史、自动保存和刷新恢复链。
- Preview 验证结构、布局、绑定、校验、同步 reaction、Runtime Data Source 和
  readonly 行为，不复现未注入的宿主函数。
- 动态 Runtime Data Source 属于生产 Runtime 的代码态能力，不进入 Studio 设计文档。
- 默认导出直接使用 Vue、Vue Router 与目标 UI 组件的原始工程源码，Required 与
  RuleSet v2 是工程内可读校验代码；它不依赖 ConfigForm、`@moluoxixi/*`、
  `@config-form/*` 或内部 Runtime。第二种导出只组合公开 ConfigForm adapter、
  Headless model 与绑定配置。Tailwind v4 原生工程的部分校验使用 Zod。绑定产物是集成代码包，
  不是独立应用；默认打开当前页面配置，使用方法随 `README.md` 导出。两者都不生成 `src/runtime/**`，也不复制 Compiler、
  Prototype Runtime、事件注册表或业务函数桩。
- Raw 与 ConfigForm binding 使用同一 pinned compilation 独立生成、独立失败；弹窗按
  mode 展示文件或 diagnostics，仅禁用失败 mode 的复制和下载，另一个 mode 仍可用。
- 源码弹窗可在 CSS 与 Tailwind v4 之间切换；该选择只属于当前导出会话，不写入
  ProjectDocument。两种样式后端都同时适用于 Raw 与 ConfigForm binding，并保持两种
  源码模式各自独立失败。

复杂组件逻辑由宿主 Vue/TypeScript 代码维护，使用内存 config 的 `props.onX`。函数
不进入 ProjectDocument、IndexedDB、Preview transport 或 Source，也不通过 iframe
转发。

## 工作台样式与手机适配

- 工作台使用 Tailwind v4，模板负责普通布局，组件样式中的 `@apply` 负责状态选择器和 Element Plus 内部结构。扫描范围仅为 `app`、`features`、`components` 下的 Vue 文件；不启用 Preflight，不注入 Runtime Host。
- 根字号保持 `100%`，默认 16px。布局间距只使用 `0`、`1`、`2`、`3`、`4` 档，对应 `0`、`0.25rem`、`0.5rem`、`0.75rem`、`1rem`；例如 `gap-2`、`p-4`。标题与首个内容区保持 `1rem`。浏览器字号偏好和页面缩放继续生效。
- 使用响应式布局、`dvh` 和 `safe-area-inset-*` 处理手机宽度、横屏与系统安全区。安全区是设备占位，不计入内容间距上限。触屏输入控件使用 `1rem` 字号；支持的浏览器在软键盘弹出时调整内容视口。
- 不引入根据屏宽修改根字号的脚本或全局 px 转 rem 插件，避免影响设计文档中的尺寸以及预览、导出表单的实际布局。
- `pnpm test:e2e --project=phone-chromium --project=phone-webkit` 验证 320、360、375、390、414、430px 竖屏、844×390 横屏与安全区。属于浏览器模拟验证，发布前仍可补充真机软键盘检查。

## 当前运行路径

`ProjectDocument` 经过 Compiler 生成 `CanonicalProjectIR`，再由 Vue backend 生成
可传给 `ConfigFormRenderer` 的运行配置。每个 Preview iframe 有独立 Runtime Host；
Experience 模式由共享 Prototype Runtime 按 `instanceId` 管理 Surface 状态，Host v7
只传递严格的 Design/Experience 消息，不提供 Data request 或组件事件转发通道。

```ts
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createRendererConfig } from './pages/home/form.config'

const renderer = createRendererConfig(resolver, { dataSourceHost })
const model = createConfigFormModel(values)

const runtimeConfig = {
  ...renderer,
  fields: renderer.fields.map(field =>
    field.id === 'save' ? { ...field, props: { ...field.props, onClick: saveDraft } } : field,
  ),
}
```

## Studio 责任

Studio 应用壳拥有项目管理、Page/Dialog/Drawer/Dataset/Resource 资产树、
Design/Experience 切换、IndexedDB、项目 JSON 导入导出，以及 Source 弹窗中的重新
生成、复制、单文件下载、ZIP 和通知。

当前边界中：

- Designer 只编辑当前 `SurfaceAsset`。
- `@moluoxixi/config-form-prototype-runtime` 统一执行页面历史、overlay instance 栈、
  参数/结果事务和主要 UI 动作；Studio Preview 不复制该 reducer。
- Studio 设计体验使用静态 Dataset，生产 Runtime 的代码态 Data Source 能力独立保留。
- `@moluoxixi/config-form-source` 拥有无 DOM Generator、SourceFileSet、文件树模型和
  只读 Viewer；Studio 在组合根分别注入同步 provider component resolver、独立的
  ConfigForm binding resolver 与异步 Resource reader。Raw 不接收 binding resolver；
  Studio 保留所有宿主命令。
- Viewer 桌面显示左文件树和右源码，窄屏切换 tree/code；Monaco 仅在 Viewer 内
  异步加载。Viewer 不拥有弹窗、复制、下载、ZIP、通知或持久化。

Prototype Runtime、Source、资产树、Dataset/Resource 编辑器、主题和 Interactions
Inspector 均已接入当前 Studio。本轮范围和后续顺序见 [实施计划](../docs/implementation-plan.md)。

## 当前合同

持久化、Registry、Canonical IR、Preview transport 与 `SourceFileSet v1` 只接受各自
精确的 JSON-safe 当前版本。当前校验链路是 RuleSet v2、ProjectDocument v8、
SurfaceGraph v3、Canonical IR v7 和 Compiler 8.0.0；字段 Required 独立于 RuleSet。
旧、未来、缺失、畸形或混合版本均 fail closed；不提供迁移器、兼容别名、deprecated
wrapper 或双读。

工作区采用设计、体验、交付三个独立视图。体验使用 `PreviewWorkspace`，不再保留旧弹窗的
展开/恢复状态或兼容入口；页面预览和设计画布使用一致的内容内边距及设备宽度。

源码迁移采用同样硬切策略：旧 Workbench generator、文件树、Monaco editor、wrapper
和 re-export 已删除；Prototype Interaction 不转换成原始事件、动作链或 Flow。

## 验证

```sh
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
pnpm --filter @config-form/workbench test:e2e
```

产品定位与架构见 [文档索引](../docs/README.md)，包用法见 [ConfigForm 入口](../README.md)。

## 个人模板备份

模板库支持导入模板 JSON、备份全部个人模板，以及单个个人模板的导出。导出格式包含 manifest 和 surface；内置模板无需备份。导入前校验完整文件，全部合法后一次写入，失败时不留下半批模板。导入始终创建新副本，不覆盖同名或同 ID 的现有模板。

浏览器清理网站数据或更换设备前，可导出个人模板，再在目标浏览器导入。项目 JSON 与模板库 JSON 分别从对应入口导入。

## AI 对话与 MCP 实时预览

「AI 生成」连接 ConfigForm 本地工作区；「AI 修改」以已保存项目创建独立草稿。桌面同时显示对话和表单，手机可切换；每批修改可撤销，保存后继续设计或导出源码。浏览器独立模式会显示本地工作区启动入口，不会自动迁移或丢弃浏览器项目。服务配置、四种 API 格式和 MCP 接入见 [本地工作区说明](../local/README.md#对话与实时预览)。
