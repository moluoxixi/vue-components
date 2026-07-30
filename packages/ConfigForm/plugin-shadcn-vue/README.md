# @moluoxixi/config-form-plugin-shadcn-vue

ConfigForm 的 shadcn-vue runtime adapter。shadcn-vue 组件通常由业务项目生成到本地目录，本 adapter 不直接导入这些生成组件，只维护组件 key 到 ConfigForm 字段绑定协议的映射，并通过 `readonlyAdapters` 提供只读展示映射。包名与 `createShadcnVuePlugin` 保留既有命名，但它不是 Vue `app.use()` 插件。

## 使用

```vue
<script setup lang="ts">
import type { FormRuntimeOptions } from '@moluoxixi/config-form'
import { ConfigForm, defineField } from '@moluoxixi/config-form'
import { createShadcnVuePlugin } from '@moluoxixi/config-form-plugin-shadcn-vue'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

const runtime = {
  plugins: [
    createShadcnVuePlugin({
      components: {
        Input,
        NativeSelect,
        Textarea,
      },
    }),
  ],
} satisfies FormRuntimeOptions

const fields = [
  defineField({
    field: 'accountName',
    component: 'Input',
    props: { placeholder: '请输入账户名称' },
  }),
]
</script>

<template>
  <ConfigForm :fields="fields" :runtime="runtime" />
</template>
```

内置映射覆盖当前 ConfigForm shadcn-vue 示例使用的 `Input`、`NativeSelect` 和 `Textarea`。需要扩展或覆盖时传入 `bindings`：

```ts
createShadcnVuePlugin({
  components: { Slider },
  bindings: {
    Slider: {
      valueProp: 'modelValue',
      trigger: 'update:modelValue',
    },
  },
})
```

只读态按组件 key 注册。`NativeSelect` 会从字段 `props.options` 中读取候选项并展示 label；options 缺失或不是数组时回退当前 raw value，不抛渲染异常。文本类组件按原始值文本展示。默认 strict 模式下，传入 `components` 的组件 key 如果没有绑定映射会直接抛错，避免字符串组件能渲染但表单值协议错误。

```ts
createShadcnVuePlugin({
  readonlyAdapters: {
    NativeSelect: ({ value }) => String(value),
  },
})
```
