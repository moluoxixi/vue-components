# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

本包只维护通用业务组件。ConfigForm 由 `@moluoxixi/config-form`、`@moluoxixi/config-form-headless`、`@moluoxixi/config-form-element` 和 `@moluoxixi/config-form-antd-vue` 等专用包提供；本包不重复包装或转发这些入口。

```ts
import {
  ConfigTable,
  DateRangePicker,
  EnterNextContainer,
  PopoverTableSelect,
  RequestCascader,
  RequestSelectV2,
  RequestTreeSelect,
} from '@moluoxixi/components'
```

样式统一通过样式入口引入：

```ts
import '@moluoxixi/components/styles'
```

## 自动按需加载

`@moluoxixi/components/auto-loaders` 子路径提供 `unplugin-vue-components` 与 `unplugin-auto-import` 的官方接入配置。它不经过组件根入口，也不会在 Vite 配置期加载组件运行时：

```bash
pnpm add -D unplugin-auto-import unplugin-vue-components
```

```ts
// vite.config.ts
import { autoComponent, autoImport } from '@moluoxixi/components/auto-loaders'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default {
  plugins: [AutoImport({ imports: [autoImport] }), Components({ resolvers: [autoComponent] })],
}
```

`autoComponent` 只解析公开组件，并从对应组件子入口按需导入，同时加载 `@moluoxixi/components/styles`。`autoImport` 按 `CopyText`、`HeadlessTable` 等最小子入口注入运行时 API，避免一个工具函数把根 barrel 带入首包；TypeScript 类型仍需使用 `import type` 显式导入。

## 请求缓存组件

`RequestSelectV2`、`RequestCascader`、`RequestTreeSelect`、`ConfigTable` 和 `PopoverTableSelect` 的 `query` 模式基于 `@moluoxixi/hooks` 与 TanStack Vue Query。宿主应用需要提供唯一 `QueryClient`：

```ts
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

app.use(VueQueryPlugin, {
  queryClient: new QueryClient(),
})
```

选项组件固定接收 `query(params)`，并把 `params` 放进缓存 key。表格组件固定接收 `query({ ...params, currentPage, pageSize })`，并把 `params`、`currentPage`、`pageSize` 放进缓存 key。

`params` 必须是稳定、可序列化的普通对象；不要传入函数、DOM、组件实例、循环引用或会在渲染期间频繁重建且语义不变的对象。
