# @config-form/workbench

Workbench 是当前仓库内部的 Project 编辑、Preview、源码导出和集成验证应用。它是
ConfigForm Studio 的演进基线，不应被业务应用作为运行时依赖导入。Surface Foundation
已将持久化、Preview 与缓存切换为 Surface；源码生成和只读查看由独立
`@moluoxixi/config-form-source` 包提供。

## 当前实现

- 组合公开的 Model、Compiler、Vue backend、Runtime、Designer 与 provider adapter。
- 应用壳是真正的路由应用，层级为**项目 › 页面 › 表单设计器**：`/projects`（项目管理）、
  `/projects/new|import`（新建项目）、`/projects/:projectId/pages`（页面管理）、
  `/projects/:projectId/pages/new`（新建页面）、`/projects/:projectId/pages/:pageId/design`
  （该页面的表单设计器）各自独立成路由。设计器属于页面而非项目，`pageId` 承载三类
  Surface（page/dialog/drawer）的 id，页面管理同时列这三类。
- **项目管理与页面管理是两个平级的管理台**，都渲染共享的 `ManagementShell` 侧边导航：
  任一屏都能一键到达另一屏，当前屏带 `aria-current="page"`。页面管理是唯一需要项目的
  管理台，它的导航命令会打开当前项目或最近更新的项目，工作区为空时给出提示而不是静默失败。
  两个管理台各自只负责自己的创建入口：**项目管理创建项目，页面管理只创建页面**（新建项目
  会切换当前项目且不可撤销，新建页面是当前项目内一条可撤销命令，因此不放在同一屏）。
  设计器保留自己的外壳，不渲染该导航。
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
- 动态 Runtime Data Source 仍属于生产 Runtime 的代码态能力，不进入 Studio Demo 合同。
- 默认导出直接使用 Vue、Vue Router 与目标 UI 组件的原始工程源码，Required 与
  RuleSet v2 是工程内可读校验代码；它不依赖 ConfigForm、Zod、`@moluoxixi/*`、
  `@config-form/*` 或内部 Runtime。第二种导出只组合公开 ConfigForm adapter、
  Headless model 与绑定配置。两者都不生成 `src/runtime/**`，也不复制 Compiler、
  Prototype Runtime、事件注册表或业务函数桩。
- Raw 与 ConfigForm binding 使用同一 pinned compilation 独立生成、独立失败；弹窗按
  mode 展示文件或 diagnostics，仅禁用失败 mode 的复制和下载，另一个 mode 仍可用。
- 源码弹窗可在 CSS 与 Tailwind v4 之间切换；该选择只属于当前导出会话，不写入
  ProjectDocument。两种样式后端都同时适用于 Raw 与 ConfigForm binding，并保持两种
  源码模式各自独立失败。

复杂组件逻辑由宿主 Vue/TypeScript 代码维护，使用内存 config 的 `props.onX`。函数
不进入 ProjectDocument、IndexedDB、Preview transport 或 Source，也不通过 iframe
转发。

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
- Studio 作者体验只使用静态 Dataset；现有动态 Runtime Data Source 作者 UI 将从
  Studio 移除，但生产 Runtime 的代码态 Data Source 能力保留。
- `@moluoxixi/config-form-source` 拥有无 DOM Generator、SourceFileSet、文件树模型和
  只读 Viewer；Studio 在组合根分别注入同步 provider component resolver、独立的
  ConfigForm binding resolver 与异步 Resource reader。Raw 不接收 binding resolver；
  Studio 保留所有宿主命令。
- Viewer 桌面显示左文件树和右源码，窄屏切换 tree/code；Monaco 仅在 Viewer 内
  异步加载。Viewer 不拥有弹窗、复制、下载、ZIP、通知或持久化。

Surface Foundation、Prototype Runtime、Source、资产树、Dataset/Resource 编辑器、
主题和 Interactions Inspector 均已接入当前 Studio。实现状态以
[路线图](../ROADMAP.md) 为准。

## 当前合同

持久化、Registry、Canonical IR、Preview transport 与 `SourceFileSet v1` 只接受各自
精确的 JSON-safe 当前版本。当前校验链路是 RuleSet v2、ProjectDocument v8、
SurfaceGraph v3、Canonical IR v7 和 Compiler 8.0.0；字段 Required 独立于 RuleSet。
旧、未来、缺失、畸形或混合版本均 fail closed；不提供迁移器、兼容别名、deprecated
wrapper 或双读。

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

目标产品边界见 [PRODUCT.md](../PRODUCT.md)，架构入口见 [README.md](../README.md)。
