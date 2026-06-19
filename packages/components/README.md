# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包聚合转发 `packages/ConfigForm/*` 下的轻量配置表单包，并提供从旧组件库迁入的常用 Element Plus 辅助组件。ConfigForm 的公共协议和三个 UI 实现不在本包内维护。

```ts
import { defineField, ElementConfigForm } from '@moluoxixi/components'
```

```ts
import {
  AntdConfigForm,
  antdConfigForm,
  ConfigTable,
  DateRangePicker,
  defineField,
  ElementConfigForm,
  EnterNextContainer,
  PopoverTableSelect,
  RequestCascader,
  RequestSelectV2,
  RequestTreeSelect,
  ShadcnConfigForm,
} from '@moluoxixi/components'
```

`ElementConfigForm` 直接使用 `ElForm` / `ElFormItem` 渲染，`antdConfigForm` 直接使用 `AForm` / `AFormItem` 渲染，`ShadcnConfigForm` 使用本地 form 壳渲染 label/error。三者都支持 `defineField` / `defineFields`、容器节点和配置化 slots；它们不接入 schema、runtime plugin 或自定义 FormItem。

样式统一通过样式入口引入：

```ts
import '@moluoxixi/components/styles'
```

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
