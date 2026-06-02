# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包提供基于 Element Plus、Ant Design Vue 和 shadcn-vue 的轻量配置表单，并提供从旧组件库迁入的常用 Element Plus 辅助组件。

```ts
import { defineField, ElementConfigForm } from '@moluoxixi/components'
```

```ts
import {
  AntdConfigForm,
  antdConfigForm,
  DateRangePicker,
  defineField,
  ElementConfigForm,
  EnterNextContainer,
  PopoverTableSelect,
  ShadcnConfigForm,
} from '@moluoxixi/components'
```

`ElementConfigForm` 直接使用 `ElForm` / `ElFormItem` 渲染，`antdConfigForm` 直接使用 `AForm` / `AFormItem` 渲染，`ShadcnConfigForm` 使用本地 form 壳渲染 label/error。三者都支持 `defineField` / `defineFields`、容器节点和配置化 slots；它们不接入 schema、runtime plugin 或自定义 FormItem。

样式统一通过样式入口引入：

```ts
import '@moluoxixi/components/styles'
```
