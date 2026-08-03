# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包维护 Element Plus、Ant Design Vue ConfigForm 的独立公共类型和薄适配器，并提供从旧组件库迁入的常用 Element Plus 辅助组件。ConfigForm 的状态与 Zod 校验收敛在 headless 层，Vue DOM、原生 Grid/Flex、字段壳和 ARIA 收敛在 `@moluoxixi/config-form/renderer`；本包保留两套 UI 的绑定预设、样式和就近测试。

```ts
import { defineFields, ElementConfigForm } from '@moluoxixi/components'

const { defineField } = defineFields<MyFormValues>()
```

```ts
import {
  AntdConfigForm,
  antdConfigForm,
  ConfigTable,
  DateRangePicker,
  ElementConfigForm,
  EnterNextContainer,
  PopoverTableSelect,
  RequestCascader,
  RequestSelectV2,
  RequestTreeSelect,
} from '@moluoxixi/components'
```

两套 ConfigForm 都使用原生 `<form>`、CSS Grid/Flex 和共享字段壳，不依赖 UI 库的 Form/FormItem/Row/Col。它们支持 headless 层的 `defineField` / `defineFields`、Zod schema、`validateOn` 的 change/blur 校验触发、容器节点、配置化 slots、readonly 与 `readonlyRender`，并透传 dirty/touched、`metaChange`、默认 slot `meta` 及 `getMeta` / `getFieldMeta` / `setTouched`。

需要只加载单一 UI 实现时，使用本包的纯入口：

```ts
import { AntdConfigForm } from '@moluoxixi/components/antd'
import { ElementConfigForm } from '@moluoxixi/components/element'
```

只消费无 UI 协议与 controller 时直接使用独立 headless 包：

```ts
import { createConfigFormController, defineFields } from '@moluoxixi/config-form-headless'
```

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
