# @config-form/workbench

Workbench 是当前仓库内部的 Project 编辑、Preview、源码导出和集成验证应用。它是
ConfigForm Studio 的演进基线，不应被业务应用作为运行时依赖导入。Surface Foundation
已将持久化、Preview 与缓存切换为 Surface；源码生成和只读查看由独立
`@moluoxixi/config-form-source` 包提供。

## 当前实现

- 组合公开的 Model、Compiler、Vue backend、Runtime、Designer 与 provider adapter。
- `ProjectDocument v6`、持久化、Preview Runtime Host、缓存和 Source generator 都以
  Surface 为身份；默认 Designer Inspector 只有 `properties` 与 `validation`。
- Preview 验证结构、布局、绑定、校验、同步 reaction、Runtime Data Source 和
  readonly 行为，不复现未注入的宿主函数。
- 动态 Runtime Data Source 仍属于生产 Runtime 的代码态能力，不进入 Studio Demo 合同。
- 默认导出直接使用 Vue 与目标 UI 组件的原始工程源码；第二种导出只组合公开
  ConfigForm adapter、Headless model 与绑定配置。两者都不生成 `src/runtime/**`，也不
  复制 Compiler、Prototype Runtime、事件注册表或业务函数桩。

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

## 目标 Studio 责任

演进完成后，Studio 应用壳拥有项目管理、Page/Dialog/Drawer/Dataset/Resource 资产树、
Design/Experience 切换、IndexedDB、项目 JSON 导入导出，以及 Source 弹窗中的重新
生成、复制、单文件下载、ZIP 和通知。

当前边界中：

- Designer 只编辑当前 `SurfaceAsset`。
- `@moluoxixi/config-form-prototype-runtime` 统一执行页面历史、overlay instance 栈、
  参数/结果事务和主要 UI 动作；Studio Preview 不复制该 reducer。
- Studio 作者体验只使用静态 Dataset；现有动态 Runtime Data Source 作者 UI 将从
  Studio 移除，但生产 Runtime 的代码态 Data Source 能力保留。
- `@moluoxixi/config-form-source` 拥有无 DOM Generator、SourceFileSet、文件树模型和
  只读 Viewer；Studio 在组合根分别注入同步 provider component resolver 与异步
  Resource reader，并保留所有宿主命令。
- Viewer 桌面显示左文件树和右源码，窄屏切换 tree/code；Monaco 仅在 Viewer 内
  异步加载。Viewer 不拥有弹窗、复制、下载、ZIP、通知或持久化。

Surface Foundation、Prototype Runtime 与 Source 已是当前可导入 API；资产树、Dataset
编辑器和 Interactions Inspector 仍是后续迁移责任。实现状态以
[路线图](../ROADMAP.md) 为准。

## 当前合同

持久化、Registry、Canonical IR、Preview transport 与 `SourceFileSet v1` 只接受各自
精确的 JSON-safe 当前版本。旧、未来、缺失、畸形或混合版本均 fail closed；不提供
迁移器、兼容别名、deprecated wrapper 或双读。

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
