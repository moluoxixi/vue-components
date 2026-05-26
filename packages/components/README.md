# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包转发 `@moluoxixi/config-form`，并提供从旧组件库迁入的常用 Element Plus 辅助组件。

```ts
import { ConfigForm, defineField } from '@moluoxixi/components'
```

```ts
import {
  ConfigForm,
  DateRangePicker,
  defineField,
  EnterNextContainer,
  PopoverTableSelect,
} from '@moluoxixi/components'
```

样式统一通过样式入口引入：

```ts
import '@moluoxixi/components/styles'
```
