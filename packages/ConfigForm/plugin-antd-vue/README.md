# @moluoxixi/config-form-plugin-antd-vue

ConfigForm 的 Ant Design Vue runtime adapter。核心包的字段组件默认使用 `modelValue/update:modelValue` 作为绑定协议；本 adapter 通过 `getDefaultField(field)` 生命周期把 Ant Design Vue 字段组件映射到对应的 `valueProp/trigger`，并通过 `readonlyAdapters` 提供只读展示映射。包名与 `createAntdVuePlugin` 保留既有命名，但它不是 Vue `app.use()` 插件。

adapter 不直接引入 `ant-design-vue`，只读取组件对象上的 `name`。字段已显式声明非默认绑定协议时不会被覆盖；默认 strict 模式下，组件名形如 Ant Design Vue 组件但没有映射时会直接抛错。Vue 函数组件必须先用 `asVueFunctionalComponent()` 包装再注册；若要复用内置绑定和只读映射，registry key 必须保持 `AInput` 等 canonical key，任意 alias 需要同时提供同 key 的 `bindings` 和 `readonlyAdapters`。

```vue
<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createAntdVuePlugin } from '@moluoxixi/config-form-plugin-antd-vue'
import Input from 'ant-design-vue/es/input'
import Switch from 'ant-design-vue/es/switch'

const runtime = {
  plugins: [
    createAntdVuePlugin(),
  ],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'name',
    component: Input,
    props: { placeholder: '请输入姓名' },
  }),
  defineField({
    field: 'enabled',
    component: Switch,
    defaultValue: true,
  }),
]
</script>

<template>
  <ConfigForm :fields="fields" :runtime="runtime" />
</template>
```

内置映射覆盖常见输入类组件、选择类组件、日期时间组件、`Switch`、`Checkbox`、`CheckboxGroup` 和 `RadioGroup`。需要扩展或覆盖时传入 `bindings`：

```ts
createAntdVuePlugin({
  strict: true,
  bindings: {
    ATransfer: {
      valueProp: 'targetKeys',
      trigger: 'update:targetKeys',
    },
  },
})
```

只读态同样按组件名注册，核心不会把 `readonly` 语义写回组件 props，而是直接渲染展示值。默认适配器已经覆盖常见输入、选择、开关和分组组件；没有适配器时会回退为原始值文本。

```ts
createAntdVuePlugin({
  readonlyAdapters: {
    ATransfer: ({ value }) => String(value),
  },
})
```
