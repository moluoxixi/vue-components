# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包在内部维护不含 runtime plugin 功能的 Element Plus、Ant Design Vue ConfigForm，并提供从旧组件库迁入的常用 Element Plus 辅助组件。两套 ConfigForm 直接由本包实现，不转发 runtime plugin 或其他 UI 实现；通用字段协议、节点工具和模型 controller 收敛在 headless 层，并由本包直接导出。

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

`ElementConfigForm` 直接使用 `ElForm` / `ElFormItem` 渲染，`antdConfigForm` 直接使用 `AForm` / `AFormItem` 渲染。两者都支持 headless 层的 `defineField` / `defineFields`、容器节点和配置化 slots；它们不接入 schema、runtime plugin 或自定义 FormItem。

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
