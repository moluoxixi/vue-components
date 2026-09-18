# @config-form/workbench

Workbench 是仓库内部的 Project 编辑、Preview、静态 Source/Config 导出和集成验证应用，不是公开的低代码运行平台。

## 当前边界

- Runtime 是 ConfigForm 的主产品；Workbench 只组合公开的 Model、Compiler、Vue backend、Runtime 和 Designer 包。
- Designer Inspector 只提供 `properties` 与 `validation` 两个默认区域。Workbench 不提供事件编辑、事件转发、动作注册器或流程编排入口。
- 复杂组件逻辑由宿主 Vue/TypeScript 代码维护，使用运行时内存中的 `props.onX` 函数。函数不进入 ProjectDocument、IndexedDB、Preview transport 或 Source 导出。
- Preview 用于验证结构、布局、绑定、校验、同步 reaction、Data Source 和 readonly 行为。Preview 不承诺复现未注入的宿主函数。
- Source/Config 导出只生成 JSON-safe 静态结构和可信的公开包导入，不生成 handler stub、字符串 action 引用或事件元数据。

## 运行路径

`ProjectDocument` 经过公开 Compiler 生成 `CanonicalProjectIR`，再由 Vue backend 生成可传给 `ConfigFormRenderer` 的运行配置。每个 Preview iframe 都有独立的 Runtime Host 实例和 Data request 通道；Runtime Host 这个名称表示 iframe 渲染宿主，不表示事件总线。

业务集成应安装匹配版本的 `vue`、`@moluoxixi/config-form`、`@moluoxixi/config-form-headless`、`@moluoxixi/config-form-core`、`@moluoxixi/config-form-compiler`、`@moluoxixi/config-form-vue-backend` 和实际使用的 UI adapter。

```ts
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { createRendererConfig } from './pages/home/form.config'

const renderer = createRendererConfig(resolver, { dataSourceHost })
const model = createConfigFormModel(values)

// 复杂逻辑在宿主配置中组合，不写入 ProjectDocument：
const runtimeConfig = {
  ...renderer,
  fields: renderer.fields.map(field =>
    field.id === 'save' ? { ...field, props: { ...field.props, onClick: saveDraft } } : field,
  ),
}
```

## 当前合同

持久化、Registry、Canonical IR、Preview transport 和 Source generator 只接受当前 JSON-safe 合同。旧、未来、缺失或混合版本均 fail closed；不提供迁移器、兼容别名、deprecated wrapper 或双读。

Workbench 是 private workspace package，不应被业务应用作为运行时依赖导入。生产应用直接使用 Runtime/Headless 和宿主代码态配置。

## 验证

```sh
pnpm --filter @config-form/workbench test
pnpm --filter @config-form/workbench typecheck
pnpm --filter @config-form/workbench build
pnpm --filter @config-form/workbench verify:templates
```

长期产品边界见 [../PRODUCT.md](../PRODUCT.md)，架构入口见 [../README.md](../README.md)。
