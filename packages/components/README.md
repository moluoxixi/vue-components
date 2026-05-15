# @moluoxixi/components

`@moluoxixi/components` 是 Moluoxixi 组件集合入口。

当前包先转发 `@moluoxixi/config-form`，后续新增组件会继续收敛到这个包下。

```ts
import { ConfigForm, defineField } from '@moluoxixi/components'
```

如需只引用 ConfigForm 相关能力，可以使用子入口：

```ts
import { ConfigForm, defineField } from '@moluoxixi/components/config-form'
import '@moluoxixi/components/config-form/styles'
```
