# Canonical Config 导出

Config 用于在业务 Vue 应用中集成 `ConfigFormRenderer`，不是独立 Source 工程，也不是可执行的用户配置语言。导出只包含 JSON-safe Canonical 数据和固定的可信集成代码，不复制组件库、设计器、源码模板或业务 action 实现。

## 当前公开格式

- `project.config.ts`：`project` 保存完整项目编译 identity、origin、Schema/IR 版本、Registry snapshot/lock、environment、settings、resources、页面顺序和路由；`pageConfigs` 是按稳定 pageId 索引的真实页面模块导入映射。
- `pages/<目录>/form.config.ts`：`pageCompilation` 是公开 Compiler 生成的完整 `PageCompilation`，包括 snapshot identity、Registry usage、Canonical page identity 和 `CanonicalPageIR`。
- `plan` 是 `ConfigFormPageRuntimePlan`：保留编译 Flow plans、valueSchema、page.runtime 和 optionBindings。Flow 的 semantic hash 保留在 `pageCompilation.page.flows`；设计坐标不属于执行 IR。
- `initialValues` 只由 Core `createConfigFormValueScopeStore` 的正式默认投影产生。两个对象中的同名字段互不覆盖，字段名中的点号仍是一个键；数组按 minItems 和后代声明得到自然初值。未声明默认值的字段保持 missing，不猜测空字符串、0、false 或空数组；瞬态 rowId 不进入这些数据。
- `requiredBindings` 列出组件、custom validator、宿主 Flow action 和数据源请求能力的 ref、pageId、nodeId、flowId/sourceId（适用时）及精确路径。可信函数不进入这些数据。
- `createRendererConfig(resolver, host?)` 调用公开 Vue backend `compileCanonicalPageRuntime`，返回可直接传给 Renderer 的 `RuntimeRendererConfig`。`host` 的类型为 `RuntimeHostBindings`，包含 `flowActions` 和 `dataSourceHost`。条件、校验、readonly、字段事件、作用域和布局均由正式 backend 降低；每次调用得到独立的 `defaultValues`。

## 业务集成

业务应用需要安装互相匹配的 `vue`、`@moluoxixi/config-form`、`@moluoxixi/config-form-headless`、`@moluoxixi/config-form-core`、`@moluoxixi/config-form-compiler`、`@moluoxixi/config-form-vue-backend`，以及实际使用的组件库和 validator 依赖。类型和运行时都使用公开包入口；不要导入 Workbench 或包的私有源码路径。

下面的业务组件接收可信宿主注册器，使用同一个同步 model port：

```vue
<script setup lang="ts">
import type { RuntimeBindingResolver, RuntimeHostBindings } from './pages/home/form.config'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createConfigFormModel } from '@moluoxixi/config-form-headless'
import { shallowRef } from 'vue'
import { createRendererConfig } from './pages/home/form.config'

const props = defineProps<{
  resolver: RuntimeBindingResolver
  host?: RuntimeHostBindings
}>()
const renderer = createRendererConfig(props.resolver, props.host)
const values = shallowRef<Record<string, unknown>>({})
const model = createConfigFormModel(values)
</script>

<template>
  <ConfigFormRenderer v-bind="renderer" :model="model" />
</template>
```

`RuntimeBindingResolver` 扩展公开 `VueRuntimeBindingResolver`，增加 `adapter`、`adapterVersion`、`registryFingerprint`。这些值必须来自业务实际部署的可信 Registry，不能直接复制导出文件中的 identity 来掩盖组件版本不一致。每个 `resolveBinding` 返回真实 Vue 组件（或已注册组件键）、kind、contractVersion、contractFingerprint 及其 valueProp/trigger/blurTrigger/readonlyRender 等协议；`resolveValidator` 返回可信 custom validator。

一个应用可以通过 `pageConfigs[pageId].createRendererConfig(...)` 选择页面；页面模块导入本身不会创建 Renderer 实例、执行 Flow 或发送请求。每个挂载实例仍需自己的 model。回填通过该 model 同步写入，reset/validation/submit 使用 Renderer 的公开 expose API。

## 能力与失败边界

- 导出时检查 source resolver 的 adapter/version/fingerprint 和所有实际使用组件的契约身份。此 resolver 只检查可导出性，不将 source binding 默认值当作业务默认值。
- factory 再次检查业务 Runtime resolver 的 Registry identity。Vue backend 原始诊断 code、nodeId、path、severity 不会被吞掉；`ConfigRuntimeBindingError.diagnostics` 增加 pageId。
- Config 不打包 action 的模块源码。业务必须通过 `host.flowActions.get(ref)` 提供 `requiredBindings` 中列出的 action；缺失或没有 execute 函数时 factory 抛出 `CONFIG_RUNTIME_ACTION_BINDING_UNAVAILABLE`，包含 flowId 和步骤路径，不会带缺失 action 挂载。Renderer 自带的 field.set、variable.set、field.state、form.validate/submit/reset 和 dataSource.load 无需业务重复实现。
- 声明数据源的页面必须提供 `host.dataSourceHost.request`；缺失时 factory 抛出 `CONFIG_RUNTIME_DATA_SOURCE_HOST_MISSING`，包含 sourceId 和请求定义路径。请求、导航、消息等副作用必须显式提供；Config 不创建全局 fetch 适配器，也不在导入/设计阶段执行请求。
- 不对配置字符串使用 eval、Function 或任意 JS 解释器。危险对象键由 Model/导出序列化边界拒绝，脚本结束标签和 Unicode 行分隔符安全转义。业务只导入本次生成的可信 TS 模块，不把外部上传的任意 TS 当成配置执行。
- 不要分别修改导出 plan、pageCompilation 或另配其他 revision 的字段。结构修改应通过 Project 重新编译并整体导出；运行值通过 model 改变。

## 破坏性变更

旧的 `PageFormValues`、`defineFields/defineField` 字段源码、模块级 `fields`、raw `flows`、`graph`、`form` 导出已移除，无兼容别名、旧格式读取器或自动迁移。原有调用方改为消费 `createRendererConfig`；字段、form 与 graph props 等可审计数据位于 `pageCompilation.page`，运行计划位于 `plan`。Config 是业务集成产物，不是 ProjectDocument 的作者态回导格式。

## 验证

从仓库根目录执行：

```sh
pnpm --dir packages/ConfigForm/workbench test src/project/__tests__/config-runtime-parity.test.ts src/project/__tests__/canonical-config-export.test.ts src/project/__tests__/export-snapshot.test.ts src/project/__tests__/export-serialization.test.ts
pnpm --dir packages/ConfigForm/workbench typecheck
```

`config-runtime-parity.test.ts` 编译并执行实际生成的 TS 导入闭包，仅注入真实公开 Vue backend，挂载真实 `ConfigFormRenderer`，与直接编译同一 Project 的 Renderer 比较。覆盖 committed/draft 身份、对象与两层数组初值、missing/default、字面字段键、校验、readonly、reset、Flow 值引用与事件、宿主绑定缺失、带请求参数的真实 scoped options、Renderer builtin、危险文本和导入/设计阶段无请求。
